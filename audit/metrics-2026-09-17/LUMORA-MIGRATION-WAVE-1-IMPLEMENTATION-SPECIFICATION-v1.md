# LUMORA MIGRATION WAVE 1 IMPLEMENTATION SPECIFICATION v1

Status: **SPECIFICATION ONLY / IMPLEMENTATION NOT AUTHORIZED**

Prepared: 19 September 2026. Wave 0: **IMPLEMENTED AND ACCEPTED** by the owner decision referenced in the Wave 0 execution package. Technical Architecture: **APPROVED**. Wave 2 remains blocked until Wave 1 is separately authorized, implemented, verified and accepted.

This is a proposed change set, not an instruction to run it. No Wave 1 schema, migration, import, API, UI, flag, production data, or workflow change is delivered with this document. It follows [Technical Architecture & Migration Design v1](CANONICAL-TECHNICAL-ARCHITECTURE-MIGRATION-DESIGN-v1.md), [Attribution v1](CANONICAL-DOCTOR-BRANCH-ATTRIBUTION.md), [Attribution Amendment 01](DOCTOR-BRANCH-ATTRIBUTION-v1-AMENDMENT-01.md), and the [Wave 0 implementation specification](MIGRATION-WAVE-0-IMPLEMENTATION-SPECIFICATION-v1.md). Frozen business definitions are not reopened.

## 1. Scope And Exact Proposed Change Set

Wave 1 establishes empty foundational structures. **No business-record import, including M1 reference population, is proposed in Wave 1.** The architecture's "M1 source references only" is an upper bound, not a requirement to create orphan references before a typed canonical owner exists. Later approved domain waves will populate source references in the same transaction as their typed records. Wave 1 may insert only reviewed non-business configuration such as role/rule registry definitions and synthetic test data in disposable environments; production remains empty unless a separate execution approval explicitly lists seed records.

No `InvoiceIssued`, `PaymentRecorded`, `AppointmentCreated`, `QueueArrived`, `EncounterStarted`, `VisitClinicallyCompleted`, `TreatmentPlanPresented`, `TreatmentItemAccepted`, `TreatmentItemStarted`, `PayrollObligationCreated`, `GoodsReceived`, `StockConsumed`, `AlertDetected`, or other domain event table is in this change set. No generic JSON event bucket or implementation of all 68 events is permitted.

All paths below are **proposed**, not created. `W1-*` IDs form the exhaustive Wave 1 file/change manifest; a later execution review must reconcile every actual file against it before applying anything.

| Change ID | Component/File | Proposed Change | Architecture Entity | Dependency | Runtime Impact | Reversible? |
| --- | --- | --- | --- | --- | --- | --- |
| W1-001 | Prisma: `dental-pms/prisma/schema.prisma` | Add typed core, attribution-role registry and data-quality models/enums; retain legacy models | Core + DQ | Wave 0 schema | None while unused | Additive rollback only before data |
| W1-002 | Prisma: `lumora-website/prisma/schema.prisma` | Mirror new models for client compatibility; no website write path | Core + DQ | W1-001 | None | Yes, before use |
| W1-003 | Migration: `dental-pms/prisma/migrations/<reviewed_wave1_timestamp>_core_infrastructure/migration.sql` | Add tables, FKs, checks, partial/expression indexes, triggers and grants; no legacy DDL/DML | All Wave 1 entities | W1-001 and reviewed SQL | Additive DB objects only | Preserve objects after production; restore only for disaster |
| W1-004 | Library: `dental-pms/src/lib/canonical/event-identity.ts` | UUID, aggregate sequence and idempotency contract | CanonicalEventHeader | W1-001, W1-003 | Dormant | Yes, until used |
| W1-005 | Library: `dental-pms/src/lib/canonical/event-header.ts` | Transactional insert contract requiring registered typed owner in later wave | CanonicalEventHeader | W1-004 | Dormant, no route wiring | Yes |
| W1-006 | Library: `dental-pms/src/lib/canonical/provenance.ts` | Immutable source-reference and batch-link validation | SourceRecordReference | W1-001, Wave 0 MigrationBatch | Dormant | Yes |
| W1-007 | Library: `dental-pms/src/lib/canonical/corrections.ts` | Graph validation and typed compatibility policy | EventCorrection | W1-005 | Dormant | Yes |
| W1-008 | Library: `dental-pms/src/lib/canonical/policy-versions.ts` | Effective-window and approval contract | PolicyVersion | W1-001 | Dormant | Yes |
| W1-009 | Library: `dental-pms/src/lib/canonical/cutover-registry.ts` | Immutable registry transitions; no flag activation | CutoverRegistry | Wave 0 flags, W1-001 | Dormant | Yes |
| W1-010 | Library: `dental-pms/src/lib/canonical/attribution.ts` | Typed role/state/reason/evidence validation | ATTR-D01-D13, ATTR-B01-B13 | Frozen attribution dictionary | Dormant | Yes |
| W1-011 | Library: `dental-pms/src/lib/canonical/data-quality.ts` | Named-rule dedupe and lifecycle contract | DQ entities | W1-001 | Dormant | Yes |
| W1-012 | Tests: `dental-pms/tests/canonical/wave1-identity.test.ts` | UUID, sequence concurrency, idempotency, timestamps | Event header | W1-004, disposable DB | None | Yes |
| W1-013 | Tests: `dental-pms/tests/canonical/wave1-provenance-corrections.test.ts` | Source immutability and correction graph | Source reference, correction | W1-006, W1-007 | None | Yes |
| W1-014 | Tests: `dental-pms/tests/canonical/wave1-attribution.test.ts` | 26 role codes, four states, multi-share contract | Attribution foundation | W1-010 | None | Yes |
| W1-015 | Tests: `dental-pms/tests/canonical/wave1-policy-cutover.test.ts` | Range overlap, approvals and inert cutover | PolicyVersion, CutoverRegistry | W1-008, W1-009 | None | Yes |
| W1-016 | Tests: `dental-pms/tests/canonical/wave1-data-quality.test.ts` | Named rules, dedupe and lifecycle | DQ entities | W1-011 | None | Yes |
| W1-017 | Fixtures: `dental-pms/tests/canonical/fixtures/wave1-synthetic.ts` | Fixed UUIDs/UTC instants; no production rows or PHI | All Wave 1 contracts | W1-012 to W1-016 | None | Yes |
| W1-018 | Script: `dental-pms/scripts/canonical/wave1-prod-ddl-gate.ts` | Fail-closed pre-DDL evidence check, no DDL execution | W1-PROD-DDL-GATE | Wave 0 gate/evidence harness | Read-only | Yes |
| W1-019 | Script: `dental-pms/scripts/canonical/wave1-baseline.ts` | Extend Wave 0 read-only baseline with Wave 1 catalog/zero-row checks | Core + DQ | Wave 0 read-only role | Read-only | Yes |
| W1-020 | Script: `dental-pms/scripts/canonical/wave1-restore-verify.ts` | Five-way restore and no-domain-object comparison | All Wave 1 entities | Wave 0 restore tooling | Isolated only | Yes |
| W1-021 | CI: `.github/workflows/canonical-wave1.yml` | Fresh DB migration, tests, static scope check, both builds | All | W1-001 to W1-020 | CI only | Yes |
| W1-022 | Evidence: `audit/canonical/schemas/wave1-evidence.schema.json` | Versioned gate/manifest validation schema | Gate evidence | Wave 0 evidence rules | None | Yes |
| W1-023 | Runbook: `deploy/WAVE-1-RUNBOOK.md` | Explicit approval, backup, off-VPS copy, dry-run, restore, baseline, DDL and fallback order | Wave 1 | Wave 0 runbook | None | Yes |
| W1-024 | Deployment config: `deploy/.env.production.example` | Document Wave 1 flags as OFF; no production enablement | Wave 0 feature controls | W1-023 | None | Yes |
| W1-025 | Evidence: `audit/canonical/LUMORA-MIGRATION-WAVE-1-EXECUTION-ACCEPTANCE-PACKAGE-v1.md` | Future execution manifest and W1-Gxx outcomes, created only upon authorized execution | Acceptance | W1-PROD-DDL-GATE | None | Append-only |

No production Compose change or new service is planned for Wave 1. The proposed migration name is a placeholder until execution authorization and an actual UTC migration timestamp. Any extra file, domain table or role-code change requires renewed scope review. Wave 0's PMS-only migration ownership continues; website mirrors schema but does not migrate or write canonical objects.

## 2. Core Structures And Relationships

Names below are target contracts for the later implementation review. Use PostgreSQL `uuid`, `timestamptz`, bounded text/enums, and FKs. Required canonical fields are columns, not an arbitrary JSON payload. `createdAt`/`recordedAt` are database-assigned UTC instants. Object names receive a collision and Prisma mapping review before implementation.

| Structure | Key Fields | Constraints | Indexes | Mutability | Relationship Rules |
| --- | --- | --- | --- | --- | --- |
| `CanonicalEventHeader` | `eventId uuid`, `domain`, `eventType`, `aggregateType`, `aggregateId uuid`, `aggregateSequence bigint`, `idempotencyKey`, `occurredAt`, `recordedAt`, `actorType`, `actorId`, `policyVersionId?`, `migrationClass`, `migrationBatchId?`, `sourceProvenanceKey?` | PK eventId; positive sequence; unique `(aggregateType,aggregateId,aggregateSequence)` and namespaced idempotency key; `recordedAt` DB time; M1-M3 require batch and source reference before a migrated typed event is committed | `(aggregateType,aggregateId,aggregateSequence)`, `(domain,eventType,occurredAt)`, unique idempotency | Insert-only; no update/delete except separately approved disaster restoration | Every header must gain exactly one typed domain owner within its transaction in a later wave; no header row is allowed in production Wave 1. Future domain migrations add a typed child FK plus deferred ownership enforcement. Header alone is never a business event. |
| `CanonicalAggregateSequence` | `aggregateType`, `aggregateId uuid`, `nextSequence bigint` | Composite PK; positive counter; atomic upsert under row lock | PK `(aggregateType,aggregateId)` | Counter update only through transactional writer | Used only by a later approved typed event writer; no counter row in Wave 1. |
| `EventCorrection` | `correctionId uuid`, `originalEventId`, `replacementEventId`, `kind`, `reasonCode`, `evidenceRef`, `approverType/Id`, `occurredAt`, `recordedAt`, `migrationBatchId?` | PK; distinct original/replacement; FKs to headers; unique reversal/void target where terminal; approved kind; both events compatible by typed contract | `(originalEventId,recordedAt)`, unique permitted terminal action | Append-only | The replacement is an actual typed event in a later wave. No correction row or replacement event in Wave 1. Graph rules in section 5. |
| `SourceRecordReference` | `referenceId uuid`, `ownerType`, `ownerId uuid`, `sourceSystem`, `sourceEntity`, `sourceKey`, `sourceVersion?`, `sourceChecksum`, `sourceProvenanceKey`, `observedAt`, `importedAt`, `migrationClass`, `migrationBatchId` | PK; unique `(sourceSystem,sourceEntity,sourceKey,sourceVersion,ownerType,ownerId)` with null-safe version normalization; unique source provenance key per imported canonical fact; M1-M3 only; nonempty key/hash | `(ownerType,ownerId)`, `(migrationBatchId)`, unique provenance | Insert-only; corrections append new refs | `migrationBatchId` FK to Wave 0 `CanonicalMigrationBatch`; `ownerType` must name a registered typed canonical owner. A deferred owner check is added with that owner table. No orphan/generic source refs are inserted in Wave 1. |
| `PolicyVersion` | `policyVersionId uuid`, `family`, `scopeType`, `scopeKey`, `version`, `effectiveFrom`, `effectiveTo?`, `approvalReference`, `approvedBy`, `approvedAt`, `definitionHash`, `status` | PK; unique `(family,scopeType,scopeKey,version)`; half-open interval, valid dates, no overlapping approved/active windows for same scope | `(family,scopeType,scopeKey,effectiveFrom)`, overlap enforcement | Approved version content immutable; status is append-only transition or audited projection | Future typed policy bodies/versioned definitions link to this version. Empty/generic policy infrastructure is not a payroll or alert rule. |
| `CutoverRegistry` | `cutoverId uuid`, `domain`, `scopeType`, `scopeKey`, `cutoverAt`, `migrationClasses`, `approvalReference`, `evidenceManifestHash`, `activatedBy?`, `activatedAt?`, `status`, `migrationBatchId?` | PK; required approval/hash before ACTIVE; one active version per domain/scope; `activatedAt` only on activated version and never before approval; immutable activation record | unique active `(domain,scopeType,scopeKey)`, `(domain,status,cutoverAt)` | New version/transition; activated record immutable | `migrationBatchId` optional FK to Wave 0 ledger. A registry row records approval, **not** application enablement; Wave 0 allowlist plus domain readiness gate are still required. |

`eventType` is an identifier governed by a reviewed per-domain typed-event registration contract. Wave 1 registers no business event type and grants no production header writer. Before any later writer is enabled, its domain migration must prove a one-to-one typed child row, permissible event type, scoped permissions, and atomic insertion. Free-form event payload/extension JSON cannot substitute for typed fields. If an extension is later justified, it must have a versioned schema and cannot carry fields used by canonical metric logic.

## 3. Identity, Sequence And Time

- `eventId`: Wave 0-compatible conventional UUIDv4 generated in application code (or database UUID only if the same reviewed generator is used consistently); UUIDv7 is deferred until cross-stack safety is verified. It is never a human queue number.
- `aggregateId`: stable UUID for one typed domain aggregate; `aggregateType` is explicit. Domain waves define the mapping from legacy source identity and any permitted new aggregate type. It is not a generic patient ID.
- Sequence: each `(aggregateType,aggregateId)` owns a DB counter row. In one transaction, `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING next_sequence` serializes competing writers; insert the header and typed child in that same transaction. Unique DB constraint is the final guard. Retries reuse the same idempotency key and return the prior event; rollback consumes no committed sequence. A later approved writer must handle serialization/deadlock retry with bounded attempts.
- Idempotency: unique `(domain,eventType,idempotencyKey)` or a stronger explicitly namespaced key derived from stable source/action identity. Same key with different canonical content is an error, never an overwrite. The key is not a queue order.
- Source provenance key: stable hash of source system/entity/key/version + migration rule/version + intended owner, not a mutable display value. M1-M3 require source reference and batch linkage; M4 uses actor/request provenance and does not fabricate a historical source row.
- `occurredAt`: evidence-backed UTC business instant; `recordedAt`: immutable DB UTC insert instant. `occurredAt` may precede `recordedAt` for imports and delayed capture, but a future instant requires an explicit domain rule. Missing occurrence evidence is not silently replaced with `recordedAt`. Asia/Colombo calendar assignment derives from `occurredAt` using a versioned calendar/policy rule.
- Actor identity: `actorType` and `actorId` must identify a user, approved system job, or migration actor; service credentials are not a clinical actor. Policy reference is required when the event's interpretation depends on a rule, including a typed policy body in its domain wave.
- Migration class is a constrained `M1|M2|M3|M4` enum. Correction, reversal and void create new event identities; they never mutate prior headers. For M1-M3, the header references Wave 0 batch and source provenance. None of these headers are populated in Wave 1.

## 4. Attribution Foundation

Define a static, reviewed registry for exactly `ATTR-D01` through `ATTR-D13` and `ATTR-B01` through `ATTR-B13`, with dimension, cardinality, owner type, and assignment/evidence policy. The common typed value contract is `(roleCode, assignmentState, doctorId?|branchId?, reasonCode?, evidenceRef?, ownerEventOrVersionId, policyVersionId?)`. State is one of `ASSIGNED`, `UNASSIGNED`, `UNKNOWN`, `NOT_APPLICABLE`. `ASSIGNED` requires a typed subject FK and forbids a missing subject; the other states require null subject. `UNASSIGNED` means the role applies but a responsible subject is not proved; `UNKNOWN` means applicability or value cannot be determined; `NOT_APPLICABLE` means a reviewed rule establishes that this role does not apply. A role-specific reason and evidence reference are required for the non-assigned states. No current branch membership, Visit doctor or status fills historical evidence. Changes append a corrected event/version with reason/approval, never mutate an old attribution.

The registry/validation library may be added in Wave 1, but **no generic all-role assignment table is created**. Later typed domain owners supply direct columns for direct roles, relationship tables for D08, and versioned allocation tables for share roles. Typed owner fields must include state/reason/evidence even if no subject FK is present.

| Role | Foundational owner/cardinality contract for later typed wave |
| --- | --- |
| ATTR-D01 | Appointment occurrence provider, one direct role per occurrence version |
| ATTR-D02 | Queue assignment segment, one direct role per assignment version |
| ATTR-D03 | Encounter-start segment, one direct role per segment |
| ATTR-D04 | Performance segment/contribution, potentially multiple evidenced performers |
| ATTR-D05 | Clinical Visit completion, one record/finalizing doctor role |
| ATTR-D06 | Treatment plan version, one planning author role |
| ATTR-D07 | Treatment contributor version, multiple exact-share rows |
| ATTR-D08 | Invoice-Visit-doctor relationship set, audit set only, never ownership |
| ATTR-D09 | Production allocation version, multiple exact cents/share rows plus Unassigned residual |
| ATTR-D10 | Payment allocation version, inherits approved D09 version with exact cents |
| ATTR-D11 | Follow-up recommendation event, direct recommender role |
| ATTR-D12 | Prescription issue event, direct authorizing role |
| ATTR-D13 | Referral event, direct referrer role; multiple referrals append |
| ATTR-B01 | Appointment occurrence, direct scheduled branch |
| ATTR-B02 | Arrival event, direct physical arrival branch |
| ATTR-B03 | Encounter segment, direct physical branch |
| ATTR-B04 | Service/performance/completion/Visit event, direct service branch |
| ATTR-B05 | Invoice version/line allocation, economic branch; line split supported |
| ATTR-B06 | Cash receipt/refund/income/expense event, direct cash branch, never inherited from B05 |
| ATTR-B07 | Expense allocation version, multiple branches/shared cost supported |
| ATTR-B08 | Stock opening/movement, direct physical stock branch |
| ATTR-B09 | Staff work interval/approved roster, effective worked branch |
| ATTR-B10 | Salary payment event, direct cash branch |
| ATTR-B11 | Supplier payment event, direct cash branch, independent of receipt branch |
| ATTR-B12 | Treatment presentation event, immutable presentation branch |
| ATTR-B13 | Treatment acceptance event, immutable decision branch |

Versioned multi-share allocation contracts preserve a 10,000-basis-point total and exact integer-cents reconciliation including explicit Unassigned residual rows; no equal-split or inferred ownership fallback. This is a future typed-domain requirement, **not** Wave 1 allocation-table implementation.

## 5. Correction, Reversal, Supersession And Void

| Kind | Meaning | Invariant |
| --- | --- | --- |
| CORRECTION | New typed event fixes specified erroneous facts | Original remains queryable; reason/evidence/actor and replacement required; version policy determines current view |
| SUPERSESSION | New valid version replaces a previous version for forward interpretation | Same compatible aggregate/domain and explicit supersession chain; prior as-of result remains reproducible |
| REVERSAL | New event negates a prior effect under typed domain rules | References exact original and amount/allocation if relevant; no second effective reversal of same original |
| VOID | Approved invalidation of an event with no implied opposite business fact | Reason/authority required; terminal and incompatible with a second void or reversal unless a later domain policy explicitly permits correction of the void itself |

DB constraints enforce FKs, distinct original/replacement, valid kind, immutable rows, uniqueness of terminal reversal/void target, and compatible aggregate/domain identity via trigger. A DB trigger under an aggregate-scoped transaction advisory lock rejects cycles using a recursive reachability check; the service repeats the graph check for a clear error. Service/domain policy checks whether an event type supports the proposed kind, whether the actor may approve it, and whether the replacement's typed payload is valid. No service-only graph invariant is trusted without the DB guard. Competing corrections must serialize on the original/aggregate; ambiguous concurrent replacements fail, not choose a winner. Corrections never overwrite the original header, provenance, attribution or event-time value. Wave 1 inserts no correction row.

## 6. Effective-Dated Policy Versions

`PolicyVersion` is a generic envelope for future payroll due, rounding, clinic calendar, alert, migration and metric policies. It contains family, precise scope, immutable version/definition hash, half-open `[effectiveFrom,effectiveTo)` UTC interval, approval and status. A reviewed policy body is typed in its later owner wave; the envelope does not embed payroll/finance/alert business rules or treat JSON as executable policy. Only approved versions can be selected. DB overlap enforcement under a scope-level advisory lock/trigger checks active or approved windows; adjacent end/start instants are allowed. A new approval creates a new version, not an in-place edit to approved contents. Revocation/supersession is an audited transition with original version retained. Calendar interpretation uses Asia/Colombo boundaries while stored instants remain UTC.

## 7. Cutover Registry

`CutoverRegistry` records domain, branch/session/item/etc. scope, UTC cutover instant, applicable migration classes, approval reference, SHA-256 evidence manifest, `activatedBy`, `activatedAt`, status and optional batch. It is append-versioned: DRAFT/READY may be superseded; ACTIVE requires approval and immutable activation record; later PAUSED/RETIRED status is appended without erasing the activation. At most one active cutover per domain/scope. A record **does not switch reads or writes**. Every later consumer additionally needs a Wave 0 feature allowlist entry, a passing domain gate, permitted scope, and independent read/write flag. No Wave 1 cutover activation is proposed.

## 8. Data Quality And Reconciliation Foundation

| Structure | Key Fields And Grain | Constraints / indexes | Mutability / relationship |
| --- | --- | --- | --- |
| `ReconciliationRuleVersion` | `ruleCode`, version, domain, source/canonical population, typed parameter/definition hash, severity, owner, effective interval, approval | Unique code/version; approved-window non-overlap per rule scope; no `MISSING_DATA` catch-all | Immutable approved definition; later named rule packs bind executable SQL hashes |
| `ReconciliationRun` | run ID, rule-set/hash, source snapshot/watermark, scope, started/completed times, counts, status, batch ID | Unique `(ruleSetHash,snapshot,scope,runKey)`; batch FK; indexed status/time | Append-only run events/status history; counts are evidence, not business corrections |
| `DataQualityException` | exception ID, rule version, source/canonical entity key, episode key, detectedAt, severity, impact, owner queue, current status projection | Unique active `(ruleCode,sourceSystem,sourceEntity,sourceKey,scope,episodeKey)`; indexed owner/status | Mutable current projection only from append-only lifecycle; no guessed historical detection date |
| `ExceptionLifecycleEvent` | transition ID, exception ID, from/to state, actor, occurred/recorded, reason, correction ref | FK, legal transition check, monotonically sequenced per exception | Append-only; acknowledge/assign/approve/remediate/expire/close/reopen transitions |
| `ExceptionEvidence` | evidence ID, exception/run ID, source refs, aggregate counts, checksum, observedAt, manifest pointer | FK and content hash; indexed exception/run | Append-only; no raw patient/finance rows or secrets in audit artifacts |
| `ApprovedExceptionVersion` | approval ID, exception ID, approver/reference, valid from/to, review/expiry, permitted impact | Non-overlapping active approval windows, required expiry/review, indexed exception/time | Immutable version; expiry does not erase the exception |

Initial named rule definitions may include `FIN_PAYMENT_LEDGER_MISSING`, `VISIT_QUEUE_LINK_CONFLICT`, `ATTR_B06_UNASSIGNED`, `TREATMENT_ACCEPTANCE_ABSENT`, `PAYROLL_ELIGIBILITY_MISSING`, and `INVENTORY_OPENING_COST_UNKNOWN`, but each is activated only with its later domain rule pack and approved population. Wave 1 ships infrastructure/registry validation, not live detection or an automatic exception import. Dedupe is based on rule version family plus stable source/subject/scope and episode; repeated runs append evidence to the same open episode, while a genuinely resolved-and-recurred issue opens a new numbered episode. Reopening a mistakenly closed episode requires an explicit lifecycle event. Approval of an exception is time-bounded tolerance, not repair or a declaration that the underlying fact is true.

## 9. Historical Data And Carry-Forward Policy

Wave 1 production migration is **schema/infrastructure-only**. The Wave 0 five control-plane tables remain in place and were empty at Wave 0 acceptance; Wave 1 business/provenance/event/exception tables start with zero rows. No historical attribution backfill is authorized. The M1 source/provenance contract is designed now, but actual references must wait for a separately approved typed owner and source cohort in its later domain wave. This avoids orphan references and inferred event identities. No M2 reconciliation exceptions are instantiated merely because they are known; later rule-specific, evidenced runs decide how to represent them.

Wave 0 acceptance does not resolve the known payment/ledger exceptions, missing historical paid dates, queue/Visit conflicts, missing historical attribution, treatment event gaps, payroll absence or inventory-history gaps. Retain each as a distinct later-wave input without repair, reinterpretation or fabricated events.

## 10. Safety, Deployment And Rollback Model

Before **any** future production Wave 1 DDL: verify Wave 0 acceptance reference; current encrypted production backup/checksum; an encrypted copy off the production VPS or independently resilient to its loss with artifact hash, location/reference, retention, access restriction and restore provenance; same-major isolated restore; fresh DB migration from zero; current read-only baseline; CI; reviewed additive-only SQL; all canonical activation flags OFF; and explicit owner approval. Neither this specification nor Wave 0 acceptance satisfies that future gate by itself.

The Wave 0 read-only role, SQL guard, evidence manifest, feature-flag fail-closed behavior, migration ledger, timeout policy and isolated restore process are reused. The PMS alone owns migrations. Deployment, if later authorized, would expand schema with no legacy object removal, backfill or code path wired to current workflows. Header/event writes and shadow reads remain disabled. Flags plus domain gates are required even if a cutover record exists. Post-DDL comparison must show unchanged legacy schema/data except explainable live clinic activity. No destructive down migration. If behavior regresses, disable scoped canonical flags (already OFF), retain legacy read/write paths, preserve new objects/evidence, and restore only for a genuine migration disaster under the runbook. No Wave 1 capability activates merely because its schema exists.

## 11. Synthetic Test Plan

| Test family | Minimum assertion |
| --- | --- |
| Identity | UUID uniqueness; no human-readable sequence ID; aggregate sequence unique under concurrent transactions and rollback/retry |
| Idempotency | Same key/content returns prior identity; same key/different content fails; migration batch repeat/resume/concurrent candidate produces no duplicate |
| Time | Distinct evidence-backed `occurredAt` and DB `recordedAt`; delayed import; missing occurrence fails; Asia/Colombo day/month half-open boundaries from fixed UTC instants |
| Provenance | Stable source key/checksum; batch FK/class; immutable source ref; no orphan ref; source version change appends, never overwrites |
| Attribution | Every D01-D13/B01-B13 registry code; Assigned subject FK; Unassigned vs Unknown vs Not Applicable; required reason/evidence; no cross-role inference; multi-share 10,000 bps and cents including Unassigned |
| Corrections | Self-link, cycle, incompatible type/aggregate, ambiguous concurrent successor and prohibited double reversal/void rejected; as-of original retained |
| Policies | Effective-date overlap rejected concurrently; adjacent ranges accepted; approved definition immutable; calendar boundary deterministic |
| Cutover | Missing approval/hash rejected; one active record per scope; activation immutable; row alone cannot turn a feature on |
| Quality | Named rule only; repeated detection dedupes same episode; closed/recurred creates new episode; illegal lifecycle/expired approval rejected; evidence hash immutable |
| Security | Audit role cannot write/CREATE/TEMP; application has no Wave 1 production writer grant/route; no patient or payroll detail leaked by test evidence |
| Coexistence | Legacy PMS/API/UI behavior and website build unchanged; no domain event table, event row, business import or enabled flag after migration |

Fixtures are synthetic and deterministic. The fresh database test applies all 14 existing migrations plus the proposed Wave 1 migration once, re-runs deploy to prove no pending migration, checks exact new object allowlist and zero business rows, and compares restored and source fingerprints. SQL constraint/concurrency tests use separate DB connections, not mocks alone.

## 12. W1-PROD-DDL-GATE

The gate is a **future design**, not run in this task. It fails closed on missing, stale, malformed or mismatched evidence and must PASS before any Wave 1 production schema migration may be authorized.

| Gate input | Required proof |
| --- | --- |
| Prior acceptance | Wave 0 package final accepted status, W0-G12 approval reference and technical/data-owner sign-off |
| Recovery resilience | Off-VPS encrypted copy: artifact SHA-256, independent location/reference, retention, access controls and restore provenance; fresh current production encrypted backup |
| Restore | Version-matched isolated restore, schema/count/hash/reconciliation comparisons and smoke |
| Migration quality | Fresh DB and re-run migration PASS; CI/tests/builds PASS; SQL is additive-only; object allowlist excludes Wave 2+ domain tables/events |
| Production baseline | Current read-only reconciliation baseline and explained drift from Wave 0; known exceptions preserved |
| Dormancy | All canonical allowlists/flags OFF; no cutover ACTIVE; no writer endpoint, dual write, canonical read switch or domain workflow modification |
| Authorization | Named technical/data/operational owner approval of reviewed SHA, backup/restore artifacts, current baseline, execution window and rollback plan |

The gate emits a signed or SHA-addressed sanitized manifest. A passing gate authorizes a later human decision, not automatic deployment. Changed image, SQL, backup, baseline or approval invalidates the pass.

## 13. Wave 1 Acceptance Gates

| Gate | Required PASS evidence |
| --- | --- |
| W1-G01 Schema | Exact approved additive object manifest; zero legacy object changes and no domain event table |
| W1-G02 Constraints | FK/check/unique/overlap/trigger tests against concurrent writers |
| W1-G03 Provenance | Immutable source contract, M1-M3 batch linkage, no production import/orphan |
| W1-G04 Event identity | UUID, sequence, idempotency and occurrence/recording tests |
| W1-G05 Corrections/versioning | Cycle, type, terminal reversal/void and as-of invariants |
| W1-G06 Attribution | All 26 role codes, four states, evidence and future typed/allocation contracts |
| W1-G07 Policies | Effective-dated scope, no overlap, immutable approved contents |
| W1-G08 Cutover registry | Approval/evidence/activation constraints, zero behavior enablement |
| W1-G09 Exception lifecycle | Named rule, dedupe, transitions, evidence and approval expiry |
| W1-G10 Security/permissions | Audit role read-only, scoped writer, no exposed write route/secret |
| W1-G11 Legacy behavior | PMS/website smoke and current workflows unchanged; flags OFF |
| W1-G12 Rollback | Isolated restore and read fallback verified; no destructive down migration |
| W1-G13 Owner acceptance | Named technical/data-owner review of full execution evidence, explicit decision reference |

Any failed or missing gate means **WAVE 1 NOT ACCEPTED**. Wave 2 remains blocked until all W1-G01-G13 pass and the owner records explicit Wave 1 implementation acceptance.

## 14. Ordered Future Implementation Steps (Not Executed)

1. Obtain separate Wave 1 implementation authorization against this frozen file/change manifest; resolve only decisions in section 15.
2. Freeze code SHA, exact SQL/object allowlist and approval references; collect current Wave 0 baseline and known exceptions.
3. Implement additive Prisma models and handwritten reviewed SQL constraints/indexes/triggers; keep business domain tables out.
4. Add dormant canonical libraries, static role validation and synthetic fixtures; add no application route or legacy workflow hook.
5. Add disposable-DB tests, CI, evidence schemas and gate/runbook; prove concurrency and permission invariants.
6. Apply all migrations to a fresh database, repeat deploy, run tests/builds and compare catalog to the approved allowlist.
7. Create current encrypted production backup and independently resilient off-VPS encrypted copy; record hash, retention, access and provenance.
8. Restore into isolated same-major PostgreSQL; compare schema, counts, key digests, reconciliation and smoke.
9. Capture current production read-only baseline; review clinic drift and historical exceptions without mutation.
10. Run W1-PROD-DDL-GATE; obtain named owner production-DDL approval on its manifest and the deployment window.
11. Only if later separately authorized, apply additive PMS-owned migration, keep all flags OFF, and perform post-DDL catalog/data/permission/smoke comparison.
12. Assemble W1-G01-G13 execution package; seek separate implementation acceptance. Do not start Wave 2 while any gate remains open.

## 15. Genuine Open Implementation Decisions

No frozen business metric or attribution definition is reopened here.

| Decision | Options | Recommended | Consequence |
| --- | --- | --- | --- |
| DB-enforced policy overlap | Reviewed GiST exclusion extension vs trigger with scope advisory lock | Trigger/lock if extension availability or privilege is uncertain; prove with concurrent DB tests | Choice changes SQL/permission review, not effective-date semantics |
| Generic owner FK before typed tables exist | Polymorphic key now vs defer owner-specific FK/trigger to domain wave | Defer production owner rows and require typed owner FK/deferred check when first domain writer is introduced | Wave 1 remains zero-import and cannot create orphan provenance/header rows |
| Active registry status representation | Mutable audited status projection vs append-only version rows | Append-only versions plus unique active partial index | More rows, stronger activation history |
| Off-VPS recovery destination and retention | Encrypted object store vs second restricted host | Owner-approved independently resilient encrypted store with tested restore and written retention | W1-PROD-DDL-GATE cannot pass without its concrete evidence |

**WAVE 1 SPECIFICATION READY / IMPLEMENTATION NOT AUTHORIZED**
