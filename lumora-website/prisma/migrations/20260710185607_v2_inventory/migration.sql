-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockAlertedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "countedQuantity" DOUBLE PRECISION,
    "userId" TEXT,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_boms" (
    "id" TEXT NOT NULL,
    "feeId" TEXT NOT NULL,
    "patientType" TEXT NOT NULL,

    CONSTRAINT "treatment_boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_bom_lines" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "treatment_bom_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_itemId_branchId_key" ON "inventory_stock"("itemId", "branchId");

-- CreateIndex
CREATE INDEX "stock_adjustments_stockId_createdAt_idx" ON "stock_adjustments"("stockId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_boms_feeId_patientType_key" ON "treatment_boms"("feeId", "patientType");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_bom_lines_bomId_itemId_key" ON "treatment_bom_lines"("bomId", "itemId");

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "inventory_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_boms" ADD CONSTRAINT "treatment_boms_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "treatment_fees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_bom_lines" ADD CONSTRAINT "treatment_bom_lines_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "treatment_boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_bom_lines" ADD CONSTRAINT "treatment_bom_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

