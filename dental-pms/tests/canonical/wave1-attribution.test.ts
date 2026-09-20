import { describe, expect, it } from "vitest";
import { ATTRIBUTION_ROLES, assertAttribution, assertExactShares } from "../../src/lib/canonical/attribution";

describe("Wave 1 static attribution contract", () => {
  it("contains exactly the 13 approved doctor and 13 branch roles", () => {
    const codes = Object.keys(ATTRIBUTION_ROLES).sort();
    const expected = ["D", "B"].flatMap((dimension) =>
      Array.from({ length: 13 }, (_, index) => `ATTR-${dimension}${String(index + 1).padStart(2, "0")}`),
    ).sort();
    expect(codes).toEqual(expected);
  });

  it("keeps Assigned, Unassigned, Unknown and Not Applicable distinct", () => {
    expect(assertAttribution({ roleCode: "ATTR-B06", state: "ASSIGNED", subjectId: "branch-a" }).dimension).toBe("BRANCH");
    for (const state of ["UNASSIGNED", "UNKNOWN", "NOT_APPLICABLE"] as const) {
      expect(assertAttribution({ roleCode: "ATTR-D09", state, reasonCode: "NO_EVIDENCE", evidenceRef: "fixture" }).dimension).toBe("DOCTOR");
      expect(() => assertAttribution({ roleCode: "ATTR-D09", state, subjectId: "doctor-a", reasonCode: "NO_EVIDENCE", evidenceRef: "fixture" })).toThrow();
    }
    expect(() => assertAttribution({ roleCode: "ATTR-D04", state: "ASSIGNED" })).toThrow();
    expect(() => assertAttribution({ roleCode: "ATTR-X99", state: "UNKNOWN", reasonCode: "TEST", evidenceRef: "fixture" })).toThrow();
  });

  it("requires exact allocation shares including Unassigned", () => {
    expect(() => assertExactShares([6000, 3000, 1000])).not.toThrow();
    expect(() => assertExactShares([6000, 3000])).toThrow();
  });
});
