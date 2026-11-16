import amqp from "amqplib";
import type {
  ChannelModel,
  ConfirmChannel,
  GetMessage,
  Options,
} from "amqplib";
import { StoreName } from "@api/types/Enums.js";
import { ClaimJobsOptions, JobQueue } from "@api/modules/job/JobQueue.js";
import { EnqueueJobInput, JobType } from "@api/modules/job/jobTypes.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";
import {
  JobRecordStore,
  type JobFailureState,
} from "@api/modules/job/JobRecordStore.js";
import { withSpan } from "@api/observability/spans.js";

const QUEUE_PREFIX = "cosmetics.jobs";
const RETRY_BASE_DELAY_MS = 60_000;

interface InflightJob {
  message: GetMessage;
  job: ParseJob;
  queue: string;
}

function readRabbitMqUrl(): string {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error("RABBITMQ_URL is required");
  }

  return url;
}

/**
 * RabbitMQ transport for background jobs. The Parse_Jobs table remains the
 * audit/state record. Workers use basic.get so the existing polling loops and
 * per-store concurrency stay unchanged. Delivery is at-least-once; messages are
 * acknowledged only after the audit row is updated.
 */
export class RabbitMqJobQueue implements JobQueue {
  private readonly records = new JobRecordStore();
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connectPromise: Promise<ConfirmChannel> | null = null;
  private readonly inflight = new Map<number, InflightJob>();
  private cursor = 0;

  constructor(private readonly url: string = readRabbitMqUrl()) {}

  async enqueue(input: EnqueueJobInput): Promise<number> {
    const channel = await this.ensureChannel();
    const jobId = await this.records.create(input);
    const queue = this.queueName(input.type, input.store ?? null);
    const delayMs = input.availableAt
      ? Math.max(0, input.availableAt.getTime() - Date.now())
      : 0;

    try {
      await withSpan(
        "rabbitmq.publish",
        {
          "messaging.system": "rabbitmq",
          "messaging.destination.name": queue,
          "messaging.operation": "publish",
          "job.id": jobId,
        },
        () => this.publishJob(channel, queue, jobId, delayMs),
      );
    } catch (error) {
      try {
        await this.records.markFailed(jobId, error);
      } catch (markError) {
        console.error(
          `[rabbitmq] Failed to mark job #${jobId} as failed:`,
          markError,
        );
      }

      throw error;
    }

    return jobId;
  }

  async claim(options: ClaimJobsOptions): Promise<ParseJob | null> {
    const channel = await this.ensureChannel();
    const queues = this.candidateQueues(options);

    if (queues.length === 0) {
      return null;
    }

    const start = this.cursor % queues.length;

    for (let offset = 0; offset < queues.length; offset += 1) {
      const queue = queues[(start + offset) % queues.length];
      const message = await channel.get(queue, { noAck: false });

      if (!message) {
        continue;
      }

      const jobId = this.readJobId(message);

      if (jobId === null) {
        this.ackMessage(channel, message);
        continue;
      }

      if (this.inflight.has(jobId)) {
        console.warn(
          `[rabbitmq] Dropping duplicate delivery for in-flight job #${jobId}`,
        );
        this.ackMessage(channel, message);
        continue;
      }

      let job: ParseJob | null;

      try {
        job = await withSpan(
          "rabbitmq.claim",
          {
            "messaging.system": "rabbitmq",
            "messaging.destination.name": queue,
            "messaging.operation": "receive",
            "job.id": jobId,
          },
          () => this.records.claim(jobId, options.workerId),
        );
      } catch (error) {
        this.requeueMessage(channel, message);
        throw error;
      }

      if (!job) {
        this.ackMessage(channel, message);
        continue;
      }

      this.inflight.set(job.id, { message, job, queue });
      this.cursor = (start + offset + 1) % queues.length;
      return job;
    }

    return null;
  }

  async complete(jobId: number): Promise<void> {
    try {
      await this.records.complete(jobId);
    } catch (error) {
      const entry = this.inflight.get(jobId);

      if (entry) {
        this.nack(entry, true);
      }

      throw error;
    }

    const entry = this.inflight.get(jobId);

    if (!entry) {
      console.warn(
        `[rabbitmq] No in-flight message for completed job #${jobId}`,
      );
      return;
    }

    this.ack(entry);
  }

  async fail(jobId: number, error: unknown): Promise<void> {
    let failure: JobFailureState | null;

    try {
      failure = await this.records.fail(jobId, error);
    } catch (recordError) {
      console.error(
        `[rabbitmq] Failed to record failure for job #${jobId}:`,
        recordError,
      );
      const entry = this.inflight.get(jobId);

      if (entry) {
        this.nack(entry, true);
      }

      return;
    }

    const entry = this.inflight.get(jobId);

    if (!entry) {
      console.warn(`[rabbitmq] No in-flight message for failed job #${jobId}`);
      return;
    }

    const channel = this.channel;

    if (!channel) {
      this.inflight.delete(jobId);
      return;
    }

    try {
      if (!failure) {
        this.ack(entry);
        return;
      }

      if (failure.final) {
        await this.publishToQueue(channel, `${entry.queue}.dlq`, jobId);
        console.warn(
          `[rabbitmq] Job #${jobId} moved to ${entry.queue}.dlq after ${failure.attempts} attempt(s)`,
        );
      } else {
        const delayMs = failure.attempts * RETRY_BASE_DELAY_MS;
        await this.publishToQueue(
          channel,
          `${entry.queue}.retry`,
          jobId,
          delayMs,
        );
        console.warn(
          `[rabbitmq] Job #${jobId} scheduled for retry ${failure.attempts}/${failure.maxAttempts} in ${delayMs}ms`,
        );
      }

      this.ack(entry);
    } catch (publishError) {
      console.error(
        `[rabbitmq] Failed to schedule retry/DLQ for job #${jobId}:`,
        publishError,
      );
      this.nack(entry, true);
    }
  }

  async releaseStale(olderThanMinutes: number): Promise<number> {
    return this.records.releaseStale(olderThanMinutes);
  }

  async close(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;
    this.inflight.clear();

    if (channel) {
      await channel.close().catch((error: unknown) => {
        console.error("[rabbitmq] Failed to close channel:", error);
      });
    }

    if (connection) {
      await connection.close().catch((error: unknown) => {
        console.error("[rabbitmq] Failed to close connection:", error);
      });
    }
  }

  private async ensureChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connect();
    }

    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connect(): Promise<ConfirmChannel> {
    const connection = await amqp.connect(this.url);
    const channel = await connection.createConfirmChannel();

    this.connection = connection;
    this.channel = channel;

    connection.on("error", (error) => {
      console.error("[rabbitmq] Connection error:", error);
    });

    connection.on("close", () => {
      if (this.connection === connection) {
        this.connection = null;
        this.channel = null;
        this.inflight.clear();
      }
    });

    channel.on("error", (error) => {
      console.error("[rabbitmq] Channel error:", error);
    });

    channel.on("close", () => {
      if (this.channel === channel) {
        this.channel = null;
        this.inflight.clear();
      }
    });

    try {
      await this.assertTopology(channel);
    } catch (error) {
      this.channel = null;
      this.connection = null;
      await connection.close().catch(() => undefined);
      throw error;
    }

    return channel;
  }

  private async assertTopology(channel: ConfirmChannel): Promise<void> {
    for (const queue of this.mainQueues()) {
      await channel.assertQueue(queue, { durable: true });
      await channel.assertQueue(`${queue}.retry`, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": queue,
        },
      });
      await channel.assertQueue(`${queue}.dlq`, { durable: true });
    }
  }

  private mainQueues(): string[] {
    const queues = new Set<string>();

    for (const type of Object.values(JobType)) {
      for (const store of this.storesFor(type)) {
        queues.add(this.queueName(type, store));
      }
    }

    return [...queues];
  }

  private storesFor(type: JobType): (StoreName | null)[] {
    if (type === JobType.NotificationsDispatch) {
      return [null];
    }

    return [...Object.values(StoreName), null];
  }

  private queueName(type: JobType, store: StoreName | null): string {
    return `${QUEUE_PREFIX}.${type}.${store ?? "all"}`;
  }

  private candidateQueues(options: ClaimJobsOptions): string[] {
    const queues = new Set<string>();

    for (const type of options.types) {
      const stores = options.store ? [options.store] : this.storesFor(type);

      for (const store of stores) {
        queues.add(this.queueName(type, store));
      }
    }

    return [...queues];
  }

  private readJobId(message: GetMessage): number | null {
    try {
      const payload = JSON.parse(message.content.toString()) as {
        jobId?: unknown;
      };
      const jobId = Number(payload.jobId);

      if (!Number.isInteger(jobId) || jobId <= 0) {
        throw new Error("jobId must be a positive integer");
      }

      return jobId;
    } catch (error) {
      console.warn(
        `[rabbitmq] Dropping malformed message from ${message.fields.routingKey}:`,
        error,
      );
      return null;
    }
  }

  private async publishJob(
    channel: ConfirmChannel,
    queue: string,
    jobId: number,
    delayMs: number,
  ): Promise<void> {
    if (delayMs > 0) {
      await this.publishToQueue(channel, `${queue}.retry`, jobId, delayMs);
      return;
    }

    await this.publishToQueue(channel, queue, jobId);
  }

  private async publishToQueue(
    channel: ConfirmChannel,
    queue: string,
    jobId: number,
    delayMs = 0,
  ): Promise<void> {
    const options: Options.Publish = {
      persistent: true,
      contentType: "application/json",
      messageId: String(jobId),
      timestamp: Date.now(),
    };

    if (delayMs > 0) {
      options.expiration = String(delayMs);
    }

    channel.publish(
      "",
      queue,
      Buffer.from(JSON.stringify({ jobId })),
      options,
    );
    await channel.waitForConfirms();
  }

  private ack(entry: InflightJob): void {
    try {
      this.channel?.ack(entry.message);
    } catch (error) {
      console.error(
        `[rabbitmq] Failed to acknowledge job #${entry.job.id}:`,
        error,
      );
    } finally {
      this.inflight.delete(entry.job.id);
    }
  }

  private nack(entry: InflightJob, requeue: boolean): void {
    try {
      this.channel?.nack(entry.message, false, requeue);
    } catch (error) {
      console.error(
        `[rabbitmq] Failed to reject job #${entry.job.id}:`,
        error,
      );
    } finally {
      this.inflight.delete(entry.job.id);
    }
  }

  private ackMessage(channel: ConfirmChannel, message: GetMessage): void {
    try {
      channel.ack(message);
    } catch (error) {
      console.error("[rabbitmq] Failed to acknowledge a message:", error);
    }
  }

  private requeueMessage(channel: ConfirmChannel, message: GetMessage): void {
    try {
      channel.nack(message, false, true);
    } catch (error) {
      console.error("[rabbitmq] Failed to requeue a message:", error);
    }
  }
}
