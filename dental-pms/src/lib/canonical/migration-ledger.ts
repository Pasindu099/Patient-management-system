export type MigrationStatus =
  | "PLANNED" | "DRY_RUN" | "REVIEW_REQUIRED" | "APPROVED" | "RUNNING"
  | "VALIDATING" | "COMPLETED" | "FAILED" | "BLOCKED" | "ROLLED_BACK";

const TRANSITIONS: Record<MigrationStatus, readonly MigrationStatus[]> = {
  PLANNED: ["DRY_RUN", "REVIEW_REQUIRED", "BLOCKED"],
  DRY_RUN: ["REVIEW_REQUIRED", "FAILED", "BLOCKED"],
  REVIEW_REQUIRED: ["APPROVED", "BLOCKED"],
  APPROVED: ["RUNNING", "BLOCKED"],
  RUNNING: ["VALIDATING", "FAILED", "BLOCKED"],
  VALIDATING: ["COMPLETED", "FAILED", "BLOCKED"],
  COMPLETED: [], FAILED: ["ROLLED_BACK"], BLOCKED: ["PLANNED"], ROLLED_BACK: [],
};

export function assertMigrationTransition(prior: MigrationStatus, next: MigrationStatus): void {
  if (!TRANSITIONS[prior].includes(next)) throw new Error(`Invalid migration transition: ${prior} -> ${next}`);
}

export function assertLedgerWriteAuthorized(mode: string, dryRun: boolean, approvalReference?: string | null): void {
  if (mode !== "execute") throw new Error("Database ledger writes require execute mode; dry runs use evidence artifacts");
  if (dryRun) throw new Error("Dry-run ledger writes are forbidden");
  if (!approvalReference) throw new Error("An approval reference is required for an execution ledger write");
}
