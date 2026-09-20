import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertIdempotentReplay, eventContentHash, newEventId, reserveAggregateSequence } from "../../src/lib/canonical/event-identity";
import { insertSyntheticHeader, TEST_INSTANT, wave1Client } from "./fixtures/wave1-synthetic";

describe("Wave 1 event identity", () => {
  it("uses UUIDs and rejects changed content on replay", () => {
    const first = newEventId();
    expect(first).not.toBe(newEventId());
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    const hash = eventContentHash({ amount: 123 });
    expect(assertIdempotentReplay({ eventId: first, contentHash: hash }, hash)).toBe(first);
    expect(() => assertIdempotentReplay({ eventId: first, contentHash: hash }, eventContentHash({ amount: 124 }))).toThrow();
  });

  it("holds Colombo half-open day boundary independently of UTC recording", () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(TEST_INSTANT);
    const day = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    expect(`${day.year}-${day.month}-${day.day}`).toBe("2026-10-01");
  });
});

describe.skipIf(!process.env.WAVE1_TEST_DATABASE_URL)("Wave 1 identity in PostgreSQL", () => {
  it("serializes aggregate sequence reservations across real concurrent transactions", async () => {
    const first = await wave1Client();
    const second = await wave1Client();
    const aggregateId = randomUUID();
    try {
      await first.query("BEGIN");
      expect(await reserveAggregateSequence(first, "TestAggregate", aggregateId)).toBe(BigInt(1));
      await second.query("BEGIN");
      const waiting = reserveAggregateSequence(second, "TestAggregate", aggregateId);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("COMMIT");
      expect(await waiting).toBe(BigInt(2));
      await second.query("COMMIT");
    } finally {
      await first.query("ROLLBACK");
      await second.query("ROLLBACK");
      await first.end();
      await second.end();
    }
  });

  it("enforces sequence and idempotency uniqueness in the database", async () => {
    const client = await wave1Client();
    try {
      const { aggregateId } = await insertSyntheticHeader(client);
      await expect(insertSyntheticHeader(client, aggregateId, randomUUID(), 1)).rejects.toThrow();
      const idempotencyKey = randomUUID();
      const eventId = randomUUID();
      const beforeInsert = Date.now();
      await client.query(
        `INSERT INTO canonical_event_headers ("eventId","domain","eventType","aggregateType","aggregateId","aggregateSequence","idempotencyKey","contentHash","occurredAt","actorType","actorId","migrationClass")
         VALUES ($1,'TEST','SyntheticEvent','TestAggregate',$2,2,$3,$4,$5,'SYSTEM','wave1-fixture','M4')`,
        [eventId, aggregateId, idempotencyKey, "b".repeat(64), TEST_INSTANT],
      );
      await expect(client.query(
        `INSERT INTO canonical_event_headers ("eventId","domain","eventType","aggregateType","aggregateId","aggregateSequence","idempotencyKey","contentHash","occurredAt","actorType","actorId","migrationClass")
         VALUES ($1,'TEST','SyntheticEvent','TestAggregate',$2,3,$3,$4,$5,'SYSTEM','wave1-fixture','M4')`,
        [randomUUID(), aggregateId, idempotencyKey, "c".repeat(64), TEST_INSTANT],
      )).rejects.toThrow();
      const recorded = await client.query<{ recordedAt: Date }>("SELECT \"recordedAt\" FROM canonical_event_headers WHERE \"eventId\"=$1", [eventId]);
      expect(recorded.rows[0].recordedAt.getTime()).toBeGreaterThanOrEqual(beforeInsert - 1000);
      expect(recorded.rows[0].recordedAt.getTime()).not.toBe(TEST_INSTANT.getTime());
    } finally {
      await client.end();
    }
  });
});
