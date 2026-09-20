export const ATTRIBUTION_ROLES = {
  "ATTR-D01": { dimension: "DOCTOR", owner: "AppointmentOccurrence", cardinality: "ONE" },
  "ATTR-D02": { dimension: "DOCTOR", owner: "QueueAssignmentSegment", cardinality: "ONE" },
  "ATTR-D03": { dimension: "DOCTOR", owner: "EncounterSegment", cardinality: "ONE" },
  "ATTR-D04": { dimension: "DOCTOR", owner: "TreatmentPerformanceSegment", cardinality: "MANY" },
  "ATTR-D05": { dimension: "DOCTOR", owner: "VisitCompletion", cardinality: "ONE" },
  "ATTR-D06": { dimension: "DOCTOR", owner: "TreatmentPlanVersion", cardinality: "ONE" },
  "ATTR-D07": { dimension: "DOCTOR", owner: "TreatmentContributorVersion", cardinality: "SHARES" },
  "ATTR-D08": { dimension: "DOCTOR", owner: "InvoiceDoctorSet", cardinality: "RELATIONSHIP" },
  "ATTR-D09": { dimension: "DOCTOR", owner: "ProductionAllocationVersion", cardinality: "SHARES" },
  "ATTR-D10": { dimension: "DOCTOR", owner: "PaymentAllocationVersion", cardinality: "SHARES" },
  "ATTR-D11": { dimension: "DOCTOR", owner: "FollowUpRecommendation", cardinality: "ONE" },
  "ATTR-D12": { dimension: "DOCTOR", owner: "PrescriptionIssue", cardinality: "ONE" },
  "ATTR-D13": { dimension: "DOCTOR", owner: "ReferralEvent", cardinality: "MANY" },
  "ATTR-B01": { dimension: "BRANCH", owner: "AppointmentOccurrence", cardinality: "ONE" },
  "ATTR-B02": { dimension: "BRANCH", owner: "QueueArrival", cardinality: "ONE" },
  "ATTR-B03": { dimension: "BRANCH", owner: "EncounterSegment", cardinality: "ONE" },
  "ATTR-B04": { dimension: "BRANCH", owner: "ServiceEvent", cardinality: "ONE" },
  "ATTR-B05": { dimension: "BRANCH", owner: "InvoiceAllocationVersion", cardinality: "SHARES" },
  "ATTR-B06": { dimension: "BRANCH", owner: "CashEvent", cardinality: "ONE" },
  "ATTR-B07": { dimension: "BRANCH", owner: "ExpenseAllocationVersion", cardinality: "SHARES" },
  "ATTR-B08": { dimension: "BRANCH", owner: "StockEvent", cardinality: "ONE" },
  "ATTR-B09": { dimension: "BRANCH", owner: "StaffWorkInterval", cardinality: "ONE" },
  "ATTR-B10": { dimension: "BRANCH", owner: "SalaryPayment", cardinality: "ONE" },
  "ATTR-B11": { dimension: "BRANCH", owner: "SupplierPayment", cardinality: "ONE" },
  "ATTR-B12": { dimension: "BRANCH", owner: "TreatmentPresentation", cardinality: "ONE" },
  "ATTR-B13": { dimension: "BRANCH", owner: "TreatmentAcceptance", cardinality: "ONE" },
} as const;

export type AttributionRole = keyof typeof ATTRIBUTION_ROLES;
export type AttributionState = "ASSIGNED" | "UNASSIGNED" | "UNKNOWN" | "NOT_APPLICABLE";

export function assertAttribution(value: {
  roleCode: string;
  state: AttributionState;
  subjectId?: string | null;
  reasonCode?: string | null;
  evidenceRef?: string | null;
}) {
  if (!(value.roleCode in ATTRIBUTION_ROLES)) throw new Error("Unknown attribution role");
  if (value.state === "ASSIGNED") {
    if (!value.subjectId) throw new Error("Assigned attribution requires a subject");
  } else if (value.subjectId || !value.reasonCode || !value.evidenceRef) {
    throw new Error("Non-assigned attribution requires reason/evidence and no subject");
  }
  return ATTRIBUTION_ROLES[value.roleCode as AttributionRole];
}

export function assertExactShares(basisPoints: readonly number[]) {
  if (!basisPoints.length || basisPoints.some((share) => !Number.isInteger(share) || share < 0) ||
      basisPoints.reduce((sum, share) => sum + share, 0) !== 10_000) {
    throw new Error("Allocation shares including Unassigned must total 10,000 basis points");
  }
}
