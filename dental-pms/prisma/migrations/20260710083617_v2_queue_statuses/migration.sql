-- Rename reception queue statuses to v2 values (column is a plain String,
-- no type change needed — just remap existing data).
-- WAITING -> CHECKED_IN (or ASSIGNED if a doctor is already assigned)
-- CALLED -> ASSIGNED, IN_TREATMENT -> IN_CHAIR, READY_TO_PAY -> COMPLETED, DONE -> PAID
UPDATE "reception_queue_items" SET "status" = CASE "status"
  WHEN 'WAITING'      THEN CASE WHEN "assignedDoctorId" IS NULL THEN 'CHECKED_IN' ELSE 'ASSIGNED' END
  WHEN 'CALLED'       THEN 'ASSIGNED'
  WHEN 'IN_TREATMENT' THEN 'IN_CHAIR'
  WHEN 'READY_TO_PAY' THEN 'COMPLETED'
  WHEN 'DONE'         THEN 'PAID'
  ELSE "status" END;

ALTER TABLE "reception_queue_items" ALTER COLUMN "status" SET DEFAULT 'CHECKED_IN';
