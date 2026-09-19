# LUMORA MIGRATION WAVE 0 EXECUTION & ACCEPTANCE PACKAGE v1

Status: **WAVE 0 IMPLEMENTATION INCOMPLETE / BLOCKED - OWNER ACCEPTANCE PENDING**

Prepared: 19 September 2026. Scope: **Wave 0 only**. Wave 1 remains **NOT AUTHORIZED**. Technical Architecture remains **TECHNICAL ARCHITECTURE APPROVED**. No canonical business-domain table, event, backfill, repair, dashboard switch, API change, or UI workflow change was authorized or delivered by Wave 0.

## A. Implementation Manifest

All paths are repository-relative. `E1` is the committed Wave 0 code and successful CI run; `E2` the fresh database migration and canonical test evidence; `E3` the backup/restore evidence; `E4` the read-only baseline/reconciliation evidence; `E5` the production DDL gate and post-DDL proof. Additional safety files are noted below.

| Change ID | Planned | Implemented | File(s) changed | Deviation | Evidence |
| --- | --- | --- | --- | --- | --- |
| W0-001 | Tooling/scripts | Yes | `dental-pms/package.json` | Pinned Node 20-compatible Vitest and parser | E1, E2 |
| W0-002 | Lockfile | Yes | `dental-pms/package-lock.json` | None | E1 |
| W0-003 | Test configuration | Yes | `dental-pms/vitest.config.ts` | None | E2 |
| W0-004 | PMS control-plane models | Yes | `dental-pms/prisma/schema.prisma` | None | E1, E5 |
| W0-005 | Website schema mirror | Yes | `lumora-website/prisma/schema.prisma` | No website write/migrate path | E1 |
| W0-006 | Additive migration | Yes | `dental-pms/prisma/migrations/20260918190000_wave0_control_plane/migration.sql` | None | E2, E5 |
| W0-007 | Fail-closed environment | Yes | `dental-pms/src/lib/canonical/environment.ts` | None | E2 |
| W0-008 | Identifier policy | Yes | `dental-pms/src/lib/canonical/identifiers.ts` | UUIDv4 runtime fallback; Node 20 has no guaranteed native UUIDv7 | E1 |
| W0-009 | Scoped flags | Yes | `dental-pms/src/lib/canonical/feature-flags.ts` | None | E2, E5 |
| W0-010 | Migration ledger | Yes | `dental-pms/src/lib/canonical/migration-ledger.ts` | Integration coverage added in follow-up commit; no production batch | E2, E5 |
| W0-011 | Read-only DB harness | Yes | `dental-pms/src/lib/canonical/read-only-db.ts` | None | E4 |
| W0-012 | Strict SQL guard | Yes | `dental-pms/src/lib/canonical/sql-guard.ts` | Full AST and exact query-pack hash required | E2, E4 |
| W0-013 | Fingerprints | Yes | `dental-pms/src/lib/canonical/fingerprint.ts` | Catalog-based PK discovery prevents role-visibility drift | E3, E4 |
| W0-014 | Evidence writer | Yes | `dental-pms/src/lib/canonical/evidence.ts` | ISO timestamp serialization regression fixed before final capture | E3, E4 |
| W0-015 | Baseline tool | Yes | `dental-pms/scripts/canonical/wave0-baseline.ts` | None | E4 |
| W0-016 | Reconciliation tool | Yes | `dental-pms/scripts/canonical/wave0-reconcile.ts` | None | E4 |
| W0-017 | Read-only proof | Yes | `dental-pms/scripts/canonical/wave0-readonly-proof.ts` | No production mutation probes | E4 |
| W0-018 | Idempotency harness | Yes | `dental-pms/scripts/canonical/wave0-idempotency.ts` | Synthetic contract only; no Wave 1 importer | E2 |
| W0-019 | Restore verifier | Yes | `dental-pms/scripts/canonical/wave0-restore-verify.ts` | Compares five dimensions including reconciliation | E3 |
| W0-020 | Baseline SQL | Yes | `dental-pms/scripts/canonical/sql/baseline.sql` | None | E1 |
| W0-021 | Restore SQL | Yes | `dental-pms/scripts/canonical/sql/restore-verification.sql` | None | E1 |
| W0-022 | Reviewed query pack | Yes | `audit/metrics-2026-09-17/READ-ONLY-CANONICAL-RECONCILIATION.sql` | Retained unchanged; hash pinned | E4 |
| W0-023 | Synthetic fixtures | Yes | `dental-pms/tests/canonical/fixtures/golden-fixtures.ts` | No production data | E2 |
| W0-024 | Golden expectations | Yes | `dental-pms/tests/canonical/fixtures/golden-expected.json` | All 15 approved IDs and expected outcomes frozen | E2 |
| W0-025 | Read-only tests | Yes | `dental-pms/tests/canonical/read-only.test.ts` | None | E2 |
| W0-026 | Flag tests | Yes | `dental-pms/tests/canonical/feature-flags.test.ts` | None | E2 |
| W0-027 | Idempotency tests | Yes | `dental-pms/tests/canonical/idempotency.test.ts` | Synthetic future-importer contract | E2 |
| W0-028 | Golden tests | Yes | `dental-pms/tests/canonical/golden-fixtures.test.ts` | None | E2 |
| W0-029 | Audit role provisioning | Yes | `deploy/scripts/provision-audit-role.sh` | Revoked inherited PUBLIC TEMP; retained TEMP for app owner | E4 |
| W0-030 | Encrypted backup | Yes | `deploy/scripts/backup-production.sh` | `age` recipient/identity restricted to root | E3 |
| W0-031 | Backup verification | Yes | `deploy/scripts/verify-backup.sh` | None | E3 |
| W0-032 | Isolated restore | Yes | `deploy/scripts/restore-rehearsal.sh` | Derived major from production manifest; loopback TCP correction | E3 |
| W0-033 | Rehearsal Compose | Yes | `deploy/docker-compose.rehearsal.yml` | Internal-only network and fresh named volume | E3 |
| W0-034 | Safe production Compose | Yes | `deploy/docker-compose.prod.yml` | Includes domain cutover allowlist and audit connection reference | E5 |
| W0-035 | Production env example | Yes | `deploy/.env.production.example` | All allowlists empty | E5 |
| W0-036 | Local env example | Yes | `dental-pms/.env.example` | All allowlists empty | E1 |
| W0-037 | CI workflow | Yes | `.github/workflows/canonical-wave0.yml` | Includes website ownership proof and disposable ledger integration | E1, E2 |
| W0-038 | Artifact exclusions | Yes | `.gitignore` | Excludes backups, runtime evidence, npm cache | E1 |
| W0-039 | Evidence policy | Yes | `audit/canonical/README.md` | None | E1 |
| W0-040 | Baseline schema | Yes | `audit/canonical/schemas/baseline-manifest.schema.json` | None | E1 |
| W0-041 | Run schema | Yes | `audit/canonical/schemas/migration-run.schema.json` | None | E1 |
| W0-042 | Runbook | Yes | `deploy/WAVE-0-RUNBOOK.md` | None | E1, E3 |
| W0-043 | Deploy guidance | Yes | `DEPLOY.md` | Existing legacy host examples are not the current production domains | E1 |

Additional Wave 0 safety files: `wave0-prod-ddl-gate.ts`, `wave0-prepare-gate.ts`, `wave0-flags-proof.ts`, `post-ddl-proof.sql`, `audit-role-proof.sql`, `ledger-integration.test.ts`, and `configure-wave0-production-env.sh`. They tighten, rather than expand, the authorized Wave 0 scope.

## B. Git And Build Evidence

- Pre-Wave-0 SHA: `03e80367790de617adcb63d73facc9880d336f3b`.
- Initial implementation/deployment SHA: `b884092877e01423a5130286c17d8eac91b41f68`.
- Follow-up ledger/test SHA: `8cc4e7ef6b42305ed527db4593403a726e7344b4`.
- Changed-file lists: `git diff --name-only 03e8036 b884092` and `git show --name-only 8cc4e7e`. Unrelated dirty queue, Visit, seed, form, and fee editor files were not committed or deployed.
- Dependency additions: `pg 8.23.0`, `pgsql-ast-parser 12.0.2`, `@types/pg 8.23.1`, `vitest 3.2.4`.
- Migration SQL SHA-256: `cab33e5108d3cfe82011a33d7d1a3c41819d532e3b059b9a82ff3e3cc4cbd569`.
- Reviewed reconciliation SQL SHA-256: `c91295a147182ae6251825e22c31a7895b98aeb872050ee55f8adcad79cd122e`.
- Production Node `20.20.2`, npm `10.8.2`, Prisma Client `5.22.0`, Next.js `15.5.23`, PostgreSQL `16.14`. Local Node `24.15.0`, npm `11.12.1`.
- Production PMS image: `sha256:1453c0f02edb41c1948644c7e0247df9adf11c030d0d9368fcd618b657aa1c9e`; website image: `sha256:2050a4aab9963d9857eac5c428fb50bcd2a6a430e5e4ab2f97eae5b089b2e298`.
- GitHub Actions: [initial deployment run 35397609188](https://github.com/Pasindu099/Patient-management-system/actions/runs/35397609188) PASS; [ledger follow-up run 35468353949](https://github.com/Pasindu099/Patient-management-system/actions/runs/35468353949) PASS.

## C. Production Schema Evidence

PMS applied `20260918190000_wave0_control_plane` once, with `finished_at` present and no rollback. Exactly three enums were added: `CanonicalFeatureControlType`, `CanonicalMigrationCountType`, and `CanonicalMigrationStatus`. Exactly five tables were added: `canonical_feature_flags`, `canonical_feature_flag_versions`, `canonical_migration_batches`, `canonical_migration_batch_counts`, and `canonical_migration_run_events`, plus their approved indexes/constraints. All five tables contain zero rows.

For the 53 pre-existing public tables, pre/post comparison found identical object lists, 597 columns, 131 constraints, and 125 indexes. **Existing business-table schema changes: NONE. Migration-authored business-data mutations: NONE.** The migration SQL contains no business DML/backfill. Live clinic activity during the comparison interval is detailed below and is not attributed to the Wave 0 migration.

## D. Backup Evidence

- Production source PostgreSQL `16.14`; `pg_dump` `16.14`; custom-format logical archive created 18 September 2026 at `21:06:53 UTC`.
- Encrypted artifact: `lumora-wave0-20260918T210653Z.dump.age`, retained under root-only `/root/lumora-wave0/backups` on the VPS. The private age identity is root-only and not included here.
- Encrypted archive SHA-256: `b5bc2e3d6989a5609d1245d4879d5e1aa87f6525c5a645930707044471bec42f`.
- Archive checksum, age decryption, and `pg_restore --list` validation: PASS. No dump or private key is in Git/audit artifacts.

## E. Restore Evidence

- Primary rehearsal: fresh project `lumora_wave0_20260918211427`, PostgreSQL `16.14`, isolated internal Docker network/volume, no production volume/network, no production notification/AI secrets. Temporary resources were removed after verification.
- Full restore verification SHA-256: `46fa719429647481dd98cac97f7a7d86533025189b16f86e4062f2fa57f6c7ae`.
- Schema fingerprint, Prisma history, every table count, safe primary-key digests, and the 29 comparable reconciliation result sets: **all match the backup-aligned source baseline**. Audit context/timestamp output is excluded from the result comparison.
- Isolated application smoke: PMS login `200`, protected dashboard `307`, website home `200`, public slots read `200`. Notification and AI environment values were empty. Recovery major version was discovered, not assumed.

## F. Baseline And Reconciliation Evidence

- Pre-DDL baseline at `2026-09-18T21:20:33.315Z`: SHA-256 `2f91abd6280b759cb3cf56ff86ff4f7ad253817110f29ce865df4b822b95edb8`.
- Post-DDL/pre-Wave-1 baseline at `2026-09-19T20:38:20.342Z`: SHA-256 `16617b86e7e442aa74228a0a1c08c7951f86bbd00d6197b4c415d776d594c006`.
- The 18 September reference cohorts exactly matched the pre-DDL snapshot: invoices `107`, payments `95`, payments without ledger `2`, paid invoices without paid date `11`, completed Visits with both markers `145`, queue rows/started proxies/Visit-linked starts `196/160/146`, treatment plans/items `37/65`, contracts/active-user proxy/salary rows `2/6/0`, and active inventory items/branches/stock rows `1/1/1`.
- During the approximately 23-hour interval, clinic activity changed patients `172 -> 179`, Visits `150 -> 156`, queue rows `196 -> 202`, invoices `107 -> 112`, payments `95 -> 100`, ledger transactions `93 -> 98`, and status events `305 -> 322`. Matching related changes appeared in medical histories, invoice items, Visit-invoice links, clinic sessions, and audit logs. These deltas are reproducible from the two read-only aggregate manifests. The two pre-existing payment/ledger exceptions and 11 missing paid dates remain unchanged; they were not repaired.
- The backup and isolated restore reproduced the *same* source snapshot and reconciliation. The later production baseline is intentionally a newer live snapshot, not expected to have identical business counts.

## G. Read-Only And Flag Proof

- Dedicated production role: `lumora_audit_ro`, `transaction_read_only=on`, database TEMP `false`, CREATE `false`, all-table write privilege `false`. Runtime harness verifies exact identity, sets `60s` statement and `5s` lock timeouts, requires the full parsed read-only AST and frozen query hash, and unconditionally rolls back.
- Mutation probes were not sent to production. Negative SQL tests ran locally; parser uncertainty fails closed. Production audit role was rechecked after the new table grants, with the same no-write result.
- Production `CANONICAL_MIGRATION_MODE=disabled`. `write_capture.*`, `shadow_read.*`, `metric_read.*`, `domain_cutover.*`, `alert_type.*`, and `ui_surface.*` allowlists are all empty and effective capabilities are OFF. Control-plane flag/version tables are empty.

## H. Tests And Behavior

- Fresh disposable PostgreSQL 16 migration history: 14 migrations applied, including Wave 0; exactly five empty `canonical_*` tables.
- Local canonical unit/golden/idempotency/read-only/ledger integration tests: `23/23` PASS; PMS TypeScript and both production builds PASS.
- GitHub Actions run 35397609188 PASS for the deployed commit. Website ownership check confirms no migration command or control-plane write path.
- Live production smoke on the **configured** domains: `https://pms.lumoradentalstudio.com/login` `200`, protected dashboard `307`, `https://lumoradentalstudio.com/` `200`, public slots read `200`. An earlier smoke attempt used an outdated hostname from legacy deployment notes and returned DNS errors; rerun against configured domains passed. No Wave 0 application/API/UI behavior change was observed.
- Existing dependency audit notices remain (PMS 14, website 7 reported during image builds); these were not broadened into an unrelated dependency-upgrade effort. A historical Caddy `502` entry was present in logs; current live checks pass. Neither is claimed as resolved by Wave 0.

## I. Gates

| Gate | Status | Evidence / remaining action |
| --- | --- | --- |
| W0-PROD-DDL-GATE | PASS | SHA-256 `f1a29bb045ab969bd1d91e59d89dea71c148cdfd6040c0b37cce950b0e0e3122`; passed before deployment |
| W0-G01 Backup | PASS | Encrypted manifest, checksum, archive validation |
| W0-G02 Restore | PASS | Version-matched isolated restore, five-way comparison, smoke |
| W0-G03 Baseline | PASS | Pre/post manifests, cohort/delta explanation, build/image digests |
| W0-G04 Ledger | PASS | Additive models and disposable DB lifecycle integration |
| W0-G05 Flags | PASS | Empty allowlists, disabled mode, empty DB flags |
| W0-G06 Read-only | PASS | Role privileges, identity, timeouts, guard, rollback |
| W0-G07 Fixtures | PASS | 15 synthetic golden cases and boundary expectations |
| W0-G08 Idempotency | PASS | Repeat, resume, concurrent candidate, and correction-key contract tests; no business importer exists |
| W0-G09 Reconciliation | PASS | Same backup snapshot reproduces query-pack output/digest in restore |
| W0-G10 Rollback | PASS | Isolated restore and read fallback require no data deletion; no destructive down migration |
| W0-G11 Behavior | PASS | PMS/website live smoke, normal current behavior, no canonical activation |
| W0-G12 Approval | BLOCKED | Named technical and data-owner review/approval references have not been provided |

No overall Wave 0 PASS is claimed while W0-G12 is blocked. The owner should review the backup retention, comparison limits, known pre-existing data exceptions, and this package before recording technical/data-owner approval. **Wave 1 remains NOT AUTHORIZED.**

## J. Evidence Locations

Sanitized local runtime evidence (ignored by Git): `audit/canonical/runtime/gate/`, `audit/canonical/runtime/production-pre-ddl/`, `audit/canonical/runtime/production-post-ddl/`, and `audit/canonical/runtime/restore-rehearsal/`. Restricted VPS backup and operational evidence: `/root/lumora-wave0/backups/` and `/root/lumora-wave0/evidence/`. No credentials, patient names, row contents, or database dump are in this package.

## Final Verification Addendum

The follow-up ledger/golden-fixture commit passed GitHub Actions run 35468353949. No owner approval reference has been recorded. Do not change W0-G12 or begin Wave 1 merely because CI passes.
