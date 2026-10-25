import { StoreName } from "@api/types/Enums.js";

export enum JobType {
  ParseStoreRecord = "parse.store_record",
  DiscoveryMissingStore = "discovery.missing_store",
  NotificationsDispatch = "notifications.dispatch",
}

export enum JobStatus {
  Pending = "pending",
  Processing = "processing",
  Done = "done",
  Failed = "failed",
}

export interface ParseStoreRecordPayload {
  storeRecordId: number;
}

export interface DiscoveryMissingStorePayload {
  productId: number;
  name: string;
  brand: string;
}

export interface NotificationsDispatchPayload {
  requestedAt: string;
}

export interface EnqueueJobInput {
  type: JobType;
  store?: StoreName | null;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  availableAt?: Date;
}

export function parseStoreName(value: string): StoreName {
  if (!Object.values(StoreName).includes(value as StoreName)) {
    throw new Error(
      `Invalid store "${value}". Expected one of: ${Object.values(StoreName).join(", ")}`,
    );
  }

  return value as StoreName;
}
