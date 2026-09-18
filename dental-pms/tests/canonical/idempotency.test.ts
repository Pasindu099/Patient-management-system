import { describe, expect, it } from "vitest";
import { eventIdempotencyKey, simulateIdempotentImport, type SourceCandidate } from "../../src/lib/canonical/idempotency";
import { assertLedgerWriteAuthorized, assertMigrationTransition } from "../../src/lib/canonical/migration-ledger";

const candidate: SourceCandidate = {
  sourceSystem: "fixture", sourceTable: "visits", sourcePrimaryKey: "visit_1",
  targetType: "visit-event", semanticVersionHash: "source-v1", transformationVersion: "wave0-v1", occurrence: "completed",
};

describe("future importer idempotency contract", () => {
  it("does not duplicate a repeated or resumed source", () => {
    const first = simulateIdempotentImport(new Set(), [candidate]);
    const repeat = simulateIdempotentImport(first.keys, [candidate]);
    expect(first.inserted).toBe(1);
    expect(repeat).toMatchObject({ inserted: 0, skipped: 1 });
  });

  it("excludes batch identity and distinguishes an approved correction", () => {
    expect(eventIdempotencyKey(candidate)).toBe(eventIdempotencyKey({ ...candidate }));
    expect(eventIdempotencyKey({ ...candidate, semanticVersionHash: "source-v2" })).not.toBe(eventIdempotencyKey(candidate));
  });

  it("collapses concurrent candidates under the same deterministic key", () => {
    const run = simulateIdempotentImport(new Set(), [candidate, { ...candidate }]);
    expect(run).toMatchObject({ inserted: 1, skipped: 1 });
  });

  it("enforces reviewed ledger lifecycle and execute-only writes", () => {
    expect(() => assertMigrationTransition("APPROVED", "RUNNING")).not.toThrow();
    expect(() => assertMigrationTransition("PLANNED", "COMPLETED")).toThrow();
    expect(() => assertLedgerWriteAuthorized("dry-run", true, "OWNER-1")).toThrow();
    expect(() => assertLedgerWriteAuthorized("execute", false, "OWNER-1")).not.toThrow();
  });
});
