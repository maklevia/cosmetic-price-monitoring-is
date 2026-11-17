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

Background workers: scheduler ──► RabbitMQ ──► parser worker / notifier
Job audit/state: PostgreSQL Parse_Jobs
Monitoring: Prometheus + Grafana + Loki + Tempo + PostgreSQL exporters
```

Main parts:

- **web** — nginx serving the React application and proxying `/api` and `/auth`;
- **API** — main HTTP service for products, collections and notifications;
- **auth service** — separate authentication API with its own database, JWT
  access tokens and refresh tokens;
- **PostgreSQL** — one server with two databases: application data and auth data;
- **RabbitMQ** — transports background jobs between the scheduler and workers;
  the `Parse_Jobs` table remains as an audit/state record;
- **background workers** — scheduler, parser worker and notifier, connected
  through RabbitMQ;
- **Telegram bot** — optional client for price-drop notifications;
- **Prometheus** — collects application, database and RabbitMQ metrics;
- **Grafana** — provisioned dashboards for application, database, broker, logs
  and trace data;
- **Loki and Alloy** — collects and stores logs from all containers;
- **Tempo** — stores distributed traces sent by the backend through OpenTelemetry.

Everything runs in Docker Compose.

## Tech stack

- Node.js + TypeScript, Express
- React + Vite + Chakra UI
- PostgreSQL 15
- RabbitMQ 4
- Docker Compose
- Prometheus, Grafana, Loki and Tempo
- Telegram bot (Telegraf)

## Quick start

```bash
docker compose up -d --build
```

Compose loads `.env.docker.example` as fallback defaults, so a fresh checkout
starts without copying an env file. To customize values, copy the example and
use it explicitly:

```bash
cp .env.docker.example .env.docker
# edit .env.docker
docker compose --env-file .env.docker up -d --build
```

- Web application: http://localhost:8080
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000, login `admin` with `GRAFANA_ADMIN_PASSWORD`
- RabbitMQ management: http://localhost:15672, login with `RABBITMQ_USER` and
  `RABBITMQ_PASSWORD`
- Optional Telegram bot:
  `docker compose --env-file .env.docker --profile bot up -d bot`

`migrate`, `monitoring-init` and `tempo-init` must finish successfully before the
services that depend on them become healthy; all are one-shot containers and
should show `Exited (0)`.

Generate demo users, collection data, price history, notifications and HTTP/job
activity:

```bash
npm run demo
```

This creates or reuses `demo@example.com` / `DemoPass123`, seeds nine real
products (three from each store) with their store links, queues a notification
job and sends API/auth requests. Use `npm run demo -- --requests=40` for more
traffic. To also enqueue three real parser jobs (one per store), run
`npm run demo -- --with-parser`; those jobs depend on the external store sites
being reachable.

For a clean presentation, reset the stack and run the demo again:

```bash
docker compose down -v
docker compose up -d --build
npm run demo
```

## Monitoring

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
- `rabbitmq` transports jobs between the scheduler and the workers. The main
  queues are split by job type and store, with a `.retry` queue using a per-message
  TTL and a `.dlq` queue for exhausted jobs. Workers use `basic.get` with manual
  acknowledgements, so the `rabbitmq_queue_consumers` metric is intentionally
  zero; use ready, unacknowledged and get-rate metrics instead. Delivery is
  at-least-once: workers acknowledge only after updating `Parse_Jobs`, and a
  failed publish marks the audit row as failed. Management UI:
  http://localhost:15672; Prometheus metrics: port `15692`.
- `loki` stores container logs for 7 days in `loki_data`. `alloy` discovers
  project containers through the Docker socket, labels entries by Compose
  service, and pushes them to Loki. Neither service is published on the host.
- `tempo` receives OTLP traces on ports `4317` (gRPC) and `4318` (HTTP) and
  stores them locally for 7 days in `tempo_data`. The API, auth service,
  scheduler, parser worker and notifier load OpenTelemetry instrumentation at
  startup and export traces to Tempo. Tempo is not published on the host.
- `grafana` loads its Prometheus, Loki and Tempo datasources and the five
  Cosmetics dashboards from `docker/grafana/`, so a fresh volume needs no manual
  setup. It is available at http://localhost:3000 and bound to `127.0.0.1`.

Locally started services expose Prometheus metrics on separate ports: API `9464`,
auth `9465`, scheduler `9466`, parser `9467`, notifier `9468`. In Docker every
container uses `9464` because each container has its own network namespace.

### What is collected

- **PostgreSQL activity:** connections, commits and rollbacks, cache hit ratio,
  disk reads, locks, deadlocks, temporary files, database and table sizes,
  per-table row changes, index usage and the top 20 queries from
  `pg_stat_statements`, including normalized query text.
- **Database content:** product, user, collection and price-history counts,
  store records per store, PostgreSQL job audit depth, oldest pending audit
  job, last price update per store, unread notifications, and auth credentials
  and refresh-token counts.
- **RabbitMQ:** ready, unacknowledged and dead-lettered messages per queue,
  publish/get/ack rates, connections and channels.
- **HTTP:** request count, duration histogram and status codes. The route label
  uses the Express route template, not the raw URL.
- **Auth:** signup, login, refresh and password-reset outcomes, and failed token
  validations.
- **Workers:** parser jobs and duration, store request results, price updates
  and drops, notification delivery and scheduler runs.
- **Node.js:** CPU, memory, event loop lag, garbage collection and other default
  process metrics supplied by `prom-client`.
- **Logs:** stdout and stderr from every project container, labeled by
  `service`, `container` and `stream`. Logs stay in plain text and are filtered
  with LogQL; no level parsing or structured logging is required.
- **Traces:** OpenTelemetry spans for incoming HTTP requests, PostgreSQL
  queries, outgoing HTTP calls, parser store requests, RabbitMQ publish/claim
  operations and parser, notifier and scheduler job spans. Each trace is labeled
  with the Compose service name (`api`, `auth-service`, `scheduler`,
  `parser-worker`, `notifier`).

### Dashboards

All dashboards live in the `Cosmetics` folder and link to each other through the
**Cosmetics dashboards** menu in Grafana's top bar.

- **Overview** — target and exporter health, API error rate and latency, database
  connections, PostgreSQL job audit depth, worker activity, business counts and
  price freshness.
- **PostgreSQL** — collection health, connections by state, long transactions,
  locks, commits/rollbacks, cache hit ratio, temporary files, database and table
  sizes, row changes, index vs sequential scans, top queries and application/auth
  table counts. A `$database` variable switches between the main and auth
  databases.
- **Application & Workers** — HTTP requests and latency by service/route/status,
  auth outcomes, parser jobs and store requests, price updates and drops,
  notifier deliveries, scheduler runs, RabbitMQ queue health and Node.js
  CPU/memory/event-loop/GC.
- **Logs** — Loki log volume, error lines, recent logs and literal search for the
  application, web, PostgreSQL, RabbitMQ and monitoring containers.
- **Traces** — Tempo recent, slow and error traces, filtered by service and
  minimum span duration, with TraceQL examples.

### Check that it works

```bash
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

`migrate`, `monitoring-init` and `tempo-init` should show `Exited (0)`. Open
http://localhost:9090/targets; every target, including `rabbitmq`, should be
`UP`. Open http://localhost:3000 and check the five Cosmetics dashboards. Start
with **Overview**; it links to **PostgreSQL**, **Application & Workers**,
**Logs** and **Traces**.

Check the RabbitMQ queues and management UI:

```bash
docker compose --env-file .env.docker exec rabbitmq \
  rabbitmqctl list_queues name messages messages_unacknowledged
```

The stack declares one main queue per job type/store plus `.retry` and `.dlq`
queues (27 queues in total). The management UI is at
http://localhost:15672.

Inspect a service directly from inside the Docker network:

```bash
docker compose --env-file .env.docker exec web wget -qO- http://api:9464/metrics | head
docker compose --env-file .env.docker exec web wget -qO- http://postgres-exporter:9187/metrics | grep cosmetics_db_
docker compose --env-file .env.docker exec web wget -qO- http://loki:3100/loki/api/v1/label/service/values
docker compose --env-file .env.docker exec web wget -qO- http://tempo:3200/ready
```

Tempo can take about a minute to report `ready` on the first start.

In Grafana, open **Explore**, choose **Loki**, and run:

```logql
{service="api"}
{service=~"api|auth-service"} |= "error"
```

Choose **Tempo** in Explore and run:

```traceql
{ resource.service.name = "api" }
{ resource.service.name = "auth-service" }
```

Logs and traces have their own dashboards. Use the **Cosmetics dashboards** menu
in Grafana's top bar, or the links on the **Overview** dashboard.

Example PromQL queries for the demo:

```promql
up
pg_up
pg_exporter_last_scrape_error
pg_scrape_collector_success{collector="stat_database"}
rate(pg_stat_database_xact_commit[1m])
pg_stat_database_numbackends / pg_settings_max_connections
rate(pg_stat_database_blks_hit[5m]) / (rate(pg_stat_database_blks_hit[5m]) + rate(pg_stat_database_blks_read[5m]))
rate(cosmetics_http_requests_total[5m])
histogram_quantile(0.95, sum by (le, route) (rate(cosmetics_http_request_duration_seconds_bucket[5m])))
cosmetics_db_parse_jobs
time() - cosmetics_db_last_price_update_timestamp_seconds
sum by (queue) (rabbitmq_queue_messages_ready{queue=~"cosmetics.jobs.*"})
sum(rabbitmq_queue_messages_unacked{queue=~"cosmetics.jobs.*", queue!~".*(retry|dlq)"})
sum(rate(rabbitmq_global_messages_delivered_get_manual_ack_total[5m]))
```

### Configuration files

- `docker/prometheus/prometheus.yml` — scrape targets and intervals.
- `docker/rabbitmq/rabbitmq.conf` — RabbitMQ Prometheus per-object metrics.
- `docker/rabbitmq/enabled_plugins` — management and Prometheus plugins.
- `docker/postgres-exporter/queries.yaml` — custom metrics for the main DB.
- `docker/postgres-exporter/queries-auth.yaml` — custom metrics for the auth DB.
- `docker/postgres/observability.sql` — monitoring role and extension setup.
- `api/src/observability/metrics.ts` — metric definitions and metrics server.
- `auth-service/src/observability/metrics.ts` — auth metric definitions.
- `docker/loki/loki.yml` — Loki storage and 7-day retention.
- `docker/alloy/config.alloy` — Docker log discovery and Loki push.
- `docker/tempo/tempo.yml` — Tempo storage, OTLP receivers and 7-day retention.
- `api/src/observability/tracing.ts` — OpenTelemetry setup for API and workers.
- `api/src/observability/spans.ts` — manual spans for parser, notifier and scheduler jobs.
- `api/src/scripts/demo.ts` — demo seed, HTTP traffic and job enqueue script.
- `api/src/scripts/demoFixtures.ts` — nine demo products with real store links.
- `auth-service/src/observability/tracing.ts` — OpenTelemetry setup for auth.
- `docker/grafana/provisioning/` — Prometheus, Loki and Tempo datasources plus the dashboard provider.
- `docker/grafana/dashboards/overview.json` — health and activity summary.
- `docker/grafana/dashboards/postgresql.json` — PostgreSQL activity, tables, queries and exporter health.
- `docker/grafana/dashboards/application.json` — HTTP, auth, workers, scheduler and Node.js runtime.
- `docker/grafana/dashboards/logs.json` — Loki log exploration.
- `docker/grafana/dashboards/traces.json` — Tempo trace exploration.

`MONITORING_DB_PASSWORD`, `METRICS_PORT`, `PROMETHEUS_RETENTION`,
`PROMETHEUS_PORT`, `GRAFANA_PORT` and `GRAFANA_ADMIN_PASSWORD` are configured in
`.env.docker` (see `.env.docker.example`). A fresh checkout falls back to
`.env.docker.example` defaults and the Compose defaults; when `.env.docker`
exists it is loaded after the example file, so it overrides values. Pass
`--env-file .env.docker` to `docker compose` if you also customize Compose
interpolation values such as ports. `OTEL_EXPORTER_OTLP_ENDPOINT` can override
the default internal Tempo endpoint. The RabbitMQ connection is built from
`RABBITMQ_URL` (optional full override), `RABBITMQ_USER` and
`RABBITMQ_PASSWORD`; the defaults match the Compose service. Changing the user
or password after the RabbitMQ volume is initialized requires updating the
existing RabbitMQ user or removing `rabbitmq_data`. RabbitMQ AMQP, management
and metrics ports are bound to `127.0.0.1` for local inspection. The application
metrics, exporter, Loki, Alloy and Tempo ports are not published on the host.
Prometheus and Grafana are bound to `127.0.0.1`; Grafana provides the
authenticated monitoring UI. Alloy reads the Docker socket read-only to tail
container logs.

Reset stored data (including RabbitMQ queues) together with the database:

```bash
docker compose --env-file .env.docker down -v
```

## Repository layout

```text
api/
  src/entrypoints/      api, scheduler, parser and notifier process entrypoints
  src/jobs/             scheduling and job-processing logic
  src/scripts/          demo seed and traffic generator
  src/modules/job/      job entity, Parse_Jobs audit store and RabbitMQ queue
  src/modules/          domain modules (product, notification, user, channel, internal)
  src/observability/    Prometheus metrics, metrics server and OpenTelemetry tracing
auth-service/
  src/modules/auth/     signup, login, refresh-token rotation, logout, password reset
  src/entities/         credentials and refresh tokens
  src/observability/    Prometheus metrics, metrics server and OpenTelemetry tracing
frontend/               React + Vite + Chakra UI
telegram-bot/           Telegraf bot
docker/
  prometheus/           Prometheus scrape configuration
  rabbitmq/             RabbitMQ plugins and Prometheus metrics configuration
  postgres-exporter/    custom SQL metrics for both databases
  postgres/             init scripts, monitoring role and pg_stat_statements
  grafana/              provisioned datasources and dashboards
  loki/                 Loki storage and retention configuration
  alloy/                Docker log collection configuration
  tempo/                Tempo storage and retention configuration
docker-compose.yml      full container stack
```
