import { readFile } from "node:fs/promises";
import { captureDatabaseFingerprint } from "../../src/lib/canonical/fingerprint";
import { sha256, stableJson, writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { executeGuardedQueryPack, withReadOnlyDatabase } from "../../src/lib/canonical/read-only-db";
import { auditEnvironment, fail, loadReviewedReconciliation, REVIEWED_RECONCILIATION_SHA256 } from "./common";
import { captureWave1Tables } from "./wave1-baseline";

async function main() {
  const baselinePath = process.env.WAVE1_SOURCE_BASELINE_MANIFEST;
  if (!baselinePath) throw new Error("WAVE1_SOURCE_BASELINE_MANIFEST is required");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const environment = auditEnvironment();
  const restored = await withReadOnlyDatabase(environment, captureDatabaseFingerprint);
  const restoredReconciliation = await executeGuardedQueryPack(
    environment, await loadReviewedReconciliation(), REVIEWED_RECONCILIATION_SHA256,
  );
  const phase = process.env.WAVE1_RESTORE_PHASE === "post" ? "empty" : "absent";
  const wave1Tables = await withReadOnlyDatabase(environment, (client) => captureWave1Tables(client, phase));
  const source = baseline.fingerprint ?? baseline;
  const sourceReconciliation = baseline.reconciliation?.results;
  if (!Array.isArray(sourceReconciliation)) throw new Error("Source reconciliation results are required");
  const comparisons = {
    schema: source.schemaSha256 === restored.result.schemaSha256,
    migrations: source.migrationHistorySha256 === restored.result.migrationHistorySha256,
    tableCounts: source.tableCountsSha256 === restored.result.tableCountsSha256,
    safeFieldDigests: source.tableIdentityDigestsSha256 === restored.result.tableIdentityDigestsSha256,
    reconciliation: sha256(stableJson(sourceReconciliation.slice(1))) ===
      sha256(stableJson(restoredReconciliation.result.results.slice(1))),
    wave1Tables: phase === "absent" ? wave1Tables.result.tables.length === 0 :
      Object.values(wave1Tables.result.counts).every((count) => count === 0),
  };
  if (Object.values(comparisons).some((passed) => !passed)) throw new Error(`Wave 1 restore mismatch: ${JSON.stringify(comparisons)}`);
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave1-restore-verification.json", {
    kind: "lumora-wave1-restore-verification-v1", phase, comparisons,
    restored: restored.result, wave1Tables: wave1Tables.result,
    reconciliationSha256: sha256(stableJson(restoredReconciliation.result.results.slice(1))),
    sessions: [restored.evidence, restoredReconciliation.evidence, wave1Tables.evidence],
  });
  console.log(JSON.stringify(artifact));
}

main().catch(fail);
