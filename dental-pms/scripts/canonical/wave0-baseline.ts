import { captureDatabaseFingerprint } from "../../src/lib/canonical/fingerprint";
import { writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { executeGuardedQueryPack, withReadOnlyDatabase } from "../../src/lib/canonical/read-only-db";
import { auditEnvironment, fail, loadReviewedReconciliation, REVIEWED_RECONCILIATION_SHA256 } from "./common";

async function main() {
  const environment = auditEnvironment();
  const sql = await loadReviewedReconciliation();
  const fingerprint = await withReadOnlyDatabase(environment, captureDatabaseFingerprint);
  const reconciliation = await executeGuardedQueryPack(environment, sql, REVIEWED_RECONCILIATION_SHA256);
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave0-baseline.json", {
    kind: "lumora-wave0-baseline-v1",
    fingerprint: fingerprint.result,
    reconciliation: reconciliation.result,
    readOnlyEvidence: [fingerprint.evidence, reconciliation.evidence],
  });
  console.log(JSON.stringify(artifact));
}

main().catch(fail);
