-- v2 role migration
-- DENTIST → DOCTOR, HYGIENIST → DOCTOR, CLINIC_MANAGER → HEAD_NURSE
-- Mapping happens inside the USING clause so no row is ever left with an
-- invalid value; the whole change is one transaction.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'DOCTOR', 'HEAD_NURSE', 'NURSE', 'RECEPTIONIST');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'DENTIST'        THEN 'DOCTOR'
    WHEN 'HYGIENIST'      THEN 'DOCTOR'
    WHEN 'CLINIC_MANAGER' THEN 'HEAD_NURSE'
    ELSE "role"::text
  END::"UserRole_new"
);
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'RECEPTIONIST';
COMMIT;

