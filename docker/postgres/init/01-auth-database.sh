#!/bin/sh
set -eu

: "${AUTH_DB_NAME:?AUTH_DB_NAME is required}"
: "${AUTH_DB_USER:?AUTH_DB_USER is required}"
: "${AUTH_DB_PASSWORD:?AUTH_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=auth_db_name="$AUTH_DB_NAME" \
  --set=auth_db_user="$AUTH_DB_USER" \
  --set=auth_db_password="$AUTH_DB_PASSWORD" <<'EOSQL'
CREATE ROLE :"auth_db_user" LOGIN PASSWORD :'auth_db_password';
CREATE DATABASE :"auth_db_name" OWNER :"auth_db_user";
EOSQL
