#!/bin/sh
set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${AUDIT_DATABASE_PASSWORD:?AUDIT_DATABASE_PASSWORD is required}"
AUDIT_DATABASE_USER="${AUDIT_DATABASE_USER:-lumora_audit_ro}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-lumora_db}"

if [ "$AUDIT_DATABASE_USER" != "lumora_audit_ro" ]; then
  echo "Wave 0 permits only the reviewed lumora_audit_ro role name" >&2
  exit 1
fi

docker exec -i "$POSTGRES_CONTAINER" psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=role_password="$AUDIT_DATABASE_PASSWORD" --set=app_role="$POSTGRES_USER" <<'SQL'
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumora_audit_ro') THEN
    CREATE ROLE lumora_audit_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
  END IF;
END
$block$;
ALTER ROLE lumora_audit_ro PASSWORD :'role_password';
ALTER ROLE lumora_audit_ro SET default_transaction_read_only = on;
ALTER ROLE lumora_audit_ro SET statement_timeout = '60s';
ALTER ROLE lumora_audit_ro SET lock_timeout = '5s';
REVOKE TEMPORARY ON DATABASE :"DBNAME" FROM PUBLIC;
GRANT TEMPORARY ON DATABASE :"DBNAME" TO :"app_role";
REVOKE CREATE, TEMPORARY ON DATABASE :"DBNAME" FROM lumora_audit_ro;
REVOKE CREATE ON SCHEMA public FROM lumora_audit_ro;
GRANT CONNECT ON DATABASE :"DBNAME" TO lumora_audit_ro;
GRANT USAGE ON SCHEMA public TO lumora_audit_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lumora_audit_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO lumora_audit_ro;
SQL

echo "Provisioned lumora_audit_ro with existing-object read access and no write/TEMP/DDL grants."
