import { createHash } from "node:crypto";

export function sourceProvenanceKey(parts: {
  sourceSystem: string;
  sourceEntity: string;
  sourceKey: string;
  sourceVersion: string;
  ruleVersion: string;
  canonicalEventId: string;
}): string {
  if (Object.values(parts).some((value) => !value.trim())) throw new Error("Incomplete source provenance");
  return createHash("sha256").update(Object.values(parts).join("\u001f")).digest("hex");
}

export function assertHistoricalReference(migrationClass: string, batchId: string, eventId: string) {
  if (!(["M1", "M2", "M3"] as string[]).includes(migrationClass) || !batchId || !eventId) {
    throw new Error("Historical source reference requires M1-M3, batch and concrete event header");
  }
}
