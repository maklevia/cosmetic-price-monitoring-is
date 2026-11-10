# Cosmetics Price Monitoring IS

An information system for monitoring cosmetic product prices in online stores
(Eva, Makeup, Notino). Users create an account, build a collection of products
and receive notifications when a price drops.

The project is developed as a university information system and also demonstrates
a practical observability stack: metrics, logs, traces and dashboards.

Only authenticated users can access the application data.

## Project idea

The system has two goals:

- give users one place to track prices of favourite cosmetic products and get
  notified about discounts;
- show how a containerized, authenticated information system can be monitored
  at the application and database levels.

## Architecture

```text
Browser
  │
  ▼
web (nginx + React)
  ├── /api  ──► API service
  └── /auth ──► auth service (separate authentication API)
                     │
                     ▼
                 PostgreSQL
                 ├── main database
                 └── auth database

Background workers: scheduler, parser worker, notifier
Monitoring: Prometheus + Grafana + PostgreSQL exporters
```

Main parts:

- **web** — nginx serving the React application and proxying `/api` and `/auth`;
- **API** — main HTTP service for products, collections and notifications;
- **auth service** — separate authentication API with its own database, JWT
  access tokens and refresh tokens;
- **PostgreSQL** — one server with two databases: application data and auth data;
- **background workers** — scheduler, parser worker and notifier, connected
  through a PostgreSQL-backed job queue;
- **Telegram bot** — optional client for price-drop notifications;
- **Prometheus** — collects application and database metrics;
- **Grafana** — provisioned dashboards for application and database metrics;
- **Loki and Tempo** — logs and traces (in progress).

Everything runs in Docker Compose.

## Project stages

### Done

- **Authentication** — separate auth service, JWT access/refresh tokens,
  protected API routes and protected frontend routes.
- **Database and background jobs** — PostgreSQL, migrations, PostgreSQL-backed
  parse queue, scheduler, parser worker and notifier.
- **Docker** — the full stack runs in containers: PostgreSQL, migrations, API,
  auth service, nginx web container, workers and optional Telegram bot.
- **Prometheus metrics** — application metrics and PostgreSQL metrics collected
  through exporters.
- **Grafana** — provisioned dashboards for application, database and business
  metrics.

### In progress

- **Loki** — collecting and exploring logs from all containers.
- **Tempo** — distributed traces for HTTP requests, database calls and worker
  jobs.

## Tech stack

- Node.js + TypeScript, Express
- React + Vite + Chakra UI
- PostgreSQL 15
- Docker Compose
- Prometheus and Grafana, with Loki and Tempo in progress
- Telegram bot (Telegraf)

## Quick start

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

- Web application: http://localhost:8080
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000, login `admin` with `GRAFANA_ADMIN_PASSWORD`
- Optional Telegram bot:
  `docker compose --env-file .env.docker --profile bot up -d bot`

`migrate` and `monitoring-init` must finish successfully before the services
that depend on them become healthy; both are one-shot containers and should show
`Exited (0)`.

## Metrics and Prometheus

### What is running

- Every backend process starts a separate small HTTP server on `METRICS_PORT`
  (`9464` by default): `api`, `auth-service`, `scheduler`, `parser-worker` and
  `notifier`. It exposes `/metrics` for Prometheus and `/healthz` for checks.
  This server is not the Express app and is not proxied by nginx, so metrics
  are never exposed through `/api` or `/auth`.
- `postgres-exporter` and `postgres-exporter-auth` read PostgreSQL statistics
  and a few application tables. They connect as the read-only `monitoring` role.
- Prometheus scrapes every target every 15 seconds and keeps data for 15 days
  in the `prometheus_data` volume. The `instance` label is pinned to the service
  name, so restarting a container does not create duplicate series.
- `pg_stat_statements` is enabled through `shared_preload_libraries`, which lets
  the exporter show the slowest SQL queries.
- `grafana` loads its Prometheus datasource and dashboard from
  `docker/grafana/`, so a fresh volume needs no manual setup. It is available at
  http://localhost:3000 and bound to `127.0.0.1`.

Locally started services expose Prometheus metrics on separate ports: API `9464`,
auth `9465`, scheduler `9466`, parser `9467`, notifier `9468`. In Docker every
container uses `9464` because each container has its own network namespace.

### What is collected

- **PostgreSQL activity:** connections, commits and rollbacks, cache hit ratio,
  disk reads, locks, deadlocks, temporary files, database and table sizes,
  per-table row changes, index usage and the top 20 queries from
  `pg_stat_statements`.
- **Database content:** product, user, collection and price-history counts,
  store records per store, queue sizes, oldest pending job, last price update
  per store and unread notifications.
- **HTTP:** request count, duration histogram and status codes. The route label
  uses the Express route template, not the raw URL.
- **Auth:** signup, login, refresh and password-reset outcomes, and failed token
  validations.
- **Workers:** parser jobs and duration, store request results, price updates
  and drops, notification delivery and scheduler runs.
- **Node.js:** CPU, memory, event loop lag, garbage collection and other default
  process metrics supplied by `prom-client`.

### Check that it works

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

`migrate` and `monitoring-init` should show `Exited (0)`. Open
http://localhost:9090/targets; every target should be `UP`. Open
http://localhost:3000 and check that the `Cosmetics Price Monitoring` dashboard
loads with data.

Inspect a service directly from inside the Docker network:

```bash
docker compose --env-file .env.docker exec web wget -qO- http://api:9464/metrics | head
docker compose --env-file .env.docker exec web wget -qO- http://postgres-exporter:9187/metrics | grep cosmetics_db_
```

Example PromQL queries for the demo:

```promql
up
rate(pg_stat_database_xact_commit[1m])
pg_stat_database_numbackends / pg_settings_max_connections
rate(pg_stat_database_blks_hit[5m]) / (rate(pg_stat_database_blks_hit[5m]) + rate(pg_stat_database_blks_read[5m]))
rate(cosmetics_http_requests_total[5m])
histogram_quantile(0.95, sum by (le, route) (rate(cosmetics_http_request_duration_seconds_bucket[5m])))
cosmetics_db_parse_jobs
time() - cosmetics_db_last_price_update_timestamp_seconds
```

### Configuration files

- `docker/prometheus/prometheus.yml` — scrape targets and intervals.
- `docker/postgres-exporter/queries.yaml` — custom metrics for the main DB.
- `docker/postgres-exporter/queries-auth.yaml` — custom metrics for the auth DB.
- `docker/postgres/observability.sql` — monitoring role and extension setup.
- `api/src/observability/metrics.ts` — metric definitions and metrics server.
- `auth-service/src/observability/metrics.ts` — auth metric definitions.
- `docker/grafana/provisioning/` — Prometheus datasource and dashboard provider.
- `docker/grafana/dashboards/overview.json` — application and database dashboard.

`MONITORING_DB_PASSWORD`, `METRICS_PORT`, `PROMETHEUS_RETENTION`,
`PROMETHEUS_PORT`, `GRAFANA_PORT` and `GRAFANA_ADMIN_PASSWORD` are configured in
`.env.docker` (see `.env.docker.example`). The metrics and exporter ports are
not published on the host. Prometheus and Grafana are bound to `127.0.0.1`;
Grafana provides the authenticated monitoring UI.

Reset stored monitoring data together with the database:

```bash
docker compose --env-file .env.docker down -v
```

## Repository layout

```text
api/
  src/entrypoints/      api, scheduler, parser and notifier process entrypoints
  src/jobs/             scheduling and job-processing logic
  src/modules/job/      job entity, queue interface and PostgreSQL queue
  src/modules/          domain modules (product, notification, user, channel, internal)
  src/observability/    Prometheus metrics and metrics server
auth-service/
  src/modules/auth/     signup, login, refresh-token rotation, logout, password reset
  src/entities/         credentials and refresh tokens
  src/observability/    Prometheus metrics and metrics server
frontend/               React + Vite + Chakra UI
telegram-bot/           Telegraf bot
docker/
  prometheus/           Prometheus scrape configuration
  postgres-exporter/    custom SQL metrics for both databases
  postgres/             init scripts, monitoring role and pg_stat_statements
  grafana/              provisioned datasource and dashboard
docker-compose.yml      full container stack
```
