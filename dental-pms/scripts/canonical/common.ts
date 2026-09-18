import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCanonicalEnvironment, requireAuditEnvironment } from "../../src/lib/canonical/environment";
import { sha256 } from "../../src/lib/canonical/evidence";

export const REPO_ROOT = path.resolve(process.cwd(), "..");
export const RECONCILIATION_PATH = path.join(REPO_ROOT, "audit", "metrics-2026-09-17", "READ-ONLY-CANONICAL-RECONCILIATION.sql");
export const REVIEWED_RECONCILIATION_SHA256 = "c91295a147182ae6251825e22c31a7895b98aeb872050ee55f8adcad79cd122e";

export async function loadReviewedReconciliation() {
  const sql = await readFile(RECONCILIATION_PATH, "utf8");
  const digest = sha256(sql);
  if (digest !== REVIEWED_RECONCILIATION_SHA256) throw new Error(`Reviewed reconciliation hash changed: ${digest}`);
  return sql;
}

export function auditEnvironment() {
  return requireAuditEnvironment(readCanonicalEnvironment());
}

export function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
