import { describe, expect, it } from "vitest";
import { readCanonicalEnvironment, requireAuditEnvironment } from "../../src/lib/canonical/environment";
import { guardReadOnlySql } from "../../src/lib/canonical/sql-guard";

describe("canonical read-only controls", () => {
  it("fails closed without a dedicated audit connection", () => {
    expect(() => requireAuditEnvironment(readCanonicalEnvironment({ CANONICAL_MIGRATION_MODE: "audit" }))).toThrow(/required/);
  });

  it("accepts ordinary reviewed selects", () => {
    expect(guardReadOnlySql("SELECT count(*) FROM patients").statementCount).toBe(1);
  });

  it.each([
    "INSERT INTO patients (id) VALUES ('x')",
    "UPDATE patients SET id = id",
    "DELETE FROM patients",
    "TRUNCATE patients",
    "SELECT * FROM patients FOR UPDATE",
    "WITH removed AS (DELETE FROM patients RETURNING *) SELECT * FROM removed",
    "SELECT pg_sleep(1)",
    "DO $$ BEGIN RAISE NOTICE 'x'; END $$",
  ])("rejects unsafe SQL: %s", (sql) => expect(() => guardReadOnlySql(sql)).toThrow());

  it("pins the complete query pack hash", () => {
    expect(() => guardReadOnlySql("SELECT 1", "00")).toThrow(/hash mismatch/);
  });

  it("rejects unreviewed psql commands", () => {
    expect(() => guardReadOnlySql("\\copy patients to '/tmp/x'\nSELECT 1;")).toThrow(/meta-command/);
  });
});
