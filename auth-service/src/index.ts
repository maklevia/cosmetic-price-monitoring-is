import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "@auth/modules/auth/authRoutes.js";
import { errorMiddleware } from "@auth/middlewares/errorMiddleware.js";
import { getEnvOrThrow } from "@auth/utils/getEnvOrThrow.js";
import {
  closeDataSource,
  initializeDataSource,
} from "@auth/config/initialize.js";

async function main(): Promise<void> {
  await initializeDataSource();

  const app = express();
  app.set("trust proxy", 1);

  const port = getEnvOrThrow("AUTH_SERVICE_PORT");
  const corsOptions = {
    origin: [getEnvOrThrow("FE_ORIGIN")],
    credentials: true,
  };

  app.use(express.json());
  app.use(cors(corsOptions));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.send("Auth service is running");
  });

  app.use("/", authRoutes);
  app.use(errorMiddleware);

  const server = app.listen(port, () => {
    console.log(`[auth] Server is running at http://localhost:${port}`);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    server.close(async () => {
      await closeDataSource();
      process.exit(0);
    });
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("[auth] Failed to start:", error);
  process.exit(1);
});
