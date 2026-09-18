import { writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { executeGuardedQueryPack } from "../../src/lib/canonical/read-only-db";
import { auditEnvironment, fail, loadReviewedReconciliation, REVIEWED_RECONCILIATION_SHA256 } from "./common";

async function main() {
  const environment = auditEnvironment();
  const result = await executeGuardedQueryPack(environment, await loadReviewedReconciliation(), REVIEWED_RECONCILIATION_SHA256);
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave0-reconciliation.json", {
    kind: "lumora-wave0-reconciliation-v1", ...result,
  });
  console.log(JSON.stringify(artifact));
}
main().catch(fail);
