# GAP ANALYSIS — DentalCare PMS v1 → v2

Audited: 2026-07-09. Repo: `dental-pms/` (staff PMS, Next.js 15 + Prisma + NextAuth v5) and `lumora-website/` (public site + booking), sharing one PostgreSQL 16 DB. Schemas are currently identical copies (kept in sync by hand — no shared package).

**Legend:** ✅ exists · 🟡 partial · ❌ missing · Risk = risk of breaking working v1 behaviour while implementing (L/M/H)

---

## 1. Multi-branch

| Feature | Current state | What must change | Affected files | Risk |
|---|---|---|---|---|
| `Branch` model | ✅ exists (2 branches seeded, `UserBranch` join, admin CRUD at `/settings/branches`) | Nothing structural | `prisma/schema.prisma:97`, `api/settings/branches`, `components/settings/BranchManager.tsx` | L |
| `branchId` on visits/appointments/queue/invoices | ✅ exists (nullable on `Visit`/`Invoice` — should become required with backfill) | Make `branchId` non-null on `Visit`, `Invoice`, `Payment` (new — payments currently have no branch), and on all new models (sessions, inventory, ledger) | schema; `api/visits`, `api/invoices` | M |
| Shared patient DB across branches | ✅ works today (patients are global, no branch scoping) | Nothing | — | L |
| Reports per branch + consolidated | 🟡 `BranchComparison.tsx` exists in reports; most report queries don't take a branch filter | Add branch filter param to `/api/reports` and the dashboard | `api/reports/route.ts`, `components/reports/*` | L |
| Branch-level session capacity / online slot allocation | ❌ no session concept; `OnlineSlot` is per-doctor/day/time with `maxBookings`, not per-branch capacity split | New `ClinicSession` + capacity fields (see §3); `OnlineSlot` either retired or re-scoped to sessions | `settings/slots`, `lumora-website/api/slots*`, `api/book` | **H** |

## 2. Users and roles

| Feature | Current state | What must change | Affected files | Risk |
|---|---|---|---|---|
| Role set | 🟡 v1 enum: `ADMIN, DENTIST, HYGIENIST, RECEPTIONIST, NURSE, CLINIC_MANAGER`. v2 wants `ADMIN, DOCTOR, HEAD_NURSE, NURSE, RECEPTIONIST` | Enum migration with explicit data mapping (DENTIST→DOCTOR, HYGIENIST→DOCTOR or NURSE?, CLINIC_MANAGER→HEAD_NURSE or ADMIN?). **~40 files** hard-code role strings (`'DENTIST'`, `'HYGIENIST'`, `'CLINIC_MANAGER'`) in API guards, sidebar, middleware-adjacent checks. Central permission helper needed | `lib/auth.ts`, `lib/utils.ts` (ROLE_LABELS/COLORS), `Sidebar.tsx`, every `api/*` role check, all `(dashboard)/*/page.tsx` guards, `seed.ts` | **H** — an unmapped string check silently changes access |
| Admin: user management | ✅ `/settings/staff` (create/edit staff, roles, branch assignment) | Add contract & salary record storage | `settings/staff`, `StaffManager.tsx`, new models | L |
| Admin: staff contract + salary records | ❌ | New `StaffContract` / `SalaryRecord` models + admin UI (ties into ledger §10) | new | L |
| Admin: NO clinical functions / no clinical buttons | ❌ opposite today: admin sees Start Visit, can create visits, `canStartVisit = role !== 'RECEPTIONIST'` includes ADMIN; admin sees clinical nav | Invert: strip clinical nav + actions for ADMIN; block clinical APIs for ADMIN | `Sidebar.tsx`, `patients/[id]/page.tsx:88`, `patients/page.tsx:25`, `visits/*`, `api/visits` | M |
| Effective-dated treatment prices | ❌ `TreatmentFee.price` is a single mutable Float; editing it would change what future bills auto-fill but v1 bills store their own copied prices (protective) | New `TreatmentPriceHistory` (fee, price, effectiveFrom, setBy); price lookup = latest effective ≤ visit date; admin fee editor writes history rows instead of overwriting | `TreatmentFee` model, `api/fees`, `api/settings/fees`, `FeeScheduleEditor/Manager.tsx`, `TreatmentPlanStep.tsx` (price lookup) | M |
| Admin low-stock notification (dashboard + SMS) | ❌ (no inventory at all) | Part of inventory build (§6); reuse Notify.lk sender from `api/reminders/route.ts:33-61` | new + `api/reminders` (extract sender to `lib/sms.ts`) | L |
| Admin financial log (daily collections per branch/doctor, override report, debtors, expenses, profit) | 🟡 `/reports` has revenue & AR aging; `/finances` is a doctor-personal earnings page. No expenses, no override report, no per-doctor daily collections view | New ledger-backed admin finance pages + APIs (§10) | `api/reports`, new `api/finance/*` | M |
| Audit log viewer for admin | 🟡 `AuditLog` model + writes exist on most mutating routes; **no UI** to view it | Admin audit page + `/api/audit` (read) | new | L |
| Doctor home = personal queue only | 🟡 `DoctorQueuePanel` exists on dashboard; but doctors also get full sidebar (patients, appointments, clinical, transcribe, finances…) | New role-based home: doctor lands on a queue-only screen; nav reduced to Queue + Patients button | `dashboard/page.tsx`, `Sidebar.tsx`, `layout.tsx` | M |
| One-tap "Receive to chair" | 🟡 "Start" button sets `IN_TREATMENT` + timestamps `startedAt`, then opens visit form | Rename/relabel to chair semantics (`IN_CHAIR`), keep behaviour | `DoctorQueuePanel.tsx`, `api/queue/[id]` | L |
| Refer patient to another doctor with note | ❌ (receptionist can reassign via dropdown; doctor cannot, and no note/attribution) | Doctor-facing "Refer" action: sets `assignedDoctorId`, appends referral note, audit-logs | `DoctorQueuePanel.tsx`, `api/queue/[id]` | L |
| Doctor finalizes bill, never collects payment | ✅ already the design (visit form builds bill; reception collects at `/billing/queue`) | Keep; enforce API-side (currently `api/invoices/[id]/payments` allows any authed role) | `api/invoices/[id]/payments`, `api/installments/pay` | L |
| Installment splits per treatment by doctor | ✅ visit form has per-treatment installment rows | Keep | `VisitForm.tsx` | L |
| Head nurse = receptionist ∪ nurse perms | ❌ no such role | New role + central permission map | permission helper | M (part of role migration) |
| Nurse scribe mode (append-only observations, attribution, concurrent editing) | ❌ visit fields are single strings on `Visit` (`examination`, `diagnosis` …) — concurrent writes would clobber | New append-only `VisitObservation` model (visitId, authorId, onBehalfOfDoctorId, text, createdAt); visit screen shows live entries; nurse UI to open active visits | `Visit` model, `api/visits/*`, `VisitForm.tsx`, new nurse screens | M |
| Receptionist: today board (all tokens, 3 chairs, live statuses) | 🟡 `/queue` shows waiting/ready-to-pay lists; no token numbers, no chair/session dimension | Rebuild around sessions + tokens + chairs (§3–4) | `queue/page.tsx`, `ReceptionQueueClient.tsx` | M |
| Receptionist: confirm pending online bookings | ❌ **v2 REVERSES a v1 decision**: earlier this cycle online bookings were changed to auto-`CONFIRMED` (site copy says "confirmed instantly"). v2 wants `PENDING_CONFIRMATION` + reception confirm step | Re-introduce pending state (new `AppointmentStatus.PENDING_CONFIRMATION`), pending panel for reception, revert website copy | `lumora-website/api/book`, `book/page.tsx`, `BookingForm.tsx`, appointments UI | M |

## 3. Sessions and appointments

| Feature | Current state | What must change | Affected files | Risk |
|---|---|---|---|---|
| Session as first-class record (2/day/branch, fixed hours) | ❌ | New `ClinicSession` (branch, date, period MORNING/EVENING, capacities, status) + generation logic | new | M |
| Capacity split (online / onsite / walk-in) | ❌ (`OnlineSlot.maxBookings` is the only capacity notion) | Capacity fields on session; booking APIs check remaining allocation | `api/book`, `NewAppointmentModal`, `api/appointments` | **H** — replaces the working slot system |
| Website sees only online allocation | 🟡 website sees `OnlineSlot`s only (similar spirit) | Re-point `lumora-website/api/slots*` at session online allocation | `lumora-website/api/slots*`, `BookingForm.tsx` | M |
| Website offers only sessions with a doctor scheduled | 🟡 today slots are inherently per-doctor | Derive from `DoctorBranchAvailability` (§4) | same | M |
| Online booking → `PENDING_CONFIRMATION` | ❌ (see §2 reversal note) | as above | as above | M |
| Token numbers, one ordered list per session | 🟡 `ReceptionQueueItem.queueNumber` exists per branch-day (not per session), no slot-time priority | Token issued at check-in per session; ordering = appointment priority around slot time, walk-ins appended | `api/queue`, queue UI | M |
| 20-min no-show release | ❌ | Scheduled check (cron route or on-load sweep) that flips overdue appointments and promotes walk-ins | new + `api/queue` | L |

## 4. Queue and chair assignment

| Feature | Current state | What must change | Affected files | Risk |
|---|---|---|---|---|
| Status chain `CHECKED_IN→ASSIGNED→IN_CHAIR→COMPLETED→PAID` | 🟡 v1: `WAITING→CALLED→IN_TREATMENT→READY_TO_PAY→DONE/LEFT` (string, not enum). Semantics map ~1:1 (WAITING≈CHECKED_IN, assigned-doctor field≈ASSIGNED, IN_TREATMENT≈IN_CHAIR, READY_TO_PAY≈COMPLETED, DONE≈PAID) | Either rename values with data migration or keep storage values and map labels. **`dental-pms/src/lib/visit-sync.ts` (new in v1.5) auto-syncs queue↔visit↔payment — must be preserved/adapted** | `api/queue/*`, `visit-sync.ts`, queue UIs | M |
| Patient visible only in assigned doctor's queue | 🟡 assignment exists; unassigned patients appear in every doctor's shared queue (by design); doctor API guard exists (`api/queue/[id]:24-30`) | Tighten per v2: `ASSIGNED` ⇒ only that doctor sees it | `api/queue`, `DoctorQueuePanel` | L |
| 3 chairs per branch | ❌ `Appointment.chair` is a free-text string, queue has no chair | `Chair` model or enum per branch; occupancy shown on today board | schema, queue UI | L |
| `DoctorBranchAvailability` (doctor/branch/weekday/session) | ❌ `UserBranch` says where a doctor *can* work, `OnlineSlot` says *when bookable online* — neither models rostering | New model + admin roster UI; booking/assignment validation reads it | new; `NewAppointmentModal`, `api/appointments`, `api/book` | M |

## 5. Visit workflow (8 steps)

Current `VisitForm.tsx` is already a step-wizard with **6 steps**: Diagnosis → Treatment Plan (cascading catalog dropdowns ✅) → Treatment Done (list price vs charged amount ✅ — silent difference, no "discount" field ✅) → Next Visits → Prescription (SL drug presets ✅) → Bill (per-treatment installments ✅). FDI `ToothChart` ✅.

| v2 step | Current state | What must change | Risk |
|---|---|---|---|
| 1. Review history (auto-opening, read-only) | ❌ not in the wizard (history lives on patient page) | New step 0: past visits, active plan progress, outstanding balance | L |
| 2. Diagnosis + live nurse scribe entries | 🟡 diagnosis exists; no scribe | Render `VisitObservation` stream (poll or refetch) with attribution | M |
| 3. Plan from catalog, TBQ flag | 🟡 catalog cascade exists; price-0 items shown but not flagged "TBQ" | TBQ badge; "today vs future" already exists (`deferToNext`) | L |
| 4. Done-today triggers price fill + BOM deduction + threshold alert | 🟡 price auto-fill ✅ (from `TreatmentFee`, needs switch to effective-dated lookup); inventory ❌ | Hook deduction + notification into visit save (`api/visits` POST) | M |
| 5. Next visit books a session + queues bilingual SMS day-before | 🟡 "next visit plan" is free-form; SMS templates exist (en/si) but sending is **manual per appointment** (button), nothing scheduled | Booking against sessions; `ScheduledSms` queue table + cron sender | M |
| 6. Prescription printable | ✅ (print button exists) | Keep | L |
| 7. Bill: charged-amount edit, silent override log | 🟡 UI supports charge ≠ list; difference is **not** logged anywhere as an override record | Write override rows (visit, item, listPrice, charged, doctor) → feeds Admin override report | L |
| 8. End visit locks + reception "ready to pay" | 🟡 ready-to-pay flow ✅ (v1.5 sync); no lock flag | `lockedAt` on Visit; PATCH rejects edits after lock (except append-only observations) | L |
| Never tabs, auto-advance, vertical flow | 🟡 wizard advances on button press; layout is step-tabs at top | Restyle to single vertical auto-advancing flow | L |
| Multi-day plan persistence | ✅ `TreatmentPlan(Item)` persists, plan items completable across visits (`completedPlanItemIds`) | Keep | L |

## 6. Inventory

Entirely ❌ — `/inventory` is a 9-line "Coming next." stub with **no models**. Everything is new: `InventoryItem` (per branch, qty, threshold), `TreatmentBOM` + BOM lines (per treatment × adult/child), auto-deduct on done-today, manual adjustments with reason + user (audit), stock-take with variance, low-stock SMS/dashboard alert. Note: visit form must gain an adult/child determination (derivable from patient DOB; allow override). Risk to existing features: L (green-field), but the visit-save transaction gets heavier — keep deduction failures non-blocking for the clinical save.

## 7. Cross-cutting

| Feature | Current state | Notes |
|---|---|---|
| FDI numbering | ✅ `ToothChart.tsx`, `toothTypes.ts` | Do not touch |
| NIC validation 9+V / 12-digit | ✅ `lib/utils.ts:39` (`validateNIC`) used in patient form + booking | Do not touch |
| LKR/USD | ✅ `Currency` enum | Preserved; money type changes in §10 |
| Notify.lk | ✅ sender in `api/reminders/route.ts` | Extract to `lib/sms.ts` for reuse (low-stock, day-before queue) |
| Bilingual templates | ✅ en/si templates in reminders route + dashboard preview | Reuse |
| PDPA | ✅ consent fields on `MedicalHistory` | Service-account data boundary must exclude clinical models (§10) |
| Audit on price/override/inventory/user-mgmt/deletions | 🟡 generic `AuditLog` written by most routes; price changes NOT audited today; no deletions exist in UI | Add audit writes on new surfaces |
| Delete/refund only in Admin panel | 🟡 effectively true (no delete buttons anywhere); refunds don't exist | Build as admin-only from the start |

## 8. UI rules (low computer literacy)

v1 is a conventional sidebar-dashboard app. Doctor sees ~10 nav items. Queue statuses already use color+word chips ✅; buttons mostly ≥44px ✅ (`min-h-[44px]` used). Gaps: role-scoped minimal homes (doctor = queue only), one-tap depth, auto-advance, structure ready for Sinhala labels (no i18n scaffolding — recommend a simple label-dictionary module now, translations later). Risk: M — this is a broad UI reorganisation; do it late, behind the data model.

## 9. v1 pitfalls

Acknowledged; all four (server/client boundary, Prisma back-relations, number-input validation, `@apply`+`group`) will be treated as review checklist items on every increment.

## 10. AI finance agent readiness

| Feature | Current state | What must change | Risk |
|---|---|---|---|
| Unified `FinancialTransaction` ledger | ❌ money lives in `Invoice`/`Payment`/`Installment` only | New ledger table; **every** payment write path (3: `api/invoices/[id]/payments`, `api/installments/pay`, inline full-payment in `api/visits` POST) also writes a ledger row in the same transaction | M |
| Money as integer cents | ❌ **Floats everywhere**: `Invoice.subtotal/total/balance…`, `Payment.amount`, `InstallmentPlan.*`, `Installment.*`, `TreatmentFee.price`, `TreatmentPlan(Item)` fees, `InsuranceLetter.approvedAmount` | Highest-risk migration in the project: add Int-cents columns, backfill `round(x*100)`, switch code, drop Floats last. All `formatLKR`/`formatCurrency` call sites and every arithmetic site must convert | **H** |
| Salary records | ❌ | `SalaryRecord` (per staff, period, base/allowances/deductions/net, paidAt) → ledger on paid | L |
| Supplier / PurchaseOrder | ❌ | New models; receiving increments inventory + writes ledger expense | L |
| Generic `Attachment` | 🟡 `PatientDocument` exists but is patient-scoped | New polymorphic `Attachment` (or generalize) | L |
| API-first finance | 🟡 reports data is fetched in server components, not clean APIs | Every finance read/write as documented `/api/finance/*` routes | L |
| Service-account auth (API key, scopes) | ❌ NextAuth credentials-only | `ServiceAccount` + hashed API-key auth path + scope checks (finance:read, finance:propose); clinical models excluded by scope design | M |
| `AgentAction` propose-and-approve | ❌ | New table + admin review UI | L |

---

## Existing working features v2 could break — and protection

1. **Billing/installment logic** (`api/visits` POST inline billing, `api/invoices/[id]/payments`, `api/installments/pay`, plus the v1.5 auto-close sync in `lib/visit-sync.ts`). *Protection:* float→cents and ledger insertion done as one increment with before/after manual test script (create visit → invoice → partial pay → installment pay → verify balances and queue auto-close); never change payment math and payment routing in the same increment.
2. **Treatment catalog cascading dropdown** (`TreatmentPlanStep.tsx` reading `/api/fees`, 86 seeded procedures). *Protection:* effective-dated prices implemented as a *new* lookup behind the same API response shape (`price` field = current effective price), so the dropdown code doesn't change.
3. **SMS via Notify.lk** (`api/reminders`). *Protection:* extract the sender into `lib/sms.ts` verbatim; the existing manual-send button keeps working through the same function; new scheduled sending is additive.
4. **NIC validation** (`lib/utils.ts` `validateNIC`, used in `NewPatientForm` + website booking). *Protection:* no changes to these functions; role-migration edits to `utils.ts` must not touch the NIC block.
5. **FDI tooth chart** (`ToothChart.tsx`, `ToothChartSVG.tsx`, `toothTypes.ts`). *Protection:* untouched; visit-wizard restyle wraps it, never rewrites it.
6. **Online booking end-to-end** (website slots → `api/book` → PMS calendar). *Protection:* session-based capacity replaces `OnlineSlot` — this is the one flow that *must* change shape. Plan: build sessions in parallel, keep `OnlineSlot` working until the session-based booking passes an end-to-end test, then cut the website over in a single increment and retire `OnlineSlot` (kept in DB, unused, until explicitly approved to drop).
7. **Role-gated access (~40 hard-coded role checks)**. *Protection:* introduce a central `can(user, permission)` helper first, mechanically replace all checks while keeping the OLD enum, verify build + behaviour, and only then migrate the enum values — two separate increments.
8. **Auth/middleware** (NextAuth v5, protected-route list in `middleware.ts`). *Protection:* new routes added to middleware as they're created; service-account auth is a parallel path (API-key header) that never touches session auth.

## Decisions needed before Phase 2 (will re-ask in Phase 2)

1. **Role mapping**: HYGIENIST → DOCTOR or NURSE? CLINIC_MANAGER → HEAD_NURSE or ADMIN? (seed data + any real users)
2. **Online booking**: v2 spec restores `PENDING_CONFIRMATION`, reversing the auto-confirm decision made earlier in v1.5. Confirm the reversal.
3. **Queue status values**: rename stored values to v2 names (data migration) or keep v1 storage with v2 labels?
4. **`OnlineSlot` retirement**: OK to retire after session cutover?
5. **Existing float money data**: this is a dev/seed database — is destructive-ish backfill acceptable, or must it be production-safe?
