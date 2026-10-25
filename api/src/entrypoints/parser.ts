import os from "os";
import {
  closeDataSource,
  initializeDataSource,
} from "@api/config/initialize.js";
import { PostgresJobQueue } from "@api/modules/job/PostgresJobQueue.js";
import {
  JobType,
  parseStoreName,
} from "@api/modules/job/jobTypes.js";
import { ParserWorker } from "@api/jobs/ParserWorker.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";
import { StoreName } from "@api/types/Enums.js";
import { sleep } from "@api/utils/time.js";

const PARSER_JOB_TYPES = [
  JobType.ParseStoreRecord,
  JobType.DiscoveryMissingStore,
];

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}

function getParserDelayMs(store: StoreName | null): number {
  const configuredDelay = process.env.PARSER_DELAY_MS;

  if (configuredDelay) {
    const value = Number(configuredDelay);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("PARSER_DELAY_MS must be a non-negative number");
    }

    return value;
  }

  return store === StoreName.Notino ? 8000 : 2000;
}

async function main(): Promise<void> {
  await initializeDataSource();

  const queue = new PostgresJobQueue();
  const worker = new ParserWorker();
  const store = process.env.PARSER_STORE
    ? parseStoreName(process.env.PARSER_STORE)
    : null;
  const concurrency = readPositiveInt("PARSER_CONCURRENCY", 2);
  const pollMs = readPositiveInt("PARSER_POLL_MS", 1000);
  const workerName = `${os.hostname()}:${process.pid}:${store ?? "all"}`;

  const released = await queue.releaseStale(30);
  if (released > 0) {
    console.log(`[parser] Released ${released} stale jobs`);
  }

  let running = true;
  const loops = Array.from({ length: concurrency }, async (_, index) => {
    const workerId = `${workerName}:${index}`;

    while (running) {
      let job: ParseJob | null = null;

      try {
        job = await queue.claim({
          types: PARSER_JOB_TYPES,
          store,
          workerId,
        });
      } catch (error) {
        console.error(`[parser:${workerId}] Failed to claim a job:`, error);
        await sleep(pollMs * 5);
        continue;
      }

      if (!job) {
        await sleep(pollMs);
        continue;
      }

      try {
        await worker.process(job);
        await queue.complete(job.id);
        console.log(
          `[parser:${workerId}] Completed ${job.type} #${job.id} (${job.store})`,
        );
      } catch (error) {
        console.error(
          `[parser:${workerId}] Failed ${job.type} #${job.id}:`,
          error,
        );
        await queue.fail(job.id, error);
      }

      await sleep(getParserDelayMs(job.store));
    }
  });

  console.log(
    `[parser] Started ${concurrency} worker(s) for ${store ?? "all stores"}`,
  );

  const shutdown = () => {
    if (!running) return;
    running = false;
    console.log("[parser] Shutting down after current jobs finish...");
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await Promise.all(loops);
  await closeDataSource();
}

main().catch((error) => {
  console.error("[parser] Failed to start:", error);
  process.exit(1);
});
