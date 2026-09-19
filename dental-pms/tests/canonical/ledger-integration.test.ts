import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { createAuthorizedBatch, readBatch, recordBatchCount, transitionBatch } from "../../src/lib/canonical/migration-ledger";

const url = process.env.WAVE0_LEDGER_TEST_DATABASE_URL;
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

afterAll(async () => { await prisma?.$disconnect(); });

describe.skipIf(!prisma)("Wave 0 ledger on a disposable database", () => {
  it("writes an approved batch, append-only events, counts, and a terminal read", async () => {
    const database = prisma!;
    const batch = await createAuthorizedBatch(database, "execute", {
      wave: 1, scopeType: "FIXTURE", scopeKey: "wave0-ledger-test",
      sourceSnapshotId: "fixture-snapshot", sourceChecksum: "f".repeat(64),
      buildSha: "wave0-test", actorType: "TEST", approvalReference: "TEST-ONLY",
    });
    const actor = { actorType: "TEST", buildSha: "wave0-test", reason: "fixture transition" };
    for (const next of ["REVIEW_REQUIRED", "APPROVED", "RUNNING"] as const) {
      await transitionBatch(database, "execute", batch.id, next, actor);
    }
    await recordBatchCount(database, "execute", batch.id, {
      sourceName: "fixture", entityType: "synthetic", countType: "SOURCE", rowCount: BigInt(1),
    });
    for (const next of ["VALIDATING", "COMPLETED"] as const) {
      await transitionBatch(database, "execute", batch.id, next, actor);
    }
    const persisted = await readBatch(database, batch.id);
    expect(persisted?.status).toBe("COMPLETED");
    expect(persisted?.counts).toHaveLength(1);
    expect(persisted?.events.map((event) => event.newStatus)).toEqual([
      "PLANNED", "REVIEW_REQUIRED", "APPROVED", "RUNNING", "VALIDATING", "COMPLETED",
    ]);
    await expect(transitionBatch(database, "audit", batch.id, "RUNNING", actor)).rejects.toThrow(/execute mode/);
  });
});
