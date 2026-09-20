import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertNamedRule, exceptionDedupeKey } from "../../src/lib/canonical/data-quality";
import { wave1Client } from "./fixtures/wave1-synthetic";

describe("Wave 1 data-quality contract", () => {
  it("requires a specific named rule and stable episode key", () => {
    expect(() => assertNamedRule("FIN_PAYMENT_LEDGER_MISSING")).not.toThrow();
    expect(() => assertNamedRule("MISSING_DATA")).toThrow();
    expect(exceptionDedupeKey(["rule", "source", "entity", "key", "scope", "episode"])).toBe(
      exceptionDedupeKey(["rule", "source", "entity", "key", "scope", "episode"]),
    );
  });
});

describe.skipIf(!process.env.WAVE1_TEST_DATABASE_URL)("Wave 1 exception lifecycle in PostgreSQL", () => {
  it("dedupes an episode and preserves lifecycle history", async () => {
    const client = await wave1Client();
    const ruleId = randomUUID();
    const exceptionId = randomUUID();
    const sourceKey = randomUUID();
    try {
      await client.query(
        `INSERT INTO canonical_reconciliation_rule_versions ("ruleVersionId","ruleCode","version","domain","scopeType","scopeKey","definitionHash","severity","ownerQueue","effectiveFrom","approvalReference")
         VALUES ($1,'FIN_PAYMENT_LEDGER_MISSING',1,'FINANCE','GLOBAL',$2,$3,'HIGH','DATA',now(),'fixture')`,
        [ruleId, randomUUID(), "a".repeat(64)],
      );
      const insertException = (id: string) => client.query(
        `INSERT INTO canonical_data_quality_exceptions ("exceptionId","ruleVersionId","sourceSystem","sourceEntity","sourceKey","scopeKey","episodeKey","detectedAt","severity","impactCode","ownerQueue")
         VALUES ($1,$2,'PMS','Payment',$3,'GLOBAL','episode-1',now(),'HIGH','RECONCILIATION','DATA')`,
        [id, ruleId, sourceKey],
      );
      await insertException(exceptionId);
      await expect(insertException(randomUUID())).rejects.toThrow();
      const transition = (prior: string | null, next: string) => client.query(
        `INSERT INTO canonical_exception_lifecycle_events ("eventId","exceptionId","priorStatus","newStatus","actorType","actorId","occurredAt","reasonCode")
         VALUES ($1,$2,$3,$4,'SYSTEM','fixture',now(),'SYNTHETIC')`,
        [randomUUID(), exceptionId, prior, next],
      );
      await transition(null, "OPEN");
      await transition("OPEN", "ACKNOWLEDGED");
      await expect(transition("OPEN", "CLOSED")).rejects.toThrow();
      const current = await client.query("SELECT \"currentStatus\" FROM canonical_data_quality_exceptions WHERE \"exceptionId\"=$1", [exceptionId]);
      expect(current.rows[0].currentStatus).toBe("ACKNOWLEDGED");
    } finally {
      await client.end();
    }
  });
});
