export type MigrationStatus =
  | "PLANNED" | "DRY_RUN" | "REVIEW_REQUIRED" | "APPROVED" | "RUNNING"
  | "VALIDATING" | "COMPLETED" | "FAILED" | "BLOCKED" | "ROLLED_BACK";

const TRANSITIONS: Record<MigrationStatus, readonly MigrationStatus[]> = {
  PLANNED: ["DRY_RUN", "REVIEW_REQUIRED", "BLOCKED"],
  DRY_RUN: ["REVIEW_REQUIRED", "FAILED", "BLOCKED"],
  REVIEW_REQUIRED: ["APPROVED", "BLOCKED"],
  APPROVED: ["RUNNING", "BLOCKED"],
  RUNNING: ["VALIDATING", "FAILED", "BLOCKED"],
  VALIDATING: ["COMPLETED", "FAILED", "BLOCKED"],
  COMPLETED: [], FAILED: ["ROLLED_BACK"], BLOCKED: ["PLANNED"], ROLLED_BACK: [],
};

export function assertMigrationTransition(prior: MigrationStatus, next: MigrationStatus): void {
  if (!TRANSITIONS[prior].includes(next)) throw new Error(`Invalid migration transition: ${prior} -> ${next}`);
}

export function assertLedgerWriteAuthorized(mode: string, dryRun: boolean, approvalReference?: string | null): void {
  if (mode !== "execute") throw new Error("Database ledger writes require execute mode; dry runs use evidence artifacts");
  if (dryRun) throw new Error("Dry-run ledger writes are forbidden");
  if (!approvalReference) throw new Error("An approval reference is required for an execution ledger write");
}

export type AuthorizedBatchInput = {
  wave: number;
  scopeType: string;
  scopeKey: string;
  domain?: string;
  sourceSnapshotId: string;
  sourceChecksum: string;
  buildSha: string;
  actorType: string;
  actorId?: string;
  approvalReference: string;
};

export async function createAuthorizedBatch(
  prisma: PrismaClient,
  mode: string,
  input: AuthorizedBatchInput,
) {
  assertLedgerWriteAuthorized(mode, false, input.approvalReference);
  if (input.wave < 1) throw new Error("Wave 0 does not import business records");
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.canonicalMigrationBatch.create({
      data: {
        id: newCanonicalId(),
        wave: input.wave,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        domain: input.domain,
        sourceSnapshotId: input.sourceSnapshotId,
        sourceChecksum: input.sourceChecksum,
        buildSha: input.buildSha,
        actorType: input.actorType,
        actorId: input.actorId,
        approvalReference: input.approvalReference,
        dryRun: false,
        status: "PLANNED",
      },
    });
    await transaction.canonicalMigrationRunEvent.create({
      data: {
        id: newCanonicalId(), batchId: batch.id, newStatus: "PLANNED",
        actorType: input.actorType, actorId: input.actorId, buildSha: input.buildSha,
        reason: "Authorized batch created",
      },
    });
    return batch;
  });
}

export async function transitionBatch(
  prisma: PrismaClient,
  mode: string,
  batchId: string,
  next: MigrationStatus,
  actor: { actorType: string; actorId?: string; buildSha: string; reason: string; evidenceHash?: string },
) {
  if (mode !== "execute") throw new Error("Database ledger transitions require execute mode");
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.canonicalMigrationBatch.findUniqueOrThrow({ where: { id: batchId } });
    assertLedgerWriteAuthorized(mode, batch.dryRun, batch.approvalReference);
    assertMigrationTransition(batch.status, next);
    const updated = await transaction.canonicalMigrationBatch.updateMany({
      where: { id: batchId, status: batch.status },
      data: { status: next, completedAt: next === "COMPLETED" ? new Date() : undefined },
    });
    if (updated.count !== 1) throw new Error("Concurrent ledger transition detected");
    await transaction.canonicalMigrationRunEvent.create({
      data: {
        id: newCanonicalId(), batchId, priorStatus: batch.status, newStatus: next,
        actorType: actor.actorType, actorId: actor.actorId, buildSha: actor.buildSha,
        reason: actor.reason, evidenceHash: actor.evidenceHash,
      },
    });
    return transaction.canonicalMigrationBatch.findUniqueOrThrow({ where: { id: batchId } });
  });
}

export async function recordBatchCount(
  prisma: PrismaClient,
  mode: string,
  batchId: string,
  count: { sourceName: string; entityType: string; countType: "SOURCE" | "CANDIDATE" | "MIGRATED" | "SKIPPED" | "EXCEPTION" | "VALIDATED"; rowCount: bigint; checksum?: string },
) {
  if (mode !== "execute") throw new Error("Database ledger counts require execute mode");
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.canonicalMigrationBatch.findUniqueOrThrow({ where: { id: batchId } });
    assertLedgerWriteAuthorized(mode, batch.dryRun, batch.approvalReference);
    if (batch.status !== "RUNNING" && batch.status !== "VALIDATING") throw new Error("Counts require an active batch");
    return transaction.canonicalMigrationBatchCount.create({
      data: { id: newCanonicalId(), batchId, ...count },
    });
  });
}

export function readBatch(prisma: PrismaClient, batchId: string) {
  return prisma.canonicalMigrationBatch.findUnique({
    where: { id: batchId },
    include: { counts: true, events: { orderBy: { occurredAt: "asc" } } },
  });
}
import type { PrismaClient } from "@prisma/client";
import { newCanonicalId } from "./identifiers";
