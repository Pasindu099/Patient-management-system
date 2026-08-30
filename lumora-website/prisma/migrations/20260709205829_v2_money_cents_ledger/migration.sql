-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "installment_plans" ADD COLUMN     "amountPerInstallmentCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "amountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmountCents" INTEGER;

-- AlterTable
ALTER TABLE "insurance_letters" ADD COLUMN     "approvedAmountCents" INTEGER;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitPriceCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "balanceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "treatment_fees" ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "treatment_plan_items" ADD COLUMN     "feeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "patientEstCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "treatment_plans" ADD COLUMN     "patientPortionCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalFeeCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "finance_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "TxDirection" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "direction" "TxDirection" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "categoryId" TEXT NOT NULL,
    "branchId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "serviceAccountId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_categories_code_key" ON "finance_categories"("code");

-- CreateIndex
CREATE INDEX "financial_transactions_branchId_date_idx" ON "financial_transactions"("branchId", "date");

-- CreateIndex
CREATE INDEX "financial_transactions_categoryId_date_idx" ON "financial_transactions"("categoryId", "date");

-- CreateIndex
CREATE INDEX "financial_transactions_refType_refId_idx" ON "financial_transactions"("refType", "refId");

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Backfill cents from legacy float columns (same transaction) ─────────────
UPDATE "invoices" SET
  "subtotalCents"   = ROUND("subtotal"   * 100)::int,
  "discountCents"   = ROUND("discount"   * 100)::int,
  "taxCents"        = ROUND("tax"        * 100)::int,
  "totalCents"      = ROUND("total"      * 100)::int,
  "amountPaidCents" = ROUND("amountPaid" * 100)::int,
  "balanceCents"    = ROUND("balance"    * 100)::int;

UPDATE "invoice_items" SET
  "unitPriceCents" = ROUND("unitPrice" * 100)::int,
  "totalCents"     = ROUND("total"     * 100)::int;

UPDATE "payments" SET "amountCents" = ROUND("amount" * 100)::int;

UPDATE "installment_plans" SET
  "totalAmountCents"          = ROUND("totalAmount"          * 100)::int,
  "amountPerInstallmentCents" = ROUND("amountPerInstallment" * 100)::int;

UPDATE "installments" SET
  "amountCents"     = ROUND("amount" * 100)::int,
  "paidAmountCents" = CASE WHEN "paidAmount" IS NULL THEN NULL ELSE ROUND("paidAmount" * 100)::int END;

UPDATE "treatment_fees" SET "priceCents" = ROUND("price" * 100)::int;

UPDATE "treatment_plans" SET
  "totalFeeCents"       = ROUND("totalFee"       * 100)::int,
  "patientPortionCents" = ROUND("patientPortion" * 100)::int;

UPDATE "treatment_plan_items" SET
  "feeCents"        = ROUND("fee"        * 100)::int,
  "patientEstCents" = ROUND("patientEst" * 100)::int;

UPDATE "insurance_letters" SET
  "approvedAmountCents" = CASE WHEN "approvedAmount" IS NULL THEN NULL ELSE ROUND("approvedAmount" * 100)::int END;

-- ─── Seed the chart of accounts ──────────────────────────────────────────────
INSERT INTO "finance_categories" ("id", "code", "name", "direction") VALUES
  ('fincat-patient-payment', 'PATIENT_PAYMENT', 'Patient payment',      'IN'),
  ('fincat-other-income',    'OTHER_INCOME',    'Other income',         'IN'),
  ('fincat-refund',          'REFUND',          'Patient refund',       'OUT'),
  ('fincat-salary',          'SALARY',          'Staff salary',         'OUT'),
  ('fincat-rent',            'RENT',            'Rent',                 'OUT'),
  ('fincat-lab-fee',         'LAB_FEE',         'Laboratory fees',      'OUT'),
  ('fincat-supplies',        'SUPPLIES',        'Supplies & materials', 'OUT'),
  ('fincat-other-expense',   'OTHER_EXPENSE',   'Other expense',        'OUT')
ON CONFLICT ("code") DO NOTHING;

-- ─── Backfill ledger from existing payments ──────────────────────────────────
INSERT INTO "financial_transactions"
  ("id", "direction", "amountCents", "currency", "categoryId", "branchId", "date", "recordedByUserId", "refType", "refId", "createdAt")
SELECT
  'ftx-' || p."id", 'IN'::"TxDirection", ROUND(p."amount" * 100)::int, p."currency",
  'fincat-patient-payment', i."branchId", p."paidAt", p."processedById", 'payment', p."id", p."paidAt"
FROM "payments" p
JOIN "invoices" i ON i."id" = p."invoiceId";
