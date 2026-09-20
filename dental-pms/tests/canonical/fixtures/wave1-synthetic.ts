import { randomUUID } from "node:crypto";
import { Client } from "pg";

export const TEST_INSTANT = new Date("2026-09-30T18:30:00.000Z");
export const COLOMBO_NEXT_DAY = "2026-10-01";

export async function wave1Client() {
  const connectionString = process.env.WAVE1_TEST_DATABASE_URL;
  if (!connectionString) throw new Error("WAVE1_TEST_DATABASE_URL is required for DB integration tests");
  const url = new URL(connectionString);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) && !url.hostname.endsWith(".internal")) {
    throw new Error("Wave 1 integration tests require disposable local/CI database");
  }
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

export async function insertSyntheticHeader(client: Client, aggregateId = randomUUID(), eventId = randomUUID(), sequence = 1) {
  await client.query(
    `INSERT INTO canonical_event_headers
      ("eventId","domain","eventType","aggregateType","aggregateId","aggregateSequence",
       "idempotencyKey","contentHash","occurredAt","actorType","actorId","migrationClass")
     VALUES ($1,'TEST','SyntheticEvent','TestAggregate',$2,$3,$4,$5,$6,'SYSTEM','wave1-fixture','M4')`,
    [eventId, aggregateId, sequence, randomUUID(), "a".repeat(64), TEST_INSTANT],
  );
  return { eventId, aggregateId };
}
