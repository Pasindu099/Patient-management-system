export type RunStatus = "PLANNED" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED";
export type ExceptionStatus = "OPEN" | "ACKNOWLEDGED" | "ASSIGNED" | "APPROVED" | "REMEDIATED" | "EXPIRED" | "CLOSED";

const runNext: Record<string, readonly RunStatus[]> = {
  START: ["PLANNED"],
  PLANNED: ["RUNNING"],
  RUNNING: ["COMPLETED", "FAILED", "BLOCKED"],
};

export function assertRunTransition(prior: RunStatus | null, next: RunStatus) {
  if (!runNext[prior ?? "START"]?.includes(next)) throw new Error("Invalid reconciliation run transition");
}

export function assertNamedRule(ruleCode: string) {
  if (!/^[A-Z][A-Z0-9_]+$/.test(ruleCode) || ruleCode === "MISSING_DATA") throw new Error("Specific named rule required");
}

export function exceptionDedupeKey(parts: readonly string[]): string {
  if (parts.length !== 6 || parts.some((part) => !part.trim())) throw new Error("Incomplete exception identity");
  return parts.join("\u001f");
}
