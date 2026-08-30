-- CreateTable
CREATE TABLE "treatment_price_history" (
    "id" TEXT NOT NULL,
    "feeId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_overrides" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "toothNumbers" TEXT,
    "listPriceCents" INTEGER NOT NULL,
    "chargedCents" INTEGER NOT NULL,
    "doctorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_price_history_feeId_effectiveFrom_idx" ON "treatment_price_history"("feeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "bill_overrides_doctorId_createdAt_idx" ON "bill_overrides"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "bill_overrides_visitId_idx" ON "bill_overrides"("visitId");

-- AddForeignKey
ALTER TABLE "treatment_price_history" ADD CONSTRAINT "treatment_price_history_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "treatment_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_overrides" ADD CONSTRAINT "bill_overrides_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: current catalog prices become the first history entry
INSERT INTO "treatment_price_history" ("id", "feeId", "priceCents", "effectiveFrom", "createdAt")
SELECT 'tph-' || "id", "id", "priceCents", "createdAt", now()
FROM "treatment_fees";
