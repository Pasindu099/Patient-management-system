-- Wave 0 administrative control plane only. No canonical business-domain
-- entity, business-table alteration, or business-data migration is included.

CREATE TYPE "CanonicalMigrationStatus" AS ENUM (
  'PLANNED', 'DRY_RUN', 'REVIEW_REQUIRED', 'APPROVED', 'RUNNING',
  'VALIDATING', 'COMPLETED', 'FAILED', 'BLOCKED', 'ROLLED_BACK'
);

CREATE TYPE "CanonicalMigrationCountType" AS ENUM (
  'SOURCE', 'CANDIDATE', 'MIGRATED', 'SKIPPED', 'EXCEPTION', 'VALIDATED'
);

CREATE TYPE "CanonicalFeatureControlType" AS ENUM (
  'WRITE_CAPTURE', 'SHADOW_READ', 'METRIC_READ', 'DOMAIN_CUTOVER',
  'ALERT_TYPE', 'UI_SURFACE'
);

CREATE TABLE "canonical_migration_batches" (
  "id" UUID NOT NULL,
  "wave" INTEGER NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT '*',
  "domain" TEXT,
  "sourceSnapshotId" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "buildSha" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "status" "CanonicalMigrationStatus" NOT NULL DEFAULT 'PLANNED',
  "approvalReference" TEXT,
  "validationResult" TEXT,
  "artifactManifestHash" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_migration_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_migration_batch_counts" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "sourceName" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "countType" "CanonicalMigrationCountType" NOT NULL,
  "rowCount" BIGINT NOT NULL,
  "amountCents" BIGINT,
  "currency" TEXT,
  "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_migration_batch_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_migration_run_events" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "priorStatus" "CanonicalMigrationStatus",
  "newStatus" "CanonicalMigrationStatus" NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "buildSha" TEXT NOT NULL,
  "reason" TEXT,
  "checkpoint" JSONB,
  "errorClass" TEXT,
  "evidenceHash" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_migration_run_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_feature_flags" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "controlType" "CanonicalFeatureControlType" NOT NULL,
  "domain" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
  "scopeKey" TEXT NOT NULL DEFAULT '*',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canonical_feature_flag_versions" (
  "id" UUID NOT NULL,
  "flagId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT NOT NULL,
  "approvalReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canonical_feature_flag_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "canonical_migration_batches_wave_domain_status_idx"
  ON "canonical_migration_batches"("wave", "domain", "status");
CREATE INDEX "canonical_migration_batches_sourceSnapshotId_idx"
  ON "canonical_migration_batches"("sourceSnapshotId");
CREATE UNIQUE INDEX "canonical_migration_batch_counts_batch_source_entity_type_key"
  ON "canonical_migration_batch_counts"("batchId", "sourceName", "entityType", "countType");
CREATE INDEX "canonical_migration_batch_counts_batch_type_idx"
  ON "canonical_migration_batch_counts"("batchId", "countType");
CREATE INDEX "canonical_migration_run_events_batch_occurred_idx"
  ON "canonical_migration_run_events"("batchId", "occurredAt");
CREATE UNIQUE INDEX "canonical_feature_flags_key_key"
  ON "canonical_feature_flags"("key");
CREATE UNIQUE INDEX "canonical_feature_flags_control_domain_feature_scope_key"
  ON "canonical_feature_flags"("controlType", "domain", "featureKey", "scopeType", "scopeKey");
CREATE INDEX "canonical_feature_flags_control_domain_idx"
  ON "canonical_feature_flags"("controlType", "domain");
CREATE UNIQUE INDEX "canonical_feature_flag_versions_flag_effective_key"
  ON "canonical_feature_flag_versions"("flagId", "effectiveAt");
CREATE INDEX "canonical_feature_flag_versions_flag_effective_expires_idx"
  ON "canonical_feature_flag_versions"("flagId", "effectiveAt", "expiresAt");

ALTER TABLE "canonical_migration_batch_counts"
  ADD CONSTRAINT "canonical_migration_batch_counts_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "canonical_migration_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canonical_migration_run_events"
  ADD CONSTRAINT "canonical_migration_run_events_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "canonical_migration_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "canonical_feature_flag_versions"
  ADD CONSTRAINT "canonical_feature_flag_versions_flagId_fkey"
  FOREIGN KEY ("flagId") REFERENCES "canonical_feature_flags"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
