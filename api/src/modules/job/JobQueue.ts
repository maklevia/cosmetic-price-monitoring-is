import { StoreName } from "@api/types/Enums.js";
import { EnqueueJobInput, JobType } from "@api/modules/job/jobTypes.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";

export interface ClaimJobsOptions {
  types: JobType[];
  store?: StoreName | null;
  workerId: string;
}

export interface JobQueue {
  enqueue(input: EnqueueJobInput): Promise<number>;
  claim(options: ClaimJobsOptions): Promise<ParseJob | null>;
  complete(jobId: number): Promise<void>;
  fail(jobId: number, error: unknown): Promise<void>;
  releaseStale(olderThanMinutes: number): Promise<number>;
}
