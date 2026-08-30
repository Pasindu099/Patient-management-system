# V2 MIGRATION PLAN — DentalCare PMS

Decisions locked from Phase 1 review:
- Roles: `HYGIENIST` removed, `CLINIC_MANAGER` → `HEAD_NURSE`, `ADMIN` separate. (Mapping of *existing* HYGIENIST users: → `DOCTOR`, see Open Question 1.)
- Online bookings: **auto-confirmed**, capacity controlled by the preset online allocation per session. No `PENDING_CONFIRMATION` state.
- Queue statuses: renamed to v2 values with a data migration (they're plain strings, so this is a safe `UPDATE`).
- `OnlineSlot`: kept in the database but dormant after the session cutover; dropped only with explicit approval later.
- All migrations **production-safe**: additive first (expand), backfill, switch code, freeze old columns; nothing dropped without approval.

---

## 1. Prisma schema changes (diff)

### 1.1 Changed enums / fields on existing models

```diff
 enum UserRole {
   ADMIN
-  DENTIST
-  HYGIENIST
+  DOCTOR         // migration: DENTIST → DOCTOR, HYGIENIST → DOCTOR
   RECEPTIONIST
   NURSE
-  CLINIC_MANAGER
+  HEAD_NURSE     // migration: CLINIC_MANAGER → HEAD_NURSE
 }
```
Postgres enum migration (production-safe order): `ALTER TYPE ... ADD VALUE 'DOCTOR'`, `ADD VALUE 'HEAD_NURSE'`; `UPDATE users SET role='DOCTOR' WHERE role IN ('DENTIST','HYGIENIST')`; `UPDATE users SET role='HEAD_NURSE' WHERE role='CLINIC_MANAGER'`; then recreate the type without the old values (small table; runs in one transaction).

```diff
 model User {
   ...
+  availability     DoctorBranchAvailability[]
+  salaryRecords    SalaryRecord[]
+  contracts        StaffContract[]
+  visitObservations VisitObservation[]
 }

 model Branch {
   ...
+  chairCount Int @default(3)
+  sessions       ClinicSession[]
+  inventoryStock InventoryStock[]
+  transactions   FinancialTransaction[]
+  purchaseOrders PurchaseOrder[]
+  availability   DoctorBranchAvailability[]
 }

 model Appointment {
   ...
+  sessionId String?
+  session   ClinicSession? @relation(fields: [sessionId], references: [id])
+  slotKind  String? // "ONLINE" | "APPOINTMENT" — which allocation it consumed
 }

 model ReceptionQueueItem {
   ...
-  status String @default("WAITING") // WAITING | CALLED | IN_TREATMENT | READY_TO_PAY | DONE | LEFT
+  status String @default("CHECKED_IN") // CHECKED_IN | ASSIGNED | IN_CHAIR | COMPLETED | PAID | LEFT
+  sessionId   String?
+  session     ClinicSession? @relation(fields: [sessionId], references: [id])
+  chairNumber Int?
+  referralNote String?      // set when a doctor refers the patient onward
+  referredById String?      // doctor who referred
 }
```
Data migration: `WAITING→CHECKED_IN` (or `ASSIGNED` when assignedDoctorId set), `CALLED→ASSIGNED`, `IN_TREATMENT→IN_CHAIR`, `READY_TO_PAY→COMPLETED`, `DONE→PAID`. `queueNumber` is reused as the token number.

```diff
 model Visit {
   ...
+  lockedAt    DateTime?          // step 8 "End visit" sets this; PATCH rejects edits after
+  patientType String @default("ADULT") // ADULT | CHILD — drives BOM choice; derived from DOB, overridable
+  observations VisitObservation[]
+  overrides    BillOverride[]
 }

 model TreatmentFee {
   ...
+  priceCents Int @default(0)    // money migration; `price` Float frozen after cutover
+  priceHistory TreatmentPriceHistory[]
+  boms         TreatmentBOM[]
 }
```

**Money → integer cents (expand-and-contract), applied to:** `Invoice` (subtotal/discount/tax/total/amountPaid/balance), `InvoiceItem` (unitPrice/total), `Payment.amount`, `InstallmentPlan` (totalAmount/amountPerInstallment), `Installment` (amount/paidAmount), `TreatmentPlan` (totalFee/patientPortion/estimatedInsurance), `TreatmentPlanItem` (fee/insuranceEst/patientEst), `InsuranceLetter.approvedAmount`, `TreatmentFee.price`.
For each: add `<field>Cents Int` → backfill `ROUND(old*100)` in the same migration → code reads/writes cents only → Float columns frozen (kept, ignored) → dropped in a final, separately-approved migration.

### 1.2 New models — sessions & rostering

```prisma
enum SessionPeriod { MORNING EVENING }   // 09:00–14:00 / 16:00–21:00

model ClinicSession {
  id        String  @id @default(cuid())
  branchId  String
  branch    Branch  @relation(fields: [branchId], references: [id])
  date      DateTime @db.Date
  period    SessionPeriod
  onlineCapacity      Int @default(4)   // sellable on the website
  appointmentCapacity Int @default(10)  // onsite/phone bookings
  // remainder of the session = walk-ins (no numeric cap)
  isOpen    Boolean @default(true)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  appointments Appointment[]
  queueItems   ReceptionQueueItem[]

  @@unique([branchId, date, period])
  @@index([date, branchId])
  @@map("clinic_sessions")
}

model DoctorBranchAvailability {
  id       String @id @default(cuid())
  doctorId String
  doctor   User   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  branchId String
  branch   Branch @relation(fields: [branchId], references: [id], onDelete: Cascade)
  weekday  Int            // 0 = Sunday … 6 = Saturday
  period   SessionPeriod
  isActive Boolean @default(true)

  @@unique([doctorId, branchId, weekday, period])
  @@map("doctor_branch_availability")
}
```
Sessions are materialized lazily: booking/check-in for a (branch, date, period) upserts the session row with the branch's default capacities; Admin can edit capacities per session or per branch default.

### 1.3 New models — clinical v2

```prisma
model VisitObservation {              // append-only ⇒ no write conflicts
  id                 String  @id @default(cuid())
  visitId            String
  visit              Visit   @relation(fields: [visitId], references: [id], onDelete: Cascade)
  authorId           String
  author             User    @relation(fields: [authorId], references: [id])
  onBehalfOfDoctorId String?           // set when a nurse scribes for a doctor
  text               String
  createdAt          DateTime @default(now())

  @@index([visitId, createdAt])
  @@map("visit_observations")
}

model TreatmentPriceHistory {
  id            String   @id @default(cuid())
  feeId         String
  fee           TreatmentFee @relation(fields: [feeId], references: [id], onDelete: Cascade)
  priceCents    Int
  effectiveFrom DateTime @default(now())
  setByUserId   String?
  createdAt     DateTime @default(now())

  @@index([feeId, effectiveFrom])
  @@map("treatment_price_history")
}

model BillOverride {                  // silent list-vs-charged log → Admin report
  id             String  @id @default(cuid())
  visitId        String
  visit          Visit   @relation(fields: [visitId], references: [id])
  invoiceItemId  String?
  description    String
  listPriceCents Int
  chargedCents   Int
  doctorId       String
  createdAt      DateTime @default(now())

  @@index([doctorId, createdAt])
  @@map("bill_overrides")
}
```

### 1.4 New models — inventory

```prisma
model InventoryItem {                 // catalog (shared); stock is per branch
  id        String  @id @default(cuid())
  name      String
  unit      String  @default("unit")  // unit | ml | g | pack …
  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  stock    InventoryStock[]
  bomLines TreatmentBOMLine[]
  poItems  PurchaseOrderItem[]

  @@map("inventory_items")
}

model InventoryStock {                // quantity + threshold per item per branch
  id               String @id @default(cuid())
  itemId           String
  item             InventoryItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  branchId         String
  branch           Branch @relation(fields: [branchId], references: [id])
  quantity         Float  @default(0)
  reorderThreshold Float  @default(0)
  lowStockAlertedAt DateTime?         // dedupe threshold notifications
  updatedAt        DateTime @updatedAt

  adjustments StockAdjustment[]

  @@unique([itemId, branchId])
  @@map("inventory_stock")
}

model StockAdjustment {               // every movement, logged
  id        String @id @default(cuid())
  stockId   String
  stock     InventoryStock @relation(fields: [stockId], references: [id])
  delta     Float            // negative = deduction
  kind      String           // RECEIVED | CORRECTION | AUTO_DEDUCT | STOCK_TAKE
  reason    String?
  countedQty Float?          // STOCK_TAKE: the counted figure (variance = delta)
  userId    String?
  visitId   String?          // AUTO_DEDUCT provenance
  purchaseOrderId String?    // RECEIVED provenance
  createdAt DateTime @default(now())

  @@index([stockId, createdAt])
  @@map("stock_adjustments")
}

model TreatmentBOM {                  // per treatment × patient type; Admin-only
  id          String @id @default(cuid())
  feeId       String
  fee         TreatmentFee @relation(fields: [feeId], references: [id], onDelete: Cascade)
  patientType String       // ADULT | CHILD
  lines       TreatmentBOMLine[]

  @@unique([feeId, patientType])
  @@map("treatment_boms")
}

model TreatmentBOMLine {
  id       String @id @default(cuid())
  bomId    String
  bom      TreatmentBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  itemId   String
  item     InventoryItem @relation(fields: [itemId], references: [id])
  quantity Float          // average usage

  @@unique([bomId, itemId])
  @@map("treatment_bom_lines")
}
```

### 1.5 New models — finance & agent readiness

```prisma
enum TxDirection { IN OUT }

model FinanceCategory {               // simple chart of accounts (seeded, Admin-extendable)
  id        String @id @default(cuid())
  code      String @unique  // PATIENT_PAYMENT, REFUND, SALARY, RENT, LAB_FEE, SUPPLIES, OTHER_EXPENSE, OTHER_INCOME
  name      String
  direction TxDirection
  isActive  Boolean @default(true)

  transactions FinancialTransaction[]
  @@map("finance_categories")
}

model FinancialTransaction {          // THE ledger — every money movement
  id          String   @id @default(cuid())
  direction   TxDirection
  amountCents Int
  currency    Currency @default(LKR)
  categoryId  String
  category    FinanceCategory @relation(fields: [categoryId], references: [id])
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])
  date        DateTime @default(now())
  recordedByUserId    String?
  serviceAccountId    String?
  refType     String?  // "payment" | "invoice" | "salary_record" | "purchase_order" | "expense" | "refund"
  refId       String?
  notes       String?
  createdAt   DateTime @default(now())

  @@index([branchId, date])
  @@index([categoryId, date])
  @@index([refType, refId])
  @@map("financial_transactions")
}

model StaffContract {
  id              String @id @default(cuid())
  userId          String
  user            User   @relation(fields: [userId], references: [id])
  title           String
  startDate       DateTime
  endDate         DateTime?
  baseSalaryCents Int
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("staff_contracts")
}

model SalaryRecord {
  id              String @id @default(cuid())
  userId          String
  user            User   @relation(fields: [userId], references: [id])
  periodYear      Int
  periodMonth     Int    // 1–12
  baseCents       Int
  allowancesCents Int @default(0)
  deductionsCents Int @default(0)
  netCents        Int
  paidAt          DateTime?
  ledgerTxId      String?  // set when marked paid (writes OUT/SALARY)
  notes           String?
  createdAt       DateTime @default(now())

  @@unique([userId, periodYear, periodMonth])
  @@map("salary_records")
}

model Supplier {
  id       String @id @default(cuid())
  name     String
  phone    String?
  email    String?
  notes    String?
  isActive Boolean @default(true)
  purchaseOrders PurchaseOrder[]
  @@map("suppliers")
}

model PurchaseOrder {
  id         String @id @default(cuid())
  poNumber   String @unique
  supplierId String
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id])
  status     String   @default("DRAFT") // DRAFT | ORDERED | RECEIVED | CANCELLED
  totalCents Int      @default(0)
  orderedAt  DateTime?
  receivedAt DateTime?    // receiving: stock += qty AND ledger OUT/SUPPLIES row
  ledgerTxId String?
  createdById String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  items PurchaseOrderItem[]
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id        String @id @default(cuid())
  poId      String
  po        PurchaseOrder @relation(fields: [poId], references: [id], onDelete: Cascade)
  itemId    String
  item      InventoryItem @relation(fields: [itemId], references: [id])
  quantity  Float
  unitCostCents Int
  @@map("purchase_order_items")
}

model Attachment {                    // generic file-on-anything
  id           String @id @default(cuid())
  refType      String   // "financial_transaction" | "purchase_order" | "staff_contract" | ...
  refId        String
  fileName     String
  fileUrl      String
  mimeType     String?
  fileSize     Int?
  uploadedById String?
  createdAt    DateTime @default(now())

  @@index([refType, refId])
  @@map("attachments")
}

model ServiceAccount {                // non-human principal (future agent)
  id         String  @id @default(cuid())
  name       String
  keyHash    String  @unique   // bcrypt of the API key; key shown once at creation
  scopes     String[]          // "finance:read" | "finance:propose" | "inventory:read"
  isActive   Boolean @default(true)
  createdAt  DateTime @default(now())
  lastUsedAt DateTime?
  actions AgentAction[]
  @@map("service_accounts")
}

model AgentAction {                   // propose-and-approve; nothing auto-executes
  id               String @id @default(cuid())
  serviceAccountId String?
  serviceAccount   ServiceAccount? @relation(fields: [serviceAccountId], references: [id])
  actionType       String   // "create_expense" | "mark_salary_paid" | "create_po" | ...
  payload          Json
  status           String   @default("PENDING") // PENDING | APPROVED | REJECTED
  reviewedById     String?
  reviewedAt       DateTime?
  executedAt       DateTime?
  resultRefId      String?
  createdAt        DateTime @default(now())

  @@index([status, createdAt])
  @@map("agent_actions")
}

model ScheduledSms {                  // day-before reminders, low-stock alerts
  id            String @id @default(cuid())
  phone         String
  message       String
  language      String  @default("en") // en | si
  sendAt        DateTime
  sentAt        DateTime?
  status        String  @default("PENDING") // PENDING | SENT | FAILED | CANCELLED
  attempts      Int     @default(0)
  lastError     String?
  appointmentId String?
  createdAt     DateTime @default(now())

  @@index([status, sendAt])
  @@map("scheduled_sms")
}
```

**Nothing is dropped or renamed at column level.** `OnlineSlot`, `Recall`, `InsuranceLetter`, frozen Float columns all remain until separately approved.

---

## 2. Implementation order — 12 increments

Each increment: `prisma migrate dev` (named migration), `next build` both apps where touched, manual smoke test of the listed flows, short summary. Payment math and payment routing never change in the same increment.

| # | Increment | Contents | Test gate |
|---|---|---|---|
| 1 | **Foundations (no schema)** | `lib/permissions.ts` central `can(user, action)` map replacing ~40 inline role checks (old roles, identical behaviour); extract Notify.lk sender to `lib/sms.ts`; `lib/money.ts` (cents helpers, `formatLKRCents`) | Build; every page reachable per role exactly as before; manual SMS button works |
| 2 | **Role migration** | Enum migration + data mapping (DENTIST/HYGIENIST→DOCTOR, CLINIC_MANAGER→HEAD_NURSE); permission map switched to v2 roles; Admin stripped of clinical nav/actions/APIs; HEAD_NURSE = reception ∪ nurse; seed updated | Login as each role; Admin sees no clinical buttons anywhere; doctor/nurse/receptionist flows unchanged |
| 3 | **Money → cents + ledger** | Cents columns + backfill migration; all billing code switched to cents; `FinanceCategory` seed; `FinancialTransaction` written inside the same transaction by all 3 payment paths (invoice payment, installment pay, inline visit payment); Float columns frozen | Full billing regression: visit→invoice→partial pay→installment; balances match pre-migration figures; every payment has exactly one ledger row |
| 4 | **Effective-dated prices + override log** | `TreatmentPriceHistory` (backfilled from current prices); fee editor writes history; price lookup helper (latest ≤ visit date) behind unchanged `/api/fees` response shape; `BillOverride` rows written on visit save; price-change audit | Catalog dropdown unchanged; change a price → old bills untouched, new visit uses new price; override report data appears |
| 5 | **Admin finance + audit UI** | `/api/finance/*` (documented): daily collections per branch/doctor, debtors, overrides, expense entry (ledger write), profit per branch; admin finance pages; audit-log viewer | Admin sees collections matching seeded payments; expense entry appears in ledger and profit |
| 6 | **Sessions + rostering** | `ClinicSession`, `DoctorBranchAvailability` + admin config UIs (capacity defaults per branch, roster grid); lazy session materialization; booking APIs validate doctor-is-rostered; chairs (`chairCount`, `chairNumber`) | Create roster; onsite booking blocked for unrostered doctor/session; capacities editable |
| 7 | **Tokens, today board, no-show** | Queue status rename migration (mapping in §1.1); token per session at check-in (appointment patients slotted by time, walk-ins appended); receptionist today board (3 chairs, live statuses, color+word); 20-min no-show sweep endpoint promoting walk-ins; `visit-sync.ts` updated to new status names | Walk-in + appointment check-in ordering correct; board reflects chair states; sweep releases a stale slot |
| 8 | **Website cutover to sessions** | `lumora-website` slots API reads session online allocation (only sessions with ≥1 rostered doctor); booking consumes `slotKind=ONLINE`, still auto-confirmed; full-online shown when allocation exhausted; `OnlineSlot` left dormant | End-to-end online booking; exhausting allocation shows session full online while onsite booking still works |
| 9 | **Doctor home + refer + visit v2 shell** | Role-scoped home screens (doctor = queue only + one Patients button); one-tap Receive-to-chair; Refer-with-note action; visit wizard restyled to vertical auto-advancing 8 steps incl. new Review-history step 1, TBQ flags, End-visit lock (`lockedAt`, PATCH guard) | Doctor day path ≤1 tap deep; locked visit rejects edits; existing visit data still renders |
| 10 | **Nurse scribe** | `VisitObservation` append-only API + nurse "active visits" screen; live observation feed (5s poll) in doctor's step 2 with "entered by X on behalf of Dr Y" stamps | Nurse and doctor write simultaneously from two browsers; no clobbering |
| 11 | **Inventory** | Items/stock/adjustments/stock-take + nurse/receptionist UI; Admin BOM config (adult/child); auto-deduct on Done-today (non-blocking: failure logs, never aborts the clinical save); low-stock dashboard alert + SMS via `ScheduledSms`; visit `patientType` from DOB with override | Done-today deducts correct BOM; threshold crossing alerts Admin once; stock-take records variance |
| 12 | **Agent readiness + wrap-up** | `SalaryRecord`/`StaffContract` (+ mark-paid → ledger), `Supplier`/`PurchaseOrder` (receive → stock + ledger), `Attachment` (+ upload on transactions/POs), `ServiceAccount` API-key auth (scoped, finance+inventory only — clinical routes structurally excluded), `AgentAction` + admin approval queue, scheduled-SMS cron route + day-before enqueue on next-visit booking, `API.md` for all finance routes, `V2_CHANGES.md` | Service key with `finance:read` can hit finance APIs but 403s on everything clinical; PO receive updates stock and ledger; salary paid writes ledger |

Rough dependency chain: 1→2→3→4→5 (finance track), 6→7→8 (sessions track, independent of 3–5), 9→10 (needs 7), 11 (needs 4 for BOM-on-fee + 7), 12 last.

---

## 3. Open questions before I start Phase 3

1. **HYGIENIST mapping**: you said remove the role. The seeded hygienist account (`hygiene@dentalcare.lk`) currently performs treatments, so I plan to map existing HYGIENIST users → **DOCTOR** to preserve their access. If your real hygienist should be a **NURSE** instead, say so — it's a one-line change in the migration.
2. **Inventory shape**: spec says "InventoryItem per branch", but BOMs are global per treatment. I propose a shared item **catalog** + per-branch **stock/threshold** rows (§1.4) so one BOM works at both branches. Confirm or I'll follow the spec literally (duplicated items per branch).
3. **Scheduled SMS execution**: Next.js has no built-in scheduler. The day-before reminders and no-show sweep need a trigger for `/api/cron/*`. Where will this be hosted (Windows machine at the clinic → Task Scheduler; a VPS → cron; Vercel → vercel.json crons)? Until answered, I'll build the cron endpoints + a manual "Run now" admin button so nothing blocks.
4. **Session capacity defaults**: I've assumed 4 online / 10 appointment slots per session as seed defaults (Admin-editable). Fine?
5. **Sinhala labels**: I'll route all new UI strings through a single label dictionary (`lib/labels.ts`) so Sinhala can be added later without a UI rewrite — actual translations are out of scope for v2. Confirm.
