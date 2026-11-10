import type { NextFunction, Request, Response } from "express";
import http from "node:http";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

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

export const authLoginTotal = new Counter({
  name: "cosmetics_auth_login_total",
  help: "Login attempts by result",
  labelNames: ["result"],
  registers: [registry],
});

export const authSignupTotal = new Counter({
  name: "cosmetics_auth_signup_total",
  help: "Signup attempts by result",
  labelNames: ["result"],
  registers: [registry],
});

export const authRefreshTotal = new Counter({
  name: "cosmetics_auth_refresh_total",
  help: "Refresh-token attempts by result",
  labelNames: ["result"],
  registers: [registry],
});

export const authPasswordResetTotal = new Counter({
  name: "cosmetics_auth_password_reset_total",
  help: "Password reset attempts by result",
  labelNames: ["result"],
  registers: [registry],
});

export const authTokenValidationFailuresTotal = new Counter({
  name: "cosmetics_auth_token_validation_failures_total",
  help: "Access-token validation failures by reason",
  labelNames: ["reason"],
  registers: [registry],
});

const DEFAULT_METRICS_PORTS: Record<string, number> = {
  "auth-service": 9465,
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
