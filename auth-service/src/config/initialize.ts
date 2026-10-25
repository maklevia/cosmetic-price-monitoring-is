import "reflect-metadata";
import { AuthDataSource } from "@auth/config/data-source.js";

export async function initializeDataSource(): Promise<void> {
  if (!AuthDataSource.isInitialized) {
    await AuthDataSource.initialize();
  }
}

export async function closeDataSource(): Promise<void> {
  if (AuthDataSource.isInitialized) {
    await AuthDataSource.destroy();
  }
}
