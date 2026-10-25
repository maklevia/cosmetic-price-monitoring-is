import { AppDataSource } from "@api/config/data-source.js";
import { EnqueueJobInput, JobStatus } from "@api/modules/job/jobTypes.js";
import { ClaimJobsOptions, JobQueue } from "@api/modules/job/JobQueue.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";

function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0] as T[];
  }

  return (result ?? []) as T[];
}

export class PostgresJobQueue implements JobQueue {
  async enqueue(input: EnqueueJobInput): Promise<number> {
    const result = await AppDataSource.query(
      `INSERT INTO "Parse_Jobs"
        ("type", "store", "payload", "max_attempts", "available_at")
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING "id"`,
      [
        input.type,
        input.store ?? null,
        JSON.stringify(input.payload ?? {}),
        input.maxAttempts ?? 3,
        input.availableAt ?? new Date(),
      ],
    );

    const rows = unwrapRows<{ id: number }>(result);
    return rows[0].id;
  }

  async claim(options: ClaimJobsOptions): Promise<ParseJob | null> {
    const storeClause = options.store ? "AND store = $3" : "";
    const params: unknown[] = [options.types, options.workerId];

    if (options.store) {
      params.push(options.store);
    }

    const result = await AppDataSource.query(
      `WITH next_job AS (
         SELECT "id"
         FROM "Parse_Jobs"
         WHERE "status" = '${JobStatus.Pending}'
           AND "available_at" <= now()
           AND "type" = ANY($1::text[])
           ${storeClause}
         ORDER BY "id"
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE "Parse_Jobs" AS job
       SET "status" = '${JobStatus.Processing}',
           "locked_at" = now(),
           "locked_by" = $2,
           "attempts" = job."attempts" + 1,
           "updated_at" = now()
       FROM next_job
       WHERE job."id" = next_job."id"
       RETURNING job.*`,
      params,
    );

    const rows = unwrapRows<ParseJob>(result);
    return rows[0] ?? null;
  }

  async complete(jobId: number): Promise<void> {
    await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = '${JobStatus.Done}',
           "locked_at" = NULL,
           "locked_by" = NULL,
           "updated_at" = now()
       WHERE "id" = $1`,
      [jobId],
    );
  }

  async fail(jobId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = CASE
             WHEN "attempts" >= "max_attempts" THEN '${JobStatus.Failed}'
             ELSE '${JobStatus.Pending}'
           END,
           "available_at" = CASE
             WHEN "attempts" >= "max_attempts" THEN "available_at"
             ELSE now() + ("attempts" * interval '1 minute')
           END,
           "last_error" = $2,
           "locked_at" = NULL,
           "locked_by" = NULL,
           "updated_at" = now()
       WHERE "id" = $1`,
      [jobId, message],
    );
  }

  async releaseStale(olderThanMinutes: number): Promise<number> {
    const result = await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = '${JobStatus.Pending}',
           "locked_at" = NULL,
           "locked_by" = NULL,
           "available_at" = now(),
           "updated_at" = now()
       WHERE "status" = '${JobStatus.Processing}'
         AND "locked_at" < now() - ($1 * interval '1 minute')
       RETURNING "id"`,
      [olderThanMinutes],
    );

    return unwrapRows<{ id: number }>(result).length;
  }
}
