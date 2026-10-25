import cron from "node-cron";
import {
  closeDataSource,
  initializeDataSource,
} from "@api/config/initialize.js";
import { PostgresJobQueue } from "@api/modules/job/PostgresJobQueue.js";
import { JobType } from "@api/modules/job/jobTypes.js";
import { ParsingScheduler } from "@api/jobs/ParsingScheduler.js";
import { MaintenanceService } from "@api/jobs/MaintenanceService.js";

const timezone = process.env.SCHEDULER_TIMEZONE ?? "Europe/Kyiv";

async function runScheduled(
  name: string,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    console.log(`[scheduler] Starting ${name}`);
    await action();
    console.log(`[scheduler] Finished ${name}`);
  } catch (error) {
    console.error(`[scheduler] ${name} failed:`, error);
  }
}

async function main(): Promise<void> {
  await initializeDataSource();

  const queue = new PostgresJobQueue();
  const parsingScheduler = new ParsingScheduler(queue);
  const maintenanceService = new MaintenanceService();

  const tasks = [
    cron.schedule(
      "0 7 * * *",
      () =>
        void runScheduled("daily reparse", () =>
          parsingScheduler.enqueueDailyReparse(),
        ),
      { timezone },
    ),
    cron.schedule(
      "0 13 * * 6",
      () =>
        void runScheduled("weekly discovery", () =>
          parsingScheduler.enqueueWeeklyDiscovery(),
        ),
      { timezone },
    ),
    cron.schedule(
      "0 11 * * *",
      () =>
        void runScheduled("notification dispatch", async () => {
          await queue.enqueue({
            type: JobType.NotificationsDispatch,
            payload: { requestedAt: new Date().toISOString() },
          });
        }),
      { timezone },
    ),
    cron.schedule(
      "0 13 * * 0",
      () =>
        void runScheduled("weekly cleanup", () => maintenanceService.run()),
      { timezone },
    ),
  ];

  console.log(`[scheduler] Started with timezone ${timezone}`);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const task of tasks) {
      task.stop();
    }

    await closeDataSource();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("[scheduler] Failed to start:", error);
  process.exit(1);
});
