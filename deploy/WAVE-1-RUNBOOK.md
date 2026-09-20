# Wave 1 Pre-Production Runbook

Status: **IMPLEMENTATION AUTHORIZED - PRE-PRODUCTION ONLY**. Wave 1 production DDL and Wave 2 are **NOT AUTHORIZED**. Technical approver: Pasindu Perera. Data approver: Dr Amitha Perera. The frozen [Wave 1 specification](../audit/metrics-2026-09-17/LUMORA-MIGRATION-WAVE-1-IMPLEMENTATION-SPECIFICATION-v1.md) controls scope.

## Production Boundary

The PMS `docker-entrypoint.sh` runs `prisma migrate deploy` on every startup. Therefore **do not sync, build, restart or redeploy production PMS from a tree containing the Wave 1 migration**. Keep the production VPS on its Wave 0 source/image until a separate production-DDL authorization. No production schema or row change is part of this runbook's pre-production execution.

The Wave 1 SQL starts with a fail-closed check of PostgreSQL `lumora.wave1_ddl_authorization`. Production Compose does not set it. A missing value aborts migration before any Wave 1 object is created. In disposable CI/rehearsal databases only, the operator explicitly sets `ALTER DATABASE <disposable_db> SET lumora.wave1_ddl_authorization = 'preproduction-disposable'` before `prisma migrate deploy`. A future production operator may set an owner-approved reference only **after** W1-PROD-DDL-GATE and a separate owner instruction, and must reset the setting after the authorized deployment. Do not use `PGOPTIONS`: Prisma did not pass it through in the verified local rehearsal. This guard is an additional stop, not a substitute for the deployment hold.

## Pre-Production Order

1. Confirm the frozen 17-table allowlist, migration SHA and `wave1:prod-ddl-gate -- --static-only` output. Inspect SQL for any legacy `ALTER`, destructive DDL, domain table, seed or business DML. Any deviation blocks the gate.
2. Create a **disposable** PostgreSQL 16 database with no production volume/network. Set the database-local authorization marker as above. Apply all migrations from zero with PMS Prisma; before fixtures, run `wave1:baseline -- post` and retain its exact 17 zero-row counts and catalog list. Rerun `prisma migrate deploy` and require no pending migrations.
3. Run synthetic real-DB tests (`WAVE1_TEST_DATABASE_URL` must point only to the disposable database), PMS type check/build and website schema/type check/build. CI must repeat these checks. Never use production rows for fixtures.
4. Capture a fresh production baseline using the Wave 0 dedicated read-only role and frozen reconciliation SQL. For pre-DDL production, `wave1:baseline -- pre` must find no Wave 1 table. Explain normal clinic-activity drift from the accepted Wave 0 baseline; do not repair historical exceptions.
5. Produce a current encrypted production backup with the Wave 0 backup script and record artifact hash/source provenance. Establish an encrypted copy in a different VPS failure domain. Record location, retention, access, encryption/key separation, successful retrieval and checksum, and linkage to a version-matched isolated restore. **Do not put a dump or private identity in Git.** If independent storage/key recovery is not established, the gate remains BLOCKED.
6. Restore the current backup into an isolated same-major PostgreSQL database, run `wave1:restore-verify` against a backup-aligned source baseline, compare schema, migration history, counts, safe identity digests and reviewed reconciliation output. No restoration touches production.
7. Assemble the sanitized pre-production package and evaluate `wave1:prod-ddl-gate`. The gate may PASS only with concrete hashes and owner implementation approval. A PASS is not authorization to deploy. Stop and request separate production-DDL owner instruction.

## Object And Access Controls

Only the 17 named Wave 1 tables, their approved enums/indexes/constraints/trigger functions/grants may exist. The migration conditionally grants the dedicated audit role SELECT and never grants it write, CREATE or TEMP. The website mirrors Prisma types but has no migration or canonical write path. No business event type, domain event table, production writer route, exception record, policy row, cutover row or feature activation is introduced. All canonical flags and allowlists stay OFF.

## Rollback And Failure

Before production authorization, rollback is simply to stop pre-production work; the production Wave 0 image and database remain unchanged. On an accidental production startup with this source, the missing database authorization marker must fail migration before Wave 1 DDL; keep/restart the known Wave 0 image and investigate without setting the marker. Do not run a destructive down migration. After any later authorized DDL, retain legacy reads/writes and fall back through flags without deleting canonical history; restore is reserved for migration disaster under a separately approved recovery action.
