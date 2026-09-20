# LUMORA Wave 1 Pre-Production Implementation & DDL Gate Package v1

Status (2026-09-20): **WAVE 1 PRE-PRODUCTION IMPLEMENTATION INCOMPLETE / BLOCKED**. This package does not authorize production DDL, deployment, restart, canonical activation, or Wave 2. Technical approver: Pasindu Perera. Data approver: Dr Amitha Perera. Owner decision: pre-production implementation only, as recorded in the Wave 1 implementation instruction. The [frozen specification](../metrics-2026-09-17/LUMORA-MIGRATION-WAVE-1-IMPLEMENTATION-SPECIFICATION-v1.md) remains authoritative. Sections F-H retain the initial blocked assessment; Section I appends later evidence without rewriting that history.

## A. Implementation Manifest

"Implemented" below means present and locally exercised, not production-deployed or owner-accepted. E1 = migration/schema and static review; E2 = [disposable catalog and zero-row proof](WAVE-1-DISPOSABLE-CATALOG-AND-ZERO-ROW-PROOF-v1.json); E3 = 42-pass real-DB canonical suite; E4 = local builds; E5 = this package and [runbook](../../deploy/WAVE-1-RUNBOOK.md). All paths are repository-relative.

| Change ID | Planned | Implemented | Files | Deviation | Evidence |
| --- | --- | --- | --- | --- | --- |
| W1-001 | Typed core Prisma models | Yes | `dental-pms/prisma/schema.prisma` | `contentHash` approved by follow-up owner decision | E1, E4 |
| W1-002 | Website schema mirror | Yes | `lumora-website/prisma/schema.prisma` | Same approved supporting field | E4 |
| W1-003 | Additive migration, 17 tables | Yes, disposable only | `dental-pms/prisma/migrations/20260919213000_wave1_core_infrastructure/migration.sql` | Conditional audit grant and authorization guard; no production DDL | E1, E2 |
| W1-004 | Event identity | Yes | `dental-pms/src/lib/canonical/event-identity.ts` | None identified | E3 |
| W1-005 | Dormant typed event contract | Yes | `dental-pms/src/lib/canonical/event-header.ts` | No live event type or writer | E3 |
| W1-006 | Concrete provenance | Yes | `dental-pms/src/lib/canonical/provenance.ts` | None identified | E3 |
| W1-007 | Correction contract | Yes | `dental-pms/src/lib/canonical/corrections.ts` | None identified | E3 |
| W1-008 | Policy versions | Yes | `dental-pms/src/lib/canonical/policy-versions.ts` | None identified | E2, E3 |
| W1-009 | Cutover registry | Yes, dormant | `dental-pms/src/lib/canonical/cutover-registry.ts` | None identified | E3 |
| W1-010 | 26 static attribution roles | Yes | `dental-pms/src/lib/canonical/attribution.ts` | No role table/seed | E3 |
| W1-011 | DQ and reconciliation infrastructure | Yes | `dental-pms/src/lib/canonical/data-quality.ts` | No production rows | E3 |
| W1-012 | Identity/sequence tests | Yes | `dental-pms/tests/canonical/wave1-identity.test.ts` | None identified | E3 |
| W1-013 | Provenance/correction tests | Yes | `dental-pms/tests/canonical/wave1-provenance-corrections.test.ts` | None identified | E3 |
| W1-014 | Attribution tests | Yes | `dental-pms/tests/canonical/wave1-attribution.test.ts` | None identified | E3 |
| W1-015 | Policy/cutover tests | Yes | `dental-pms/tests/canonical/wave1-policy-cutover.test.ts` | None identified | E3 |
| W1-016 | DQ tests | Yes | `dental-pms/tests/canonical/wave1-data-quality.test.ts` | None identified | E3 |
| W1-017 | Synthetic fixtures | Yes, disposable only | `dental-pms/tests/canonical/fixtures/wave1-synthetic.ts` | None identified | E3 |
| W1-018 | Fail-closed DDL gate | Yes, remains BLOCKED | `dental-pms/scripts/canonical/wave1-prod-ddl-gate.ts` | Evidence inputs remain incomplete | E1, E5 |
| W1-019 | Baseline and object proof | Yes locally | `dental-pms/scripts/canonical/wave1-baseline.ts` | Fresh production baseline not yet captured | E2 |
| W1-020 | Restore verifier | Implemented, not exercised for current backup | `dental-pms/scripts/canonical/wave1-restore-verify.ts` | Current-backup restore pending | E5 |
| W1-021 | CI | Defined, remote run pending | `.github/workflows/canonical-wave1.yml` | CI result pending | E5 |
| W1-022 | Evidence schema | Yes | `audit/canonical/schemas/wave1-evidence.schema.json` | None identified | E5 |
| W1-023 | Runbook | Yes | `deploy/WAVE-1-RUNBOOK.md` | None identified | E5 |
| W1-024 | Safe environment documentation | Yes | `deploy/.env.production.example` | No flag enabled | E5 |
| W1-025 | Future execution acceptance package | No, intentionally deferred | Not created | Requires separate production-DDL authorization and execution | Frozen spec |
| W1-026 | Reconciliation lifecycle tests | Yes | `dental-pms/tests/canonical/wave1-reconciliation-run-lifecycle.test.ts` | None identified | E3 |

## B. Exact Migration Object Manifest

The immutable proposed migration SHA-256 is `384068a451c470d5b40e5d40fb44c326c3517875e7620ffd33ebea5183466568`. The [machine-readable catalog proof](WAVE-1-DISPOSABLE-CATALOG-AND-ZERO-ROW-PROOF-v1.json), SHA-256 `b5170ce212f6f8ae23c219f111a2d9f5e0026384400a05e491d0074d413239c4`, enumerates **every** table, enum, index (including unique and partial), constraint (PK, FK, check, unique), trigger, trigger function, and grant by exact catalog name and definition. This is the exact object list, not a sample or count-only summary. Counts: 17 tables, 6 enums, 44 indexes, 57 constraints, 18 triggers, 7 trigger functions, 17 audit-role SELECT grants. There are no audit-role write grants in the disposable proof. The six enums are `CanonicalMigrationClass`, `CanonicalCorrectionKind`, `CanonicalGovernanceStatus`, `CanonicalReconciliationStatus`, `CanonicalExceptionStatus`, and `CanonicalAttributionState`. SQL static scope check passed: no legacy table ALTER, DROP, backfill, business INSERT, or domain event/entity table. The supporting `contentHash` field was approved in the follow-up owner decision. Its library contract is now `sha256:v1:<digest>` over deterministic canonical semantic JSON; system-generated fields are rejected, and changed content cannot replay under the same idempotency key.

## C. Zero-Row Proof

A fresh local PostgreSQL 16 database received all 15 migrations from zero, with the Wave 1 authorization marker set **only on that disposable database**. Before fixture loading, `wave1:baseline -- post` enumerated exactly the frozen 17 Wave 1 tables and returned `0` for each count (see linked proof). A repeat `prisma migrate deploy` returned `No pending migrations to apply.` A separate no-marker disposable attempt failed before creating Wave 1 objects. The marker is absent from the production deployment configuration.

## D. Constraint And Concurrency Evidence

The local canonical suite: **42 passed, 1 skipped**. The skipped Wave 0 ledger integration test needs its separate URL; it is not counted as Wave 1 evidence. PostgreSQL tests exercise aggregate sequence under concurrent transactions, DB-enforced idempotency, provenance/correction rules, concurrent policy overlap rejection with adjacent half-open intervals accepted, append-only governance and active projection, ReconciliationRun lifecycle and retry history, and exception dedupe/lifecycle. These fixtures ran only after the zero-row proof in the disposable database. PMS `tsc --noEmit` and both PMS and website builds passed locally. Remote CI is pending; this is not a CI PASS claim.

## E. Security Evidence

No Wave 1 writer route, registered live business event type, production runtime activation, canonical flag/allowlist change, or website write path was introduced. The website change is Prisma schema mirror only. In a disposable database where `lumora_audit_ro` existed before migration, the catalog proof shows 17 SELECT grants, and the baseline script verified no INSERT/UPDATE/DELETE on those tables and no schema/database CREATE or database TEMP privilege. This does **not** substitute for a fresh production role/flag check. Production PMS startup runs `prisma migrate deploy`; therefore the Wave 1 source/image must remain off the VPS until separately authorized. The migration also aborts without a database-local authorization setting, tested in a disposable negative case.

## F. Recovery Evidence (Initial Assessment)

Wave 0 acceptance documented an encrypted VPS-local backup and isolated PostgreSQL 16 restore with five-way fingerprint/reconciliation equality; see [Wave 0 package](LUMORA-MIGRATION-WAVE-0-EXECUTION-ACCEPTANCE-PACKAGE-v1.md). That is prior lineage, **not** a current Wave 1 recovery proof. A current encrypted production backup, an independently resilient off-VPS copy, its artifact SHA-256/destination/retention/access/key separation, retrieval integrity verification, and an isolated same-major restore of the current backup have **not** been established in this package. No database dump or private age identity is committed. W1-PROD-DDL-GATE is BLOCKED until the actual artifacts and lineage are recorded.

## G. Production Baseline (Initial Assessment)

The accepted Wave 0 post-DDL baseline is dated `2026-09-19T20:38:20.342Z`, SHA-256 `16617b86e7e442aa74228a0a1c08c7951f86bbd00d6197b4c415d776d594c006`. A live, narrow check on 2026-09-20 showed `20260918190000_wave0_control_plane` as the latest applied Prisma migration and `canonical_event_headers` absent. This query used the DB administrative connection and is **not** the required read-only audit baseline. An attempt to run the existing Wave 0 audit baseline in the live PMS container failed before querying because the production image lacks `scripts/canonical/wave0-baseline.ts`. A **fresh** production read-only fingerprint, reconciliation result, full Wave 1 table-absence proof, role/flag proof, and drift analysis against the accepted snapshot are therefore pending. Normal clinic activity can change counts between snapshots; no historical exception has been repaired or imported here. The lack of a fresh baseline blocks the gate.

## H. W1-PROD-DDL-GATE (Initial Assessment)

| Input | Result |
| --- | --- |
| Frozen scope, static SQL hash, fresh disposable migration, repeat migration, 17 zero rows | PASS locally |
| Constraint/concurrency suite and local builds | PASS locally; remote CI pending |
| Conditional audit-role grant and read-only privileges | PASS in disposable DB; production confirmation pending |
| Supporting `contentHash` field/guard reviewed against frozen specification | PASS: follow-up owner decision; versioned library contract tested |
| Current backup and independent encrypted off-VPS copy/retrieval | BLOCKED |
| Current-backup isolated restore and five-way comparison | BLOCKED |
| Fresh production read-only baseline and drift explanation | BLOCKED |
| Canonical production flags/allowlists remain OFF, no Wave 1 rows | Pending fresh production proof |

**W1-PROD-DDL-GATE = BLOCKED.** Run `npm run wave1:prod-ddl-gate` with no evidence file to confirm fail-closed behavior. Even a later gate PASS would not authorize production DDL; separate explicit owner authorization is mandatory. Do not sync or restart the Wave 1 migration-containing PMS build on the VPS.

## I. Follow-Up Owner Decision And Evidence, 2026-09-20

**Owner decisions.** Cloudflare R2 is approved as the independent off-VPS encrypted recovery destination. A dedicated private bucket, no public access/domain, minimum-scoped identities, Bucket Lock, and client-side age encryption are mandatory. Routine backups must be retained at least 180 days; a later formally accepted wave's reference backup must be retained 365 days from acceptance. The Asia-Pacific location hint should be used where supported but is not a legal residency guarantee. The age private identity must never be placed in R2, Git, or public audit materials. The owner also expressly approved `contentHash` as a technical SHA-256 semantic-content/idempotency invariant. These decisions resolve the earlier `contentHash` review item, but not the R2 evidence requirement.

**Current VPS-local recovery source.** The reviewed backup process produced `lumora-wave0-20260920T084128Z.dump.age` at `2026-09-20T08:41:28Z` from production PostgreSQL `16.14` using `pg_dump 16.14`. The encrypted artifact SHA-256 is `96e46aa24f73528dbe96716545e3846e601db07ebd1fe6cded2c492ab37f355d`; size is about 302 KB. Source is the live `dental_pms` database through the existing reviewed script, stored in a root-only VPS backup directory. The verifier matched the manifest hash, decrypted with the separately controlled age identity, and passed `pg_restore --list`. A restricted copy of the private identity was placed on the owner's Windows computer outside the repository, R2, and encrypted artifact; its ACL permits only that user and SYSTEM. Owner-managed second-copy/vault retention remains to be confirmed. This is **not yet** an R2 recovery proof.

**Fresh production read-only evidence.** At `2026-09-20T08:46:07.468Z`, the existing Wave 0 baseline ran through `lumora_audit_ro` over a temporary SSH tunnel, with `BEGIN READ ONLY`, and produced ignored local runtime artifact SHA-256 `5ac726bc0db94e29dfb6ff5d9bb73fb6cc30ed1aa533b8edae90ba475f4fd4b9`. The Wave 1 pre-DDL baseline artifact SHA-256 is `6851043d3ffe18caea7cdeacfaa0be5966321170d6e5ff5c4f1f0727186297c0`: all Wave 1 tables absent. A separate audit-role privilege proof, SHA-256 `36d94d422ed5034524968252abf61970bd96681fb1f201741aec32ce815c2c54`, reports no table write, database CREATE, or TEMP privilege. Production Wave 0 canonical flag/version table counts are zero; production environment inspection found migration mode `disabled` and all six canonical allowlists empty. No raw baseline rows, patient data, credentials, or private keys are committed.

**Drift from accepted Wave 0 snapshot.** Schema fingerprint and Prisma migration history hashes are unchanged; the same 30 frozen reconciliation statements were used. From `2026-09-19T20:38:20.342Z` to `2026-09-20T08:46:07.468Z`, patients and visits each increased `179 -> 184` and `156 -> 161`; invoices `112 -> 117`, payments `100 -> 104`, reception queue items `202 -> 207`, and related clinical/financial records also increased. These are consistent with ordinary clinic activity between snapshots, not a schema migration or historical repair. The frozen query results changed as expected with live activity; no exception cohort was imported or repaired.

**CI history and current gate evaluation.** GitHub Actions runs [35499586739](https://github.com/Pasindu099/Patient-management-system/actions/runs/35499586739) for `30eed9b` and [35499668212](https://github.com/Pasindu099/Patient-management-system/actions/runs/35499668212) for `f28a0ce` failed; the latter failed at PMS type check/build. A catalog-summary TypeScript narrowing error was then corrected. The approved versioned `contentHash` library contract added one focused test. [Run 35501298190](https://github.com/Pasindu099/Patient-management-system/actions/runs/35501298190) for reviewed successor commit `332471f00503c791d4818d676de30b5e8013392f` completed **success**: static migration review, fresh disposable migration, 17 zero rows before fixtures, repeat migration, real-DB tests, PMS type check/build, website schema-mirror check, and website type check/build all passed. Local canonical suite: **43 passed**, one unrelated Wave 0 ledger test skipped. Production read-only baseline/role/flag proof, current VPS-local backup, and owner `contentHash` decision also have evidence.

**Preliminary same-major restore, not from R2.** The VPS-local encrypted artifact named above restored into a fresh isolated PostgreSQL `16.14` container with no production application network or production volume. The full Wave 1 verifier compared it with the backup-aligned read-only source baseline: schema, migration history, table counts, safe identity digests, frozen reconciliation results, and pre-DDL Wave 1 table absence all **PASS**. Ignored runtime verification artifact SHA-256: `d5812142e21259b05bcf60730b4ff2bf5cbb4f403bbad4f14b2b01982cc37850`. The disposable container/network/volume were removed after verification. This rehearsal does **not** satisfy the required R2-retrieved restore lineage.

The dedicated private R2 bucket, actual Bucket Lock retain-until, scoped credentials, encrypted upload hash/metadata, R2 retrieval, integrity/decryption/archive proof, and **R2-derived** isolated PostgreSQL 16 restore/five-way comparison are pending. A gate rerun with the evidence file set these two inputs false and returned `BLOCKED` specifically for `independentRecovery` and `restorePassed`; all other current checks evaluated true. Thus **W1-PROD-DDL-GATE remains BLOCKED**; no production Wave 1 DDL or deployment is authorized.
