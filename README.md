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

- Frontend: http://localhost:5173
- API: http://localhost:3001
- The Telegram bot requires a real `TELEGRAM_BOT_TOKEN` in `.env`.

### Build

```bash
npm run build
```

## Repository layout

```text
api/            Express + TypeScript + TypeORM API
frontend/       React + Vite + Chakra UI
telegram-bot/   Telegraf bot
```
