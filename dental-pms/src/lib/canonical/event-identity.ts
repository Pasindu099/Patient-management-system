import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";

export function newEventId(): string {
  return randomUUID();
}

const NON_SEMANTIC_FIELDS = new Set(["eventId", "recordedAt", "insertionOrder", "migrationExecutionTimestamp"]);

function canonicalSemanticJson(value: unknown, seen: WeakSet<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Semantic content requires finite numbers");
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid semantic timestamp");
    return JSON.stringify(value.toISOString());
  }
  if (typeof value !== "object") throw new Error("Semantic content must be JSON-compatible");
  if (seen.has(value)) throw new Error("Cyclic semantic content is not supported");
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalSemanticJson(item, seen)).join(",")}]`;
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error("Semantic content must use plain objects");
    }
    return `{${Object.keys(value).sort().map((key) => {
      if (NON_SEMANTIC_FIELDS.has(key)) throw new Error(`System-generated field is not semantic content: ${key}`);
      return `${JSON.stringify(key)}:${canonicalSemanticJson((value as Record<string, unknown>)[key], seen)}`;
    }).join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

export function eventContentHash(semanticContent: unknown): string {
  const canonical = canonicalSemanticJson(semanticContent, new WeakSet());
  const digest = createHash("sha256").update(`lumora-canonical-content:v1\n${canonical}`, "utf8").digest("hex");
  return `sha256:v1:${digest}`;
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
