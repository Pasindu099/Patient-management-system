-- KPI groundwork. All columns nullable; historical rows stay NULL and the KPI
-- queries fall back to free-text grouping when a feeId is absent.

-- Link billed lines and planned procedures back to the fee catalog so revenue
-- and volume can be grouped by TreatmentFee.category.
ALTER TABLE "invoice_items" ADD COLUMN "feeId" TEXT;
ALTER TABLE "treatment_plan_items" ADD COLUMN "feeId" TEXT;

-- Which visit actually completed a planned item (average visits per plan).
ALTER TABLE "treatment_plan_items" ADD COLUMN "completedVisitId" TEXT;

-- Intended follow-up date, set even when no Appointment row is booked.
ALTER TABLE "visits" ADD COLUMN "nextVisitDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoice_items_feeId_idx" ON "invoice_items"("feeId");
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");
CREATE INDEX "treatment_plan_items_feeId_idx" ON "treatment_plan_items"("feeId");
CREATE INDEX "treatment_plan_items_completedVisitId_idx" ON "treatment_plan_items"("completedVisitId");
CREATE INDEX "visits_doctorId_visitDate_idx" ON "visits"("doctorId", "visitDate");
CREATE INDEX "visits_nextVisitDate_idx" ON "visits"("nextVisitDate");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "treatment_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "treatment_fees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_completedVisitId_fkey" FOREIGN KEY ("completedVisitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
