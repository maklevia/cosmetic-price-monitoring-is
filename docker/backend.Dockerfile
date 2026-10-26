FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY api/package.json ./api/package.json
COPY auth-service/package.json ./auth-service/package.json
COPY frontend/package.json ./frontend/package.json
COPY telegram-bot/package.json ./telegram-bot/package.json

RUN npm ci

COPY api ./api
COPY auth-service ./auth-service

RUN npm run build --workspace=api \
  && npm run build --workspace=auth-service

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY auth-service/package.json ./auth-service/package.json
COPY frontend/package.json ./frontend/package.json
COPY telegram-bot/package.json ./telegram-bot/package.json

RUN npm ci --omit=dev

COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/auth-service/dist ./auth-service/dist

USER node
