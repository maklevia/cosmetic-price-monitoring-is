import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getEnvOrThrow } from "@api/utils/getEnvOrThrow.js";
import { productRoutes } from "@api/modules/product/productRoutes.js";
import { notificationRoutes } from "@api/modules/notification/notificationRoutes.js";
import { channelRoutes } from "@api/modules/channel/channelRoutes.js";
import { userRoutes } from "@api/modules/user/userRoutes.js";
import { internalRoutes } from "@api/modules/internal/internalRoutes.js";
import { errorMiddleware } from "@api/middlewares/errorMiddleware.js";
import {
  closeDataSource,
  initializeDataSource,
} from "@api/config/initialize.js";

async function main(): Promise<void> {
  await initializeDataSource();

  const app = express();
  app.set("trust proxy", 1);

  const port = getEnvOrThrow("API_PORT");
  const corsOptions = {
    origin: [getEnvOrThrow("FE_ORIGIN")],
    credentials: true,
  };

  app.use(express.json());
  app.use(cors(corsOptions));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.send("API is running with TypeScript!");
  });

  app.use("/internal", internalRoutes);
  app.use("/product", productRoutes);
  app.use("/notification", notificationRoutes);
  app.use("/channel", channelRoutes);
  app.use("/user", userRoutes);

  app.use(errorMiddleware);

  const server = app.listen(port, () => {
    console.log(`[api] Server is running at http://localhost:${port}`);
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
  console.error("[api] Failed to start:", error);
  process.exit(1);
});
