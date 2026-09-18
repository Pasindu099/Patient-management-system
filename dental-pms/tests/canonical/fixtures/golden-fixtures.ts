export type GoldenFixture = {
  id: string;
  scenario: string;
  expected: Record<string, string | number | boolean | null>;
};

export const COLOMBO_BOUNDARY = {
  januaryEndUtc: "2026-01-31T18:29:59.999Z",
  februaryStartUtc: "2026-01-31T18:30:00.000Z",
};

export const goldenFixtures: GoldenFixture[] = [
  { id: "GF-001", scenario: "normal-invoice-payment", expected: { invoiceCents: 10000, paymentCents: 10000, balanceCents: 0 } },
  { id: "GF-002", scenario: "partial-payment-boundary", expected: { invoiceCents: 10000, januaryPaidCents: 4000, februaryPaidCents: 6000 } },
  { id: "GF-003", scenario: "reversal-refund", expected: { originalCents: 10000, reversalCents: -10000, refundCents: -2500 } },
  { id: "GF-004", scenario: "unassigned-branch", expected: { branch: "Unassigned", clinicCount: 1 } },
  { id: "GF-005", scenario: "unassigned-doctor", expected: { doctor: "Unassigned", completedCount: 1 } },
  { id: "GF-006", scenario: "multi-doctor-contribution", expected: { firstBasisPoints: 3333, secondBasisPoints: 3333, thirdBasisPoints: 3334, totalBasisPoints: 10000 } },
  { id: "GF-007", scenario: "multi-branch-lifecycle", expected: { presentationBranch: "branch_a", acceptanceBranch: "branch_b", serviceBranch: "branch_c" } },
  { id: "GF-008", scenario: "rescheduled-appointment", expected: { originalClosed: true, newOccurrence: true, outcomes: 2 } },
  { id: "GF-009", scenario: "no-show-corrected", expected: { originalPreserved: true, latestOutcome: "ARRIVED" } },
  { id: "GF-010", scenario: "queue-transfer", expected: { segments: 2, overlaps: 0 } },
  { id: "GF-011", scenario: "visit-reopen-correction", expected: { events: 3, historicalCompletionPreserved: true } },
  { id: "GF-012", scenario: "payroll-proration", expected: { januaryDays: 31, februaryDays: 28, rounding: "half-away-from-zero" } },
  { id: "GF-013", scenario: "inventory-lifecycle", expected: { opening: 10, receipt: 5, transferOut: 3, consumed: 2, closing: 10 } },
  { id: "GF-014", scenario: "unknown-inventory-cost", expected: { quantity: 10, valueCents: null, coverage: "UNKNOWN" } },
  { id: "GF-015", scenario: "alert-lifecycle", expected: { episodes: 1, duplicateSuppressed: true, finalState: "RESOLVED" } },
];

export const boundaryFixtures = {
  knownZeroMoneyCents: 0,
  unknownMoneyCents: null,
  leapDayUtc: "2028-02-29T00:00:00.000Z",
  monthEndDueDate: "2026-02-28",
  futureAppointmentUtc: "2027-01-01T03:30:00.000Z",
  concurrentCandidates: 2,
  partialResumeCheckpoint: "fixture-row-0007",
};
