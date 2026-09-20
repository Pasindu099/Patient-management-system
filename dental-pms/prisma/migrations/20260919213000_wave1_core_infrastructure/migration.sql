-- Wave 1 additive infrastructure only. No legacy DDL or data mutation.
-- Production DDL is not authorized by this migration artifact.
-- PMS startup runs migrate deploy, so this fails closed unless the session
-- carries a separately supplied authorization. Production Compose sets none.
DO $$ BEGIN
  IF coalesce(current_setting('lumora.wave1_ddl_authorization', true), '') = '' THEN
    RAISE EXCEPTION 'Wave 1 DDL authorization setting is required';
  END IF;
END $$;

CREATE TYPE "CanonicalMigrationClass" AS ENUM ('M1', 'M2', 'M3', 'M4');

CREATE TYPE "CanonicalCorrectionKind" AS ENUM ('CORRECTION', 'SUPERSESSION', 'REVERSAL', 'VOID');

CREATE TYPE "CanonicalGovernanceStatus" AS ENUM ('READY', 'APPROVED', 'ACTIVE', 'PAUSED', 'RETIRED', 'REVOKED', 'SUPERSEDED');

CREATE TYPE "CanonicalReconciliationStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');

CREATE TYPE "CanonicalExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'APPROVED', 'REMEDIATED', 'EXPIRED', 'CLOSED');

CREATE TYPE "CanonicalAttributionState" AS ENUM ('ASSIGNED', 'UNASSIGNED', 'UNKNOWN', 'NOT_APPLICABLE');

CREATE TABLE "canonical_event_headers" (
    "eventId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "aggregateSequence" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "policyVersionId" UUID,
    "migrationClass" "CanonicalMigrationClass" NOT NULL,
    "migrationBatchId" UUID,
    "sourceProvenanceKey" TEXT,

    CONSTRAINT "canonical_event_headers_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "canonical_aggregate_sequences" (
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "nextSequence" BIGINT NOT NULL,

    CONSTRAINT "canonical_aggregate_sequences_pkey" PRIMARY KEY ("aggregateType","aggregateId")
);

CREATE TABLE "canonical_event_corrections" (
    "correctionId" UUID NOT NULL,
    "originalEventId" UUID NOT NULL,
    "replacementEventId" UUID NOT NULL,
    "kind" "CanonicalCorrectionKind" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migrationBatchId" UUID,

    CONSTRAINT "canonical_event_corrections_pkey" PRIMARY KEY ("correctionId")
);

CREATE TABLE "canonical_source_record_references" (
    "referenceId" UUID NOT NULL,
    "canonicalEventId" UUID NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL DEFAULT '',
    "sourceChecksum" TEXT NOT NULL,
    "sourceProvenanceKey" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "migrationClass" "CanonicalMigrationClass" NOT NULL,
    "migrationBatchId" UUID NOT NULL,

    CONSTRAINT "canonical_source_record_references_pkey" PRIMARY KEY ("referenceId")
);

CREATE TABLE "canonical_policy_versions" (
    "policyVersionId" UUID NOT NULL,
    "family" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "approvalReference" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL,
    "definitionHash" TEXT NOT NULL,

    CONSTRAINT "canonical_policy_versions_pkey" PRIMARY KEY ("policyVersionId")
);

CREATE TABLE "canonical_policy_transition_events" (
    "transitionId" UUID NOT NULL,
    "policyVersionId" UUID NOT NULL,
    "priorStatus" "CanonicalGovernanceStatus",
    "newStatus" "CanonicalGovernanceStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonCode" TEXT NOT NULL,
    "approvalReference" TEXT,

    CONSTRAINT "canonical_policy_transition_events_pkey" PRIMARY KEY ("transitionId")
);

CREATE TABLE "canonical_policy_current_states" (
    "policyVersionId" UUID NOT NULL,
    "family" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "currentStatus" "CanonicalGovernanceStatus" NOT NULL,
    "lastTransitionId" UUID NOT NULL,

    CONSTRAINT "canonical_policy_current_states_pkey" PRIMARY KEY ("policyVersionId")
);

CREATE TABLE "canonical_cutover_registry" (
    "cutoverId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "cutoverAt" TIMESTAMPTZ(3) NOT NULL,
    "migrationClasses" "CanonicalMigrationClass"[],
    "approvalReference" TEXT NOT NULL,
    "evidenceManifestHash" TEXT NOT NULL,
    "migrationBatchId" UUID,

    CONSTRAINT "canonical_cutover_registry_pkey" PRIMARY KEY ("cutoverId")
);

CREATE TABLE "canonical_cutover_transition_events" (
    "transitionId" UUID NOT NULL,
    "cutoverId" UUID NOT NULL,
    "priorStatus" "CanonicalGovernanceStatus",
    "newStatus" "CanonicalGovernanceStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "activatedBy" TEXT,
    "activatedAt" TIMESTAMPTZ(3),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonCode" TEXT NOT NULL,
    "approvalReference" TEXT,

    CONSTRAINT "canonical_cutover_transition_events_pkey" PRIMARY KEY ("transitionId")
);

CREATE TABLE "canonical_cutover_current_states" (
    "cutoverId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "currentStatus" "CanonicalGovernanceStatus" NOT NULL,
    "lastTransitionId" UUID NOT NULL,

    CONSTRAINT "canonical_cutover_current_states_pkey" PRIMARY KEY ("cutoverId")
);

CREATE TABLE "canonical_reconciliation_rule_versions" (
    "ruleVersionId" UUID NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "definitionHash" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "ownerQueue" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3),
    "approvalReference" TEXT NOT NULL,

    CONSTRAINT "canonical_reconciliation_rule_versions_pkey" PRIMARY KEY ("ruleVersionId")
);

CREATE TABLE "canonical_reconciliation_runs" (
    "reconciliationRunId" UUID NOT NULL,
    "ruleSetHash" TEXT NOT NULL,
    "sourceSnapshotId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "retryOfRunId" UUID,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "currentStatus" "CanonicalReconciliationStatus",
    "migrationBatchId" UUID,

    CONSTRAINT "canonical_reconciliation_runs_pkey" PRIMARY KEY ("reconciliationRunId")
);

CREATE TABLE "canonical_reconciliation_run_events" (
    "eventId" UUID NOT NULL,
    "reconciliationRunId" UUID NOT NULL,
    "priorStatus" "CanonicalReconciliationStatus",
    "newStatus" "CanonicalReconciliationStatus" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reasonCode" TEXT,
    "failureCode" TEXT,
    "evidenceManifestHash" TEXT,
    "migrationBatchId" UUID,

    CONSTRAINT "canonical_reconciliation_run_events_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "canonical_data_quality_exceptions" (
    "exceptionId" UUID NOT NULL,
    "ruleVersionId" UUID NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceEntity" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "episodeKey" TEXT NOT NULL,
    "detectedAt" TIMESTAMPTZ(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "impactCode" TEXT NOT NULL,
    "ownerQueue" TEXT NOT NULL,
    "currentStatus" "CanonicalExceptionStatus",
    "migrationBatchId" UUID,

    CONSTRAINT "canonical_data_quality_exceptions_pkey" PRIMARY KEY ("exceptionId")
);

CREATE TABLE "canonical_exception_lifecycle_events" (
    "eventId" UUID NOT NULL,
    "exceptionId" UUID NOT NULL,
    "priorStatus" "CanonicalExceptionStatus",
    "newStatus" "CanonicalExceptionStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasonCode" TEXT NOT NULL,
    "correctionId" UUID,

    CONSTRAINT "canonical_exception_lifecycle_events_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "canonical_exception_evidence" (
    "evidenceId" UUID NOT NULL,
    "exceptionId" UUID NOT NULL,
    "reconciliationRunId" UUID,
    "evidenceType" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "manifestRef" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_exception_evidence_pkey" PRIMARY KEY ("evidenceId")
);

CREATE TABLE "canonical_approved_exception_versions" (
    "approvalId" UUID NOT NULL,
    "exceptionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "approvalReference" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(3) NOT NULL,
    "reviewAt" TIMESTAMPTZ(3) NOT NULL,
    "permittedImpact" TEXT NOT NULL,

    CONSTRAINT "canonical_approved_exception_versions_pkey" PRIMARY KEY ("approvalId")
);

CREATE INDEX "canonical_event_headers_domain_eventType_occurredAt_idx" ON "canonical_event_headers"("domain", "eventType", "occurredAt");

CREATE UNIQUE INDEX "canonical_event_headers_aggregateType_aggregateId_aggregate_key" ON "canonical_event_headers"("aggregateType", "aggregateId", "aggregateSequence");

CREATE UNIQUE INDEX "canonical_event_headers_domain_eventType_idempotencyKey_key" ON "canonical_event_headers"("domain", "eventType", "idempotencyKey");

CREATE INDEX "canonical_event_corrections_originalEventId_recordedAt_idx" ON "canonical_event_corrections"("originalEventId", "recordedAt");

CREATE UNIQUE INDEX "canonical_event_corrections_replacementEventId_key" ON "canonical_event_corrections"("replacementEventId");

CREATE UNIQUE INDEX "canonical_source_record_references_sourceProvenanceKey_key" ON "canonical_source_record_references"("sourceProvenanceKey");

CREATE INDEX "canonical_source_record_references_migrationBatchId_idx" ON "canonical_source_record_references"("migrationBatchId");

CREATE UNIQUE INDEX "canonical_source_record_references_canonicalEventId_sourceS_key" ON "canonical_source_record_references"("canonicalEventId", "sourceSystem", "sourceEntity", "sourceKey", "sourceVersion");

CREATE INDEX "canonical_policy_versions_family_scopeType_scopeKey_effecti_idx" ON "canonical_policy_versions"("family", "scopeType", "scopeKey", "effectiveFrom");

CREATE UNIQUE INDEX "canonical_policy_versions_family_scopeType_scopeKey_version_key" ON "canonical_policy_versions"("family", "scopeType", "scopeKey", "version");

CREATE INDEX "canonical_policy_transition_events_policyVersionId_recorded_idx" ON "canonical_policy_transition_events"("policyVersionId", "recordedAt");

CREATE INDEX "canonical_policy_current_states_family_scopeType_scopeKey_c_idx" ON "canonical_policy_current_states"("family", "scopeType", "scopeKey", "currentStatus");

CREATE INDEX "canonical_cutover_registry_domain_scopeType_scopeKey_cutove_idx" ON "canonical_cutover_registry"("domain", "scopeType", "scopeKey", "cutoverAt");

CREATE INDEX "canonical_cutover_transition_events_cutoverId_recordedAt_idx" ON "canonical_cutover_transition_events"("cutoverId", "recordedAt");

CREATE INDEX "canonical_cutover_current_states_domain_scopeType_scopeKey__idx" ON "canonical_cutover_current_states"("domain", "scopeType", "scopeKey", "currentStatus");

CREATE UNIQUE INDEX "canonical_reconciliation_rule_versions_ruleCode_version_sco_key" ON "canonical_reconciliation_rule_versions"("ruleCode", "version", "scopeType", "scopeKey");

CREATE INDEX "canonical_reconciliation_runs_currentStatus_startedAt_idx" ON "canonical_reconciliation_runs"("currentStatus", "startedAt");

CREATE UNIQUE INDEX "canonical_reconciliation_runs_ruleSetHash_sourceSnapshotId__key" ON "canonical_reconciliation_runs"("ruleSetHash", "sourceSnapshotId", "scopeType", "scopeKey", "runKey", "attempt");

CREATE INDEX "canonical_reconciliation_run_events_reconciliationRunId_rec_idx" ON "canonical_reconciliation_run_events"("reconciliationRunId", "recordedAt", "eventId");

CREATE INDEX "canonical_data_quality_exceptions_ownerQueue_currentStatus_idx" ON "canonical_data_quality_exceptions"("ownerQueue", "currentStatus");

CREATE UNIQUE INDEX "canonical_data_quality_exceptions_ruleVersionId_sourceSyste_key" ON "canonical_data_quality_exceptions"("ruleVersionId", "sourceSystem", "sourceEntity", "sourceKey", "scopeKey", "episodeKey");

CREATE INDEX "canonical_exception_lifecycle_events_exceptionId_recordedAt_idx" ON "canonical_exception_lifecycle_events"("exceptionId", "recordedAt");

CREATE INDEX "canonical_exception_evidence_exceptionId_reconciliationRunI_idx" ON "canonical_exception_evidence"("exceptionId", "reconciliationRunId");

CREATE UNIQUE INDEX "canonical_approved_exception_versions_exceptionId_version_key" ON "canonical_approved_exception_versions"("exceptionId", "version");

-- All references are to Wave 0 control-plane or Wave 1 infrastructure only.
ALTER TABLE "canonical_event_headers"
  ADD CONSTRAINT "w1_header_policy_fk" FOREIGN KEY ("policyVersionId") REFERENCES "canonical_policy_versions"("policyVersionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_header_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_header_sequence_check" CHECK ("aggregateSequence" > 0 AND length("contentHash") > 0),
  ADD CONSTRAINT "w1_header_import_check" CHECK ("migrationClass" = 'M4' OR ("migrationBatchId" IS NOT NULL AND "sourceProvenanceKey" IS NOT NULL));
ALTER TABLE "canonical_aggregate_sequences"
  ADD CONSTRAINT "w1_sequence_positive_check" CHECK ("nextSequence" > 0);
ALTER TABLE "canonical_event_corrections"
  ADD CONSTRAINT "w1_correction_original_fk" FOREIGN KEY ("originalEventId") REFERENCES "canonical_event_headers"("eventId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_correction_replacement_fk" FOREIGN KEY ("replacementEventId") REFERENCES "canonical_event_headers"("eventId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_correction_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_correction_distinct_check" CHECK ("originalEventId" <> "replacementEventId");
CREATE UNIQUE INDEX "w1_correction_one_successor_idx" ON "canonical_event_corrections"("originalEventId");
ALTER TABLE "canonical_source_record_references"
  ADD CONSTRAINT "w1_source_header_fk" FOREIGN KEY ("canonicalEventId") REFERENCES "canonical_event_headers"("eventId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_source_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_source_nonempty_check" CHECK (length("sourceKey") > 0 AND length("sourceChecksum") > 0 AND length("sourceProvenanceKey") > 0 AND "migrationClass" <> 'M4');
ALTER TABLE "canonical_policy_versions"
  ADD CONSTRAINT "w1_policy_window_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "w1_policy_version_check" CHECK ("version" > 0);
ALTER TABLE "canonical_policy_transition_events"
  ADD CONSTRAINT "w1_policy_transition_version_fk" FOREIGN KEY ("policyVersionId") REFERENCES "canonical_policy_versions"("policyVersionId") ON DELETE RESTRICT;
ALTER TABLE "canonical_policy_current_states"
  ADD CONSTRAINT "w1_policy_current_version_fk" FOREIGN KEY ("policyVersionId") REFERENCES "canonical_policy_versions"("policyVersionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_policy_current_event_fk" FOREIGN KEY ("lastTransitionId") REFERENCES "canonical_policy_transition_events"("transitionId") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "w1_policy_one_active_scope_idx" ON "canonical_policy_current_states"("family", "scopeType", "scopeKey") WHERE "currentStatus" = 'ACTIVE';
ALTER TABLE "canonical_cutover_registry"
  ADD CONSTRAINT "w1_cutover_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_cutover_classes_check" CHECK (cardinality("migrationClasses") > 0);
ALTER TABLE "canonical_cutover_transition_events"
  ADD CONSTRAINT "w1_cutover_transition_registry_fk" FOREIGN KEY ("cutoverId") REFERENCES "canonical_cutover_registry"("cutoverId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_cutover_activation_check" CHECK (("newStatus" = 'ACTIVE') = ("activatedBy" IS NOT NULL AND "activatedAt" IS NOT NULL));
ALTER TABLE "canonical_cutover_current_states"
  ADD CONSTRAINT "w1_cutover_current_registry_fk" FOREIGN KEY ("cutoverId") REFERENCES "canonical_cutover_registry"("cutoverId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_cutover_current_event_fk" FOREIGN KEY ("lastTransitionId") REFERENCES "canonical_cutover_transition_events"("transitionId") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "w1_cutover_one_active_scope_idx" ON "canonical_cutover_current_states"("domain", "scopeType", "scopeKey") WHERE "currentStatus" = 'ACTIVE';
ALTER TABLE "canonical_reconciliation_rule_versions"
  ADD CONSTRAINT "w1_rule_window_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "w1_rule_named_check" CHECK ("ruleCode" <> 'MISSING_DATA' AND length("ruleCode") > 0);
ALTER TABLE "canonical_reconciliation_runs"
  ADD CONSTRAINT "w1_run_retry_fk" FOREIGN KEY ("retryOfRunId") REFERENCES "canonical_reconciliation_runs"("reconciliationRunId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_run_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_run_attempt_check" CHECK ("attempt" > 0 AND ("retryOfRunId" IS NULL OR "retryOfRunId" <> "reconciliationRunId"));
ALTER TABLE "canonical_reconciliation_run_events"
  ADD CONSTRAINT "w1_run_event_run_fk" FOREIGN KEY ("reconciliationRunId") REFERENCES "canonical_reconciliation_runs"("reconciliationRunId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_run_event_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_run_failure_code_check" CHECK ("newStatus" NOT IN ('FAILED', 'BLOCKED') OR "failureCode" IS NOT NULL);
ALTER TABLE "canonical_data_quality_exceptions"
  ADD CONSTRAINT "w1_exception_rule_fk" FOREIGN KEY ("ruleVersionId") REFERENCES "canonical_reconciliation_rule_versions"("ruleVersionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_exception_batch_fk" FOREIGN KEY ("migrationBatchId") REFERENCES "canonical_migration_batches"("id") ON DELETE RESTRICT;
ALTER TABLE "canonical_exception_lifecycle_events"
  ADD CONSTRAINT "w1_exception_event_exception_fk" FOREIGN KEY ("exceptionId") REFERENCES "canonical_data_quality_exceptions"("exceptionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_exception_event_correction_fk" FOREIGN KEY ("correctionId") REFERENCES "canonical_event_corrections"("correctionId") ON DELETE RESTRICT;
ALTER TABLE "canonical_exception_evidence"
  ADD CONSTRAINT "w1_evidence_exception_fk" FOREIGN KEY ("exceptionId") REFERENCES "canonical_data_quality_exceptions"("exceptionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_evidence_run_fk" FOREIGN KEY ("reconciliationRunId") REFERENCES "canonical_reconciliation_runs"("reconciliationRunId") ON DELETE RESTRICT;
ALTER TABLE "canonical_approved_exception_versions"
  ADD CONSTRAINT "w1_approval_exception_fk" FOREIGN KEY ("exceptionId") REFERENCES "canonical_data_quality_exceptions"("exceptionId") ON DELETE RESTRICT,
  ADD CONSTRAINT "w1_approval_window_check" CHECK ("effectiveTo" > "effectiveFrom" AND "reviewAt" >= "effectiveFrom");

CREATE FUNCTION canonical_w1_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Wave 1 history is append-only: %', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER w1_header_immutable BEFORE UPDATE OR DELETE ON "canonical_event_headers" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_correction_immutable BEFORE UPDATE OR DELETE ON "canonical_event_corrections" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_source_immutable BEFORE UPDATE OR DELETE ON "canonical_source_record_references" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_policy_version_immutable BEFORE UPDATE OR DELETE ON "canonical_policy_versions" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_policy_event_immutable BEFORE UPDATE OR DELETE ON "canonical_policy_transition_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_cutover_immutable BEFORE UPDATE OR DELETE ON "canonical_cutover_registry" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_cutover_event_immutable BEFORE UPDATE OR DELETE ON "canonical_cutover_transition_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_rule_immutable BEFORE UPDATE OR DELETE ON "canonical_reconciliation_rule_versions" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_run_event_immutable BEFORE UPDATE OR DELETE ON "canonical_reconciliation_run_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_exception_event_immutable BEFORE UPDATE OR DELETE ON "canonical_exception_lifecycle_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_evidence_immutable BEFORE UPDATE OR DELETE ON "canonical_exception_evidence" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();
CREATE TRIGGER w1_approval_immutable BEFORE UPDATE OR DELETE ON "canonical_approved_exception_versions" FOR EACH ROW EXECUTE FUNCTION canonical_w1_reject_mutation();

CREATE FUNCTION canonical_w1_validate_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  original_row RECORD;
  replacement_row RECORD;
  creates_cycle BOOLEAN;
BEGIN
  SELECT "domain", "aggregateType", "aggregateId" INTO original_row
    FROM "canonical_event_headers" WHERE "eventId" = NEW."originalEventId";
  SELECT "domain", "aggregateType", "aggregateId" INTO replacement_row
    FROM "canonical_event_headers" WHERE "eventId" = NEW."replacementEventId";
  IF original_row IS NULL OR replacement_row IS NULL OR
     (original_row."domain", original_row."aggregateType", original_row."aggregateId")
       IS DISTINCT FROM (replacement_row."domain", replacement_row."aggregateType", replacement_row."aggregateId") THEN
    RAISE EXCEPTION 'Correction events must share domain and aggregate';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(original_row."aggregateType" || ':' || original_row."aggregateId"::text, 0));
  WITH RECURSIVE successors(id) AS (
    SELECT NEW."replacementEventId"
    UNION
    SELECT c."replacementEventId" FROM "canonical_event_corrections" c
      JOIN successors s ON c."originalEventId" = s.id
  ) SELECT EXISTS (SELECT 1 FROM successors WHERE id = NEW."originalEventId") INTO creates_cycle;
  IF creates_cycle THEN RAISE EXCEPTION 'Correction cycle rejected'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER w1_correction_validate BEFORE INSERT ON "canonical_event_corrections" FOR EACH ROW EXECUTE FUNCTION canonical_w1_validate_correction();

CREATE FUNCTION canonical_w1_policy_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  policy_row RECORD;
  previous "CanonicalGovernanceStatus";
BEGIN
  SELECT * INTO policy_row FROM "canonical_policy_versions" WHERE "policyVersionId" = NEW."policyVersionId";
  PERFORM pg_advisory_xact_lock(hashtextextended('policy:' || policy_row."family" || ':' || policy_row."scopeType" || ':' || policy_row."scopeKey", 0));
  SELECT "currentStatus" INTO previous FROM "canonical_policy_current_states" WHERE "policyVersionId" = NEW."policyVersionId" FOR UPDATE;
  IF NEW."priorStatus" IS DISTINCT FROM previous OR NOT (
    (previous IS NULL AND NEW."newStatus" = 'APPROVED') OR
    (previous = 'APPROVED' AND NEW."newStatus" IN ('ACTIVE','REVOKED','SUPERSEDED')) OR
    (previous = 'ACTIVE' AND NEW."newStatus" IN ('REVOKED','SUPERSEDED'))
  ) THEN RAISE EXCEPTION 'Invalid policy transition'; END IF;
  IF NEW."newStatus" IN ('APPROVED','ACTIVE') AND EXISTS (
    SELECT 1 FROM "canonical_policy_versions" p
    JOIN "canonical_policy_current_states" s ON s."policyVersionId" = p."policyVersionId"
    WHERE p."policyVersionId" <> NEW."policyVersionId"
      AND (p."family",p."scopeType",p."scopeKey") = (policy_row."family",policy_row."scopeType",policy_row."scopeKey")
      AND s."currentStatus" IN ('APPROVED','ACTIVE')
      AND tstzrange(p."effectiveFrom",p."effectiveTo",'[)') &&
          tstzrange(policy_row."effectiveFrom",policy_row."effectiveTo",'[)')
  ) THEN RAISE EXCEPTION 'Overlapping approved policy interval'; END IF;
  INSERT INTO "canonical_policy_current_states"("policyVersionId","family","scopeType","scopeKey","currentStatus","lastTransitionId")
    VALUES (NEW."policyVersionId",policy_row."family",policy_row."scopeType",policy_row."scopeKey",NEW."newStatus",NEW."transitionId")
    ON CONFLICT ("policyVersionId") DO UPDATE SET "currentStatus"=EXCLUDED."currentStatus", "lastTransitionId"=EXCLUDED."lastTransitionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER w1_policy_transition AFTER INSERT ON "canonical_policy_transition_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_policy_transition();

CREATE FUNCTION canonical_w1_cutover_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cutover_row RECORD;
  previous "CanonicalGovernanceStatus";
BEGIN
  SELECT * INTO cutover_row FROM "canonical_cutover_registry" WHERE "cutoverId" = NEW."cutoverId";
  PERFORM pg_advisory_xact_lock(hashtextextended('cutover:' || cutover_row."domain" || ':' || cutover_row."scopeType" || ':' || cutover_row."scopeKey", 0));
  SELECT "currentStatus" INTO previous FROM "canonical_cutover_current_states" WHERE "cutoverId" = NEW."cutoverId" FOR UPDATE;
  IF NEW."priorStatus" IS DISTINCT FROM previous OR NOT (
    (previous IS NULL AND NEW."newStatus" = 'READY') OR
    (previous = 'READY' AND NEW."newStatus" IN ('ACTIVE','SUPERSEDED')) OR
    (previous = 'ACTIVE' AND NEW."newStatus" IN ('PAUSED','RETIRED')) OR
    (previous = 'PAUSED' AND NEW."newStatus" IN ('ACTIVE','RETIRED'))
  ) THEN RAISE EXCEPTION 'Invalid cutover transition'; END IF;
  IF NEW."newStatus" = 'ACTIVE' AND (length(cutover_row."approvalReference") = 0 OR length(cutover_row."evidenceManifestHash") = 0) THEN
    RAISE EXCEPTION 'Cutover activation requires approval and evidence';
  END IF;
  INSERT INTO "canonical_cutover_current_states"("cutoverId","domain","scopeType","scopeKey","currentStatus","lastTransitionId")
    VALUES (NEW."cutoverId",cutover_row."domain",cutover_row."scopeType",cutover_row."scopeKey",NEW."newStatus",NEW."transitionId")
    ON CONFLICT ("cutoverId") DO UPDATE SET "currentStatus"=EXCLUDED."currentStatus", "lastTransitionId"=EXCLUDED."lastTransitionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER w1_cutover_transition AFTER INSERT ON "canonical_cutover_transition_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_cutover_transition();

CREATE FUNCTION canonical_w1_run_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  run_row RECORD;
  previous "CanonicalReconciliationStatus";
  retry_parent RECORD;
BEGIN
  SELECT * INTO run_row FROM "canonical_reconciliation_runs" WHERE "reconciliationRunId" = NEW."reconciliationRunId" FOR UPDATE;
  previous := run_row."currentStatus";
  IF NEW."priorStatus" IS DISTINCT FROM previous OR NOT (
    (previous IS NULL AND NEW."newStatus" = 'PLANNED') OR
    (previous = 'PLANNED' AND NEW."newStatus" = 'RUNNING') OR
    (previous = 'RUNNING' AND NEW."newStatus" IN ('COMPLETED','FAILED','BLOCKED'))
  ) THEN RAISE EXCEPTION 'Invalid reconciliation run transition'; END IF;
  IF previous IS NULL AND run_row."retryOfRunId" IS NOT NULL THEN
    SELECT * INTO retry_parent FROM "canonical_reconciliation_runs" WHERE "reconciliationRunId" = run_row."retryOfRunId";
    IF retry_parent."currentStatus" NOT IN ('FAILED','BLOCKED') OR run_row."attempt" <> retry_parent."attempt" + 1 OR
       (run_row."ruleSetHash",run_row."sourceSnapshotId",run_row."scopeType",run_row."scopeKey",run_row."runKey")
         IS DISTINCT FROM
       (retry_parent."ruleSetHash",retry_parent."sourceSnapshotId",retry_parent."scopeType",retry_parent."scopeKey",retry_parent."runKey") THEN
      RAISE EXCEPTION 'Retry must link to matching failed or blocked run';
    END IF;
  ELSIF previous IS NULL AND run_row."attempt" <> 1 THEN
    RAISE EXCEPTION 'Initial reconciliation attempt must be one';
  END IF;
  UPDATE "canonical_reconciliation_runs" SET "currentStatus" = NEW."newStatus",
    "startedAt" = CASE WHEN NEW."newStatus" = 'RUNNING' THEN NEW."recordedAt" ELSE "startedAt" END,
    "completedAt" = CASE WHEN NEW."newStatus" IN ('COMPLETED','FAILED','BLOCKED') THEN NEW."recordedAt" ELSE "completedAt" END
    WHERE "reconciliationRunId" = NEW."reconciliationRunId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER w1_run_transition AFTER INSERT ON "canonical_reconciliation_run_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_run_transition();

CREATE FUNCTION canonical_w1_require_initial_run_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "canonical_reconciliation_run_events" WHERE "reconciliationRunId" = NEW."reconciliationRunId" AND "priorStatus" IS NULL AND "newStatus" = 'PLANNED') THEN
    RAISE EXCEPTION 'Reconciliation run requires an initial PLANNED event';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER w1_run_initial_event AFTER INSERT ON "canonical_reconciliation_runs"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION canonical_w1_require_initial_run_event();

CREATE FUNCTION canonical_w1_exception_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous "CanonicalExceptionStatus";
BEGIN
  SELECT "currentStatus" INTO previous FROM "canonical_data_quality_exceptions"
    WHERE "exceptionId" = NEW."exceptionId" FOR UPDATE;
  IF NEW."priorStatus" IS DISTINCT FROM previous OR NOT (
    (previous IS NULL AND NEW."newStatus" = 'OPEN') OR
    (previous = 'OPEN' AND NEW."newStatus" IN ('ACKNOWLEDGED','ASSIGNED','APPROVED','CLOSED')) OR
    (previous = 'ACKNOWLEDGED' AND NEW."newStatus" IN ('ASSIGNED','APPROVED','REMEDIATED','CLOSED')) OR
    (previous = 'ASSIGNED' AND NEW."newStatus" IN ('APPROVED','REMEDIATED','CLOSED')) OR
    (previous = 'APPROVED' AND NEW."newStatus" IN ('EXPIRED','REMEDIATED','CLOSED')) OR
    (previous = 'REMEDIATED' AND NEW."newStatus" = 'CLOSED') OR
    (previous = 'EXPIRED' AND NEW."newStatus" IN ('ASSIGNED','CLOSED')) OR
    (previous = 'CLOSED' AND NEW."newStatus" = 'OPEN')
  ) THEN RAISE EXCEPTION 'Invalid exception lifecycle transition'; END IF;
  UPDATE "canonical_data_quality_exceptions" SET "currentStatus" = NEW."newStatus" WHERE "exceptionId" = NEW."exceptionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER w1_exception_transition AFTER INSERT ON "canonical_exception_lifecycle_events" FOR EACH ROW EXECUTE FUNCTION canonical_w1_exception_transition();

-- The audit role is optional in disposable databases; production provisioning
-- rechecks this grant and still has no write/CREATE/TEMP privilege.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumora_audit_ro') THEN
    GRANT SELECT ON
      "canonical_event_headers", "canonical_aggregate_sequences", "canonical_event_corrections",
      "canonical_source_record_references", "canonical_policy_versions", "canonical_policy_transition_events",
      "canonical_policy_current_states", "canonical_cutover_registry", "canonical_cutover_transition_events",
      "canonical_cutover_current_states", "canonical_reconciliation_rule_versions", "canonical_reconciliation_runs",
      "canonical_reconciliation_run_events", "canonical_data_quality_exceptions", "canonical_exception_lifecycle_events",
      "canonical_exception_evidence", "canonical_approved_exception_versions"
      TO lumora_audit_ro;
  END IF;
END $$;
