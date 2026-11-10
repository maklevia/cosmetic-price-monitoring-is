\set ON_ERROR_STOP on

SELECT format('CREATE ROLE monitoring LOGIN PASSWORD %L', :'monitoring_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitoring')
\gexec

ALTER ROLE monitoring WITH LOGIN PASSWORD :'monitoring_password';

GRANT pg_monitor TO monitoring;
GRANT pg_read_all_data TO monitoring;

GRANT CONNECT ON DATABASE :"main_db" TO monitoring;
GRANT CONNECT ON DATABASE :"auth_db" TO monitoring;

\connect :main_db
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\connect :auth_db
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
