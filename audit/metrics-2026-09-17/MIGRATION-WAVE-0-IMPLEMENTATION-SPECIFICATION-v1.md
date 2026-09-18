# LUMORA MIGRATION WAVE 0 IMPLEMENTATION SPECIFICATION v1

Status: **WAVE 0 IMPLEMENTATION AUTHORIZED - WAVE 0 ONLY**
Prepared: 18 September 2026
Architecture dependency: [CANONICAL-TECHNICAL-ARCHITECTURE-MIGRATION-DESIGN-v1.md](CANONICAL-TECHNICAL-ARCHITECTURE-MIGRATION-DESIGN-v1.md)

Wave 0 establishes safety, testing, evidence, reconciliation and feature-control infrastructure before canonical domain schema or business-data migration begins. It changes no business definition and migrates no business record into a canonical entity.

## Wave 0 Invariants

1. Current PMS and public website behavior remains unchanged.
2. Every canonical write, read, alert and UI flag defaults OFF.
3. Audit and dry-run connections cannot mutate production.
4. Production backup validity is demonstrated by isolated restore, not command exit status alone.
5. Baseline artifacts contain aggregate evidence and hashes, not patient/staff content or secrets.
6. The PMS remains the sole migration owner. The public website never runs migrations.
7. Wave 0 database additions are administrative control-plane structures only; no canonical domain event/entity is introduced.
8. No destructive database command is required. Restore testing uses a fresh isolated database/volume.

## Minimum Scope Traceability

| Required Wave 0 scope | Specification coverage |
| --- | --- |
| Backup and restore rehearsal | Sections 2 and 9; W0-030-W0-033 |
| Baseline database fingerprint | Sections 2.4 and 8; W0-013/W0-015/W0-020 |
| Read-only reconciliation harness | Sections 2.5 and 5; W0-011/W0-012/W0-016/W0-022 |
| Migration execution ledger | Section 3; W0-004-W0-006/W0-010 |
| Migration batch identity | Sections 3 and 7; W0-008/W0-010 |
| Feature flag framework | Section 4; W0-009/W0-034-W0-036 |
| Canonical migration environment controls | Sections 4 and 5; W0-007/W0-034-W0-036 |
| Golden test fixtures | Section 6; W0-023/W0-024/W0-028 |
| Idempotency test harness | Section 7; W0-018/W0-027 |
| Rollback verification | Sections 9 and 10; W0-019/W0-021/W0-032 |
| Production write protection during audit/dry-run modes | Section 5; W0-011/W0-012/W0-017/W0-029 |
| Migration logging/audit evidence | Sections 3 and 8; W0-014/W0-039-W0-041 |

# 1. Exact Wave 0 Changes

The following is the complete proposed change set if Wave 0 is later authorized. Paths are repository-relative.

| Change ID | Component/File | Proposed Change | Why Needed | Runtime Impact | Reversible? |
| --- | --- | --- | --- | --- | --- |
| W0-001 | `dental-pms/package.json` | Add Wave 0 scripts and a TypeScript test runner; add only reviewed development dependencies | Make safety checks and fixtures reproducible | None until invoked | Yes |
| W0-002 | `dental-pms/package-lock.json` | Lock the reviewed Wave 0 tooling versions | Reproducible builds | None | Yes |
| W0-003 | `dental-pms/vitest.config.ts` | Configure isolated canonical tests, UTC process timezone and fixture paths | Deterministic test execution | Test only | Yes |
| W0-004 | `dental-pms/prisma/schema.prisma` | Add only MigrationBatch, MigrationBatchCount, MigrationRunEvent, FeatureFlag and FeatureFlagVersion control-plane models | Durable authorized-run ledger and audited flags | Additive tables only; no current query changes | Leave dormant; later drop only by separate approval |
| W0-005 | `lumora-website/prisma/schema.prisma` | Mirror the additive control-plane models because both apps generate clients for the shared schema; website receives no write service | Keep shared schema representation aligned | Generated client only; no website route uses models | Yes before use; otherwise leave dormant |
| W0-006 | `dental-pms/prisma/migrations/<timestamp>_wave0_control_plane/migration.sql` | Add control-plane tables, indexes and constraints only | PMS owns production migrations | Additive DDL during authorized Wave 0 deploy | Restore/read rollback; no destructive down migration |
| W0-007 | `dental-pms/src/lib/canonical/environment.ts` | Parse migration mode, artifact path, read-only connection and environment allowlists; fail closed | Prevent accidental production execution | No effect unless canonical tooling called | Yes |
| W0-008 | `dental-pms/src/lib/canonical/identifiers.ts` | Encapsulate UUIDv7 capability test with conventional UUID fallback | One reviewed event/batch ID strategy | Wave 0 tooling only | Yes |
| W0-009 | `dental-pms/src/lib/canonical/feature-flags.ts` | Resolve domain/feature-scoped DB flags under environment allowlist ceilings | Independent future cutovers | Returns false for every flag by default | Yes |
| W0-010 | `dental-pms/src/lib/canonical/migration-ledger.ts` | Write/read authorized execution ledger; dry runs emit artifacts without production DB writes | Audit future migrations | No business-table access | Yes; tables may remain unused |
| W0-011 | `dental-pms/src/lib/canonical/read-only-db.ts` | Enforce audit role, `READ ONLY`, timeouts, identity check and rollback | Non-mutation guarantee | Audit tooling only | Yes |
| W0-012 | `dental-pms/src/lib/canonical/sql-guard.ts` | Reject multi-purpose/unsafe scripts before execution; allow only reviewed read statements/meta commands | Defense in depth | Audit tooling only | Yes |
| W0-013 | `dental-pms/src/lib/canonical/fingerprint.ts` | Produce normalized schema, migration, count and safe-field hashes | Baseline/change detection | On-demand read load only | Yes |
| W0-014 | `dental-pms/src/lib/canonical/evidence.ts` | Write sanitized JSON manifests, checksums and run logs atomically | Durable review evidence | Filesystem only when tooling runs | Yes |
| W0-015 | `dental-pms/scripts/canonical/wave0-baseline.ts` | Capture schema/migration/count/reconciliation baseline through read-only connection | Freeze pre-Wave-1 evidence | On-demand aggregate reads | Yes |
| W0-016 | `dental-pms/scripts/canonical/wave0-reconcile.ts` | Execute the approved read-only reconciliation pack and compare expected invariants | Reproducible audit | On-demand aggregate reads | Yes |
| W0-017 | `dental-pms/scripts/canonical/wave0-readonly-proof.ts` | Verify role/session/privileges and transaction mode; mutation negative test only in rehearsal | Prove non-mutation controls | None in normal runtime | Yes |
| W0-018 | `dental-pms/scripts/canonical/wave0-idempotency.ts` | Run future importer contract twice against fixtures/rehearsal and compare counts/hashes | Prevent duplicate migration effects | Test/rehearsal only | Yes |
| W0-019 | `dental-pms/scripts/canonical/wave0-restore-verify.ts` | Compare restored DB with backup manifest and run smoke/reconciliation checks | Validate backup recoverability | Rehearsal only | Yes |
| W0-020 | `dental-pms/scripts/canonical/sql/baseline.sql` | Reviewed aggregate metadata/count queries with read-only guards | Stable baseline definition | Read-only | Yes |
| W0-021 | `dental-pms/scripts/canonical/sql/restore-verification.sql` | Schema, migration-history, constraint, count and reconciliation checks | Repeatable restore proof | Rehearsal read-only | Yes |
| W0-022 | `audit/metrics-2026-09-17/READ-ONLY-CANONICAL-RECONCILIATION.sql` | Retain as authoritative reconciliation input; record its SHA-256 in every run | Preserve prior safety standard | None | Yes |
| W0-023 | `dental-pms/tests/canonical/fixtures/golden-fixtures.ts` | Synthetic deterministic fixture definitions for all required cases | Golden expected outcomes | Test only | Yes |
| W0-024 | `dental-pms/tests/canonical/fixtures/golden-expected.json` | Versioned expected cents, roles, timestamps, states and hashes | Detect semantic drift | Test only | Yes |
| W0-025 | `dental-pms/tests/canonical/read-only.test.ts` | Test fail-closed connection/session/SQL guards | Safety regression protection | Test only | Yes |
| W0-026 | `dental-pms/tests/canonical/feature-flags.test.ts` | Test domain isolation, precedence and all-OFF defaults | Prevent accidental broad activation | Test only | Yes |
| W0-027 | `dental-pms/tests/canonical/idempotency.test.ts` | Test repeated/resumed/corrected-source behavior | Migration repeatability | Test only | Yes |
| W0-028 | `dental-pms/tests/canonical/golden-fixtures.test.ts` | Assert canonical invariants against synthetic fixtures | Future wave safety foundation | Test only | Yes |
| W0-029 | `deploy/scripts/provision-audit-role.sh` | Idempotently create/reconcile a least-privilege read-only PostgreSQL role without embedding credentials | Database-enforced audit safety | Role/grants only when authorized | Revoke role/grants; no business data impact |
| W0-030 | `deploy/scripts/backup-production.sh` | Produce custom-format logical backup, metadata and checksum; no restore/drop behavior | Consistent backup artifact | Read load and backup storage only | Yes |
| W0-031 | `deploy/scripts/verify-backup.sh` | Validate checksum, archive catalog, metadata and artifact permissions | Detect unusable backup early | File reads only | Yes |
| W0-032 | `deploy/scripts/restore-rehearsal.sh` | Restore into a newly created isolated rehearsal DB/volume and invoke verification | Demonstrate recoverability | Rehearsal resources only | Remove isolated resources after evidence retained |
| W0-033 | `deploy/docker-compose.rehearsal.yml` | Define isolated PostgreSQL/app-smoke environment with no production volume and no outbound notifications | Safe restore rehearsal | None unless profile invoked | Yes |
| W0-034 | `deploy/docker-compose.prod.yml` | Pass empty canonical allowlists, disabled migration mode and read-only secret references to PMS | Fail-closed production defaults | Current behavior unchanged | Yes |
| W0-035 | `deploy/.env.production.example` | Document safe canonical controls and separate audit-role secret names; all allowlists empty | Repeatable deployment configuration | None | Yes |
| W0-036 | `dental-pms/.env.example` | Add local/rehearsal canonical variables with disabled defaults | Safe developer setup | None | Yes |
| W0-037 | `.github/workflows/canonical-wave0.yml` | Run lint/type/build, canonical unit tests, fresh-DB migration, fixtures and idempotency tests | Automated gate before production | CI only | Yes |
| W0-038 | `.gitignore` | Exclude dumps, encrypted backups, raw manifests, temporary restore data and secret-bearing logs | Prevent sensitive artifact commits | None | Yes |
| W0-039 | `audit/canonical/README.md` | Define artifact retention, redaction, naming and approval rules | Evidence governance | None | Yes |
| W0-040 | `audit/canonical/schemas/baseline-manifest.schema.json` | Validate sanitized baseline artifacts | Stable evidence format | None | Yes |
| W0-041 | `audit/canonical/schemas/migration-run.schema.json` | Validate dry-run/run evidence artifacts | Stable ledger export format | None | Yes |
| W0-042 | `deploy/WAVE-0-RUNBOOK.md` | Exact authorized backup, restore, baseline, validation, rollback and evidence procedure | Operational reproducibility | None | Yes |
| W0-043 | `DEPLOY.md` | Link the Wave 0 runbook and state PMS-only migration ownership/read-only role rules | Avoid operator ambiguity | None | Yes |

No existing API route, UI component, business query or business write path is changed in Wave 0.

# 2. Database Safety Plan

## 2.1 Production Backup

Use PostgreSQL custom-format logical backup from the `lumora_db` container with a consistent snapshot (`pg_dump --format=custom`, no owner/ACL restoration dependency, serializable-deferrable where supported). Stream it to a root-owned host backup directory with restrictive permissions, then create a SHA-256 digest and manifest containing database name, PostgreSQL version, dump tool version, UTC start/end, artifact size, source build SHA and operator identity. Encrypt before off-host retention. A DigitalOcean volume/droplet snapshot may be secondary evidence but does not replace the logical backup.

The backup script must never include plaintext credentials in arguments, logs or artifacts. It reads the existing container environment/secret channel.

## 2.2 Backup Validation

A backup passes initial validation only when:

- the command exits successfully and the file is non-empty;
- the SHA-256 recomputes exactly;
- `pg_restore --list` can parse the complete archive;
- the archive identifies the expected database/schema objects and Prisma migration table;
- metadata and artifact permissions pass policy;
- encryption/off-host-copy confirmation is recorded where required.

This is necessary but not sufficient. Full success requires restore rehearsal.

## 2.3 Restore Rehearsal

Restore into a newly created PostgreSQL 16 rehearsal container/volume using `deploy/docker-compose.rehearsal.yml`. It must not mount the production volume, join the production application network, expose a public port, use production notification/API secrets, or accept production traffic. The database starts empty, so no drop/clean command is required.

After restore, run schema/migration fingerprint, table counts, safe-field checksums, canonical reconciliation and internal application smoke checks against the isolated database. Retain sanitized evidence; destroy the disposable environment only after evidence is complete.

## 2.4 Baseline Fingerprint

Capture:

1. PostgreSQL server version, database collation/timezone, installed extensions and relevant settings.
2. Normalized schema-only dump SHA-256, excluding volatile comments/ownership noise under a documented normalization version.
3. SHA-256 for both Prisma schemas, all PMS migration files in ordered path/name order, and Prisma migration-history rows.
4. Per-public-table row counts.
5. Per-source safe-field digest: stable IDs, relationship IDs, statuses, timestamps and cents/quantities only. Names, contact data, clinical text, notes, credentials and file URLs are excluded.
6. Reconciliation query SHA-256, output schema version and aggregate result digest.
7. Current application build/git SHA and production image digests.

Only aggregate counts and final digests leave the read-only process. No source rows are written to audit artifacts.

## 2.5 Transaction and Lock Controls

- Production audits use a dedicated `lumora_audit_ro` role with `CONNECT`, `USAGE` and explicit `SELECT`; no INSERT/UPDATE/DELETE/TRUNCATE/DDL, sequence use, role creation or TEMP privilege.
- Set role/session defaults to read-only. Every harness connection also begins `TRANSACTION READ ONLY` and verifies `current_user` plus `current_setting('transaction_read_only') = 'on'` before querying.
- Use `lock_timeout = 5s`, `statement_timeout = 60s`, `idle_in_transaction_session_timeout = 30s`, `application_name = 'lumora-canonical-audit'`, and `ROLLBACK` on success or failure.
- Aggregate scans must be reviewed with query plans on rehearsal first. Run large production scans off-peak and cancel rather than relax locks/timeouts ad hoc.
- Authorized future write migrations use a separate credential and execution path. The audit harness cannot accept it.

# 3. Migration Ledger Design

Use **both database control-plane records and signed/sanitized artifact files**.

- The database ledger is authoritative for future authorized write runs because it can participate in execution transactions and uniqueness constraints.
- Artifact files are authoritative evidence for read-only dry runs, backups, restore rehearsals and approvals because production read-only runs must not write their own audit rows.
- A later approved operation may attach the reviewed dry-run artifact hash to a database MigrationBatch; it must not rewrite the artifact.

## 3.1 Database Structures

### MigrationBatch

| Field | Purpose |
| --- | --- |
| `migrationBatchId` | UUIDv7 if the toolchain gate passes; otherwise conventional UUID |
| `wave` | Integer wave number |
| `scopeType`, `scopeKey`, `domain` | Exact domain/branch/session/item scope |
| `sourceSnapshotId` | Immutable baseline/snapshot manifest identifier |
| `sourceChecksum` | SHA-256 of reviewed safe source projection/manifest |
| `buildSha` | Exact application/migration build |
| `actorType`, `actorId` | Human/service principal initiating authorized run |
| `dryRun` | Distinguishes simulation from authorized write execution |
| `status` | PLANNED, DRY_RUN, REVIEW_REQUIRED, APPROVED, RUNNING, VALIDATING, COMPLETED, FAILED, BLOCKED or ROLLED_BACK |
| `startedAt`, `completedAt` | UTC run times |
| `approvalReference` | External/internal approval identifier; mandatory before write mode |
| `validationResult` | PASS/FAIL/BLOCKED plus validation-run reference |
| `artifactManifestHash` | Links immutable evidence package |

### MigrationBatchCount

Typed child rows store `batchId`, `sourceName`, `entityType`, `countType` (`SOURCE`, `CANDIDATE`, `MIGRATED`, `SKIPPED`, `EXCEPTION`, `VALIDATED`), integer count, optional amount cents, currency and checksum. This avoids opaque count blobs.

### MigrationRunEvent

Append-only status transitions store batch, prior/new status, occurredAt, actor/build, reason, checkpoint/source cursor, error class and evidence hash. Current batch status is a projection and must agree with the latest event.

## 3.2 Artifact Package

Each run directory contains `manifest.json`, sanitized counts, reconciliation output, test results, schema/source hashes, approval references and log digest. It contains no database dump, raw row, PHI/PII, secret or unredacted SQL parameter. The package itself receives a SHA-256 manifest and optional detached signature. Backups live in encrypted restricted storage, never under `audit/` or Git.

# 4. Feature Flag Model

Flags are independently scoped by control type, domain and optional feature/scope key.

| Control type | Example key | Safe Wave 0 default |
| --- | --- | --- |
| Canonical write capture | `write_capture.finance.payment` | OFF |
| Canonical shadow read | `shadow_read.finance.invoice` | OFF |
| Canonical metric read | `metric_read.FIN-C12` | OFF |
| Domain cutover | `domain_cutover.finance.enterprise` | OFF; also requires approved CutoverRegistry entry later |
| Alert activation | `alert_type.ALT-C01` | OFF |
| UI surface cutover | `ui_surface.executive_dashboard` | OFF |

`FeatureFlag` provides stable identity. Append-only `FeatureFlagVersion` records enabled value, domain, scope, effective time, expiry, actor, reason and approval reference. Unique constraints prevent two effective versions for the same scope/time.

Production environment allowlist ceilings are empty in Wave 0:

- `CANONICAL_WRITE_CAPTURE_ALLOWLIST=`
- `CANONICAL_SHADOW_READ_ALLOWLIST=`
- `CANONICAL_METRIC_READ_ALLOWLIST=`
- `CANONICAL_ALERT_TYPE_ALLOWLIST=`
- `CANONICAL_UI_SURFACE_ALLOWLIST=`
- `CANONICAL_MIGRATION_MODE=disabled`

A capability is effective only when its exact database flag is enabled, its exact key/domain is present in the corresponding environment allowlist, its approval is valid, and any required domain cutover gate passes. Missing, malformed, expired or unreachable configuration evaluates OFF. There is no `ENABLE_CANONICAL=true` master switch.

# 5. Read-Only / Dry-Run Guarantee

## 5.1 Database Enforcement

1. Provision `lumora_audit_ro` separately from the application writer.
2. Revoke TEMP and all write/DDL privileges; grant explicit SELECT only.
3. Set default transaction read-only and timeouts at role/database scope.
4. Future tables are not automatically readable until the reviewed grant step is updated.
5. Audit credentials are stored as a separate secret and never fall back to `DATABASE_URL`.

## 5.2 Harness Enforcement

- Audit commands require `CANONICAL_MIGRATION_MODE=audit` or `dry-run` and a configured `AUDIT_DATABASE_URL` whose database user matches the expected read-only role.
- The harness opens a read-only transaction, verifies server state, records verification in the artifact, runs only a hash-pinned reviewed query pack, and always rolls back.
- SQL guard accepts SELECT, WITH...SELECT, EXPLAIN without ANALYZE-side effects, SHOW and approved psql display/transaction commands. It rejects DML, DDL, COPY-to-server, CALL, DO, unsafe functions and unreviewed multi-statement text.
- Dry-run candidate transformations occur in memory or an isolated rehearsal database. They do not write production ledger/control tables.
- If production unexpectedly grants mutation capability, role/privilege inspection fails the audit before domain queries. Negative mutation statements are tested only in rehearsal, never sent to production.
- The command exits non-zero when read-only mode, role identity, query hash, timeout settings or source snapshot expectations differ.

# 6. Golden Fixture Plan

All fixtures use synthetic identifiers such as `pat_fixture_001`; no real names, contact values, notes, credentials or production-derived text. Fixed timestamps straddle the Asia/Colombo month boundary: `2026-01-31T18:29:59.999Z` is 23:59:59.999 Colombo and `2026-01-31T18:30:00.000Z` is 00:00:00 on 1 February.

| Fixture | Minimum scenario | Assertions prepared for later waves |
| --- | --- | --- |
| GF-001 Normal invoice/payment | LKR invoice issued, one exact payment | Cents, settlement crossing, B05/B06 distinction |
| GF-002 Partial payment | Two allocations across boundary, residual balance | Receivable and settledAt remain open until final crossing |
| GF-003 Reversal/refund | Paid invoice, payment reversal and partial refund | Append-only opposite events and as-of history |
| GF-004 Unassigned branch | Valid event with required branch unknown | Clinic total = assigned + Unassigned |
| GF-005 Unassigned doctor | Completed/billed evidence without proven performer | D09/D10 remain Unassigned |
| GF-006 Multi-doctor contribution | 33.33/33.33/33.34 or evidence-unit shares | 10,000 bp and deterministic largest-remainder cents |
| GF-007 Multi-branch lifecycle | B12 presentation, B13 acceptance and B04 service differ | No branch-role substitution |
| GF-008 Rescheduled appointment | Original occurrence closed, new occurrence created | D01/B01 history and exclusive outcomes |
| GF-009 No-show corrected | No-show event followed by approved correction/arrival | As-of outcome changes without overwrite |
| GF-010 Queue transfer | Doctor/branch segment A ends, B begins | Non-overlap and preserved assignment history |
| GF-011 Visit reopen/correction | Completion, reopen, corrected completion | Earlier as-of remains reproducible |
| GF-012 Payroll proration | Contract change exactly at Colombo month boundary | Calendar-day cents, deterministic rounding, due policy |
| GF-013 Inventory lifecycle | Opening, receipt, branch transfer and consumption | Quantity equation and WAC chain |
| GF-014 Unknown inventory cost | Known quantity with null opening cost | Quantity publishes with coverage; value unavailable, never zero |
| GF-015 Alert lifecycle | Duplicate detections, snooze expiry, reopen, source resolution | One episode under dedupe policy and valid transitions |

Additional boundary fixtures cover zero-value known money versus Unknown, leap day, month-end due date, future scheduled appointment, concurrent idempotency attempts and failed partial migration resume.

# 7. Idempotency Strategy

## 7.1 Stable Identity

- `migrationBatchId` identifies an attempt/program unit but is not the canonical-record uniqueness key.
- Every source-derived candidate has a deterministic SourceRecordReference: source system, schema/table, source primary key, canonical target type, semantic source-version hash and transformation version.
- Event idempotency key is a SHA-256 namespace hash of target event type, stable source reference, event semantic version and occurrence discriminator. It excludes batch ID so another batch cannot duplicate the same event.
- Database unique constraints enforce source reference and event idempotency keys. Application checks are secondary.

## 7.2 Run Behavior

| Situation | Required behavior |
| --- | --- |
| First run | Insert candidate once, record source/count/evidence |
| Partial failure | Resume from durable checkpoint, but rely on unique keys rather than cursor alone |
| Repeat same batch | Reject concurrent duplicate attempt; completed batch becomes verification-only/no-op |
| New batch, same source | Existing identical target is counted VALIDATED/SKIPPED, never duplicated |
| Concurrent workers | Domain/scope advisory lock plus uniqueness constraints |
| Corrected source input | New semantic source-version hash; create correction/superseding event only under approved rule |
| Source changed without approved correction rule | Block and create exception; never overwrite target |
| Transformation version changed | Require new reviewed batch and comparison; no silent remigration |

Every importer must support plan/candidate output before write mode and emit equal deterministic candidate hashes for identical snapshots.

# 8. Baseline Freeze

Wave 0 captures a new same-snapshot baseline immediately before any Wave 1 work. The 18 September reconciliation remains the authoritative prior reference and must be preserved.

## 8.1 Required Baseline Contents

- Schema fingerprint, PostgreSQL settings/extensions and Prisma schema/migration hashes.
- `_prisma_migrations` history and checksum.
- Row counts for every public table.
- Safe-field source hashes for finance, patient/Visit, queue, appointment, treatment, payroll and inventory populations.
- Full aggregate output and hash of the approved read-only reconciliation pack.
- Current build/image digests and feature-flag snapshot proving all canonical flags OFF.
- Backup manifest, encrypted-storage reference and restore-rehearsal evidence.

## 8.2 Known Reconciliation Cohorts to Preserve

| Cohort | 18 September 2026 reference |
| --- | ---: |
| Invoices | 107 |
| Payments | 95 |
| Payments without ledger representation | 2 |
| Paid invoices without `paidDate` | 11 |
| Completed Visits with both completion markers | 145 |
| PAID queue episodes without valid Visit | 31 |
| PAID queue episodes linked to IN_PROGRESS Visit | 2 |
| Queue rows / started encounter proxies / Visit-linked starts | 196 / 160 / 146 |
| Treatment plans / items | 37 / 65 |
| Presentation / acceptance / item-start events | 0 / 0 / 0 |
| Completed plan items with Visit link | 3 |
| Plan items with fee ID | 64/65 |
| Invoice items with fee ID | 118/124 |
| Contracts / active-user proxy / SalaryRecord | 2 / 6 / 0 |
| Active inventory items/branches/stock rows | 1 / 1 / 1 |
| Stock movements / PO rows / PO item cost rows | 1 / 0 / 0 |
| Canonical alert lifecycle rows | 0 |

Normal clinic activity may change counts before Wave 0. Any delta must be reproduced from a new read-only source snapshot and explained in the baseline comparison; unexplained differences fail the gate. Wave 1 compares against the frozen Wave 0 manifest, not mutable expectations in prose.

# 9. Rollback Rehearsal

## 9.1 Successful Restore Criteria

A rehearsal passes only when all are true:

1. Backup checksum, archive catalog and manifest match before restore.
2. Restore into a fresh PostgreSQL 16 instance completes without ignored errors.
3. Restored schema fingerprint, Prisma history, object counts, constraints and indexes match the backup baseline.
4. Every table count and safe-field source digest matches exactly.
5. The canonical reconciliation pack reproduces the baseline aggregate output/digest.
6. Referential-integrity checks return no new orphan/duplicate violations.
7. PMS and website builds can connect to the restored database in isolated smoke mode; login page, public slot read and representative read-only staff pages respond.
8. Email, SMS, WhatsApp, AI calls and public booking writes are disabled during smoke checks.
9. Recovery start/end, operator, versions, logs and observed recovery duration are recorded.
10. No production container, volume, secret, network route or record was changed.

## 9.2 Acceptable Evidence

Retain the encrypted backup reference, SHA-256 manifest, `pg_restore` catalog and logs, restored fingerprint comparison, count/hash comparison, reconciliation result, smoke-test report, elapsed recovery time and reviewer sign-off. A successful backup command without this evidence is a Wave 0 failure.

# 10. Wave 0 Acceptance Gate

Wave 0 is PASS only when every criterion passes; there is no partial approval.

| Gate ID | Pass criterion | Failure condition |
| --- | --- | --- |
| W0-G01 Backup | Current production logical backup, checksum and encrypted retention reference exist | Missing, unreadable, unhashed or exposed artifact |
| W0-G02 Restore | Fresh isolated restore satisfies all Section 9 criteria | Any schema/count/hash/reconciliation mismatch or production contact |
| W0-G03 Baseline | Versioned manifest freezes schema, migration history, counts, known cohorts, hashes and build | Missing evidence or unexplained delta |
| W0-G04 Ledger | Control-plane model, artifact schemas and lifecycle tests pass | Required field/status/audit transition absent |
| W0-G05 Flags | Every effective canonical flag evaluates OFF in production defaults; domain isolation tests pass | Any broad/global activation path or default ON |
| W0-G06 Read-only | Audit role has no mutation/TEMP/DDL capability; harness verifies read-only and fails closed | Fallback to writer, unknown role, unsafe query or missing rollback |
| W0-G07 Fixtures | All synthetic fixture and expected-output tests are deterministic and runnable | Production data dependency, nondeterminism or missing required scenario |
| W0-G08 Idempotency | Double-run, resume, concurrent and corrected-source tests pass in rehearsal | Duplicate target, overwrite or inconsistent candidate hash |
| W0-G09 Reconciliation | Same source snapshot reproduces aggregate results and digest | Unexplained result drift |
| W0-G10 Rollback | Runbook and restore rehearsal reviewed; read fallback requires no data deletion | Destructive rollback dependency or untested procedure |
| W0-G11 Behavior | PMS/website smoke tests and production monitoring show unchanged current behavior | API/UI/business-write regression |
| W0-G12 Approval | Evidence package has named technical/data owner approval | Missing/expired approval reference |

Wave 1 cannot begin while any Wave 0 exception is open at CRITICAL/HIGH impact or any gate is FAIL/BLOCKED.

# 11. Ordered Implementation Plan If Later Authorized

The following is the exact execution order for a future authorized Wave 0. It is not executed by this specification.

1. Record Wave 0 authorization, named operators/reviewers, maintenance constraints and evidence-retention location.
2. Create an isolated implementation branch and capture pre-change Git/build hashes and current dirty-worktree ownership.
3. Add test runner, configs, synthetic fixtures and artifact schemas; run them without database access.
4. Add fail-closed environment, identifier, SQL guard, read-only, fingerprint, evidence, feature-flag and ledger modules.
5. Add baseline/reconciliation/idempotency/restore scripts and reviewed SQL packs.
6. Add additive control-plane Prisma models to PMS and mirrored website schema; generate but do not apply the migration.
7. Generate/review the Wave 0 migration SQL for additive-only tables, indexes and constraints; verify no business-table alteration or destructive statement.
8. Add deployment backup/audit-role/restore scripts, isolated rehearsal Compose file and Wave 0 runbook.
9. Add disabled production/local environment examples and empty per-capability allowlists.
10. Run CI against a fresh disposable database: migration, build, unit fixtures, flag defaults, read-only guards and idempotency tests.
11. Provision the production read-only role under separate approval; verify grants/settings through catalog inspection without mutation probes.
12. Produce and verify the production logical backup; encrypt/store it under restricted retention policy.
13. Restore that backup into the fresh isolated rehearsal environment; run full Section 9 verification and smoke tests.
14. Capture production baseline through the read-only role; compare with the 18 September reference and review every delta.
15. Apply only the reviewed additive Wave 0 control-plane migration under a separately approved deployment window.
16. Rebuild/deploy PMS and website with every canonical allowlist empty and migration mode disabled.
17. Verify control-plane tables are empty except authorized Wave 0 metadata, all flags resolve OFF, and current application behavior is unchanged.
18. Rerun baseline/reconciliation through the read-only role and prove business-table counts/hashes did not change because of Wave 0.
19. Perform read rollback drill by disabling/removing canonical tooling access while preserving current application operation; do not delete control-plane evidence.
20. Assemble signed evidence package and obtain W0-G01 through W0-G12 approvals.
21. Mark Wave 0 complete only after all gates pass. Keep every Wave 1 feature and migration handler absent or disabled.

# 12. Authorization Gate

**WAVE 0 IMPLEMENTATION AUTHORIZED - WAVE 0 ONLY**

This authorization permits only the reviewed Wave 0 safety and administrative control-plane work. It does not mark Wave 0 accepted and does not permit Wave 1 to begin.
