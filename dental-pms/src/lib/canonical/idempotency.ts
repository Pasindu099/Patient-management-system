import { stableCanonicalId } from "./identifiers";

export type SourceCandidate = {
  sourceSystem: string;
  sourceTable: string;
  sourcePrimaryKey: string;
  targetType: string;
  semanticVersionHash: string;
  transformationVersion: string;
  occurrence: string;
};

export function sourceRecordReference(candidate: SourceCandidate): string {
  return stableCanonicalId(
    "source-record-reference-v1", candidate.sourceSystem, candidate.sourceTable,
    candidate.sourcePrimaryKey, candidate.targetType, candidate.semanticVersionHash,
    candidate.transformationVersion,
  );
}

export function eventIdempotencyKey(candidate: SourceCandidate): string {
  return stableCanonicalId("event-idempotency-v1", candidate.targetType, sourceRecordReference(candidate), candidate.occurrence);
}

export function simulateIdempotentImport(existing: ReadonlySet<string>, candidates: readonly SourceCandidate[]) {
  const keys = new Set(existing);
  let inserted = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const key = eventIdempotencyKey(candidate);
    if (keys.has(key)) skipped += 1;
    else { keys.add(key); inserted += 1; }
  }
  return { keys, inserted, skipped };
}
