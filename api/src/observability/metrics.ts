import type { NextFunction, Request, Response } from "express";
import http from "node:http";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

//every process (api, scheduler, parser, notifier) uses its own registry.
export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: "cosmetics_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "cosmetics_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();
  const method = req.method;

  res.on("finish", () => {
    const routePath =
      typeof req.route?.path === "string" ? req.route.path : null;
    const route = routePath ? `${req.baseUrl}${routePath}` : "unmatched";

    httpRequestsTotal.inc({
      method,
      route,
      status: String(res.statusCode),
    });
    httpRequestDurationSeconds.observe(
      { method, route },
      Number(process.hrtime.bigint() - startedAt) / 1e9,
    );
  });

  next();
}

export const apiParseRequestsTotal = new Counter({
  name: "cosmetics_api_parse_requests_total",
  help: "Product parse requests started from the web UI",
  labelNames: ["store"],
  registers: [registry],
});

export const parserJobsTotal = new Counter({
  name: "cosmetics_parser_jobs_total",
  help: "Parser jobs finished by type and status",
  labelNames: ["type", "status"],
  registers: [registry],
});

export const parserJobDurationSeconds = new Histogram({
  name: "cosmetics_parser_job_duration_seconds",
  help: "Time spent processing one parser job",
  labelNames: ["type"],
  buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const parserStoreRequestsTotal = new Counter({
  name: "cosmetics_parser_store_requests_total",
  help: "Requests made by parsers to store websites",
  labelNames: ["store", "result"],
  registers: [registry],
});

export const parserStoreRequestDurationSeconds = new Histogram({
  name: "cosmetics_parser_store_request_duration_seconds",
  help: "Duration of requests to store websites",
  labelNames: ["store"],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60],
  registers: [registry],
});

export const parserPriceUpdatesTotal = new Counter({
  name: "cosmetics_parser_price_updates_total",
  help: "Price records updated by the parser",
  labelNames: ["store"],
  registers: [registry],
});

export const parserPriceDropsTotal = new Counter({
  name: "cosmetics_parser_price_drops_total",
  help: "Price drops found by the parser",
  labelNames: ["store"],
  registers: [registry],
});

export const notifierJobsTotal = new Counter({
  name: "cosmetics_notifier_jobs_total",
  help: "Notification dispatch jobs finished by status",
  labelNames: ["status"],
  registers: [registry],
});

export const notifierJobDurationSeconds = new Histogram({
  name: "cosmetics_notifier_job_duration_seconds",
  help: "Time spent processing one notification dispatch job",
  buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const notificationsTotal = new Counter({
  name: "cosmetics_notifier_notifications_total",
  help: "Notifications sent by channel and result",
  labelNames: ["channel", "result"],
  registers: [registry],
});

export const notificationDeliveryDurationSeconds = new Histogram({
  name: "cosmetics_notifier_delivery_duration_seconds",
  help: "Time spent delivering a notification through a channel",
  labelNames: ["channel"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [registry],
});

export const schedulerRunsTotal = new Counter({
  name: "cosmetics_scheduler_runs_total",
  help: "Scheduled task runs by job and result",
  labelNames: ["job", "result"],
  registers: [registry],
});

export const schedulerRunDurationSeconds = new Histogram({
  name: "cosmetics_scheduler_run_duration_seconds",
  help: "Time spent running a scheduled task",
  labelNames: ["job"],
  buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 120, 300],
  registers: [registry],
});

const DEFAULT_METRICS_PORTS: Record<string, number> = {
  api: 9464,
  "auth-service": 9465,
  scheduler: 9466,
  "parser-worker": 9467,
  notifier: 9468,
};

export function startMetricsServer(serviceName: string): () => Promise<void> {
  const port = Number(
    process.env.METRICS_PORT ?? DEFAULT_METRICS_PORTS[serviceName] ?? 9464,
  );
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      try {
        res.setHeader("Content-Type", registry.contentType);
        res.end(await registry.metrics());
      } catch (error) {
        console.error(`[${serviceName}] Failed to collect metrics:`, error);
        res.statusCode = 500;
        res.end("metrics collection failed\n");
      }
      return;
    }

    if (req.url === "/healthz") {
      res.setHeader("Content-Type", "text/plain");
      res.end("ok\n");
      return;
    }

    res.statusCode = 404;
    res.end("not found\n");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[${serviceName}] Metrics available on :${port}/metrics`);
  });

  return () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
}
