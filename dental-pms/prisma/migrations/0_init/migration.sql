-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DENTIST', 'HYGIENIST', 'RECEPTIONIST', 'NURSE', 'CLINIC_MANAGER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('CHECKUP', 'CLEANING', 'FILLING', 'CROWN', 'ROOT_CANAL', 'EXTRACTION', 'ORTHODONTICS', 'WHITENING', 'IMPLANT', 'CONSULTATION', 'EMERGENCY', 'FOLLOW_UP', 'WALKIN');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'REFERRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('LKR', 'USD');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WALKIN', 'PHONE', 'WHATSAPP', 'ONLINE', 'RECEPTIONIST');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branches" (
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_branches_pkey" PRIMARY KEY ("userId","branchId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'RECEPTIONIST',
    "avatar" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "preferredName" TEXT,
    "nicNumber" TEXT,
    "passportNumber" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "phoneMobile" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "district" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'LK',
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "emergencyRelation" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "communicationPref" TEXT NOT NULL DEFAULT 'whatsapp',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeceased" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "familyGroupId" TEXT,
    "firstVisitDate" TIMESTAMP(3),
    "lastVisitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_histories" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "medications" JSONB NOT NULL DEFAULT '[]',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "isPregnant" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyDueDate" TIMESTAMP(3),
    "isSmoker" BOOLEAN NOT NULL DEFAULT false,
    "alcoholUnitsPerWeek" INTEGER,
    "anxietyLevel" INTEGER,
    "gagReflex" BOOLEAN NOT NULL DEFAULT false,
    "requiresAntibiotic" BOOLEAN NOT NULL DEFAULT false,
    "pdpaConsentDate" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "lastUpdatedBy" TEXT,

    CONSTRAINT "medical_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "pulse" INTEGER,
    "oxygenSat" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_letters" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insurerName" TEXT NOT NULL,
    "policyNumber" TEXT,
    "memberName" TEXT,
    "letterStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAmount" DOUBLE PRECISION,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "letterFileUrl" TEXT,
    "letterFileName" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "appointmentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bookingSource" "BookingSource" NOT NULL DEFAULT 'RECEPTIONIST',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "chair" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "noShowRisk" DOUBLE PRECISION,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "reminder24hSentAt" TIMESTAMP(3),
    "reminder2hSentAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception_queue_items" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "assignedDoctorId" TEXT,
    "calledById" TEXT,
    "visitId" TEXT,
    "queueNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "source" TEXT NOT NULL DEFAULT 'WALK_IN',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reception_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalls" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recallType" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 6,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "completedDate" TIMESTAMP(3),
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorId" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "content" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "totalFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "estimatedInsurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patientPortion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presentedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "status" "TreatmentStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "procedureCode" TEXT,
    "procedureName" TEXT NOT NULL,
    "toothNumbers" TEXT,
    "surfaces" TEXT,
    "fee" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "insuranceEst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patientEst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'PLANNED',
    "phase" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "treatment_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "exchangeRate" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "procedureCode" TEXT,
    "description" TEXT NOT NULL,
    "toothNumbers" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'LKR',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedById" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "cariesScore" INTEGER,
    "perioScore" INTEGER,
    "riskFactors" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewDate" TIMESTAMP(3),

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedByPatient" BOOLEAN NOT NULL DEFAULT false,
    "signerName" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_transcripts" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "audioFileName" TEXT,
    "audioDurationSecs" INTEGER,
    "languageDetected" TEXT,
    "rawTranscript" TEXT NOT NULL,
    "chiefComplaint" TEXT,
    "clinicalFindings" TEXT,
    "diagnosis" TEXT,
    "treatmentCarriedOut" TEXT,
    "patientInstructions" TEXT,
    "followUpPlan" TEXT,
    "additionalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "clinicalNoteId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "numberOfInstallments" INTEGER NOT NULL,
    "amountPerInstallment" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "visitNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "branchId" TEXT,
    "chiefComplaint" TEXT,
    "examination" TEXT,
    "diagnosis" TEXT,
    "treatmentDone" TEXT,
    "nextVisitPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "toothFindings" JSONB,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_invoices" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "visit_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "prescriptionNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "visitId" TEXT,
    "notes" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_slots" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxBookings" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_fees" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patientNumber_key" ON "patients"("patientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "patients_nicNumber_key" ON "patients"("nicNumber");

-- CreateIndex
CREATE INDEX "patients_lastName_firstName_idx" ON "patients"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "patients_patientNumber_idx" ON "patients"("patientNumber");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_nicNumber_idx" ON "patients"("nicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "medical_histories_patientId_key" ON "medical_histories"("patientId");

-- CreateIndex
CREATE INDEX "vital_signs_patientId_recordedAt_idx" ON "vital_signs"("patientId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointmentNumber_key" ON "appointments"("appointmentNumber");

-- CreateIndex
CREATE INDEX "appointments_patientId_startTime_idx" ON "appointments"("patientId", "startTime");

-- CreateIndex
CREATE INDEX "appointments_providerId_startTime_idx" ON "appointments"("providerId", "startTime");

-- CreateIndex
CREATE INDEX "appointments_branchId_startTime_idx" ON "appointments"("branchId", "startTime");

-- CreateIndex
CREATE INDEX "appointments_startTime_idx" ON "appointments"("startTime");

-- CreateIndex
CREATE INDEX "reception_queue_items_branchId_status_queueNumber_idx" ON "reception_queue_items"("branchId", "status", "queueNumber");

-- CreateIndex
CREATE INDEX "reception_queue_items_assignedDoctorId_status_idx" ON "reception_queue_items"("assignedDoctorId", "status");

-- CreateIndex
CREATE INDEX "reception_queue_items_patientId_arrivedAt_idx" ON "reception_queue_items"("patientId", "arrivedAt");

-- CreateIndex
CREATE INDEX "recalls_patientId_dueDate_idx" ON "recalls"("patientId", "dueDate");

-- CreateIndex
CREATE INDEX "clinical_notes_patientId_createdAt_idx" ON "clinical_notes"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_patientId_status_idx" ON "invoices"("patientId", "status");

-- CreateIndex
CREATE INDEX "risk_assessments_patientId_assessedAt_idx" ON "risk_assessments"("patientId", "assessedAt");

-- CreateIndex
CREATE INDEX "patient_documents_patientId_documentType_idx" ON "patient_documents"("patientId", "documentType");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_patientId_createdAt_idx" ON "audit_logs"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "consultation_transcripts_patientId_createdAt_idx" ON "consultation_transcripts"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "installment_plans_invoiceId_key" ON "installment_plans"("invoiceId");

-- CreateIndex
CREATE INDEX "installments_planId_idx" ON "installments"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "visits_visitNumber_key" ON "visits"("visitNumber");

-- CreateIndex
CREATE INDEX "visits_patientId_visitDate_idx" ON "visits"("patientId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "visit_invoices_visitId_invoiceId_key" ON "visit_invoices"("visitId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_prescriptionNumber_key" ON "prescriptions"("prescriptionNumber");

-- CreateIndex
CREATE INDEX "prescriptions_patientId_idx" ON "prescriptions"("patientId");

-- CreateIndex
CREATE INDEX "online_slots_doctorId_dayOfWeek_idx" ON "online_slots"("doctorId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "online_slots_doctorId_dayOfWeek_startTime_key" ON "online_slots"("doctorId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "treatment_fees_category_idx" ON "treatment_fees"("category");

-- CreateIndex
CREATE INDEX "treatment_fees_isActive_idx" ON "treatment_fees"("isActive");

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_letters" ADD CONSTRAINT "insurance_letters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_queue_items" ADD CONSTRAINT "reception_queue_items_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalls" ADD CONSTRAINT "recalls_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_transcripts" ADD CONSTRAINT "consultation_transcripts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_invoices" ADD CONSTRAINT "visit_invoices_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_invoices" ADD CONSTRAINT "visit_invoices_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_slots" ADD CONSTRAINT "online_slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

