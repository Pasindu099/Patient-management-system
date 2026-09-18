#!/bin/sh
set -eu
umask 077

: "${BACKUP_MANIFEST:?BACKUP_MANIFEST is required}"
: "${BACKUP_IDENTITY_FILE:?BACKUP_IDENTITY_FILE is required}"
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }
command -v age >/dev/null 2>&1 || { echo "age is required" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore is required" >&2; exit 1; }

DIR="$(dirname "$BACKUP_MANIFEST")"
ARTIFACT="$DIR/$(jq -r .encryptedArtifact "$BACKUP_MANIFEST")"
EXPECTED="$(jq -r .encryptedSha256 "$BACKUP_MANIFEST")"
ACTUAL="$(sha256sum "$ARTIFACT" | awk '{print $1}')"
[ "$EXPECTED" = "$ACTUAL" ] || { echo "Encrypted backup checksum mismatch" >&2; exit 1; }

TMP="$(mktemp "${TMPDIR:-/tmp}/lumora-wave0-verify.XXXXXX.dump")"
trap 'rm -f "$TMP"' EXIT INT TERM
age -d -i "$BACKUP_IDENTITY_FILE" -o "$TMP" "$ARTIFACT"
pg_restore --list "$TMP" >/dev/null
jq '. + {archiveValidation:"PASS", verificationStatus:"PASS"}' "$BACKUP_MANIFEST"
