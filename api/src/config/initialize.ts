import "reflect-metadata";
import { AppDataSource } from "@api/config/data-source.js";

export async function initializeDataSource(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
