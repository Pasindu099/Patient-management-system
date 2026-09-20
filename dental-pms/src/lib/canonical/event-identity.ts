import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";

export function newEventId(): string {
  return randomUUID();
}

export function eventContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertIdempotentReplay(existing: { eventId: string; contentHash: string }, contentHash: string): string {
  if (existing.contentHash !== contentHash) throw new Error("Idempotency key reused with different content");
  return existing.eventId;
}

// The caller owns a transaction that also inserts a typed child and header.
export async function reserveAggregateSequence(client: Client, aggregateType: string, aggregateId: string): Promise<bigint> {
  if (!aggregateType.trim()) throw new Error("Aggregate type is required");
  const result = await client.query<{ nextSequence: string }>(
    `INSERT INTO canonical_aggregate_sequences ("aggregateType", "aggregateId", "nextSequence")
     VALUES ($1, $2, 1)
     ON CONFLICT ("aggregateType", "aggregateId")
     DO UPDATE SET "nextSequence" = canonical_aggregate_sequences."nextSequence" + 1
     RETURNING "nextSequence"`,
    [aggregateType, aggregateId],
  );
  return BigInt(result.rows[0].nextSequence);
}
