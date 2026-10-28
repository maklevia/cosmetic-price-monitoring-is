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
Monitoring: Prometheus + PostgreSQL exporters
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
- **Grafana, Loki and Tempo** — visualization, logs and traces (in progress).

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

### In progress

- **Grafana** — dashboards for application, database and business metrics.
- **Loki** — collecting and exploring logs from all containers.
- **Tempo** — distributed traces for HTTP requests, database calls and worker
  jobs.

## Tech stack

- Node.js + TypeScript, Express
- React + Vite + Chakra UI
- PostgreSQL 15
- Docker Compose
- Prometheus, with Grafana, Loki and Tempo in progress
- Telegram bot (Telegraf)

## Quick start

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

- Web application: http://localhost:8080
- Prometheus: http://localhost:9090
- Optional Telegram bot:
  `docker compose --env-file .env.docker --profile bot up -d bot`
