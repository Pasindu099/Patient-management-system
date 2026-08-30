# V2_CHANGES — DentalCare PMS v1 → v2

Implemented across 12 increments, each migrated, typechecked, built, and verified against the live dev server + database before moving to the next. See [GAP_ANALYSIS.md](GAP_ANALYSIS.md) and [V2_MIGRATION_PLAN.md](V2_MIGRATION_PLAN.md) for the audit and plan this was built from.

## What changed, by area

### Roles & permissions
- `UserRole` is now `ADMIN | DOCTOR | HEAD_NURSE | NURSE | RECEPTIONIST` (was `ADMIN | DENTIST | HYGIENIST | RECEPTIONIST | NURSE | CLINIC_MANAGER`). Existing rows migrated in-transaction (DENTIST/HYGIENIST → DOCTOR, CLINIC_MANAGER → HEAD_NURSE).
- All role checks route through `src/lib/permissions.ts` (`can(role, permission)`), replacing ~40 scattered inline checks.
- **Admin has no clinical functions** — no clinical nav, no visit/patient-registration APIs reachable, no "Start visit" buttons anywhere (including one that had leaked onto the admin dashboard's quick-actions grid).
- **HEAD_NURSE** = union of receptionist + nurse permissions.
- Doctors can register/edit patients (secondary function) but that's the full extent of their non-clinical access.

### Sessions & scheduling
- New `ClinicSession` (branch × date × MORNING/EVENING) with `onlineCapacity` / `appointmentCapacity`; materialized lazily from branch defaults, editable per session.
- New `DoctorBranchAvailability` roster (doctor × branch × weekday × period). Booking and queue check-in now validate the doctor is actually rostered.
- Reception queue tokens are numbered per session (not per day); appointment arrivals get priority over walk-ins.
- 20-minute no-show sweep (`/api/sessions/sweep`) releases stale appointment slots — manually triggered ("Check no-shows" button) since there is no server-side scheduler wired up yet.
- Website booking now checks roster + online-capacity before confirming; still auto-confirms instantly (no staff review step), per your decision.

### Money & finance
- Every money column now has an authoritative `*Cents` integer twin; the original `Float` columns are frozen legacy mirrors kept in sync for old UI/print paths, never used for new arithmetic.
- New `FinancialTransaction` ledger — every patient payment, expense, salary, and supply purchase writes exactly one row here. `FinanceCategory` seeded with the standard chart of accounts.
- `TreatmentPriceHistory` — catalog price changes are effective-dated; changing a price never touches past bills.
- `BillOverride` — silent log of list-price vs. what the doctor actually charged; feeds the admin override report. Never surfaced to the patient as a "discount."
- Admin **Finance** page: collections per branch/doctor, expense entry, debtors list, price-override report, profit. **Audit Log** viewer for price/inventory/user-management changes.

### Clinical workflow
- Doctor's home screen is now their queue and nothing else — no stats, no menus, sidebar trimmed to Dashboard + Patients.
- One-tap "Receive to chair"; inline "Refer to another doctor" with an attributed note.
- Visit wizard is the full 8 steps: **Review history** (read-only, above the wizard — past visits, active plan, outstanding balance) → Diagnosis → Treatment Plan → Treatment Done → Next Visits → Prescription → Bill → **End Visit** (locks the visit via `lockedAt`, shows a confirmation screen with print + "Back to my queue," instead of a silent redirect).
- Step bar is now a plain progress indicator — no tab-clicking, forward-only flow.
- **Nurse scribe**: append-only `VisitObservation` entries, attributed ("entered by nurse on behalf of Dr. X"), pollable feed on the visit page; nurses reach unlocked visits via a new "Active Visits" list. Locked visits reject new observations.

### Inventory
- Shared item catalog (`InventoryItem`) with per-branch stock/threshold (`InventoryStock`); every movement logged (`StockAdjustment`: RECEIVED/CORRECTION/AUTO_DEDUCT/STOCK_TAKE).
- `TreatmentBOM` per treatment × ADULT/CHILD, admin-configured (`/settings/inventory`).
- Auto-deduction fires when a doctor marks a treatment done — **best-effort matched by treatment name** against the fee catalog (see Known Limitations below), never blocks the clinical save on failure.
- Low-stock SMS to admins (deduped until restocked) + a dashboard alert banner; new `/inventory` page for nurses/receptionists/head-nurses to receive stock and do stock-takes.

### Agent readiness (schema + APIs only — no agent built)
- `ServiceAccount` (scoped API keys: `finance:read`, `finance:propose`, `inventory:read`, `inventory:propose`) + `AgentAction` propose-and-approve queue. Nothing a service account proposes ever auto-executes; Admin approves/rejects from **Settings → AI agent access**.
- `StaffContract`, `SalaryRecord` (marking paid writes a ledger row), `Supplier`/`PurchaseOrder` (receiving writes inventory + ledger together), generic `Attachment` model.
- Finance and inventory read APIs accept either a staff session or a scoped service-account bearer token; **clinical/patient routes never check service-account auth at all** — that's the PDPA boundary, enforced structurally, not by convention.

### Cross-cutting
- FDI numbering, NIC validation, LKR/USD, Notify.lk SMS, bilingual templates, PDPA consent fields — all untouched, verified still working.
- Every schema change is now a real Prisma migration (the project had never used `prisma migrate` before — only `db push`); a `0_init` baseline was created first. `dental-pms` and `lumora-website` share the identical schema + migration history, kept in sync by copying after each change.

## Known limitations / follow-ups

1. **Inventory auto-deduction matches by treatment name**, not a stable ID — the treatment-plan cascading dropdown (`TreatmentPlanStep.tsx`) still uses its own hardcoded price catalog (a pre-existing v1 characteristic) rather than fetching live `TreatmentFee` rows, so it never carries a `feeId` through to the visit save. Deduction does an exact-then-contains name match against the fee catalog, which works whenever the typed/selected description lines up with a `TreatmentFee.name`, but isn't guaranteed. A future increment should thread `feeId` through the plan builder end-to-end.
2. **No scheduler is wired up** for the no-show sweep or any future day-before SMS queue — both exist as endpoints with a manual trigger. Per your "clinic PC" answer, wiring a Windows Task Scheduler entry (or equivalent) to hit these on a timer is a deployment task, not a code task.
3. **Live nurse scribing during the very first pass of a brand-new visit** requires the doctor to save as a draft first ("Save & come back later") — the visit record doesn't exist until the first save, so a nurse can't observe a visit that hasn't been saved even once. Once saved as a draft, scribing works fully live between devices.
4. **No seeded `NURSE`-role account** exists in this database (only `HEAD_NURSE`) — tests used the head-nurse account, which correctly exercises the same permission surface, but you may want an actual dedicated nurse login for staff who aren't also front-desk.
5. **Attachment model has no upload UI** — it's schema + ready to be pointed at a file, consistent with how `PatientDocument` already works in this codebase (URL-based, no storage backend wired in), left as-is intentionally.
6. **PurchaseOrder / Salary / Supplier admin UI is API-only** — deliberately, since this increment's brief was "shape the schema and APIs so it can be added without restructuring," not build the full back-office UI for every finance sub-feature. The endpoints are documented above and ready for a UI pass whenever you want one.

## Verification

Every increment was checked against the live dev server and database (not just typecheck/build) before moving on — role logins, permission boundaries, billing math and ledger reconciliation, session/roster capacity limits, the visit-lock guard, nurse/doctor concurrent scribing, inventory deduction crossing a threshold and alerting, and the full service-account propose→approve flow. Test scripts were scratch files, not committed.
