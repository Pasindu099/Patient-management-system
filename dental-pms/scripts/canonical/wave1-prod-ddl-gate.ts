import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "../../src/lib/canonical/evidence";
import { WAVE1_TABLES } from "./wave1-baseline";
import { fail } from "./common";

export const WAVE1_MIGRATION_SHA256 = "384068a451c470d5b40e5d40fb44c326c3517875e7620ffd33ebea5183466568";
const MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260919213000_wave1_core_infrastructure/migration.sql");

export async function reviewWave1Sql() {
  const sql = await readFile(MIGRATION, "utf8");
  const digest = sha256(sql);
  if (digest !== WAVE1_MIGRATION_SHA256) throw new Error(`Unreviewed Wave 1 migration SHA: ${digest}`);
  const tables = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]).sort();
  if (JSON.stringify(tables) !== JSON.stringify([...WAVE1_TABLES].sort())) throw new Error("Wave 1 table allowlist mismatch");
  const allowedTypes = new Set([
    "CanonicalMigrationClass", "CanonicalCorrectionKind", "CanonicalGovernanceStatus",
    "CanonicalReconciliationStatus", "CanonicalExceptionStatus", "CanonicalAttributionState",
  ]);
  const types = [...sql.matchAll(/CREATE TYPE "([^"]+)"/g)].map((match) => match[1]);
  if (types.length !== allowedTypes.size || types.some((type) => !allowedTypes.has(type))) throw new Error("Wave 1 enum allowlist mismatch");
  for (const match of sql.matchAll(/ALTER TABLE "([^"]+)"/g)) {
    if (!WAVE1_TABLES.includes(match[1] as (typeof WAVE1_TABLES)[number])) throw new Error(`Legacy ALTER TABLE forbidden: ${match[1]}`);
  }
  for (const match of sql.matchAll(/\b(?:INSERT INTO|UPDATE)\s+"?(canonical_[a-z_]+)"?/g)) {
    if (!["canonical_policy_current_states", "canonical_cutover_current_states", "canonical_reconciliation_runs", "canonical_data_quality_exceptions"].includes(match[1])) {
      throw new Error(`Unapproved Wave 1 DML target: ${match[1]}`);
    }
  }
  if (/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i.test(sql)) throw new Error("Destructive Wave 1 SQL forbidden");
  return { migrationSha256: digest, tables, enums: types.sort() };
}

type GateEvidence = {
  wave0Accepted: boolean;
  namedApprovers: boolean;
  implementationApprovalReference: string;
  offVps: { artifactSha256: string; destination: string; retention: string; access: string; encryption: string; keySeparation: string; retrievalVerified: boolean; restoreLineage: string };
  currentBackup: { artifactSha256: string; provenance: string };
  restorePassed: boolean;
  freshDbPassed: boolean;
  zeroRowsPassed: boolean;
  objectManifestPassed: boolean;
  ciPassed: boolean;
  concurrencyPassed: boolean;
  securityPassed: boolean;
  baselineCaptured: boolean;
  flagsOff: boolean;
  noWriterRoute: boolean;
};

async function main() {
  const staticReview = await reviewWave1Sql();
  if (process.argv.includes("--static-only")) {
    console.log(JSON.stringify({ status: "STATIC_SCOPE_PASS", ...staticReview }));
    return;
  }
  const evidencePath = process.env.WAVE1_GATE_EVIDENCE;
  if (!evidencePath) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "WAVE1_GATE_EVIDENCE not supplied", ...staticReview }));
    return;
  }
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as GateEvidence;
  const checks: Record<string, boolean> = {
    wave0Accepted: evidence.wave0Accepted && evidence.namedApprovers,
    implementationApproval: Boolean(evidence.implementationApprovalReference),
    independentRecovery: Boolean(evidence.offVps?.artifactSha256 && evidence.offVps?.destination && evidence.offVps?.retention &&
      evidence.offVps?.access && evidence.offVps?.encryption && evidence.offVps?.keySeparation &&
      evidence.offVps?.retrievalVerified && evidence.offVps?.restoreLineage),
    currentBackup: Boolean(evidence.currentBackup?.artifactSha256 && evidence.currentBackup?.provenance),
    restorePassed: evidence.restorePassed,
    freshDbPassed: evidence.freshDbPassed && evidence.zeroRowsPassed && evidence.objectManifestPassed,
    testsPassed: evidence.ciPassed && evidence.concurrencyPassed && evidence.securityPassed,
    baselineCaptured: evidence.baselineCaptured,
    dormant: evidence.flagsOff && evidence.noWriterRoute,
  };
  const blocked = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  console.log(JSON.stringify({ status: blocked.length ? "BLOCKED" : "PASS", blocked, checks, ...staticReview }));
}

if (process.argv[1]?.includes("wave1-prod-ddl-gate")) main().catch(fail);
