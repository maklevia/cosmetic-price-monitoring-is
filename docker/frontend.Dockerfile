FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY api/package.json ./api/package.json
COPY auth-service/package.json ./auth-service/package.json
COPY frontend/package.json ./frontend/package.json
COPY telegram-bot/package.json ./telegram-bot/package.json

RUN npm ci

COPY frontend ./frontend

ARG API_ORIGIN=/api
ARG AUTH_ORIGIN=/auth

ENV API_ORIGIN=$API_ORIGIN
ENV AUTH_ORIGIN=$AUTH_ORIGIN

RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
