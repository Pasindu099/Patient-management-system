# Lumora Migration Wave 0 Runbook

Status: **WAVE 0 IMPLEMENTATION AUTHORIZED - WAVE 0 ONLY**

Wave 1 is not authorized. This runbook never migrates, repairs, backfills, or changes business records. PMS is the sole migration owner; the website must never run Prisma migrations or write canonical control-plane tables.

## Preconditions

1. Work from the isolated Wave 0 branch and record pre-change SHA, dirty-worktree ownership, specification hashes, operators, reviewers, and the restricted evidence location.
2. Keep `CANONICAL_MIGRATION_MODE=disabled` and every canonical allowlist empty in production.
3. Run `.github/workflows/canonical-wave0.yml` against a fresh database. Preserve PASS evidence and exact Node, npm, Prisma, PostgreSQL, and image versions.
4. Review the Wave 0 migration SQL. It may create only the five approved `canonical_*` tables, three enums, their indexes, constraints, and Prisma migration history entry.

## Backup And Recovery Proof

1. Install `age`, `jq`, and matching PostgreSQL client tools on the restricted operator host. Create an age identity outside Git.
2. Load production `.env`, set `BACKUP_ENCRYPTION_RECIPIENT`, and run `deploy/scripts/backup-production.sh`.
3. Record the discovered production PostgreSQL version and dump-tool version from the manifest. Do not assume a major version from Compose.
4. Set `BACKUP_MANIFEST` and `BACKUP_IDENTITY_FILE`; run `deploy/scripts/verify-backup.sh`.
5. Run `deploy/scripts/restore-rehearsal.sh`. It derives the rehearsal image major from the signed backup manifest, creates a fresh internal-only network and volume, restores with `--exit-on-error`, records versions, and destroys rehearsal resources on exit.
6. Capture complete restored fingerprints, reconciliation output, and isolated PMS/website smoke results before declaring W0-G02 PASS. Notifications, AI calls, public writes, production networks, volumes, and secrets remain unavailable during smoke tests.

## Read-Only Role And Baseline

1. Set a distinct `AUDIT_DATABASE_PASSWORD`; run `deploy/scripts/provision-audit-role.sh` once under the production owner role.
2. Build `AUDIT_DATABASE_URL` for `lumora_audit_ro`, set `AUDIT_DATABASE_USER=lumora_audit_ro`, and set migration mode to `audit` only in the operator process.
3. Run `npm run wave0:readonly-proof`, `npm run wave0:reconcile`, then `npm run wave0:baseline` from `dental-pms`.
4. No production mutation probe is permitted. Negative write tests run only on a disposable rehearsal database.
5. Compare all required cohorts with the 18 September reference. Explain every clinic-activity delta from the same read-only snapshot.

## W0-PROD-DDL-GATE

Populate a restricted evidence directory with independently reviewed PASS JSON for: CI, canonical tests, backup, backup verification, restore, reconciliation, baseline, read-only proof, and flags. Run `npm run wave0:prod-ddl-gate` with `WAVE0_GATE_EVIDENCE_DIR` set.

The gate also proves disabled mode, empty allowlists, the migration hash, no business-table ALTER, and no data-mutating or destructive SQL. If any input is missing, stale, failed, blocked, or unexplained, stop. Because the PMS entrypoint automatically runs `prisma migrate deploy`, do not copy, pull, build, or restart a production image containing the Wave 0 migration before this gate passes.

## Apply And Verify

1. After the recorded gate PASS and approved maintenance window, deploy through the PMS only. Website migration ownership remains forbidden.
2. Confirm the exact five tables and three enums were added, existing business-table schema changed by NONE, and business-data mutations equal NONE.
3. Confirm all control-plane tables are empty except explicitly authorized Wave 0 metadata and every effective canonical capability is OFF.
4. Repeat fingerprints and reconciliation. Business-table count/hash differences caused by Wave 0 must be NONE.
5. Smoke-test current PMS and public website behavior, inspect production logs, and perform the read rollback drill by removing audit-tool access without deleting control-plane evidence.

## Evidence And Rollback

Retain encrypted backup references, hashes, catalogs, manifests, fingerprints, reconciliation, tests, smoke output, timings, named reviewers, and W0-G01 through W0-G12 decisions. A read rollback disables/removes canonical tooling access and keeps current application reads intact. Do not drop control-plane tables or delete evidence without separate authorization.

Wave 0 ends as **WAVE 0 IMPLEMENTED - OWNER ACCEPTANCE PENDING** only after all technical gates pass. W0-G12 remains pending until the named owners review and approve the execution package. Wave 1 remains not authorized.
