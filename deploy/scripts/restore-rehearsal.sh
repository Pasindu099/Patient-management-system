#!/bin/sh
set -eu
umask 077

: "${BACKUP_MANIFEST:?BACKUP_MANIFEST is required}"
: "${BACKUP_IDENTITY_FILE:?BACKUP_IDENTITY_FILE is required}"
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }
command -v age >/dev/null 2>&1 || { echo "age is required" >&2; exit 1; }

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT="lumora_wave0_$(date -u +%Y%m%d%H%M%S)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/lumora-wave0-restore.XXXXXX")"
ARTIFACT="$(dirname "$BACKUP_MANIFEST")/$(jq -r .encryptedArtifact "$BACKUP_MANIFEST")"
MAJOR="$(jq -r .sourcePostgreSQLMajor "$BACKUP_MANIFEST")"
SOURCE_VERSION="$(jq -r .sourcePostgreSQLVersion "$BACKUP_MANIFEST")"
REHEARSAL_PORT="${REHEARSAL_PORT:-55433}"
REHEARSAL_PASSWORD="${REHEARSAL_PASSWORD:-unused-local-only}"

case "$MAJOR" in ''|*[!0-9]*) echo "Invalid source PostgreSQL major" >&2; exit 1;; esac
cleanup() {
  if [ "${KEEP_REHEARSAL:-0}" != "1" ]; then
    POSTGRES_IMAGE="postgres:$MAJOR-alpine" REHEARSAL_PASSWORD="$REHEARSAL_PASSWORD" REHEARSAL_PORT="$REHEARSAL_PORT" \
      docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.rehearsal.yml" down -v >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

age -d -i "$BACKUP_IDENTITY_FILE" -o "$WORK/source.dump" "$ARTIFACT"
POSTGRES_IMAGE="postgres:$MAJOR-alpine" REHEARSAL_PASSWORD="$REHEARSAL_PASSWORD" REHEARSAL_PORT="$REHEARSAL_PORT" \
  docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.rehearsal.yml" up -d postgres
POSTGRES_IMAGE="postgres:$MAJOR-alpine" REHEARSAL_PASSWORD="$REHEARSAL_PASSWORD" REHEARSAL_PORT="$REHEARSAL_PORT" \
  docker compose -p "$PROJECT" -f "$DEPLOY_DIR/docker-compose.rehearsal.yml" exec -T postgres sh -c 'until pg_isready -U wave0 -d wave0_rehearsal; do sleep 1; done'
CONTAINER="${PROJECT}-postgres-1"
docker cp "$WORK/source.dump" "$CONTAINER:/tmp/source.dump" >/dev/null
docker exec "$CONTAINER" pg_restore --exit-on-error --no-owner --no-privileges -h 127.0.0.1 -U wave0 -d wave0_rehearsal /tmp/source.dump
REHEARSAL_VERSION="$(docker exec "$CONTAINER" psql -At -h 127.0.0.1 -U wave0 -d wave0_rehearsal -c 'show server_version')"
REHEARSAL_MAJOR="$(docker exec "$CONTAINER" psql -At -h 127.0.0.1 -U wave0 -d wave0_rehearsal -c 'show server_version_num' | cut -c1-2 | sed 's/^0*//')"
[ "$REHEARSAL_MAJOR" = "$MAJOR" ] || { echo "Restore major mismatch" >&2; exit 1; }
TABLE_COUNT="$(docker exec "$CONTAINER" psql -At -h 127.0.0.1 -U wave0 -d wave0_rehearsal -c "select count(*) from information_schema.tables where table_schema='public'")"

cat <<EOF
{"kind":"lumora-wave0-restore-rehearsal-v1","status":"PASS","project":"$PROJECT","sourcePostgreSQLVersion":"$SOURCE_VERSION","rehearsalPostgreSQLVersion":"$REHEARSAL_VERSION","rehearsalPostgreSQLMajor":"$REHEARSAL_MAJOR","publicTableCount":"$TABLE_COUNT","loopbackPort":"$REHEARSAL_PORT","keptForFullVerification":$( [ "${KEEP_REHEARSAL:-0}" = "1" ] && echo true || echo false ),"productionNetworkUsed":false,"productionVolumeUsed":false}
EOF
