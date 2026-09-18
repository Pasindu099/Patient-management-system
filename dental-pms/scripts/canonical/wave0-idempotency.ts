import { sha256, stableJson, writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { simulateIdempotentImport, type SourceCandidate } from "../../src/lib/canonical/idempotency";
import { readCanonicalEnvironment } from "../../src/lib/canonical/environment";
import { fail } from "./common";

export const IDEMPOTENCY_CANDIDATES: SourceCandidate[] = [
  { sourceSystem: "fixture", sourceTable: "invoice", sourcePrimaryKey: "1", targetType: "invoice-event", semanticVersionHash: "v1", transformationVersion: "w0", occurrence: "issued" },
  { sourceSystem: "fixture", sourceTable: "payment", sourcePrimaryKey: "1", targetType: "payment-event", semanticVersionHash: "v1", transformationVersion: "w0", occurrence: "received" },
];

async function main() {
  const first = simulateIdempotentImport(new Set(), IDEMPOTENCY_CANDIDATES);
  const second = simulateIdempotentImport(first.keys, IDEMPOTENCY_CANDIDATES);
  if (first.inserted !== 2 || second.inserted !== 0 || second.skipped !== 2) throw new Error("Idempotency contract failed");
  const evidence = { first: { inserted: first.inserted, skipped: first.skipped }, second: { inserted: second.inserted, skipped: second.skipped }, candidateHash: sha256(stableJson(IDEMPOTENCY_CANDIDATES)) };
  const artifact = await writeEvidenceArtifact(readCanonicalEnvironment().artifactDir, "wave0-idempotency.json", evidence);
  console.log(JSON.stringify(artifact));
}
main().catch(fail);
