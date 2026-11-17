import { AppDataSource } from "@api/config/data-source.js";
import {
  EnqueueJobInput,
  JobStatus,
} from "@api/modules/job/jobTypes.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";

function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0] as T[];
  }

  return (result ?? []) as T[];
}

export interface JobFailureState {
  attempts: number;
  maxAttempts: number;
  final: boolean;
}

export class JobRecordStore {
  async create(input: EnqueueJobInput): Promise<number> {
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

  async claim(jobId: number, workerId: string): Promise<ParseJob | null> {
    // A worker may have crashed after claiming the row but before acking the
    // message. Allowing "processing" lets the redelivered message reclaim it.
    const result = await AppDataSource.query(
      `UPDATE "Parse_Jobs" AS job
       SET "status" = $3,
           "locked_at" = now(),
           "locked_by" = $2,
           "attempts" = job."attempts" + 1,
           "updated_at" = now()
       WHERE "id" = $1
         AND "status" IN ($4, $3)
       RETURNING job.*`,
      [jobId, workerId, JobStatus.Processing, JobStatus.Pending],
    );

    const rows = unwrapRows<ParseJob>(result);
    return rows[0] ?? null;
  }

  async complete(jobId: number): Promise<void> {
    await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = $2,
           "locked_at" = NULL,
           "locked_by" = NULL,
           "updated_at" = now()
       WHERE "id" = $1`,
      [jobId, JobStatus.Done],
    );
  }

  async fail(jobId: number, error: unknown): Promise<JobFailureState | null> {
    const message = error instanceof Error ? error.message : String(error);
    const result = await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = CASE
             WHEN "attempts" >= "max_attempts" THEN $2
             ELSE $3
           END,
           "available_at" = CASE
             WHEN "attempts" >= "max_attempts" THEN "available_at"
             ELSE now() + ("attempts" * interval '1 minute')
           END,
           "last_error" = $4,
           "locked_at" = NULL,
           "locked_by" = NULL,
           "updated_at" = now()
       WHERE "id" = $1
       RETURNING "attempts", "max_attempts", "status"`,
      [jobId, JobStatus.Failed, JobStatus.Pending, message],
    );

    const row = unwrapRows<{
      attempts: number;
      max_attempts: number;
      status: JobStatus;
    }>(result)[0];

    if (!row) {
      return null;
    }

    return {
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      final: row.status === JobStatus.Failed,
    };
  }

  async markFailed(jobId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = $2,
           "last_error" = $3,
           "locked_at" = NULL,
           "locked_by" = NULL,
           "updated_at" = now()
       WHERE "id" = $1`,
      [jobId, JobStatus.Failed, message],
    );
  }

  async releaseStale(olderThanMinutes: number): Promise<number> {
    const result = await AppDataSource.query(
      `UPDATE "Parse_Jobs"
       SET "status" = $2,
           "locked_at" = NULL,
           "locked_by" = NULL,
           "available_at" = now(),
           "updated_at" = now()
       WHERE "status" = $3
         AND "locked_at" < now() - ($1 * interval '1 minute')
       RETURNING "id"`,
      [olderThanMinutes, JobStatus.Pending, JobStatus.Processing],
    );

    return unwrapRows<{ id: number }>(result).length;
  }
}
