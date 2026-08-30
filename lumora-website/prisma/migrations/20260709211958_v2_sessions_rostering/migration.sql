-- CreateEnum
CREATE TYPE "SessionPeriod" AS ENUM ('MORNING', 'EVENING');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "slotKind" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "appointmentSlotsDefault" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "chairCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "onlineSlotsDefault" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "reception_queue_items" ADD COLUMN     "chairNumber" INTEGER,
ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "clinic_sessions" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" "SessionPeriod" NOT NULL,
    "onlineCapacity" INTEGER NOT NULL DEFAULT 4,
    "appointmentCapacity" INTEGER NOT NULL DEFAULT 10,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_branch_availability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "period" "SessionPeriod" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "doctor_branch_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_sessions_date_idx" ON "clinic_sessions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_sessions_branchId_date_period_key" ON "clinic_sessions"("branchId", "date", "period");

-- CreateIndex
CREATE INDEX "doctor_branch_availability_branchId_weekday_idx" ON "doctor_branch_availability"("branchId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_branch_availability_doctorId_branchId_weekday_period_key" ON "doctor_branch_availability"("doctorId", "branchId", "weekday", "period");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "clinic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "clinic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_sessions" ADD CONSTRAINT "clinic_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_branch_availability" ADD CONSTRAINT "doctor_branch_availability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_branch_availability" ADD CONSTRAINT "doctor_branch_availability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

