import { eventContentHash, newEventId } from "./event-identity";

export type EventHeaderDraft = {
  domain: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  occurredAt: Date;
  actorType: string;
  actorId: string;
  migrationClass: "M1" | "M2" | "M3" | "M4";
  migrationBatchId?: string;
  sourceProvenanceKey?: string;
};

// Validation only. A future typed domain owner must supply the transactional writer.
export function prepareEventHeader(draft: EventHeaderDraft, typedContent: unknown) {
  for (const key of ["domain", "eventType", "aggregateType", "aggregateId", "idempotencyKey", "actorType", "actorId"] as const) {
    if (!draft[key].trim()) throw new Error(`Missing event field: ${key}`);
  }
  if (Number.isNaN(draft.occurredAt.getTime())) throw new Error("Invalid occurredAt");
  if (draft.migrationClass !== "M4" && (!draft.migrationBatchId || !draft.sourceProvenanceKey)) {
    throw new Error("Historical event requires batch and source provenance");
  }
  return { ...draft, eventId: newEventId(), contentHash: eventContentHash(typedContent) };
}
