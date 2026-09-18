import { readFile } from "node:fs/promises";
import { captureDatabaseFingerprint } from "../../src/lib/canonical/fingerprint";
import { sha256, stableJson, writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { executeGuardedQueryPack, withReadOnlyDatabase } from "../../src/lib/canonical/read-only-db";
import { auditEnvironment, fail, loadReviewedReconciliation, REVIEWED_RECONCILIATION_SHA256 } from "./common";

async function main() {
  const baselinePath = process.env.WAVE0_BASELINE_MANIFEST;
  if (!baselinePath) throw new Error("WAVE0_BASELINE_MANIFEST is required");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const environment = auditEnvironment();
  const restored = await withReadOnlyDatabase(environment, captureDatabaseFingerprint);
  const restoredReconciliation = await executeGuardedQueryPack(
    environment,
    await loadReviewedReconciliation(),
    REVIEWED_RECONCILIATION_SHA256,
  );
  const source = baseline.fingerprint ?? baseline;
  const sourceReconciliation = baseline.reconciliation?.results;
  if (!Array.isArray(sourceReconciliation)) throw new Error("Baseline reconciliation results are required");
  const sourceComparable = sourceReconciliation.slice(1);
  const restoredComparable = restoredReconciliation.result.results.slice(1);
  const comparisons = {
    schema: source.schemaSha256 === restored.result.schemaSha256,
    migrations: source.migrationHistorySha256 === restored.result.migrationHistorySha256,
    tableCounts: source.tableCountsSha256 === restored.result.tableCountsSha256,
    safeFieldDigests: source.tableIdentityDigestsSha256 === restored.result.tableIdentityDigestsSha256,
    reconciliation: sha256(stableJson(sourceComparable)) === sha256(stableJson(restoredComparable)),
  };
  if (Object.values(comparisons).some((value) => !value)) throw new Error(`Restore fingerprint mismatch: ${JSON.stringify(comparisons)}`);
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave0-restore-verification.json", {
    kind: "lumora-wave0-restore-verification-v1", comparisons, restored: restored.result,
    reconciliationSha256: sha256(stableJson(restoredComparable)),
    session: [restored.evidence, restoredReconciliation.evidence],
  });
  console.log(JSON.stringify(artifact));
}
main().catch(fail);
