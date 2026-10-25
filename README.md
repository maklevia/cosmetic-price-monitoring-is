# Cosmetics Price Monitoring IS

Information system for tracking cosmetic product prices across online stores, with
user collections, price-drop notifications, authentication, and an observability
stack planned for the university project.

## Local development

### Requirements

- Node.js 22+
- npm
- PostgreSQL 15+

Docker files are intentionally not part of this repository yet; containerization
will be rebuilt from scratch as part of the project.

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the database credentials and JWT secrets. `.env` is gitignored.

### 3. Start PostgreSQL

Use a local PostgreSQL installation, or run a one-off container if you have Docker:

```bash
docker run -d \
  --name cosmetics-price-monitoring-db \
  -e POSTGRES_USER=cosmetics \
  -e POSTGRES_PASSWORD=cosmetics \
  -e POSTGRES_DB=cosmetics_price_monitoring \
  -p 5433:5432 \
  -v cosmetics_price_monitoring_pgdata:/var/lib/postgresql/data \
  postgres:15-alpine
```

### 4. Run migrations

```bash
npm run migrate
```

### 5. Start the services

In separate terminals:

```bash
npm run dev:api
npm run dev:frontend
npm run dev:bot
```

The API no longer schedules cron jobs. Start the background services separately:

```bash
npm run dev:scheduler   # cron schedules only; enqueues jobs
npm run dev:parser      # consumes parse/discovery jobs
npm run dev:notifier    # consumes notification dispatch jobs
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- The Telegram bot requires a real `TELEGRAM_BOT_TOKEN` in `.env`.
- Parser workers can be scoped to one store with `PARSER_STORE=eva`,
  `PARSER_STORE=makeup` or `PARSER_STORE=notino`. Without it, one worker
  processes all stores.
- Use `PARSER_CONCURRENCY`, `PARSER_DELAY_MS`, `PARSER_POLL_MS` and
  `NOTIFIER_POLL_MS` to tune the workers.

### Build

```bash
npm run build
```

## Repository layout

```text
api/
  src/entrypoints/   api, scheduler, parser and notifier process entrypoints
  src/jobs/          scheduling and job-processing logic
  src/modules/job/   job entity, queue interface and PostgreSQL queue
  src/modules/       domain modules (auth, product, notification, user, channel)
frontend/            React + Vite + Chakra UI
telegram-bot/        Telegraf bot
```
