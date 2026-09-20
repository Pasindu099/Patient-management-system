import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateCorrection } from "../../src/lib/canonical/corrections";
import { assertHistoricalReference, sourceProvenanceKey } from "../../src/lib/canonical/provenance";
import { insertSyntheticHeader, wave1Client } from "./fixtures/wave1-synthetic";

describe("Wave 1 provenance and correction contracts", () => {
  it("requires concrete header and batch identity for historical references", () => {
    expect(() => assertHistoricalReference("M1", "batch", "event")).not.toThrow();
    expect(() => assertHistoricalReference("M1", "", "event")).toThrow();
    expect(() => assertHistoricalReference("M4", "batch", "event")).toThrow();
    const parts = { sourceSystem: "PMS", sourceEntity: "Visit", sourceKey: "123", sourceVersion: "1", ruleVersion: "v1", canonicalEventId: randomUUID() };
    expect(sourceProvenanceKey(parts)).toBe(sourceProvenanceKey(parts));
  });

  it("rejects self and cross-aggregate corrections", () => {
    const original = { eventId: randomUUID(), domain: "TEST", aggregateType: "Test", aggregateId: randomUUID() };
    expect(() => validateCorrection(original, original, "CORRECTION")).toThrow();
    expect(() => validateCorrection(original, { ...original, eventId: randomUUID(), aggregateId: randomUUID() }, "CORRECTION")).toThrow();
  });
});

describe.skipIf(!process.env.WAVE1_TEST_DATABASE_URL)("Wave 1 correction graph in PostgreSQL", () => {
  it("rejects cycles and immutable-history updates", async () => {
    const client = await wave1Client();
    const aggregateId = randomUUID();
    try {
      const a = await insertSyntheticHeader(client, aggregateId, randomUUID(), 1);
      const b = await insertSyntheticHeader(client, aggregateId, randomUUID(), 2);
      const c = await insertSyntheticHeader(client, aggregateId, randomUUID(), 3);
      const link = (original: string, replacement: string) => client.query(
        `INSERT INTO canonical_event_corrections ("correctionId","originalEventId","replacementEventId","kind","reasonCode","evidenceRef","approverType","approverId","occurredAt")
         VALUES ($1,$2,$3,'CORRECTION','SYNTHETIC','fixture','SYSTEM','fixture',now())`,
        [randomUUID(), original, replacement],
      );
      await link(a.eventId, b.eventId);
      await link(b.eventId, c.eventId);
      await expect(link(c.eventId, a.eventId)).rejects.toThrow();
      await expect(client.query("UPDATE canonical_event_headers SET \"actorId\"='changed' WHERE \"eventId\"=$1", [a.eventId])).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  it("rejects a source reference without its concrete event and batch FKs", async () => {
    const client = await wave1Client();
    try {
      await expect(client.query(
        `INSERT INTO canonical_source_record_references ("referenceId","canonicalEventId","sourceSystem","sourceEntity","sourceKey","sourceChecksum","sourceProvenanceKey","observedAt","migrationClass","migrationBatchId")
         VALUES ($1,$2,'PMS','Visit','synthetic','hash','provenance',now(),'M1',$3)`,
        [randomUUID(), randomUUID(), randomUUID()],
      )).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});
