# LUMORA CANONICAL TECHNICAL ARCHITECTURE & MIGRATION DESIGN v1

Status: **TECHNICAL ARCHITECTURE APPROVED**
Prepared: 18 September 2026

This design converts the frozen business dictionaries, Executive Dashboard architecture, [canonical readiness matrix](CANONICAL-DATA-READINESS-MATRIX.md), and [read-only reconciliation](CANONICAL-DATA-RECONCILIATION-PLAN.md) into a target technical model and migration program. It contains no executable migration, final schema, application code, API change, UI change, backfill, repair, or deployment instruction.

## Design Principles

1. Canonical events are append-only. Corrections append a version, reversal, void, or superseding event; they do not rewrite history.
2. Domain events use typed tables or typed payload contracts. A single unvalidated JSON event bucket is not the canonical model.
3. `occurredAt` answers when the business event happened. `recordedAt` answers when Lumora stored it. Both use UTC instants; clinic calendar rules use Asia/Colombo.
4. Every imported record carries provenance, migration class, source identifier, migration batch, and definition/policy version.
5. Doctor and branch roles are explicit. A generic `doctorId` or `branchId` never substitutes for ATTR-D01-D13 or ATTR-B01-B13.
6. Unassigned and Unknown are first-class states. Current user role, branch membership, plan status, completion, invoice branch, or queue state cannot silently fill missing historical truth.
7. Canonical money is integer cents with an explicit currency. Unknown amount is null/Unknown, never numeric zero.
8. Transactional state, business events, analytical snapshots, and Action Centre workflow are separate concerns.
9. One versioned canonical metric layer serves every dashboard, report, export, and alert source condition.
10. Migration follows expand -> reconcile -> shadow-read -> approve -> switch-read -> stabilize. Legacy data is retained until a separately approved retirement phase.

## Migration Classes

| Class | Meaning | Required treatment |
| --- | --- | --- |
| M1 | Historical canonical migration | Import source history with stable provenance and invariant checks |
| M2 | Reconcile then migrate | Create exception records first; migrate only rows that pass deterministic evidence rules |
| M3 | Cutover opening state | Record an approved opening balance/state at cutover; do not fabricate preceding events |
| M4 | Prospective-only | Begin canonical capture at activation; historical value remains Unknown/Unassigned or legacy-only |

## Required Output Index

| Required output | Location in this design |
| --- | --- |
| 1. Target Technical Domain Model | Section 1 |
| 2. Proposed Event Model | Section 2 |
| 3. Attribution Storage Model | Section 3 |
| 4. Migration Classification Matrix M1-M4 | Section 4 |
| 5. Historical Cutover Strategy by Domain | Sections 5-8 |
| 6. Technical Data Model Gaps | Section 16 |
| 7. Migration Waves | Section 12 |
| 8. Reconciliation and Validation Gates | Sections 13-14 |
| 9. Rollback / Safety Strategy | Section 15 |
| 10. Legacy Coexistence Strategy | Section 11 |
| 11. Implementation Risk Register | Section 17 |
| 12. Final Technical Owner Decisions | Section 18; all listed decisions are approved |

# 1. Target Technical Domain Model

The names below are conceptual. Final table and field names belong to the later implementation design.

## 1.1 Core Event Infrastructure

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| CanonicalEventHeader | Common identity, sequence, actor, provenance and idempotency for typed events | One domain event | Aggregate, actor, policy version, source reference | Immutable | `occurredAt`, `recordedAt` | M1-M4 by event |
| EventCorrection | Append-only correction, reversal, void or supersession link | One corrective action against an event/version | Original event, replacement event, reason, approver | Immutable | correction occurrence/recording | M4; M2 for approved migrated corrections |
| SourceRecordReference | Trace canonical facts to legacy/current records without copying mutable meaning | One canonical record to one source record | Event/entity, source system/table/key, checksum | Immutable | imported/observed time | M1-M3 |
| PolicyVersion | Version due dates, rounding, alert, calendar and domain rules | One approved policy version | Policy family, effective range, approver | Immutable version; status controlled | effective from/to | M3/M4 |
| ClinicCalendarVersion | Asia/Colombo operating days, sessions, closures and holidays | One clinic/branch calendar version | Branch, closure events, policy | Immutable version | effective range | M3/M4 |
| CutoverRegistry | Record approved domain cutover and scope | One domain/scope/cutover | Migration batch, owner approval, readiness evidence | Immutable after activation | cutover instant | M3/M4 |
| MigrationBatch | Make imports repeatable and auditable | One execution plan/run | Source snapshot, checksums, counts, approval | Append-only status transitions | started/completed/approved times | M1-M3 |

`CanonicalEventHeader` is a shared contract, not permission to store every domain event as arbitrary JSON. Typed domain records own required IDs and constraints.

## 1.2 Patient / Encounter

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| PatientRegistrationEvent | Canonical patient registration and source | One registration event | Patient, acquisition source, recording context | Immutable; correction event | registration occurrence | M1 where `createdAt` is verified |
| PatientStatusVersion | Effective active/deceased/deactivated state | One status version | Patient, reason, actor | Immutable versions | effective range | M3/M4 |
| ClinicalEncounter | Stable clinical episode identity | One patient encounter episode | Patient, queue episode, Visit(s), segments | Mutable projection from events | opened/closed times | M2/M4 |
| EncounterSegment | Preserve doctor/branch/time segments and transfers | One uninterrupted doctor/branch interval | Encounter, D03, B03, chair | Immutable; correction event | start/end | M4; legacy proxy stays approximate |
| ClinicalVisitCompletionEvent | Authoritative completion for PAT-C07 | One completed Visit version | Visit, patient, D05, B04 | Immutable; reopen/correction events | clinical completion | M1 for 145 evidenced Visits |
| VisitLifecycleEvent | Reopen, correct or void a Visit without overwriting completion history | One lifecycle change | Visit and prior completion/version | Immutable | occurrence/recording | M4 |
| FollowUpRecommendationEvent | Preserve recommender, target and origin context | One recommendation/version | Patient, Visit, D11, B04 | Immutable; amendment event | committed time | M2/M4 |
| ReferralEvent | Preserve every referral rather than latest fields | One referral | Patient/queue/Visit, D13, from/to context | Immutable | referral time | M4; legacy latest value remains approximate |

## 1.3 Appointment / Queue

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| AppointmentOccurrence | Stable scheduled occurrence separate from mutable booking | One intended service occurrence | Patient, D01, B01, schedule | Projection from events | scheduled start/end | M3 for open appointments; M4 events |
| AppointmentEvent | Created/rescheduled/cancelled/no-show/completed chronology | One occurrence lifecycle event | Appointment occurrence, actor, reason | Immutable | occurrence and recording | M4; selected outcomes M2 only with proof |
| AppointmentArrivalLink | Link an occurrence to an actual arrival without making them the same event | One occurrence-arrival relationship | Appointment occurrence, queue arrival | Immutable; correction link | link occurrence | M2/M4 |
| QueueEpisode | Stable operational queue identity | One arrival-to-departure episode | Patient, appointment, branch, Visit links | Projection from events | arrival/departure | M3 for open episodes; M4 events |
| QueueEvent | Arrival, assignment, call, transfer, departure and correction chronology | One queue lifecycle event | Queue episode, actor, role at event | Immutable | occurrence/recording | M4; legacy current state is not event history |
| QueueVisitLink | Versioned evidence linking operational episode to clinical Visit | One relationship version | Queue episode, Visit, evidence/approval | Immutable versions | effective/recorded | M2/M4 |
| NoShowOutreachWorkItem | Routine outreach workflow, not automatically an alert | One appointment occurrence outreach case | CAP-C07 occurrence, patient, branch queue | Mutable projection with append-only events | opened/terminal times | M4 |

## 1.4 Treatment

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| TreatmentPlanVersion | Preserve authored plan scope and value amendments | One immutable plan version | Patient, D06, prior version | Immutable version | effective/recorded | M1 creation; M4 amendments |
| TreatmentPlanEvent | Created, presented, amended, closed lifecycle | One plan event | Plan/version, actor, B12 where applicable | Immutable | occurrence/recording | Created M1; presentation/closure M4 |
| TreatmentItemVersion | Preserve item scope, fee/category and patient obligation | One item version | Plan version, fee, prior item version | Immutable version | effective/recorded | M2 for stable legacy items; M4 thereafter |
| TreatmentItemDecisionEvent | Accepted, declined or deferred patient decision | One item decision/version | Item, patient decision evidence, B13 | Immutable; correction event | decision/recorded time | M4 |
| TreatmentItemStartEvent | Explicit clinical start | One item start or resumed episode | Item, Visit/encounter, performer context | Immutable | start time | M4 |
| TreatmentPerformanceSegment | Actual work by doctor, branch and interval | One uninterrupted treatment performance segment | Item, encounter, D07, B04 | Immutable; correction event | segment start/end | M4 |
| TreatmentItemCompletionEvent | Item completion independent of acceptance and billing | One completion/version | Item, Visit, performers, B04 | Immutable; correction/void | completion time | M1 for 3 evidenced items; M4 otherwise |
| TreatmentContributionVersion | Exact performer shares for completed work | One contribution version per item/completion | Completion, contributors, policy | Immutable version | effective/approved time | M4; M2 only where evidence proves legacy share |
| TreatmentBillingLink | Explicit treatment item to invoice-line relationship | One item-line relationship/version | Item, invoice line, contribution version | Immutable versions | link/recorded time | M4; legacy generally Unknown |
| LegacyTreatmentState | Keep imported active/completed legacy classification outside canonical funnel | One legacy plan/item at cutover | Existing plan/item, review outcome | Immutable cutover classification | cutover | M3 |

## 1.5 Billing / Finance

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| FinancialAccount | Cash drawer, bank, card/POS or clearing account; never a Branch | One financial account/version | Currency, account type, owner/context | Effective-dated versions | effective range | M3/M4 |
| InvoiceAggregate | Stable invoice identity and current projection | One invoice | Patient, current version, settlement projection | Mutable projection | derived | M2 |
| InvoiceVersion | Preserve issued terms and later adjustments | One immutable invoice version | Invoice, lines, B05, prior version | Immutable | issue/effective time | M2 for current history; M4 thereafter |
| InvoiceLineVersion | Canonical integer-cent line amount and category | One line version | Invoice version, fee/treatment link | Immutable | invoice version time | M2/M4 |
| InvoiceEvent | Issued, adjusted, voided or written-off chronology | One invoice event | Invoice/version, actor, policy | Immutable | occurrence/recording | M2 issue; M4 adjustments |
| PaymentEvent | Patient receipt with account and B06 | One recorded/reversed payment event | Invoice allocation(s), account, B06 | Immutable; reverse with event | paid/recorded time | M1 amount/time; B06 remains Unassigned; M4 full event |
| PaymentInvoiceAllocation | Allocate one payment across invoice balances | One payment-invoice allocation | Payment, invoice/version, cents | Immutable; reversal allocation | payment time | M2/M4 |
| RefundEvent | Explicit cash refund and source relationship | One refund/reversal | Payment/invoice, account, B06 | Immutable | refund time | M4 |
| OtherIncomeEvent | Non-patient cash inflow | One income event | Account, category, B06 | Immutable; reversal | cash event time | M2 if source proves; M4 |
| ExpenseEvent | Cash expense distinct from economic allocation | One expense event | Account, category, B06 and allocations | Immutable; reversal | cash event time | M2 if source proves; M4 |
| ExpenseBranchAllocation | Allocate economic cost to B07 | One expense-branch share/version | Expense/source obligation, B07 | Immutable version | allocation effective time | M4 |
| SupplierPaymentEvent | Supplier cash event distinct from receipt/payable | One supplier payment | Supplier payable, account, B11 | Immutable; reversal | payment time | M4 |
| SalaryPaymentEvent | Payroll cash event distinct from obligation/cost | One salary payment | Obligation(s), account, B10 | Immutable; reversal | payment time | M4 |
| ReceivableProjection | Current/as-of amount derived from invoice/payment/refund events | One invoice as-of projection | Invoice and settlement events | Rebuildable projection | as-of | M2/M4 derived |
| ProductionAllocationVersion | FIN-C18 cents by D09/B05 and Unassigned | One invoice-line allocation version | Invoice line, treatment contribution | Immutable version | approved/effective time | M4 |
| CollectionAllocation | FIN-C19 inherited allocation for a payment | One payment-production-allocation row | Payment, production version, D10 | Immutable; correction entries | payment/effective time | M4 |

## 1.6 Doctor Attribution

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| EventDoctorAttribution | Store direct event-owned D01-D07 and D11-D13 roles where not typed as required columns | One event-role assignment | Event, role code, User or Unassigned | Immutable; correction version | event time | M1-M4 by role |
| InvoiceDoctorSet | Preserve D08 relationship set without implying ownership | One invoice-Visit-doctor relationship | Invoice, Visit, doctor | Derived/rebuildable | source link time | M1 |
| TreatmentContributor | D07 performer and exact share within contribution version | One contributor/share | Contribution version, doctor/Unassigned | Immutable version | performance/effective time | M4 |
| ProductionDoctorAllocation | D09 production cents/share | One line/version/doctor | Production allocation, contributor | Immutable version | allocation effective time | M4 |
| PaymentDoctorAllocation | D10 collection cents inherited from D09 | One payment/doctor/version | Payment, production allocation | Immutable | payment/effective time | M4 |

## 1.7 Branch Attribution

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| EventBranchAttribution | Store explicit event-owned B01-B06 and B08-B13 where not typed directly | One event-role assignment | Event, role code, Branch or Unassigned | Immutable; correction version | event time | M1-M4 by role |
| BranchAllocationVersion | Exact B07 economic allocation shares/cents | One source obligation/allocation version | Expense/payroll/supply source, branch/Unassigned | Immutable version | allocation effective time | M4 |
| StaffWorkBranchInterval | B09 effective worked/approved roster evidence | One staff/branch interval or share | Staff, roster/work evidence | Immutable version | interval | M3/M4 |
| BranchMismatchFact | Reproducible named role-pair mismatch for BR-C50 | One entity/event/role pair | Two attribution facts, rule version | Derived/rebuildable | as-of/event time | M4 derived |
| UnassignedBranchFact | Reproducible denominator/numerator for BR-C49 | One source fact/required role | Event, missing role, reason | Derived from explicit absence | as-of/event time | M1-M4 derived |

## 1.8 Capacity / Availability

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| RosterProposalVersion | Proposed staff schedule before approval | One staff/branch/session version | Staff, B09, session | Immutable version | effective interval | M4 |
| ApprovedRosterVersion | Approved denominator evidence | One approved staff/branch/session version | Proposal, approver, calendar | Immutable version | effective interval | M3/M4 |
| AvailabilityInterval | Canonical approved available time | One doctor/branch interval | Doctor, B09, roster, closure | Immutable; amendment event | start/end | M4 |
| FormalClosureInterval | Branch/session closure excluded under policy | One branch interval | Branch, calendar, reason | Immutable version | start/end | M3/M4 |
| DoctorStatusInterval | Closed interval derived from paired status events | One doctor/branch/status interval | Doctor, B03/B09 context, queue | Derived then frozen by run/version | start/end | M4 |
| OvertimeEvidence | Encounter time outside approved availability | One interval overlap result | Encounter segment, availability version | Derived/rebuildable | interval | M4 |
| Chair | Stable physical chair identity | One chair/effective version | Branch | Effective-dated | effective range | M3/M4 |
| ChairOccupancyInterval | Canonical chair denominator/numerator evidence | One chair/encounter interval | Chair, encounter segment | Immutable; correction | start/end | M4 |

## 1.9 Payroll

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| PayrollEligibilityVersion | Explicit Payroll Eligible population | One employee eligibility version | Employee, reason, owner | Immutable version | effective range | M3/M4 |
| EmploymentContractVersion | Preserve effective pay terms and amendments | One contract version | Employee, prior version | Immutable version | effective range | M3 after review; M4 |
| PayrollPeriod | Asia/Colombo payroll period and due policy | One period/policy scope | Policy version, calendar | Immutable after opening | period/due date | M4 |
| PayrollObligation | Stable employee-period obligation | One employee/payroll period | Eligibility, contract, components | Mutable projection from events | period | M4 |
| PayrollComponent | Typed recurring/ad-hoc allowance, deduction or correction | One obligation component/version | Obligation, component type, cents | Immutable version | effective/recorded | M4 |
| PayrollObligationEvent | Created, finalized, corrected or voided lifecycle | One obligation event | Obligation/version, actor | Immutable | occurrence/recording | M4 |
| StatutoryPolicyVersion | Approved eligibility/rate/basis, without assumptions | One statutory rule version | Legal/payroll approval | Immutable version | effective range | M4 only after approval |
| StatutoryCostEvent | Employee/employer statutory component | One obligation/rule result | Obligation, policy version | Immutable; correction | payroll period | M4 |
| SalaryCostAllocationVersion | PAY-C13 B07 allocation from B09 evidence | One obligation/allocation version | Obligation, work evidence, B07 | Immutable version | payroll period | M4 |

## 1.10 Inventory / Purchasing

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| BranchAssortmentVersion | Effective expected item population by branch | One item/branch/version | Catalog item, B08 | Immutable version | effective range | M3/M4 |
| InventoryOpeningPosition | Approved quantity/cost/provenance at cutover | One item/branch opening | Item, B08, approver, evidence | Immutable; correction by movement | count/effective time | M3 |
| InventoryMovement | Receipt, transfer, consumption, adjustment or stock take | One item/branch movement leg | Position, B08, source event | Immutable; reversing movement | movement/recorded time | M4 |
| InventoryTransfer | Pair OUT and IN movement legs | One transfer | Source/destination B08, item | Immutable; reversal pair | transfer time | M4 |
| InventoryValuationState | Reproducible WAC after each cost-bearing movement | One item/branch/movement state | Prior state, movement, cost | Immutable derived chain | movement time | M3 opening/M4 |
| PurchaseOrderVersion | Preserve ordered scope and amendments | One PO version | Supplier, B08 receipt destination | Immutable version | ordered/effective time | M4 |
| PurchaseOrderEvent | Raised, approved, cancelled or closed | One PO lifecycle event | PO/version, actor | Immutable | occurrence/recording | M4 |
| GoodsReceipt | Header-level receipt evidence | One physical receipt | PO, supplier, B08, actor | Immutable; correction receipt | received/recorded time | M4 |
| GoodsReceiptLine | Partial/over receipt by line | One PO-line receipt | Receipt, PO item, quantity/cost | Immutable; reversing line | receipt time | M4 |
| SupplierInvoice | Approved supplier liability source | One supplier invoice/version | Supplier, PO/receipt matches | Immutable version | approved/invoice time | M4 |
| SupplierPayable | Canonical amount due after match/exceptions | One supplier invoice obligation | Invoice, match exceptions | Projection from events | due/as-of | M4 |
| PurchaseMatchException | PO/receipt/invoice mismatch evidence | One mismatch episode | PO, receipt, supplier invoice | Mutable workflow; append-only events | detected/resolved | M4 |

## 1.11 Action Centre

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| AlertPolicyVersion | Version detection, severity, SLA, dedupe, snooze and dismissal rules | One alert-type policy version | Canonical source rule, owner role | Immutable version | effective range | M4 |
| AlertInstance | Stable deduplicated alert episode | One subject/type/policy episode | Source subject, policy, owner queue | Mutable projection from lifecycle | detected/current state | M4 |
| AlertLifecycleEvent | Detected, acknowledged, assigned, snoozed, reopened, resolved or dismissed | One lifecycle transition | Alert, actor, reason, prior state | Immutable | occurrence/recording | M4 |
| ActionWorkItem | Routine operational work distinct from alert | One work item | Source subject, branch/role queue | Mutable projection with event history | opened/due/terminal | M4 |
| WorkItemEvent | Attempt, outcome, assignment and terminal history | One work transition | Work item, actor, outcome | Immutable | occurrence/recording | M4 |
| AlertSourceEvaluation | Reproducible record of policy evaluation and source version | One policy/subject/evaluation | Alert policy, source evidence | Immutable | evaluatedAt/asOf | M4 |

## 1.12 Data Quality / Reconciliation

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| ReconciliationRuleVersion | Version invariant/query/severity/owner definition | One rule version | Domain, canonical IDs, policy | Immutable version | effective range | M3/M4 |
| ReconciliationRun | Auditable execution scope and counts | One rule-set/source snapshot run | Rules, source snapshot, migration batch | Append-only status | started/completed | M2/M4 |
| DataQualityException | Durable distinct issue, not a generic warning | One rule/source-entity episode | Rule, source entity, evidence, owner | Mutable projection from events | detected/current state | M2/M4 |
| ExceptionLifecycleEvent | Acknowledge, assign, approve exception, remediate, expire or close | One exception transition | Exception, actor, correction refs | Immutable | occurrence/recording | M2/M4 |
| ExceptionEvidence | Structured counts, hashes and references without unsafe sensitive copies | One evidence item | Exception/run/source records | Immutable | observed/recorded | M2/M4 |
| ApprovedExceptionVersion | Time-bounded owner acceptance of known variance | One approval/version | Exception, approver, expiry/review | Immutable version | effective range | M2/M4 |

## 1.13 Reporting / Analytics Support

| Entity | Purpose | Grain | Key Relationships | Immutable / Mutable | Effective/Event Timestamp | Migration Class |
| --- | --- | --- | --- | --- | --- | --- |
| MetricDefinitionVersion | Bind canonical ID to one approved calculation and dimensions | One metric/version | Dictionary version, SQL/service implementation hash | Immutable version | effective range | M4 |
| MetricComputationRun | Record as-of, source watermark, version and validation | One metric scope/run | Metric version, source versions, exceptions | Immutable | computedAt/asOf | M4 |
| CanonicalMetricSnapshot | Reproducible period/snapshot/cohort result | One metric/dimension/period/as-of/version | Computation run, dimension keys | Immutable; superseding run | period/asOf | M4; M1/M2 derived history |
| SourceCoverageSnapshot | Valid, invalid, Unassigned and Unknown population | One source/domain/as-of | Reconciliation run, metric run | Immutable | asOf | M4 |
| LegacyMetricView | Explicitly labeled legacy/approximate access | One legacy metric query/version | Source fields, cutoff, limitations | Versioned read model | legacy period/asOf | M1-M3 |

# 2. Proposed Event Model

## 2.1 Common Event Contract

Every event has: `eventId`, typed `eventType`, `aggregateId`, monotonically increasing aggregate sequence, payload schema version, `occurredAt`, `recordedAt`, actor type/ID, source channel, idempotency key, policy/version references, migration class/provenance, and optional `correctsEventId`, `reversesEventId` or `voidsEventId`. Required role fields are typed IDs or explicit Unassigned reason codes.

## 2.2 Appointment Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AppointmentCreated | Occurrence | appointment, patient | booking time | insert time | user/public system | B01 | D01 | New occurrence; correction/reschedule does not overwrite |
| AppointmentRescheduled | Occurrence version | appointment, prior/new occurrence | decision/effective time | insert time | user/patient channel | old/new B01 | old/new D01 | Close old occurrence outcome; create new occurrence/version |
| AppointmentCancelled | Occurrence | appointment, reason | cancellation time | insert time | user/patient/system | B01 | D01 | Append outcome; correction event if miscoded |
| AppointmentNoShow | Occurrence | appointment, policy | policy evaluation time | insert time | scheduler/policy engine | B01 | D01 | Exclusive outcome; revoke only by correction |
| AppointmentArrivalLinked | Relationship | appointment, queue arrival | arrival/link time | insert time | receptionist/system | B01 and B02 retained | D01 only; arrival has no doctor owner | Versioned link correction; never merge roles |

## 2.3 Queue / Encounter Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QueueArrived | Queue episode | queue, patient/anonymous subject | physical arrival | insert time | receptionist/system | B02 | none | Immutable; void/correct by event |
| QueueAssigned | Assignment segment | queue, assignee/Unassigned | assignment effective time | insert time | staff/system | B02/B03 context | D02 | New assignment closes prior segment |
| QueueCalled | Queue episode | queue, caller | call time | insert time | staff | B02 | D02 context; caller is actor | Append-only |
| EncounterStarted | Encounter segment | queue, encounter, doctor | actual start | insert time | doctor/nurse | B03 | D03 | Opens segment; duplicate open blocked |
| EncounterTransferred | Segment boundary | encounter, from/to doctor | transfer time | insert time | doctor/nurse | from/to B03 | from/to D03 | End old/start new; both preserved |
| EncounterEnded | Segment | encounter, open segment | actual end | insert time | doctor/nurse | B03 | D03 | Closes exact open segment |
| QueueDeparted | Queue episode | queue, outcome | departure time | insert time | staff/system | B02 | D02 context only | Terminal operational event, not clinical completion |
| QueueCorrectedOrVoided | Prior event | queue, target event, reason | correction time | insert time | authorized staff | preserve original roles | preserve original roles | Append correction/void; projection recomputed |

## 2.4 Visit Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VisitClinicallyCompleted | Visit version | Visit, patient | clinical completion | insert time | finalizing doctor | B04 | D05; D04 only with performance evidence | Immutable completion version |
| VisitReopened | Visit | Visit, prior completion, reason | authorization time | insert time | authorized clinician | original B04 retained | actor plus original D05 | Append event; completion remains historical |
| VisitCorrected | Visit version | Visit, corrected version | correction effective time | insert time | authorized clinician | explicit corrected B04 | explicit D05 | Superseding version, never row overwrite |
| VisitVoided | Visit | Visit, reason | void effective time | insert time | authorized clinician | original B04 | original D05 | Append void; exclude under as-of rules |

## 2.5 Treatment Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TreatmentPlanCreated | Plan version | plan, patient | authored time | insert time | planner | context only; not B12 | D06 | Immutable initial version |
| TreatmentPlanPresented | Plan/item-version scope | plan, presented item versions | actual presentation | insert time | presenter | B12 | presenter actor; D06 retained separately | Correction event; original cohort retained |
| TreatmentItemAccepted | Item version | item, decision evidence | explicit acceptance | insert time | authorized recorder | B13 | D06 context only | Append decision/correction; never infer |
| TreatmentItemDeclined | Item version | item, reason | decision time | insert time | authorized recorder | B13 decision context | D06 context | Append decision/version |
| TreatmentItemDeferred | Item version | item, reason/review date | decision time | insert time | authorized recorder | B13 if decision occurred there | D06 context | Append decision/version |
| TreatmentItemStarted | Item | item, encounter/Visit | actual start | insert time | performer | B04 | D07 | Append start; repeat start requires resume/restart semantics |
| TreatmentPerformanceSegment | Item interval | item, encounter, doctor | segment start/end | insert time | performer/authorized recorder | B04 | D07 | Versioned contributions; no equal split inference |
| TreatmentItemCompleted | Item/version | item, Visit, contribution version | actual completion | insert time | finalizing clinician | B04 | D07 contributors | Correction/void event; completion independent of billing |
| TreatmentCompletionCorrected | Completion | target completion, replacement | correction effective time | insert time | authorized clinician | explicit B04 | explicit D07 | Superseding completion/contribution version |
| TreatmentPlanAmended | Plan version | plan, prior/new item versions | amendment effective time | insert time | planner | context; B12 only upon presentation | D06 | New immutable version |
| TreatmentPlanClosed | Plan | plan, close outcome | close time | insert time | authorized clinician/coordinator | retained contexts | D06 context | Append terminal event; reopen by event |

## 2.6 Finance Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| InvoiceIssued | Invoice version | invoice, patient, lines | actual issue time | insert time | billing user/system | B05 | D09 only through allocation | Immutable issued version |
| InvoiceAdjusted | Invoice version | invoice, prior/new version | adjustment effective time | insert time | authorized billing user | B05 allocation retained/versioned | D09 allocation version | New version, never overwrite issued terms |
| PaymentRecorded | Payment | payment, account, allocations | cash event time | insert time | processor/system | B06 or explicit Unassigned | D10 derived from D09 | Reverse with event; idempotent source key |
| PaymentReversed | Payment | original payment, reversal | reversal time | insert time | authorized finance user | reversal B06/account | reverse D10 cents | Exact negative/reversal allocations |
| RefundRecorded | Refund | refund, source payment/invoice | refund time | insert time | authorized finance user | B06 | reverse inherited allocation if applicable | New event, not negative edit |
| OtherIncomeRecorded | Income | event, account, category | receipt time | insert time | finance user | B06 | none | Reverse/correct by event |
| ExpenseRecorded | Expense | event, account, category | payment time | insert time | finance user | B06; B07 allocations separate | none | Reverse/correct by event |
| SupplierPaymentRecorded | Supplier payment | payment, payable, account | payment time | insert time | finance user | B11 | none | Reverse/correct by event |
| SalaryPaymentRecorded | Salary payment | payment, obligations, account | payment time | insert time | payroll/finance user | B10 | employee is payee, not doctor role | Reverse/correct by event |

## 2.7 Availability Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RosterProposed | Roster version | staff, branch, intervals | proposal effective time | insert time | scheduler | B09 candidate | doctor/staff subject | New version |
| RosterApproved | Roster version | proposal, approver | approval/effective time | insert time | authorized manager | B09 | doctor/staff subject | Immutable approved version |
| AvailabilityChanged | Availability version | staff, old/new interval | change effective time | insert time | authorized manager | B09 | doctor subject | New version; no historical overwrite |
| FormalClosureRecorded | Closure interval | branch/session, reason | closure effective time | insert time | manager/system | branch calendar context | none | Versioned closure |
| OvertimeEvidenceRecorded | Interval evidence | encounter, availability | actual overlap interval | compute/record time | system/approver | B03 vs B09 both retained | D03/D07 as applicable | Recomputable under versioned rule |
| DoctorStatusIntervalClosed | Status interval | doctor, branch, status | interval end | insert time | doctor/system | B03/B09 named context | doctor subject | Correction appends replacement interval |

## 2.8 Payroll Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ContractVersionEffective | Contract version | employee, terms | effective time | insert time | payroll owner | no economic branch | none | New version |
| PayrollObligationCreated | Employee-period | obligation, eligibility, contract | period crystallization | insert time | payroll system/user | B09 evidence; B07 later | none | Draft event then finalize |
| PayrollObligationFinalized | Obligation version | obligation, components | finalization time | insert time | authorized payroll user | B07 allocation version | none | Immutable finalized version |
| PayrollObligationCorrected | Obligation version | prior/new version, reason | correction effective time | insert time | authorized payroll user | corrected B07 allocation | none | Superseding version/delta |
| PayrollObligationVoided | Obligation | obligation, reason | void time | insert time | authorized payroll user | original roles retained | none | Append void |
| PayrollPaymentRecorded | Payment | salary payment, obligations | payment time | insert time | finance/payroll user | B10 | none | Finance salary-payment event |
| StatutoryCostRecorded | Obligation component | obligation, policy version | payroll period | insert time | payroll system/user | B07 allocation | none | New version only under approved policy |
| SalaryAllocationApproved | Allocation version | obligation, work evidence | allocation approval | insert time | payroll owner | B09 evidence -> B07 | none | Versioned exact shares/cents |

## 2.9 Inventory Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| StockPositionOpened | Item/branch | opening position, count/cost provenance | cutover count time | insert time | counter/approver | B08 | none | M3 opening; later correction is movement |
| GoodsReceived | Receipt line | receipt, PO line, quantity/cost | physical receipt | insert time | receiving user | B08 | none | Reversing receipt line; overreceipt approval linked |
| StockTransferred | Transfer leg pair | transfer, item, source/destination | transfer time | insert time | inventory user | source/destination B08 | none | Balanced OUT/IN; reverse pair |
| StockConsumed | Consumption | movement, clinical/nonclinical source | actual issue | insert time | authorized user/system | B08 | D07/Visit context only when applicable | Reversing movement; failure separately recorded |
| StockAdjusted | Adjustment | movement, reason/evidence | adjustment effective time | insert time | privileged user | B08 | none | Correction movement, not balance edit |
| StockTaken | Count | item/branch, counted quantity | count time | insert time | counter/approver | B08 | none | Variance movement derived and linked |
| PurchaseOrderStateChanged | PO version | PO, state/reason | state time | insert time | purchasing user | B08 destination | none | Append lifecycle event |
| SupplierPayableApproved | Supplier invoice | invoice, match result | approval time | insert time | authorized finance user | no B11 until payment | none | Versioned payable/correction |
| SupplierPaymentReferenced | Relationship | payable, supplier payment | link time | insert time | finance user/system | B11 belongs to payment | none | Versioned link; no receipt=payment inference |

## 2.10 Action Centre Events

| Event | Entity Grain | Required IDs | occurredAt | recordedAt | Actor | Branch Roles | Doctor Roles | Correction / Version Strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AlertDetected | Alert episode | alert, subject, policy/evaluation | actual evaluation/detection | insert time | policy engine/user | source-specific ATTR-B | source-specific ATTR-D | Initial detection or reopen episode; dedupe key required |
| AlertAcknowledged | Alert | alert, actor | acknowledgement time | insert time | role-queue member | retained source role | retained source role | Valid state transition only |
| AlertAssigned | Alert | alert, assignee | assignment time | insert time | authorized user | branch/role queue retained | assignee is workflow owner, not source doctor role | Append transition |
| AlertInProgress | Alert | alert | work start time | insert time | assignee | retained | retained | Append transition |
| AlertSnoozed | Alert | alert, reason, until, authority | snooze time | insert time | permitted actor | retained | retained | Type-policy validation; expiry reopens/evaluates |
| AlertReopened | Alert | alert, reason | reopen time | insert time | policy engine/user | retained | retained | New lifecycle event, same/new episode per policy |
| AlertResolved | Alert | alert, source evidence | source resolution time | insert time | policy engine/user | retained | retained | Source-driven; no source mutation |
| AlertDismissed | Alert | alert, mandatory reason/authority | dismissal time | insert time | permitted actor | retained | retained | Does not alter source data |

# 3. Attribution Storage Model

Direct roles are required typed columns/foreign keys on their owning immutable event. Allocation roles use versioned allocation tables because they can have multiple rows and exact shares. Derived relationship roles are stored/rebuilt as relationships and never promoted to ownership.

| Role | Canonical storage | Why |
| --- | --- | --- |
| ATTR-D01 Appointment Provider | AppointmentOccurrence/AppointmentEvent direct role | Exactly one provider or explicit Unknown per occurrence |
| ATTR-D02 Queue Assigned Doctor | QueueAssigned event/assignment segment | Reassignment requires history |
| ATTR-D03 Encounter-Start Doctor | EncounterSegment direct role | One doctor per segment; transfers create segments |
| ATTR-D04 Performing Doctor | TreatmentPerformanceSegment/contribution | May be multiple; Visit doctor alone is insufficient |
| ATTR-D05 Visit Record Doctor | VisitClinicallyCompleted direct role | Exactly one stored/finalizing Visit role |
| ATTR-D06 Treatment Planning Doctor | TreatmentPlanVersion direct role | Stable author role independent of performer |
| ATTR-D07 Treatment Performing Doctor | TreatmentContributor rows | Supports multiple performers and exact shares |
| ATTR-D08 Invoice-Linked Doctor Set | InvoiceDoctorSet relationship | Audit set only; never ownership |
| ATTR-D09 Production-Attributed Doctor | ProductionDoctorAllocation version rows | Exact line cents/shares and Unassigned reconciliation |
| ATTR-D10 Collection-Attributed Doctor | PaymentDoctorAllocation rows | Inherits approved D09 version at payment time |
| ATTR-D11 Follow-up Recommending Doctor | FollowUpRecommendationEvent direct role | Preserves origin recommender |
| ATTR-D12 Prescription Author | Prescription issue event/direct immutable field | One authorizing role |
| ATTR-D13 Referring Doctor | ReferralEvent direct role | Multiple referrals append |
| ATTR-B01 Appointment Branch | AppointmentOccurrence/AppointmentEvent direct role | Scheduled occurrence context |
| ATTR-B02 Arrival Branch | QueueArrived direct role | Physical arrival context |
| ATTR-B03 Encounter Branch | EncounterSegment direct role | Segment-specific physical context |
| ATTR-B04 Service Branch | Performance/completion/Visit events | Actual service context |
| ATTR-B05 Economic Billing Branch | InvoiceVersion/line allocation | Issue-time economic context, optionally line-split |
| ATTR-B06 Cash Payment Branch | Payment/refund/income/expense cash event | Must not inherit invoice/service branch |
| ATTR-B07 Expense Allocation Branch | BranchAllocationVersion rows | Supports central/shared and split costs |
| ATTR-B08 Stock Branch | Opening position and movement direct role | Physical stock context |
| ATTR-B09 Staff Work Branch | StaffWorkBranchInterval/approved roster | Effective worked-time evidence |
| ATTR-B10 Salary Payment Branch | SalaryPaymentEvent direct role | Independent cash context |
| ATTR-B11 Supplier Payment Branch | SupplierPaymentEvent direct role | Independent of receipt destination |
| ATTR-B12 Treatment Presentation Branch | TreatmentPlanPresented direct role | Immutable presentation-event context |
| ATTR-B13 Treatment Acceptance Branch | TreatmentItemDecisionEvent direct role | Immutable decision-event context |

An attribution value is `(roleCode, subjectId|null, assignmentState, reasonCode, evidenceRef, event/version)`. `assignmentState` is `ASSIGNED`, `UNASSIGNED`, `UNKNOWN`, or `NOT_APPLICABLE`. Historical Unassigned can change only through an approved versioned correction with contemporaneous or independently verified evidence; current membership is never evidence by itself.

## 3.1 Multi-Doctor Contribution Model

`TreatmentContributionVersion` contains the treatment completion/version, calculation policy, approval state and total allocable basis. Child `TreatmentContributor` rows contain `doctorId` or `isUnassigned`, integer `shareBasisPoints`, optional evidence units, and calculated integer cents.

Rules:

1. Contributor basis points plus Unassigned basis points equal exactly 10,000.
2. A single proven performer may receive 10,000 basis points. A single Visit doctor is only a flagged migration proxy, not proof for arbitrary history.
3. Shared work requires explicit evidence-based shares. Equal split is never a fallback.
4. Allocate cents using exact rational quotas. Floor every quota, then distribute remaining cents by descending fractional remainder. Ties use stable contributor identity order; the rounding policy/version is recorded.
5. Negative adjustment/reversal allocations use the same source allocation version and deterministic rule.
6. Corrections create a new contribution version. Prior production and collection allocations remain auditable; explicit restatement entries are required if approved policy changes prior collections.
7. `ProductionAllocationVersion` applies the approved contribution to each invoice line. Allocated production cents plus Unassigned equal the canonical line cents exactly.
8. `PaymentDoctorAllocation` inherits the approved production version proportionally across allocated invoice lines. Doctor cents plus Unassigned equal the Payment cents exactly.

# 4. Migration Classification Matrix M1-M4

| Technical source/entity | Class | Historical treatment |
| --- | --- | --- |
| Patient registrations | M1 | Import verified `Patient.createdAt` with source provenance |
| Completed Visit events, D05 and B04 | M1 | Import 145 rows with both completion markers; preserve source timestamps |
| Treatment plan creation and D06 | M1 | Import 37 plan-created facts only; no presentation/acceptance |
| Three linked treatment-item completions | M1 | Import completion evidence; no acceptance/start events |
| Prescription authorship D12 | M1 | Import stored author role |
| D08 invoice-linked doctor set | M1 | Import relationship set only |
| Existing Payment amount/time/method | M1 | Import 95 source receipt facts; B06 and D10 remain Unassigned |
| Invoice issue/version history | M2 | Validate status, issue evidence, lines, cents and adjustments before canonical issue import |
| Payment-to-ledger representation | M2 | Resolve two missing ledger representations through exceptions, not automatic repair |
| Receivables/paidDate | M2 | Reconcile 11 missing paid dates and as-of settlement evidence |
| Queue-to-Visit relationships | M2 | Review 31 PAID/no-Visit and 2 PAID/IN_PROGRESS conflicts |
| Fee/category links | M2 | Review 1/65 plan item and 6/124 invoice lines without stable fee IDs |
| Current open appointments/queue episodes | M3 | Create opening operational state at cutover, not historical lifecycle events |
| Legacy active treatment plans/items | M3 | Import Legacy Active/Completed/Deferred/Review classification only |
| Financial accounts and opening account balances | M3 | Owner-approved opening state with provenance |
| Payroll eligibility/contracts at cutover | M3 | Review two contracts and establish approved opening effective versions |
| Inventory positions/WAC opening | M3 | Physical count and approved cost/provenance per item/branch |
| Branch assortment | M3 | Approve opening effective assortment |
| Clinic calendars/approved roster/chairs | M3 | Owner-approved opening configuration at capacity cutover |
| Appointment/queue/encounter lifecycle events | M4 | Prospective append-only capture |
| D09/D10 production and collection allocations | M4 | Historical rows remain Unassigned unless independently proven under M2 review |
| B06/B07/B09-B13 missing event roles | M4 | Start at owning canonical event; no current-field inference |
| Treatment presentation/decision/start/performance events | M4 | Prospective-only funnel |
| Payroll obligations/components/statutory/payment/allocation | M4 | Begin at payroll cutover; no historical obligations fabricated |
| Inventory receipts/transfers/consumption/WAC chain/PO/payables | M4 | Begin after approved opening position |
| Alert instances and lifecycle | M4 | Initial detection at activation; no backdated lifecycle |
| Canonical metric snapshots | M4 | Recompute M1/M2 history only after each source gate passes |

# 5. Financial Technical Model and Historical Migration

## 5.1 Money and Settlement

- Canonical monetary columns use signed 64-bit integer cents and explicit `LKR`. PostgreSQL/Prisma implementation details are deferred, but overflow limits and serialization must be tested.
- Existing Float columns are migration evidence only. For each row, compare deterministic decimal-to-cents conversion with stored cents. The audit found zero current disagreements. After read cutover, Float is neither written nor read by canonical services; physical removal is a later separately approved cleanup.
- Zero cents is a known value, not an Unknown sentinel. Unknown money is nullable with an explicit reason/state and blocks publication where required.
- Invoice status is a projection from issue, adjustment, allocation, payment, refund, reversal, write-off and void events. It is not settlement history.
- Reversal uses explicit opposite events linked to the original. Corrections never edit canonical cash history.
- FinancialAccount is mandatory for prospective cash events and remains independent of Branch. One account may be associated operationally with a branch without becoming ATTR-B06/B10/B11.

## 5.2 `paidDate` / Canonical `settledAt` Evidence Hierarchy

For historical migration, derive a settlement instant only when all of these are true: invoice issued value is reconciled; valid non-reversed payment/refund allocations are complete; cumulative allocated cents first reach the canonical payable balance exactly; and no unresolved adjustment precedes that crossing.

Evidence order:

1. The timestamp of the final valid allocated Payment that causes reconciled balance to reach zero.
2. A valid existing `paidDate` only when consistent with allocation chronology and not earlier than the settling payment.
3. Explicit zero-value issue/adjustment evidence at issue time, if policy permits a zero-value invoice to settle immediately.
4. Otherwise Unknown. `status=PAID`, queue PAID, invoice `updatedAt`, or current zero balance alone cannot create a settlement timestamp.

## 5.3 Two Payments Without Ledger Rows

Each becomes a separate M2 DataQualityException containing source Payment ID, amount, timestamp, invoice, expected ledger category/direction, evidence checksum and owner. Future resolution choices are:

- **Provable representation:** an approved migration creates the canonical ledger/cash representation from the authoritative Payment, linked to the exception and migration batch.
- **Existing external evidence:** manual review links the Payment to a verified equivalent transaction without duplication.
- **Not provable:** Payment remains the receipt source; ledger reconciliation retains an explicit variance/Unassigned representation.

Automatic repair is unsafe until duplicate detection, category, account, branch role and amount/timing criteria all pass. This design authorizes no repair.

# 6. Queue / Visit Migration Policy

Visit completion outranks queue PAID/COMPLETED for clinical truth.

| Evidence outcome | Migration treatment |
| --- | --- |
| Valid non-clinical closure | Preserve queue outcome as legacy operational closure; create no Visit/completion |
| Independently linkable historical Visit | M2 QueueVisitLink version with evidence and approval; do not alter source row |
| Conflicting or insufficient evidence | Open rule-specific DataQualityException; keep clinical state Unknown |
| Irrecoverable historical queue state | Retain legacy record with explicit irrecoverable classification and cutoff |

The 31 PAID/no-valid-Visit rows and 2 PAID/IN_PROGRESS-Visit rows are seeded as exception candidates during a future dry-run. No completed Visit, `completedAt`, `lockedAt`, or treatment completion may be created solely from queue status, `finishedAt`, invoice or payment.

# 7. Treatment Canonical Cutover

## 7.1 Legacy History

- The three completed plan items with completion timestamp and Visit link may remain reportable as Legacy Completed and, after M1 checks, as canonical completion evidence.
- The 142 completed Visits without completed plan-item linkage remain Visit activity. They are not manufactured into treatment-plan completions.
- Historical plan/item creation, current scope and stable fee links can remain Legacy Historical or Approximate Historical according to the readiness matrix.
- No historical presentation, acceptance, decline, deferment or start event is created unless independent event-time evidence exists.

## 7.2 Prospective Funnel

From Treatment Cutover: Created -> Presented -> Accepted / Declined / Deferred -> Started -> Performance Segments -> Completed -> Plan Closed. Billed and Collected remain Finance events linked after clinical events; neither implies an earlier treatment event.

## 7.3 Active Plan Initialization

At cutover, every existing plan/item is classified once:

| Cutover class | Evidence | Analytics treatment |
| --- | --- | --- |
| Legacy Active - Acceptance Unknown | Open/current plan without canonical acceptance evidence | Excluded from TRT-C20 accepted pipeline; visible in legacy workload |
| Legacy Completed | Explicit completed item + completion/Visit evidence | Completion reportable; acceptance remains Unknown |
| Legacy Deferred/Inactive | Explicit contemporaneous deferred/inactive evidence | Legacy state only unless canonical decision event is captured after cutover |
| Requires Review | Conflicting status, links or value evidence | Excluded from canonical funnel pending review |

ATTR-B12/B13 remain Unassigned before cutover unless genuine event-time evidence is approved. The cutover itself does not count as presentation or acceptance.

# 8. Capacity, Payroll, Inventory and Action Centre Cutovers

## 8.1 Capacity

- Six current scheduled appointments can become M3 opening occurrences. Their absent creation/reschedule history is not fabricated.
- Legacy queue intervals can remain Approximate Historical operational durations; mutable timestamps and absent segments prevent canonical utilisation denominators.
- The 305 doctor status events remain legacy evidence; 127 lack branch and the event series does not guarantee closed intervals.
- Capacity Cutover occurs only after clinic calendar, formal closures, approved roster/availability, encounter segments and stable chair identities are active and validated.
- Canonical utilisation begins at the first complete denominator interval after the approved cutover, not at midnight by assumption.
- CAP-C37 and CAP-C42 stay unavailable until their frozen productive-work/chair prerequisites pass.

## 8.2 Payroll

- Payroll Cutover is the first owner-approved payroll period after PayrollEligibilityVersion, reviewed contract versions, due-policy version, typed components and B09/B07 allocation method are active.
- The two historical contracts remain references until approved as opening versions. Six active users are not automatically Payroll Eligible.
- No pre-cutover payroll obligation, payment, allowance, deduction or statutory event is created. No EPF/ETF rate is assumed.
- PAY-C11/PAY-C12 remain unavailable until legal/payroll approval creates a StatutoryPolicyVersion.

## 8.3 Inventory

Inventory Opening Position is approved per item/branch and includes catalog item, B08, quantity, unit, approved opening unit cost or Unknown, cost provenance, physical count time, effective time, counter and approver.

- Unknown cost remains null/Unknown, never zero.
- Valuation begins per item/branch at the approved opening event. Quantity analytics may start while valuation remains unavailable, but coverage must show the Unknown-cost population.
- WAC is derived prospectively from approved opening cost plus cost-bearing receipts, transfers, consumption, adjustments and reversals.
- The existing one stock row and one receipt are evidence for the opening review, not a complete historical WAC chain.
- INV-C18 publishes only when opening and movement history reproduce quantity and cost for the reported population.

## 8.4 Action Centre

- Activation evaluates current source conditions using approved policy versions.
- A currently true condition may create `Initial Canonical Detection` with the actual activation/evaluation timestamp and an `initialAtActivation` provenance flag.
- `detectedAt` is not backdated to a guessed condition start. Earlier time may be stored as source context only if explicitly provable and policy permits it.
- No historical acknowledgement, assignment, snooze, resolution or dismissal is fabricated. Snapshot counters remain Legacy Historical.

# 9. Data Quality / Exception Model

Each DataQualityException has `exceptionId`, versioned `ruleId`, domain, affected canonical IDs, source system/entity/key, severity and implementation impact, `detectedAt`, structured evidence references/counts/checksums, current status, owner queue and assignee, approved-exception version, expiry/review date, remediation/correction references, migration batch, and append-only lifecycle.

Rules are specific, for example `FIN_PAYMENT_LEDGER_MISSING`, `VISIT_QUEUE_LINK_CONFLICT`, `ATTR_B06_UNASSIGNED`, `TREATMENT_ACCEPTANCE_ABSENT`, `PAYROLL_ELIGIBILITY_MISSING`, and `INVENTORY_OPENING_COST_UNKNOWN`. A generic `MISSING_DATA` rule is prohibited.

BR-C49 is derived from role-specific eligible/Unassigned populations. BR-C50 is derived from an explicitly named role pair and does not presume mismatch is error. Both retain source IDs, role codes and rule versions.

# 10. Analytics Architecture

## 10.1 Recommendation

Use PostgreSQL as the initial canonical analytics platform:

1. Append-only typed event/version/allocation tables are the source of truth.
2. Versioned canonical SQL views/functions produce reusable domain facts and metric-ready populations.
3. One application `CanonicalMetricService` invokes those definitions for dashboards, reports and exports.
4. Small scheduled materialized views or immutable snapshot tables serve expensive as-of/cohort/aging calculations only after source validation.
5. MetricComputationRun records metric version, parameters, source watermark, as-of, coverage and exception counts.

This is simpler than a separate warehouse at Lumora's current scale while preserving one calculation, reproducibility and auditability. Live transactional queries are acceptable for small current-state facts, but UI routes must not independently reimplement business rules. An external analytical store should be reconsidered only after measured workload, not pre-emptively.

## 10.2 Metric API Contract

Every result includes canonical ID/version, value and unit, period/cohort/as-of, timezone, explicit branch/doctor role, filters, comparison basis, source watermark/freshness, coverage counts, Unassigned/Unknown counts, readiness label, and drill-down token. Access to an aggregate does not grant access to underlying records or corrective actions.

# 11. Legacy Coexistence Strategy

| Label | Meaning | Allowed use |
| --- | --- | --- |
| Legacy Historical | Original operational record/metric under old semantics | Historical record access and clearly labeled legacy reports |
| Approximate Historical | Reconstructed from mutable/incomplete proxy | Trend/context with limitations; never merged invisibly into canonical series |
| Canonical | Passed migration class and reconciliation gate under a metric version | Canonical analytics and approved dashboards |
| Unassigned | Eligible canonical role/value exists but owner/context is not proved | Included in reconciliations and coverage; never silently redistributed |
| Unknown | Required fact/value cannot be determined | Displayed as unknown and excluded only under stated denominator policy |
| Not Available | Frozen metric intentionally cannot publish | Data Quality / Readiness only |

Legacy and canonical records remain accessible through separate read models with a visible cutover marker. A chart may show pre-cutover legacy and post-cutover canonical series only as visually and semantically distinct segments; it must not calculate one undisclosed total or rate across both.

# 12. Migration Waves

No wave is authorized by this design. Each future wave requires reviewed schema design, backup evidence, dry-run output and gate approval.

| Wave | Scope and schema dependencies | Data migration | Validation / reconciliation gate | Rollback and feature condition |
| --- | --- | --- | --- | --- |
| 0 | Backup/restore rehearsal, migration ledger, test fixtures, feature flags, read-only harness | None | Restore tested; baseline counts/hashes frozen; production write paths unchanged | No-op rollback; all canonical flags OFF |
| 1 | Core headers, policy/cutover/provenance, attribution and exception infrastructure | M1 source references only | Idempotency, sequence, provenance, Unassigned invariants | Drop no legacy object; disable dual-write flag |
| 2 | Financial accounts, invoice/payment versions, allocations, receivable projection | M1 payments; M2 invoice/ledger/paidDate dry runs | Clinic cents reconcile; exceptions equal known 2/11 baseline or explained delta | Reads stay legacy; canonical shadow tables isolated |
| 3 | Patient, Visit completion, appointment/queue/encounter structures | M1 145 completions; M2 links; M3 open state | Visit counts and branch totals reconcile; no queue-created Visit | Per-domain read flag; legacy workflow remains authoritative |
| 4 | Treatment versions/events/contributions/billing links | M1 creation/3 completions; M3 legacy active state | No fabricated presentation/acceptance/start; shares reconcile | Funnel flag OFF; legacy plans remain accessible |
| 5 | Calendar, roster, availability, status intervals, chairs | M3 approved opening configuration | Complete denominator interval and timezone tests | Utilisation stays unavailable until cutover gate |
| 6 | Payroll eligibility/contracts/obligations/components/allocations | M3 opening eligibility/contracts; no obligations backfilled | Eligible population approved; obligation arithmetic and privacy pass | Payroll canonical capture flag per period |
| 7 | Assortment, opening positions, movements, WAC, PO/receipt/payable | M3 approved openings | Quantity equation and cost provenance pass per item/branch | Inventory valuation flag per covered population |
| 8 | Alert policies, instances, work items and lifecycle | Initial M4 detections only | Dedupe, SLA, ownership, snooze/dismiss and source resolution tests | Action Centre flag by alert type |
| 9 | Metric definitions/service, materialized facts/snapshots, freshness/coverage | Compute only gate-passed M1/M2/M3 history | Golden metrics, as-of reproducibility, source totals + Unassigned | Metric-by-metric read flags; legacy reports remain |
| 10 | Executive, Doctor, Branch, Finance and Treatment UI/report consumers | No new business migration | Seven Executive headlines independently ready; permissions and drill-downs pass | Route/surface flags; instant fallback to legacy reads |

Physical removal of legacy fields/tables is not part of Waves 0-10. It requires a later retention and decommission approval after stabilization.

# 13. Reconciliation and Validation Gates

| Gate | Required proof |
| --- | --- |
| G0 Safety | Restorable backup, tested rollback, migration idempotency, no destructive DDL in expand phase |
| G1 Provenance | Every imported fact links source key/hash, batch, class and rule/version |
| G2 Finance | Invoice equation; payment allocations; ledger variance; refunds/reversals; branch + Unassigned totals all reconcile in cents |
| G3 Clinical | 145 source completions reconcile; no queue/payment event creates clinical completion |
| G4 Attribution | Every required role Assigned/Unassigned/Unknown/NA; no generic field substitution; allocation shares/cents exact |
| G5 Treatment | Funnel ordering, version scope and contribution evidence pass; no inferred acceptance/start |
| G6 Capacity | First complete calendar/roster/encounter denominator interval approved; no historical chair utilisation |
| G7 Payroll | Payroll Eligible population, contract/proration/components/due policy and B07 allocation approved for period |
| G8 Inventory | Opening quantity/cost provenance, movement equation and WAC reproduction pass for published population |
| G9 Action Centre | Policy version, dedupe, ownership, lifecycle transition and source-driven resolution tests pass per type |
| G10 Analytics | Canonical metric service equals source-domain reconciliations; freshness, coverage and as-of metadata present |
| G11 UI cutover | Permission, drill-down, labels and feature fallback tested; no screen-specific metric logic |

# 14. Test and Reconciliation Strategy

Golden fixtures must include normal, boundary, reversal, correction, Unassigned, Unknown, multi-branch and multi-doctor cases. Fixtures use fixed UTC instants around Asia/Colombo day/month boundaries and deterministic IDs.

| Test family | Required assertions |
| --- | --- |
| Financial cents | Invoice lines/adjustments equal invoice value; allocated payments/refunds equal cash events; no Float authority |
| Contributions | Basis points = 10,000; cents = source cents; largest-remainder output stable; Unassigned included |
| Branch reconciliation | Every role-specific branch sum + Unassigned = clinic source total; role mismatch never silently reassigns |
| Treatment funnel | Presented scope version exists before decision; acceptance is explicit; start/completion do not imply acceptance |
| Appointment outcomes | One terminal outcome per occurrence version; reschedule closes/creates correct occurrence relationship |
| Queue/Visit | Queue terminal outcomes cannot create Visit completion; transfer segments do not overlap improperly |
| Payroll | Base + typed allowances - typed deductions = net; proration and due dates reproduce policy version |
| Inventory | Opening + receipts + transfers in - transfers out - consumption +/- adjustments = closing; WAC chain reproduces |
| Alerts | Dedupe key creates one episode; allowed transitions only; snooze expiry/reopen and source resolution deterministic |
| Historical as-of | Later corrections do not rewrite earlier as-of results; explicit restatement is versioned |
| Timezone | Colombo half-open ranges, month end, DST-independent behavior and UTC serialization |
| Migration | Repeat run is idempotent; source counts/hashes stable; partial failure resumes without duplicates |
| Access/privacy | Aggregate permission does not reveal payroll, finance or patient detail; corrective action separately authorized |

# 15. Rollback / Safety Strategy

1. **Expand only:** add new structures without renaming/removing legacy structures or changing legacy reads.
2. **Shadow migration:** write/import into canonical structures under batch IDs; canonical reads remain disabled.
3. **Dual validation before dual write:** compare source and canonical projections first. Prospective dual-write is enabled per domain only after transaction/idempotency tests.
4. **Feature-scoped cutover:** metric and workflow flags are independent. Failure in Action Centre cannot force rollback of Finance.
5. **Read rollback:** switch consumers to legacy read paths without deleting canonical events. Never reverse valid business events merely to roll back UI.
6. **Write rollback:** stop canonical capture through flags and queue/replay idempotent events after repair; retain audit evidence.
7. **Database rollback:** use restore only for migration disaster. Down migrations that destroy captured canonical history are prohibited after activation.
8. **Post-cutover hold:** no legacy decommission until at least one approved operating cycle per domain and reconciliation sign-off.

# 16. Technical Data Model Gaps

| Gap | Frozen metrics/roles blocked | Required capability |
| --- | --- | --- |
| No immutable issue/adjustment history | FIN-C01/C02/C12-C17, B05 | Invoice versions/events and line versions |
| No cash account/branch on Payment | FIN-C03-C11, B06 | FinancialAccount and PaymentEvent B06 |
| No production/collection allocation | FIN-C18/C19, DOC-C22/C23, D09/D10 | Contribution and exact allocation versions |
| Mutable queue/appointment state | PAT/CAP and D01-D03/B01-B03 | Occurrence/episode events and encounter segments |
| No treatment decision/start events | TRT-C02-C25, B12/B13 | Item-version presentation/decision/start events |
| No historical roster/chair denominator | CAP-C29-C42, B09 | Approved availability intervals and chair identity/occupancy |
| No Payroll Eligible/obligation/components | PAY-C03-C16 | Eligibility, contract versions, obligations/components/payments |
| No assortment/opening cost/complete movements | INV-C05-C18 | Assortment, opening positions, movements and WAC chain |
| No supplier invoice/payable | INV-C16/C17, FIN-C09, B11 | PO/receipt/invoice matching and payment event |
| No alert identity/lifecycle | ALT-C01-C16 | Policy, instance, lifecycle and work-item structures |
| No versioned exception model | BR-C49/C50 and all migration gates | Rule/run/exception/evidence/lifecycle model |
| Screen-specific calculations | All dashboards/reports | Versioned canonical metric service/views/snapshots |

# 17. Implementation Risk Register

| Risk | Likelihood / impact | Mitigation | Gate owner |
| --- | --- | --- | --- |
| Fabricated historical acceptance or attribution | High / Critical | M4 policy, Unassigned, provenance tests, manual evidence review | Clinical + data owner |
| Double-counted money during dual write | Medium / Critical | Idempotency keys, source uniqueness, shadow mode, exact reconciliation | Finance + engineering |
| Current mutable field imported as event history | High / High | M3 opening state/Legacy label, no synthetic lifecycle | Domain owner |
| Largest-remainder implementation divergence | Medium / High | One shared library/service, golden fixtures and policy version | Finance + engineering |
| Queue state presented as clinical truth | High / High | Visit gate and explicit 31/2 exception cohorts | Clinical owner |
| Partial branch-role substitution | High / High | Typed role constraints and branch + Unassigned invariants | Analytics owner |
| Payroll/privacy exposure | Medium / Critical | Section/record permissions, audit logs, masked fixtures | Payroll/privacy owner |
| Unknown inventory cost becomes zero | Medium / High | Nullable known-state, publication block, opening approval | Inventory + finance owner |
| Alert flood at activation | Medium / High | Dry-run source evaluations, per-type activation, dedupe/SLA capacity review | Operations owner |
| Backfill locks or production slowdown | Medium / High | Batched imports, timeouts, replicas/off-hours, measured plans | Engineering/DB owner |
| Metric versions drift by screen | High / High | One CanonicalMetricService and implementation hashes | Analytics owner |
| Legacy/canonical series silently blended | Medium / High | Required labels/cutover metadata and UI contract tests | Product/data owner |
| Cutover cannot be reversed operationally | Low / Critical | Independent feature flags, legacy reads retained, restore rehearsal | Engineering owner |

# 18. Approved Technical Owner Decisions

These decisions are frozen for implementation planning and do not reopen business definitions.

| Decision area | Approved technical decision |
| --- | --- |
| Domain cutovers | Use domain-specific dates/times in CutoverRegistry. Each domain activates only after its own validation gate; no clinic-wide cutover is required. |
| Historical Visit doctor | ATTR-D05 never automatically becomes D04. An explicitly limited Approximate Historical Performer Proxy may be shown, but cannot feed D04, D07 or D09. |
| Historical invoice issue time | Use legacy `Invoice.createdAt` only through M2 when workflow evidence proves issuance; otherwise issue time is Unknown. Never infer from payment, Visit, `updatedAt` or status. |
| Historical settlement time | Derive `settledAt` from the first reconciled zero-balance point under valid allocated payments/refunds/adjustments. Existing `paidDate` is supporting evidence and authoritative only when consistent; otherwise Unknown. |
| Two payment-ledger gaps | Exception-first deterministic/manual review. Create no ledger representation unless authoritative source, no duplicate, amount/timing/category, account/branch treatment, batch and exception linkage are all proved. Otherwise retain variance. |
| Financial Accounts | Use a small explicit set of genuinely distinct cash drawer, bank/current, savings, card/POS clearing and other real accounts. FinancialAccount is never Branch; B06/B10/B11 remain event roles. |
| Historical D09/D10 | Permit M2 allocation only with strict independent evidence. Visit doctor, first linked doctor, plan creator, current branch and unordered Visit relationships are prohibited inference sources; otherwise retain Unassigned. |
| Capacity cutover | Activate at branch/session granularity after the first complete approved denominator interval. Never publish a partial denominator period. |
| Payroll cutover | Use the first fully configured future payroll month after eligibility, contracts, due policy, typed components and B09/B07 policy are approved. No partial or historical obligations are fabricated. |
| Inventory activation | Quantity may activate per approved item/branch opening. Valuation activates only per item/branch with approved cost provenance; aggregate value stays unavailable until intended population coverage is sufficient and visible. |
| Opening inventory cost | Evidence hierarchy: verified supplier invoice/purchase cost; reconciled reliable goods-receipt cost; finance-approved external evidence; formally approved cutover valuation; Unknown. Never use zero, sale price or arbitrary latest price as fallback. |
| Action Centre activation | Activate each alert type progressively after dry-run volume, dedupe, routing, workload/SLA and owner approval checks. Never activate all families together. |
| Metric snapshots | Events remain truth. Store daily snapshots only for reproducible as-of or expensive snapshot/cohort metrics, retain period-close snapshots for approved reporting, and avoid redundant physical snapshots for simple event-period totals. Every snapshot records metric version, watermark, as-of, coverage and computation run. |
| Event identifiers | Prefer UUIDv7 if verified safe and convenient across Prisma/PostgreSQL/TypeScript; otherwise use conventional database UUID. Never use human-readable sequential canonical IDs. |
| Event payloads | Required canonical fields use typed domain columns/tables. Extension JSON is optional, schema-versioned and validated, and cannot contain fields required for canonical metric logic. A generic arbitrary JSON event store is prohibited. |

## Current Authorization Gate

**TECHNICAL ARCHITECTURE APPROVED / IMPLEMENTATION NOT YET AUTHORIZED**

This approval does not authorize migrations, schema edits, repairs, backfills, code changes, API/UI work, data mutation or deployment. Each migration wave requires a separately reviewed implementation specification and execution approval.
