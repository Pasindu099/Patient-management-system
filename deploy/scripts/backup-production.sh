#!/bin/sh
set -eu
umask 077

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"
command -v age >/dev/null 2>&1 || { echo "age is required for encrypted backup retention" >&2; exit 1; }

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-lumora_db}"
BACKUP_DIR="${BACKUP_DIR:-./wave0-private-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PREFIX="lumora-wave0-$STAMP"
CONTAINER_DUMP="/tmp/$PREFIX.dump"
LOCAL_DUMP="$BACKUP_DIR/$PREFIX.dump"
ENCRYPTED="$LOCAL_DUMP.age"
MANIFEST="$BACKUP_DIR/$PREFIX.manifest.json"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

cleanup() {
  docker exec "$POSTGRES_CONTAINER" rm -f "$CONTAINER_DUMP" >/dev/null 2>&1 || true
  rm -f "$LOCAL_DUMP"
}
trap cleanup EXIT INT TERM

SERVER_VERSION="$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "show server_version")"
SERVER_MAJOR="$(docker exec "$POSTGRES_CONTAINER" psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "show server_version_num" | cut -c1-2 | sed 's/^0*//')"
DUMP_VERSION="$(docker exec "$POSTGRES_CONTAINER" pg_dump --version)"
docker exec "$POSTGRES_CONTAINER" pg_dump -Fc --no-owner --no-privileges --serializable-deferrable \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$CONTAINER_DUMP"
docker exec "$POSTGRES_CONTAINER" pg_restore --list "$CONTAINER_DUMP" >/dev/null
docker cp "$POSTGRES_CONTAINER:$CONTAINER_DUMP" "$LOCAL_DUMP" >/dev/null
age -r "$BACKUP_ENCRYPTION_RECIPIENT" -o "$ENCRYPTED" "$LOCAL_DUMP"
ENCRYPTED_SHA256="$(sha256sum "$ENCRYPTED" | awk '{print $1}')"

cat >"$MANIFEST" <<EOF
{
  "kind": "lumora-wave0-backup-v1",
  "status": "PASS",
  "createdAt": "$STAMP",
  "sourcePostgreSQLVersion": "$SERVER_VERSION",
  "sourcePostgreSQLMajor": "$SERVER_MAJOR",
  "dumpToolVersion": "$DUMP_VERSION",
  "format": "pg_dump-custom-age",
  "encryptedArtifact": "$(basename "$ENCRYPTED")",
  "encryptedSha256": "$ENCRYPTED_SHA256",
  "retentionReference": "restricted:$BACKUP_DIR"
}
EOF
chmod 600 "$ENCRYPTED" "$MANIFEST"
echo "$MANIFEST"
