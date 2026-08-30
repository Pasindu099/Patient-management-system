-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "patientType" TEXT NOT NULL DEFAULT 'ADULT';

-- CreateTable
CREATE TABLE "visit_observations" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "onBehalfOfDoctorId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_observations_visitId_createdAt_idx" ON "visit_observations"("visitId", "createdAt");

-- AddForeignKey
ALTER TABLE "visit_observations" ADD CONSTRAINT "visit_observations_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_observations" ADD CONSTRAINT "visit_observations_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_observations" ADD CONSTRAINT "visit_observations_onBehalfOfDoctorId_fkey" FOREIGN KEY ("onBehalfOfDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

