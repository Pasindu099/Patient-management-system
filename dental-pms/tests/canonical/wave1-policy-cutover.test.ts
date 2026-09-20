import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { describe, expect, it } from "vitest";
import { assertCutoverReady, cutoverCanEnableBehavior } from "../../src/lib/canonical/cutover-registry";
import { policyWindowsOverlap } from "../../src/lib/canonical/policy-versions";
import { wave1Client } from "./fixtures/wave1-synthetic";

const jan = new Date("2026-01-01T00:00:00Z");
const feb = new Date("2026-02-01T00:00:00Z");
const mar = new Date("2026-03-01T00:00:00Z");

async function insertPolicy(client: Client, scopeKey: string, version: number, from: Date, to: Date) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO canonical_policy_versions ("policyVersionId","family","scopeType","scopeKey","version","effectiveFrom","effectiveTo","approvalReference","approvedBy","approvedAt","definitionHash")
     VALUES ($1,'ROUNDING','BRANCH',$2,$3,$4,$5,'fixture-approval','fixture-owner',now(),$6)`,
    [id, scopeKey, version, from, to, "a".repeat(64)],
  );
  return id;
}

async function policyTransition(client: Client, id: string, prior: string | null, next: string) {
  await client.query(
    `INSERT INTO canonical_policy_transition_events ("transitionId","policyVersionId","priorStatus","newStatus","actorType","actorId","occurredAt","reasonCode")
     VALUES ($1,$2,$3,$4,'SYSTEM','fixture',now(),'TEST')`,
    [randomUUID(), id, prior, next],
  );
}

describe("Wave 1 policy and cutover contracts", () => {
  it("uses half-open policy intervals", () => {
    expect(policyWindowsOverlap({ from: jan, to: feb }, { from: feb, to: mar })).toBe(false);
    expect(policyWindowsOverlap({ from: jan, to: mar }, { from: feb, to: mar })).toBe(true);
  });
  it("does not activate behavior from a registry record alone", () => {
    expect(assertCutoverReady({ approvalReference: "owner", evidenceManifestHash: "a".repeat(64), migrationClasses: ["M3"] })).toBe(true);
    expect(cutoverCanEnableBehavior(false, true, true)).toBe(false);
  });
});

describe.skipIf(!process.env.WAVE1_TEST_DATABASE_URL)("Wave 1 governance in PostgreSQL", () => {
  it("prevents two concurrent overlapping approved policies but allows adjacent windows", async () => {
    const first = await wave1Client();
    const second = await wave1Client();
    const scope = randomUUID();
    try {
      await first.query("BEGIN");
      const firstId = await insertPolicy(first, scope, 1, jan, mar);
      await policyTransition(first, firstId, null, "APPROVED");
      await second.query("BEGIN");
      const secondId = await insertPolicy(second, scope, 2, feb, mar);
      const blocked = policyTransition(second, secondId, null, "APPROVED");
      await new Promise((resolve) => setTimeout(resolve, 50));
      await first.query("COMMIT");
      await expect(blocked).rejects.toThrow();
      await second.query("ROLLBACK");
      const adjacentId = await insertPolicy(second, scope, 2, mar, new Date("2026-04-01T00:00:00Z"));
      await policyTransition(second, adjacentId, null, "APPROVED");
      const current = await second.query("SELECT count(*)::int AS count FROM canonical_policy_current_states WHERE \"scopeKey\"=$1", [scope]);
      expect(current.rows[0].count).toBe(2);
    } finally {
      await first.query("ROLLBACK");
      await second.query("ROLLBACK");
      await first.end();
      await second.end();
    }
  });

  it("retains cutover history and enforces one active scope", async () => {
    const client = await wave1Client();
    const scope = randomUUID();
    const cutover = randomUUID();
    try {
      await client.query(
        `INSERT INTO canonical_cutover_registry ("cutoverId","domain","scopeType","scopeKey","cutoverAt","migrationClasses","approvalReference","evidenceManifestHash")
         VALUES ($1,'TEST','BRANCH',$2,now(),ARRAY['M4']::"CanonicalMigrationClass"[],'fixture-approval',$3)`,
        [cutover, scope, "a".repeat(64)],
      );
      const transition = (id: string, prior: string | null, next: string) => client.query(
        `INSERT INTO canonical_cutover_transition_events ("transitionId","cutoverId","priorStatus","newStatus","actorType","actorId","activatedBy","activatedAt","occurredAt","reasonCode")
         VALUES ($1,$2,$3,$4,'SYSTEM','fixture',$5,$6,now(),'TEST')`,
        [randomUUID(), id, prior, next, next === "ACTIVE" ? "fixture" : null, next === "ACTIVE" ? new Date() : null],
      );
      await transition(cutover, null, "READY");
      await transition(cutover, "READY", "ACTIVE");
      await expect(transition(cutover, "READY", "ACTIVE")).rejects.toThrow();
      const rows = await client.query("SELECT \"currentStatus\" FROM canonical_cutover_current_states WHERE \"cutoverId\"=$1", [cutover]);
      expect(rows.rows[0].currentStatus).toBe("ACTIVE");
    } finally {
      await client.end();
    }
  });
});
