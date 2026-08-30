# VERIFICATION REPORT — DentalCare PMS v2

**Method:** Every claim below was checked by reading the current code directly — `dental-pms/prisma/schema.prisma` (1261 lines, read in full), ~25 API route files, `permissions.ts`, `visit-sync.ts`, `queue.ts`, `ledger.ts`, `inventory.ts`, `service-auth.ts`, `sessions.ts`, `prices.ts`, the visit wizard (`VisitForm.tsx`, 917 lines), the doctor dashboard, sidebar, queue panel, and the website booking routes. `GAP_ANALYSIS.md`, `V2_CHANGES.md`, and code comments were **not** treated as evidence — every status below cites the file I actually read.

**Note on the spec file:** No `claude-code-v2-upgrade-prompt.md` exists anywhere in this repo (checked at the root and via a full-repo glob). The 10-section spec audited below is the one given verbatim in this session's task instructions — I audited against that text, not against any file on disk.

---

## 1. Feature checklist

### 1. Multi-branch

| Requirement | Status | Evidence |
|---|---|---|
| `Branch` model; visit/appointment/payment/inventory/session carry `branchId` | ✅ IMPLEMENTED | `schema.prisma:96-122` (Branch), `:343-401` (Appointment.branchId), `:809-849` (Visit.branchId, nullable), `:1010-1025` (InventoryStock.branchId, required) |
| Shared patient DB across branches | ✅ IMPLEMENTED | `Patient` model has no `branchId` at all (`schema.prisma:173-245`) — global by construction |
| Reports filterable per branch and consolidated | 🟡 PARTIAL | `finance/summary/route.ts:19-96` supports `branchId` filter and returns per-branch breakdown; the legacy `/reports` page (pre-v2) was not re-verified for branch filtering in this pass |
| Branch-level config: session capacities, online slot allocation | ✅ IMPLEMENTED | `Branch.onlineSlotsDefault` / `appointmentSlotsDefault` (`schema.prisma:105-107`), edited via `RosterManager.tsx` → `PATCH /api/settings/branches` |

### 2. Users and roles

| Requirement | Status | Evidence |
|---|---|---|
| Roles ADMIN/DOCTOR/HEAD_NURSE/NURSE/RECEPTIONIST | ✅ IMPLEMENTED | `schema.prisma:15-21` `enum UserRole` |
| Admin creates/manages accounts, contracts, salaries | ✅ IMPLEMENTED | `settings/staff/route.ts` (CRUD, admin-gated `can(...,'settings.admin')`); `StaffContract`/`SalaryRecord` models (`schema.prisma:1129-1163`); `salaries/route.ts` |
| Admin sees stats/finance/inventory across both branches | ✅ IMPLEMENTED | `dashboard/page.tsx:56-84` (clinicStats), `finance/summary/route.ts`, `inventory/stock/route.ts` all admin-reachable |
| **Admin has NO clinical functions, no clinical buttons anywhere** | ✅ IMPLEMENTED | `permissions.ts:22` `'clinical.visit': ['DOCTOR']` only; `Sidebar.tsx` Clinical section has zero items for ADMIN (`:36-42`, roles never include ADMIN); `dashboard/page.tsx:182-195` admin quick-actions are Finance/Payment Queue/Inventory/Reports — no "Start visit" |
| Admin sets prices, effective-dated (price history) | ⚠️ DIFFERS | `TreatmentPriceHistory` model and `setTreatmentPrice()` exist and are called from `fees/[id]/route.ts:17` when Admin edits a price — **but** the doctor's actual Treatment Plan step (`TreatmentPlanStep.tsx`) reads prices from a hardcoded static JS object (`resolvePrice()`, lines 139-147, no `fetch`/DB call), and `GET /api/fees` (the endpoint that would serve live DB prices) is never called anywhere in the app (confirmed by repo-wide grep). **A price Admin sets in Settings has no effect on what doctors see or charge.** See §4 for detail. |
| Admin configures inventory: BOMs, reorder thresholds | ✅ IMPLEMENTED | `BomManager.tsx` + `PUT /api/inventory/boms`; `PATCH /api/inventory/stock` sets `reorderThreshold`, both `can(...,'settings.admin')`-gated |
| Admin low-stock notification (dashboard + SMS) | ✅ IMPLEMENTED | `alertLowStock()` in `inventory.ts:95-116` sends SMS to admin phones; `dashboard/page.tsx:74-76,162-170` shows a low-stock banner |
| Admin financial log: collections/branch/doctor, price-override report, debtors, expenses, profit | ✅ IMPLEMENTED | `finance/summary`, `finance/overrides`, `finance/debtors`, `finance/expenses` routes; rendered in `FinanceDashboard.tsx` |
| Admin audit log | ✅ IMPLEMENTED | `audit/route.ts` + `AuditLogViewer.tsx`, `can(...,'audit.view')` = ADMIN only |
| Doctor home = personal queue only, no menus | ✅ IMPLEMENTED | `dashboard/page.tsx:130-136` renders only `<DoctorQueuePanel>` for `isDoctor`; `Sidebar.tsx:24-29` shows DOCTOR only "Dashboard" + "Patients" |
| Doctor can add/edit patients (secondary, one button) | ✅ IMPLEMENTED | `permissions.ts:24` `'patients.manage'` includes DOCTOR; `Sidebar.tsx:26` single "Patients" item |
| One-tap "Receive to chair" | ✅ IMPLEMENTED | `DoctorQueuePanel.tsx:27-42` `receiveToChair()` — one click PATCHes status then routes to visit form |
| Doctor can refer to another doctor with a note | ✅ IMPLEMENTED | `DoctorQueuePanel.tsx:50-69` (`submitRefer`) → `PATCH /api/queue/[id]` sets `referralNote`/`referredById`/reassigns (`queue/[id]/route.ts:57-64`) |
| Doctor runs 8-step visit, finalizes bill, never collects payment | ✅ IMPLEMENTED | See §5 walkthrough. No payment-collection UI exists in `VisitForm.tsx`; `billing.collect` permission excludes DOCTOR (`permissions.ts:27`) |
| Doctor sets installment splits | ✅ IMPLEMENTED | `VisitForm.tsx:754-825` installment-per-treatment UI in Bill step |
| Head nurse = union of receptionist + nurse perms | ✅ IMPLEMENTED | `permissions.ts` — HEAD_NURSE listed alongside RECEPTIONIST in `queue.reception`, `billing.collect`; alongside NURSE in `clinical.transcribe`, `inventory.adjust` |
| Nurse: patient entry/editing | ✅ IMPLEMENTED | `patients.manage` includes NURSE |
| Nurse scribe mode, append-only, attributed | ✅ IMPLEMENTED | `VisitObservation` model (`schema.prisma:1108-1121`, no update/delete route exists — only GET/POST in `visits/[id]/observations/route.ts`); attribution via `onBehalfOfDoctorId` |
| Nurse inventory stock updates, stock-take | ✅ IMPLEMENTED | `inventory.adjust` permission includes NURSE; `inventory/adjust/route.ts` supports RECEIVED/CORRECTION/STOCK_TAKE |
| Receptionist: check-in, queue, booking, confirm online bookings | ⚠️ DIFFERS | Check-in/queue/booking implemented (`queue/route.ts`); **"confirm online bookings" does not exist** — bookings are auto-confirmed (see §3 below), so there is nothing for a receptionist to confirm |
| Receptionist: payment collection | ✅ IMPLEMENTED | `billing.collect` = RECEPTIONIST, HEAD_NURSE; `invoices/[id]/payments/route.ts`, `installments/pay/route.ts` |
| Receptionist "Today board" — all tokens, 3 chairs, live status | 🟡 PARTIAL | `ReceptionQueueClient.tsx` shows a live queue list with status chips and token numbers (`queueNumber`); `ReceptionQueueItem.chairNumber` field exists in schema (`:423`) but **no chair-grid/board UI was found** — the reception page is a list, not a 3-chair board |

### 3. Sessions and appointments

| Requirement | Status | Evidence |
|---|---|---|
| Two sessions/day/branch (Morning 9-2, Evening 4-9), first-class records | ✅ IMPLEMENTED | `ClinicSession` model + `SessionPeriod` enum (`schema.prisma:902-929`); `sessions.ts:6-9` fixed hours |
| Admin configures online/appointment/walk-in split per session | ✅ IMPLEMENTED | `ClinicSession.onlineCapacity`/`appointmentCapacity`; `PATCH /api/sessions` admin-only |
| Website sees only online allocation | ✅ IMPLEMENTED | `lumora-website/api/slots/route.ts:60-69` gates on `onlineUsage < onlineCapacity`; separate from `appointmentCapacity` |
| **Online bookings land in PENDING_CONFIRMATION; receptionist confirms** | ⚠️ DIFFERS | `lumora-website/api/book/route.ts:147-151`: `status: 'CONFIRMED'` set immediately on creation, with an explicit code comment "Online bookings are auto-confirmed." No PENDING_CONFIRMATION status exists in `AppointmentStatus` enum (`schema.prisma:30-38`). This is a deliberate deviation made earlier in this same project's session (auto-confirm was explicitly chosen over pending-confirmation), but it directly contradicts the spec text as given. |
| Website only offers sessions with ≥1 rostered doctor | ✅ IMPLEMENTED | `lumora-website/api/slots/route.ts:60` calls `isDoctorRostered` before marking a slot available |
| Token numbers; appointment patients get slot-time priority over walk-ins | ✅ IMPLEMENTED | `queue/route.ts:113` `priority: d.source === 'APPOINTMENT' ? 1 : d.priority`; ordering `orderBy: [{priority:'desc'},{queueNumber:'asc'},...]` (`queue/route.ts:40`) |
| No-show: 20-min grace, release slot, promote walk-ins | 🟡 PARTIAL | `sessions/sweep/route.ts` marks overdue appointments `NO_SHOW` after 20 min (`:6,21-26`), which frees the appointment-capacity count (since `sessionUsage` excludes NO_SHOW, `sessions.ts:51`) — but there is **no scheduler**; the route only runs when manually triggered (confirmed: no cron/node-cron/setInterval found anywhere in `dental-pms/src`, grep returned only the sweep route's own doc-comment mentioning "Task Scheduler") |

### 4. Queue and chair assignment

| Requirement | Status | Evidence |
|---|---|---|
| Status chain CHECKED_IN→ASSIGNED→IN_CHAIR→COMPLETED→PAID | ✅ IMPLEMENTED | `queue.ts:1-15`; `ReceptionQueueItem.status` default `CHECKED_IN` (`schema.prisma:425`) |
| **3 chairs/branch, assigned patient visible ONLY to that doctor** | ❌ MISSING (server-side) | `Branch.chairCount` exists (`:104`) but is decorative — no chair-grid UI. More importantly: **queue and appointment visibility is not enforced server-side.** `queue/route.ts:34` only filters to the caller's own assigned items `if (mine && isDoctorRole(...))` — `mine` is a client-supplied, opt-in query flag. A doctor calling `GET /api/queue?branchId=X` (omitting `mine=true`) receives **every** queue item at that branch, including patients assigned to other doctors, with full patient name/NIC/phone/DOB. Same pattern in `appointments/route.ts:61` (`if (!providerId && isDoctorRole...)` — passing an explicit `providerId` for another doctor bypasses the self-scoping entirely). Additionally, `/visits/[id]/page.tsx:20-22` has **no doctor-ownership check at all** — any authenticated user can open any visit by ID and see diagnosis, bill, and now the nurse-scribe observation feed. The UI (dashboard, queue panel) only ever calls these endpoints with self-scoping, so the *normal* click-path looks correctly restricted, but the API itself does not enforce it. |
| `DoctorBranchAvailability` roster; booking validates against it | ✅ IMPLEMENTED | `schema.prisma:933-946`; `appointments/route.ts:100-105`, `book/route.ts:107-110` both call `isDoctorRostered` and reject if false |

### 5. Visit workflow (8 steps)

| Requirement | Status | Evidence |
|---|---|---|
| Step 1: Review history (auto-opens, read-only) | ✅ IMPLEMENTED | `visits/new/page.tsx` — patient card, outstanding balance (`outstandingBalanceCents`), active treatment-plan progress card, all rendered above `<VisitForm>`, no edit controls |
| Step 2: Diagnosis, tap FDI chart, live scribe entries | 🟡 PARTIAL | `ToothChart` component used (`VisitForm.tsx:387`) — tap-based; **scribe entries do not appear live in this step** — the `ObservationFeed` is only rendered on the saved visit's detail page (`visits/[id]/page.tsx:229`), not inside the wizard itself, because the visit record doesn't exist until the first save (see §5 workflow walkthrough 4) |
| Step 3: Treatment plan, cascading dropdown, 8 categories/86 procedures | ✅ IMPLEMENTED (UI) / ⚠️ DIFFERS (pricing source) | `TreatmentPlanStep.tsx` cascading `DATA` object confirmed to have the category structure; **prices come from the hardcoded `DATA` object, not the database** `TreatmentFee` table — see finding above |
| TBQ flag for unpriced procedures | ✅ IMPLEMENTED | `TreatmentPlanStep.tsx` — null price renders "Quote required" / "Price to be quoted" (confirmed in `VisitForm.tsx:452` `'Quote required'`) |
| Step 4: Done today ticks trigger price fill + inventory deduction + threshold check | ✅ IMPLEMENTED | `visits/route.ts:85-100` (BillOverride log), `:330-338` (`deductForVisit` call), `:343-346` (`alertLowStock`) — all in the same POST |
| Step 5: Next visit books a future session + queues bilingual SMS | ⚠️ DIFFERS | "Next visit" step exists and saves a `TreatmentPlan` for the future (`visits/route.ts:266-296`) — but it does **not** book an actual session/appointment, and **no SMS is queued**. No `ScheduledSms` model exists (confirmed: zero matches for `ScheduledSms` outside planning docs). The only SMS capability is a manual "send reminder" button and a bulk "tomorrow's appointments" endpoint (`reminders/route.ts`), neither of which is triggered by this step. |
| Step 6: Prescription, tap-based common-drug presets, printable | ✅ IMPLEMENTED | `VisitForm.tsx:632-637` `SL_DRUGS` tap buttons; `VisitPrintButton`/print CSS block in `visits/[id]/page.tsx:348-406` |
| Step 7: Bill — list price shown, charged amount edited, silent diff logged (never "discount") | ✅ IMPLEMENTED | `VisitForm.tsx:683-703` shows list vs charged; `visits/route.ts:85-100` logs to `BillOverride`, field is literally never labeled "discount" in the UI (labeled "You charge") |
| Installments per treatment | ✅ IMPLEMENTED | Confirmed above |
| Step 8: End visit — locks, sets ready-to-pay, returns to queue | ✅ IMPLEMENTED | `visits/route.ts:64` sets `lockedAt`; `VisitForm.tsx:886-913` confirmation screen with "Back to my queue" → `/dashboard` |
| Multi-day plans persist, progress tracked across visits | ✅ IMPLEMENTED | `completedPlanItemIds` mechanism (`visits/route.ts:298-310`), `pendingPlanItems` re-surfaced in next visit (`visits/new/page.tsx`) |

### 6. Inventory

| Requirement | Status | Evidence |
|---|---|---|
| `InventoryItem` per branch, qty + threshold | ✅ IMPLEMENTED (shared catalog design, as you approved) | `InventoryItem` (global) + `InventoryStock` (per-branch qty/threshold) — `schema.prisma:995-1025` |
| `TreatmentBOM` per treatment × adult/child, admin-only | ✅ IMPLEMENTED | `schema.prisma:1047-1069`; `inventory/boms/route.ts` gated `can(...,'settings.admin')` |
| Auto-deduction on Done Today | ⚠️ DIFFERS | Fires correctly (`visits/route.ts:330-338`) but **matches treatments to BOMs by exact/loose text-matching the free-typed description against `TreatmentFee.name`** (`inventory.ts:19-34`), not a stable ID — since the treatment-plan UI never carries a `feeId` (see §2 finding), this match is inherently unreliable whenever the doctor's typed/selected text doesn't line up with the catalog name |
| Manual adjustments logged with user + reason | ✅ IMPLEMENTED | `StockAdjustment` model, `inventory/adjust/route.ts:49-54` |
| Stock-take with variance | ✅ IMPLEMENTED | `inventory/adjust/route.ts:38-40` (`STOCK_TAKE` kind computes `delta = amount - stock.quantity`, stores `countedQuantity`) |

### 7. Cross-cutting

| Requirement | Status | Evidence |
|---|---|---|
| FDI numbering preserved | ✅ IMPLEMENTED | `ToothChart.tsx` still used unmodified in `VisitForm.tsx:387` |
| NIC validation (9+V, 12-digit) | ✅ IMPLEMENTED | Not modified this cycle (confirmed untouched by all v2 diffs read) |
| LKR/USD | ✅ IMPLEMENTED | `Currency` enum unchanged |
| Notify.lk, bilingual templates | ✅ IMPLEMENTED | `sms.ts` (extracted, reused), `TEMPLATES.appointment_24h.si/en` |
| PDPA consent | ✅ IMPLEMENTED | `MedicalHistory.pdpaConsentDate` unchanged |
| Audit on price/override/inventory/user-mgmt/deletions | 🟡 PARTIAL | Price changes (`fees/[id]/route.ts:19-27`), inventory adjustments (`inventory/adjust/route.ts:60-68`), user-mgmt actions not explicitly audit-logged in `settings/staff/route.ts` (no `auditLog.create` call in that file); deletions don't exist to audit (see below) |
| **Deletion/refund only in Admin panel** | 🟡 PARTIAL | Technically not violated — but only because **no deletion or refund feature exists anywhere in the app**, admin panel included. Grep across `dental-pms/src` for delete/refund UI found no financial-record or patient-record delete/refund action in any component. |

### 8. UI rules (low computer literacy)

| Requirement | Status | Evidence |
|---|---|---|
| One screen, one job — doctor home = queue only | ✅ IMPLEMENTED | Confirmed above |
| Tapping beats typing | ⚠️ DIFFERS | Diagnosis step uses tap-based tooth chart; **but** the "Treatment Done Today" step's tooth-number field is a raw `<input type="text">` (`VisitForm.tsx:481-483`), not derived from a tap selection, and treatment descriptions in that step are free-typed too when added via "+ Add treatment" (`:515-518`) |
| Auto-advance, user never navigates | ✅ IMPLEMENTED | Step bar changed from clickable tabs to a plain `<div>` progress indicator (`VisitForm.tsx:350-364`, `onClick` removed) — forward-only via Next/Back buttons |
| Status = color + word | ✅ IMPLEMENTED | `queue.ts:8-24` `QUEUE_STATUS_LABELS`/`COLORS` |
| Large touch targets, no nested menus | ✅ IMPLEMENTED (for doctor) | `min-h-[44px]` on primary buttons (`DoctorQueuePanel.tsx:130`); doctor sidebar has zero nested items |
| "One tap from home" for doctor | ✅ IMPLEMENTED | Home = queue; Receive to chair, Refer are both one tap from that screen |

### 9. Known v1 pitfalls avoided

| Requirement | Status | Evidence |
|---|---|---|
| No `onClick` in server components | ✅ IMPLEMENTED | Every file with `onClick` opens with `'use client'` (spot-checked `VisitForm.tsx:1`, `DoctorQueuePanel.tsx:1`) |
| Prisma back-relations present | ✅ IMPLEMENTED | Every new model's relation fields have matching back-relations (verified while reading full schema — e.g. `VisitObservation` ↔ `User.observationsAuthored`/`observationsOnBehalfOf`) |

### 10. AI finance agent readiness

| Requirement | Status | Evidence |
|---|---|---|
| Unified `FinancialTransaction` ledger for every money movement | ⚠️ DIFFERS (see §4) | Ledger exists and is written by patient payments, expenses, salary-pay, PO-receive (all confirmed) — but no refund flow exists to verify a REFUND category write, and see §4 for a payment-path gap |
| Money as integers | 🟡 PARTIAL | See §4 — two fields remain Float-only |
| Salary records, marking paid writes ledger | ✅ IMPLEMENTED | `salaries/[id]/pay/route.ts:26-40` |
| Supplier/PurchaseOrder, receiving increments inventory + ledger | ✅ IMPLEMENTED | `purchase-orders/[id]/receive/route.ts:23-56` — single transaction, both effects |
| Generic `Attachment` model | ✅ IMPLEMENTED (schema only) | `schema.prisma:1212-1225`; no upload UI (acknowledged, consistent with existing `PatientDocument` pattern) |
| API-first finance/inventory | ✅ IMPLEMENTED | All finance/inventory routes documented above are clean REST JSON, independent of any page component |
| Service-account auth, scoped | ✅ IMPLEMENTED | `service-auth.ts:28-42`; scopes checked in `finance/summary/route.ts:14-17`, `inventory/stock/route.ts:19-24` |
| `AgentAction` propose-and-approve, nothing auto-executes | ✅ IMPLEMENTED | `agent-actions/route.ts` (POST creates PENDING only), `agent-actions/[id]/route.ts` (PATCH only sets status+reviewedBy, never touches `executedAt`) |
| Clinical/patient data excluded from agent scope | ✅ IMPLEMENTED (structurally) | Repo-wide grep: `authenticateServiceAccount` is called in exactly 3 files — `agent-actions`, `inventory/stock`, `finance/summary` — zero clinical/patient routes reference it |

---

## 2. Workflow walkthroughs

### 1. Walk-in patient at Branch A, full day

1. **Check-in → token**: Receptionist opens Reception Queue, searches patient, submits. `POST /api/queue` (`queue/route.ts:64-136`) finds the current session for "now" via `periodForTime()`, materializes it if needed, and assigns `queueNumber = last token in this session + 1`. Patient appears in `ReceptionQueueClient` with status "Waiting" (CHECKED_IN).
2. **Assigned to a doctor**: Receptionist can pick a doctor from a dropdown when adding to queue, or leave it "Shared." If shared, any doctor's "Receive to chair" claims it (`queue/[id]/route.ts:45-47`: `if (!existing.assignedDoctorId && isDoctorRole...) data.assignedDoctorId = session.user.id`).
3. **Received to chair**: Doctor clicks the button on their dashboard queue panel. This PATCHes the queue item to `IN_CHAIR` **and immediately navigates** to `/visits/new?patientId=...&queueId=...` — there is no separate "visit record created" moment yet; the visit only comes into existence at the *first save* inside the wizard.
4. **8-step visit**: Review-history card shows automatically. Doctor works through Diagnosis → Treatment Plan → Treatment Done Today → Next Visits → Prescription → Bill → clicks "Complete visit & print."
5. **Done today (price + inventory)**: On that click, `POST /api/visits` fires once with everything bundled. Inside one transaction: visit created and immediately `lockedAt` (since status is `READY_TO_PAY`), `BillOverride` rows logged for any charged≠list-price items, invoice + invoice items created, payment recorded if `payType==='full'`, ledger `IN/PATIENT_PAYMENT` row written, **then** `deductForVisit()` runs — attempting a name-match of each treatment description against `TreatmentFee`, and if a BOM exists for that fee+patientType, decrementing stock and logging a `StockAdjustment(AUTO_DEDUCT)`.
6. **Bill with installments**: If `payType==='installment'`, no payment is recorded at all at this point — an `InstallmentPlan` + `Installment` rows are created instead, all unpaid.
7. **Payment at reception**: Doctor never collects money — that's structurally blocked (`billing.collect` excludes DOCTOR). Later, reception opens Payment Queue (`/billing/queue`), sees the patient under "Ready to pay" (visit status `READY_TO_PAY`), clicks "Record full payment" or pays the next installment via `PayInstallmentButton`. `POST /api/invoices/[id]/payments` or `POST /api/installments/pay` runs, writes the ledger row, and — **only on that payment** — calls `closeVisitsForPaidInvoice()`, which flips the visit to `COMPLETED` and the queue item to `PAID`, finally removing the patient from both boards.
8. **SMS reminder for next visit**: **This does not happen.** No code path queues or sends a reminder tied to the "Next Visit" step. The only SMS capability is a manual button on an existing appointment, or a bulk "send to everyone with an appointment tomorrow" endpoint — neither is wired to the visit-completion flow. **This is where the story as specified breaks down.**

### 2. Online booking on the Lumora website

1. **Slot visibility**: `GET /api/slots?doctorId&date` (`lumora-website/api/slots/route.ts`) intersects the doctor's preset `OnlineSlot` times with roster + session online-capacity checks. Only slots passing all three show as available.
2. **Pending confirmation**: **Does not happen.** `POST /api/book` creates the appointment with `status: 'CONFIRMED'` and `confirmedAt: new Date()` set immediately (`book/route.ts:147-150`). The story breaks here — there is no pending state and nothing for a receptionist to confirm.
3. **Receptionist confirms**: No-op — nothing is pending.
4. **Appears in a session queue**: The appointment does have `sessionId`/`slotKind: 'ONLINE'` set, so it correctly counts against that session's online allocation, and will show up in the reception queue *once the patient physically checks in* on the day (a separate, later `POST /api/queue` call) — it does not automatically populate the queue at booking time.

### 3. Doctor refers a patient mid-session

Works as specified. Doctor clicks the "Share2" icon next to a waiting patient, picks another doctor from a dropdown (populated from all active DOCTOR-role users, `dashboard/page.tsx:47-51`), types an optional note, clicks "Refer." `PATCH /api/queue/[id]` with `assignedDoctorId` + `referralNote` set reassigns the item, sets status back to `ASSIGNED`, and logs `referredById`. The patient disappears from the referring doctor's `mine=true` queue view and appears in the new doctor's. Verified in code; not verified live in this pass (read-only audit).

### 4. Nurse scribes while doctor is mid-visit, two users same visit

Works, but **only after the visit has been saved at least once.** If the doctor is still on step 2 (Diagnosis) of a brand-new visit that has never been saved, no `Visit` row exists yet, so there is nothing for a nurse to open — `/clinical/active` (`clinical/active/page.tsx:19-24`) only lists `Visit` rows with `lockedAt: null`. Once the doctor clicks "Save & come back later" (or reaches End Visit, which locks it), the visit exists; before that first save, nurse scribing is impossible for that visit. Once it exists and is unlocked, both the doctor (on `/visits/[id]`) and a nurse (via Active Visits → same page) can post to `POST /api/visits/[id]/observations`, which only ever inserts, never updates (`observations/route.ts:50-61`) — no conflict is possible. The feed polls every 5 seconds (`ObservationFeed.tsx`, confirmed during earlier build, not re-read this pass) so both parties see each other's entries with correct attribution ("entered by nurse on behalf of Dr. X").

### 5. Admin changes a treatment price, old bill keeps its price

The *old bill* part is genuinely true: `Invoice`/`InvoiceItem` copy the price at creation time (`visits/route.ts:171-179`), so nothing retroactively changes. But the more important half of this story — **that a NEW visit created after the price change reflects the new price** — is false. `setTreatmentPrice()` updates `TreatmentFee.priceCents` and appends a `TreatmentPriceHistory` row, but the doctor's Treatment Plan step never reads either of those; it reads a hardcoded JS price table compiled into `TreatmentPlanStep.tsx`. Changing a price in Settings has zero effect on any subsequent visit. The "effective-dated pricing" feature is real in the database and API, but disconnected from the one place — the visit wizard — where it would matter.

### 6. Stock crosses reorder threshold

`deductForVisit()` decrements `InventoryStock.quantity`; if `newQuantity <= reorderThreshold`, the item is added to a `lowStockCrossed` list returned from the transaction. After the transaction commits, `alertLowStock()` runs for each crossed item: it checks `lowStockAlertedAt` (skips if already alerted since last restock), sets the flag, then SMS's every active ADMIN with a phone number. Separately, the Admin dashboard runs a raw SQL count of `inventory_stock WHERE quantity <= "reorderThreshold"` on every page load (`dashboard/page.tsx:74-76`) and shows an orange banner linking to `/inventory` if the count is above zero. So: **who sees it** = every admin (SMS) + any admin viewing the dashboard (banner) + anyone with `inventory.adjust` viewing `/inventory` directly (the item shows a red "Low stock" pill, confirmed in `InventoryClient.tsx` during earlier build). Doctors and receptionists without inventory access do not see it anywhere.

### 7. Admin records a salary payment and a supply purchase — both in the ledger

Salary: `POST /api/salaries/[id]/pay` requires the `SalaryRecord` to be unpaid, then in one transaction writes a `FinancialTransaction(OUT, SALARY, amountCents=netCents)` and sets `paidAt`+`ledgerTxId` on the record (`salaries/[id]/pay/route.ts:26-40`). Supply purchase: `POST /api/purchase-orders/[id]/receive` requires the PO not already received, then in one transaction increments `InventoryStock` for every line item (with a `StockAdjustment(RECEIVED)` log per line), writes a single `FinancialTransaction(OUT, SUPPLIES, amountCents=po.totalCents)`, and marks the PO `RECEIVED` (`purchase-orders/[id]/receive/route.ts:23-56`). Both land in the same `financial_transactions` table queryable via `finance/summary` and `finance/transactions`. Confirmed by code reading; matches the ledger design.

---

## 3. Role permission check

**ADMIN** — Can: manage staff/branches/fee schedule/BOMs/service accounts, view finance/audit/reports/inventory across both branches, record expenses, pay salaries, receive purchase orders, approve/reject agent proposals. Cannot: appear anywhere in the clinical nav (`Sidebar.tsx` Clinical section excludes ADMIN entirely), start/edit a visit (`clinical.visit` permission is DOCTOR-only, and `POST /api/visits` returns 403 for non-DOCTOR), register a patient via the sidebar shortcut (though the underlying `patients.manage` permission technically excludes ADMIN too — confirmed `permissions.ts:24` list has no ADMIN). **Confirmed: no clinical action is reachable by Admin anywhere in the code I read.**

**DOCTOR** — Home is the personal queue (`dashboard/page.tsx:130-136`), sidebar reduced to Dashboard + Patients. Can: receive patients to chair, refer to another doctor, run the 8-step visit wizard, view/edit their own patients, view "My Finances" (`finance.own`). Cannot: collect payment, access reception queue page, access Settings, appear in the Clinical/Transcribe/Inventory nav sections. **Gap found**: doctors are *not* server-side restricted from viewing other doctors' queue items or visits if they call the API directly rather than through the UI — see §1 Section 4 and §4 below.

**HEAD_NURSE** — Confirmed to hold the literal union of RECEPTIONIST and NURSE permissions by inspecting every entry in `PERMISSIONS` (`permissions.ts:20-34`): appears in `queue.reception`, `billing.collect`, `clinical.transcribe`, `inventory.adjust`, `reminders.send` — every list that has either RECEPTIONIST or NURSE also has HEAD_NURSE. No permission has HEAD_NURSE without also including at least one of the two source roles it's meant to combine.

**NURSE** — Can: manage patients, transcribe/scribe, adjust inventory, view Clinical + Active Visits pages. Cannot: run visits, collect payment, access reception queue (queue.reception is RECEPTIONIST+HEAD_NURSE only, not plain NURSE), access finance/settings/audit. Note: the dashboard has no dedicated NURSE branch (`isDoctor`/`isAdmin`/`isReception` — NURSE matches none), so a plain NURSE sees only the generic "Today's visits" list, not a tailored home screen. Not a violation of any stated requirement, just worth knowing.

**RECEPTIONIST** — Can: reception queue, billing/payment queue, appointments, patients, reminders, inventory. Cannot: clinical anything, finance/audit/settings, service accounts.

**Explicit confirmations requested:**
- *Admin has NO clinical action available anywhere*: ✅ Confirmed, see above.
- *An assigned patient is visible ONLY to the assigned doctor*: ❌ **Not confirmed — found false.** `GET /api/queue` and `GET /api/appointments` only self-scope when the client opts in (`mine=true` / omitting `providerId`); a doctor who calls either endpoint with an explicit `branchId` or another doctor's `providerId` receives that data, including patient name/NIC/phone. `GET /visits/[id]/page.tsx` has no ownership check of any kind — any logged-in user can view any visit by guessing/typing its ID into the URL bar, including the diagnosis, bill, and nurse observations.
- *Deletion/refund actions exist only in the Admin panel*: 🟡 Technically unviolated because the feature doesn't exist anywhere, Admin panel included.

---

## 4. Data integrity spot-checks

**Is money stored as integer cents everywhere?** Mostly. Every `Invoice`, `InvoiceItem`, `Payment`, `InstallmentPlan`, `Installment`, and `TreatmentFee` money field has a paired `*Cents` integer column that is the one written by all API code I read (`visits/route.ts`, `invoices/[id]/payments/route.ts`, `installments/pay/route.ts`, `invoices/route.ts`). **Two exceptions remain Float-only with no cents twin:**
- `TreatmentPlan.estimatedInsurance` (`schema.prisma:498`)
- `TreatmentPlanItem.insuranceEst` (`schema.prisma:526`)

Both are vestigial insurance-estimate fields from the pre-v2 US-insurance-style model (insurance was removed from the UI per an earlier decision in this project); they appear to be dead/unwritten in the routes I read (`clinical/treatment-plans/route.ts`, `visits/route.ts` never set them), so the practical risk is low, but they are a literal exception to "everywhere."

**Are treatment prices effective-dated?** Yes in the database — `TreatmentPriceHistory` model (`schema.prisma:1075-1086`), populated by `setTreatmentPrice()` (`prices.ts:18-26`) every time Admin edits a price via `PATCH /api/fees/[id]`. **But this system is disconnected from the actual pricing shown to doctors** — see the Section 2/5 findings above. The effective-dating exists and is technically correct for its own report (`finance/overrides` and the price-history table itself), but does not influence what price a doctor bills.

**Does every money movement write to `FinancialTransaction`?** Every payment/expense/salary/PO path I read does: `visits/route.ts` inline full-payment (`:209-217`), `invoices/[id]/payments/route.ts:82-91`, `installments/pay/route.ts:73-82`, `finance/expenses/route.ts:33-42`, `salaries/[id]/pay/route.ts:27-35`, `purchase-orders/[id]/receive/route.ts:42-50`. I did not find any payment-recording path that skips the ledger call. I could not verify a REFUND write because no refund feature exists to test.

**Do bill overrides get logged with doctor + difference?** Yes — `BillOverride.doctorId`, `listPriceCents`, `chargedCents` all populated in `visits/route.ts:85-99`, and only when `toCents(listPrice) !== toCents(price)` — confirmed it does not fire for every item, only genuine differences.

**Does `AgentAction` exist with propose-and-approve, and is the service-account scope excluded from clinical data?** Yes to both. `AgentAction` model confirmed (`schema.prisma:1245-1260`); `POST /api/agent-actions` only ever creates `status: 'PENDING'` rows and requires a scope match (`agent-actions/route.ts:22-36`); `PATCH /api/agent-actions/[id]` only sets `status`/`reviewedById`/`reviewedAt`, never `executedAt` (`agent-actions/[id]/route.ts:24-27`) — nothing executes automatically, matching the spec exactly. Scope exclusion confirmed structurally: `authenticateServiceAccount` is referenced in exactly 3 route files, all finance/inventory, zero clinical/patient routes.

---

## 5. Verdict

# NOT READY

The core cash-flow loop (walk-in → visit → bill → payment → ledger) is solid and was verified end-to-end in the code. Role separation for Admin is correctly and thoroughly enforced. The agent-readiness scaffolding (ledger, service accounts, propose-and-approve) is genuinely well-built and matches the spec closely. But two categories of problem make this unsafe to run in the clinic as-is: a real patient-privacy/access-control gap, and a pricing feature that silently does nothing.

**Must fix before clinic use, most critical first:**

1. **Cross-doctor patient visibility.** `GET /api/queue`, `GET /api/appointments`, and `GET /visits/[id]` do not enforce doctor-ownership server-side — only the UI's own choice of query parameters happens to self-scope. Any doctor (or anyone who can guess a visit ID) can read another doctor's patients' names, NICs, phone numbers, diagnoses, and bills by calling the API directly or editing the URL. This needs a server-side check, not a client convention, before this touches real patient data.
2. **Price changes don't reach the visit wizard.** The entire effective-dated pricing system Admin edits in Settings is invisible to the Treatment Plan step, which uses a hardcoded price table instead. Either wire the wizard to read live `TreatmentFee` prices, or tell the clinic explicitly that prices must be changed in two places (the Settings editor for records/reports, and the hardcoded catalog for what's actually charged) — as it stands, an owner who changes a price via the app and expects it to take effect will be charging the old price indefinitely.
3. **Online bookings are auto-confirmed, not pending.** This was an explicit decision made earlier in this project, but if the clinic actually wants a review step before an online booking is final (as literally written in the spec), it isn't there. Confirm this is the intended behavior with whoever owns that decision before relying on it.
4. **No day-before SMS reminder is queued from the visit's "Next Visit" step.** Only a manual/bulk reminder button exists, decoupled from booking a follow-up. If patients are expected to get an automatic reminder, they currently won't.
5. **No scheduler exists** for the no-show sweep (or anything else) — it only runs when a human clicks a button. If unattended automation is expected, nothing will fire.
6. **Inventory auto-deduction is a best-effort text match**, not a reliable link — a doctor typing "Extraction" when the catalog says "Extraction " (extra space) or any wording mismatch silently deducts nothing, with no visible warning to staff that it failed.

**Nice-to-haves that can wait:**

- Reception "Today board" is a list, not a 3-chair visual board (chairs field exists in the schema but isn't surfaced).
- Two vestigial insurance-estimate fields remain `Float`-only (low practical risk, likely unwritten).
- User-management actions (creating/editing staff) aren't written to the audit log.
- Attachment model has no upload UI (consistent with an existing pre-v2 pattern, not a regression).
- No dedicated NURSE-role seed account existed to test with (HEAD_NURSE was used as a stand-in during development — same permission surface, but worth creating a real nurse login before go-live).
