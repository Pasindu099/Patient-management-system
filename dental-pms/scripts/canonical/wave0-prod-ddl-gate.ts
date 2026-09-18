import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertProductionAllowlistsEmpty, readCanonicalEnvironment } from "../../src/lib/canonical/environment";
import { sha256, writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { fail, REPO_ROOT } from "./common";

const REQUIRED_PASS_ARTIFACTS = ["ci", "canonical-tests", "backup", "backup-verification", "restore", "reconciliation", "baseline", "readonly", "flags"];

async function main() {
  const environment = readCanonicalEnvironment();
  if (environment.mode !== "disabled") throw new Error("Production canonical migration mode must be disabled at the DDL gate");
  assertProductionAllowlistsEmpty(environment);
  const evidenceDir = process.env.WAVE0_GATE_EVIDENCE_DIR;
  if (!evidenceDir) throw new Error("WAVE0_GATE_EVIDENCE_DIR is required");
  const evidence: Record<string, { pass: boolean; sha256: string }> = {};
  for (const name of REQUIRED_PASS_ARTIFACTS) {
    const body = await readFile(path.join(evidenceDir, `${name}.json`), "utf8");
    const parsed = JSON.parse(body);
    if (parsed.status !== "PASS") throw new Error(`${name} evidence did not PASS`);
    evidence[name] = { pass: true, sha256: sha256(body) };
  }
  const migrationPath = path.join(REPO_ROOT, "dental-pms", "prisma", "migrations", "20260918190000_wave0_control_plane", "migration.sql");
  const migrationSql = await readFile(migrationPath, "utf8");
  const sqlWithoutComments = migrationSql.replace(/--[^\n]*/g, "");
  if (/^\s*(?:DROP|TRUNCATE|UPDATE|DELETE|INSERT|MERGE|GRANT|REVOKE|CALL|DO|COPY)\b/im.test(sqlWithoutComments)) throw new Error("Migration contains destructive, privileged, or data-mutating SQL statements");
  const expectedTables = [
    "canonical_feature_flag_versions", "canonical_feature_flags", "canonical_migration_batch_counts",
    "canonical_migration_batches", "canonical_migration_run_events",
  ];
  const createdTables = [...migrationSql.matchAll(/CREATE TABLE\s+"([^"]+)"/gi)].map((match) => match[1]).sort();
  if (JSON.stringify(createdTables) !== JSON.stringify(expectedTables)) throw new Error(`Unexpected CREATE TABLE set: ${createdTables.join(", ")}`);
  const expectedTypes = ["CanonicalFeatureControlType", "CanonicalMigrationCountType", "CanonicalMigrationStatus"];
  const createdTypes = [...migrationSql.matchAll(/CREATE TYPE\s+"([^"]+)"/gi)].map((match) => match[1]).sort();
  if (JSON.stringify(createdTypes) !== JSON.stringify(expectedTypes)) throw new Error(`Unexpected CREATE TYPE set: ${createdTypes.join(", ")}`);
  const altered = [...migrationSql.matchAll(/ALTER TABLE\s+"([^"]+)"/gi)].map((match) => match[1]);
  if (altered.some((table) => !table.startsWith("canonical_"))) throw new Error("Migration alters an existing business table");
  const indexedTables = [...migrationSql.matchAll(/CREATE (?:UNIQUE )?INDEX[\s\S]*?\sON\s+"([^"]+)"/gi)].map((match) => match[1]);
  if (indexedTables.some((table) => !table.startsWith("canonical_"))) throw new Error("Migration indexes an existing business table");
  const artifact = await writeEvidenceArtifact(evidenceDir, "w0-prod-ddl-gate.json", {
    gate: "W0-PROD-DDL-GATE", status: "PASS", evidence,
    migrationSqlSha256: sha256(migrationSql), existingBusinessTableChanges: "NONE", businessDataMutations: "NONE",
  });
  console.log(JSON.stringify(artifact));
}
main().catch(fail);
