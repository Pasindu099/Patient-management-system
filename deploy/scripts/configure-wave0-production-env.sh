#!/bin/sh
set -eu
umask 077

ENV_FILE="${ENV_FILE:-/opt/lumora/deploy/.env}"
AUDIT_PASSWORD_FILE="${AUDIT_PASSWORD_FILE:-/root/lumora-wave0/audit.password}"
[ -f "$ENV_FILE" ] || { echo "Production env file not found" >&2; exit 1; }
[ -s "$AUDIT_PASSWORD_FILE" ] || { echo "Audit password file not found" >&2; exit 1; }

TMP="$(mktemp "$(dirname "$ENV_FILE")/.wave0-env.XXXXXX")"
trap 'rm -f "$TMP"' EXIT INT TERM
grep -v -E '^(CANONICAL_|AUDIT_DATABASE_)' "$ENV_FILE" > "$TMP"
cat >> "$TMP" <<'EOF'
CANONICAL_MIGRATION_MODE=disabled
CANONICAL_WRITE_CAPTURE_ALLOWLIST=
CANONICAL_SHADOW_READ_ALLOWLIST=
CANONICAL_METRIC_READ_ALLOWLIST=
CANONICAL_DOMAIN_CUTOVER_ALLOWLIST=
CANONICAL_ALERT_TYPE_ALLOWLIST=
CANONICAL_UI_SURFACE_ALLOWLIST=
CANONICAL_ARTIFACT_DIR=/var/lib/lumora-canonical-artifacts
AUDIT_DATABASE_USER=lumora_audit_ro
EOF
printf 'AUDIT_DATABASE_URL=postgresql://lumora_audit_ro:%s@postgres:5432/dental_pms\n' "$(cat "$AUDIT_PASSWORD_FILE")" >> "$TMP"
chmod --reference="$ENV_FILE" "$TMP"
chown --reference="$ENV_FILE" "$TMP"
mv "$TMP" "$ENV_FILE"
trap - EXIT INT TERM
echo "Wave 0 production controls configured disabled with empty allowlists."
