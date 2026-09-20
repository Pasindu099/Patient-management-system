export type CorrectionKind = "CORRECTION" | "SUPERSESSION" | "REVERSAL" | "VOID";

export function validateCorrection(
  original: { eventId: string; domain: string; aggregateType: string; aggregateId: string },
  replacement: { eventId: string; domain: string; aggregateType: string; aggregateId: string },
  kind: CorrectionKind,
) {
  if (original.eventId === replacement.eventId) throw new Error("Self-correction is forbidden");
  if (original.domain !== replacement.domain || original.aggregateType !== replacement.aggregateType || original.aggregateId !== replacement.aggregateId) {
    throw new Error("Correction requires the same domain and aggregate");
  }
  if (!("CORRECTION SUPERSESSION REVERSAL VOID".split(" ") as string[]).includes(kind)) throw new Error("Invalid correction kind");
  return { originalEventId: original.eventId, replacementEventId: replacement.eventId, kind };
}
