import os from "os";
import {
  closeDataSource,
  initializeDataSource,
} from "@api/config/initialize.js";
import { PostgresJobQueue } from "@api/modules/job/PostgresJobQueue.js";
import { JobType } from "@api/modules/job/jobTypes.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";
import { NotificationProcessor } from "@api/jobs/NotificationProcessor.js";
import { sleep } from "@api/utils/time.js";

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}

async function main(): Promise<void> {
  await initializeDataSource();

  const queue = new PostgresJobQueue();
  const processor = new NotificationProcessor();
  const pollMs = readPositiveInt("NOTIFIER_POLL_MS", 1000);
  const workerId = `${os.hostname()}:${process.pid}:notifier`;

  const released = await queue.releaseStale(30);
  if (released > 0) {
    console.log(`[notifier] Released ${released} stale jobs`);
  }

  let running = true;

  console.log("[notifier] Started");

  const shutdown = () => {
    if (!running) return;
    running = false;
    console.log("[notifier] Shutting down after the current job finishes...");
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  while (running) {
    let job: ParseJob | null = null;

    try {
      job = await queue.claim({
        types: [JobType.NotificationsDispatch],
        workerId,
      });
    } catch (error) {
      console.error("[notifier] Failed to claim a job:", error);
      await sleep(pollMs * 5);
      continue;
    }

    if (!job) {
      await sleep(pollMs);
      continue;
    }

    try {
      await processor.sendNotifications();
      await queue.complete(job.id);
      console.log(`[notifier] Completed job #${job.id}`);
    } catch (error) {
      console.error(`[notifier] Failed job #${job.id}:`, error);
      await queue.fail(job.id, error);
    }
  }

  await closeDataSource();
}

main().catch((error) => {
  console.error("[notifier] Failed to start:", error);
  process.exit(1);
});
