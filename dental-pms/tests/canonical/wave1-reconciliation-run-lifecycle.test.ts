import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { assertRunTransition } from "../../src/lib/canonical/data-quality";
import { wave1Client } from "./fixtures/wave1-synthetic";

async function insertRun(client: Client, id: string, key: string, attempt: number, retryOfRunId?: string) {
  await client.query(
    `INSERT INTO canonical_reconciliation_runs ("reconciliationRunId","ruleSetHash","sourceSnapshotId","scopeType","scopeKey","runKey","attempt","retryOfRunId")
     VALUES ($1,$2,'synthetic-snapshot','BRANCH',$3,'synthetic-run',$4,$5)`,
    [id, "a".repeat(64), key, attempt, retryOfRunId ?? null],
  );
}

async function transition(client: Client, runId: string, prior: string | null, next: string, failureCode?: string) {
  await client.query(
    `INSERT INTO canonical_reconciliation_run_events ("eventId","reconciliationRunId","priorStatus","newStatus","occurredAt","actorType","actorId","failureCode")
     VALUES ($1,$2,$3,$4,now(),'SYSTEM','fixture',$5)`,
    [randomUUID(), runId, prior, next, failureCode ?? null],
  );
}

describe("Wave 1 run lifecycle contract", () => {
  it("rejects skipping and terminal rewrites", () => {
    expect(() => assertRunTransition(null, "PLANNED")).not.toThrow();
    expect(() => assertRunTransition("PLANNED", "COMPLETED")).toThrow();
    expect(() => assertRunTransition("FAILED", "RUNNING")).toThrow();
  });
});

describe.skipIf(!process.env.WAVE1_TEST_DATABASE_URL)("Wave 1 run lifecycle in PostgreSQL", () => {
  it("retains failed history and links a new approved retry", async () => {
    const client = await wave1Client();
    const scope = randomUUID();
    const first = randomUUID();
    const retry = randomUUID();
    try {
      await client.query("BEGIN");
      await insertRun(client, first, scope, 1);
      await transition(client, first, null, "PLANNED");
      await client.query("COMMIT");
      await transition(client, first, "PLANNED", "RUNNING");
      await transition(client, first, "RUNNING", "FAILED", "SYNTHETIC_FAILURE");
      await expect(transition(client, first, "FAILED", "RUNNING")).rejects.toThrow();
      await client.query("BEGIN");
      await insertRun(client, retry, scope, 2, first);
      await transition(client, retry, null, "PLANNED");
      await client.query("COMMIT");
      await transition(client, retry, "PLANNED", "RUNNING");
      await transition(client, retry, "RUNNING", "COMPLETED");
      const status = await client.query("SELECT \"currentStatus\" FROM canonical_reconciliation_runs WHERE \"reconciliationRunId\"=$1", [retry]);
      expect(status.rows[0].currentStatus).toBe("COMPLETED");
      const count = await client.query("SELECT count(*)::int AS count FROM canonical_reconciliation_run_events WHERE \"reconciliationRunId\"=$1", [first]);
      expect(count.rows[0].count).toBe(3);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });

  it("rejects a run without its initial PLANNED event at commit", async () => {
    const client = await wave1Client();
    try {
      await client.query("BEGIN");
      await insertRun(client, randomUUID(), randomUUID(), 1);
      await expect(client.query("COMMIT")).rejects.toThrow();
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
