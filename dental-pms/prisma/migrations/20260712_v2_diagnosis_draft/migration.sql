-- CreateTable
CREATE TABLE "diagnosis_drafts" (
    "id" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "toothFindings" JSONB NOT NULL DEFAULT '{}',
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnosis_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diagnosis_drafts_queueItemId_key" ON "diagnosis_drafts"("queueItemId");

-- AddForeignKey
ALTER TABLE "diagnosis_drafts" ADD CONSTRAINT "diagnosis_drafts_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "reception_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnosis_drafts" ADD CONSTRAINT "diagnosis_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

