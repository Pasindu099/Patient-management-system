import { describe, expect, it } from "vitest";
import expected from "./fixtures/golden-expected.json";
import { boundaryFixtures, COLOMBO_BOUNDARY, goldenFixtures } from "./fixtures/golden-fixtures";
import { stableJson } from "../../src/lib/canonical/evidence";

describe("Wave 0 golden fixtures", () => {
  it("contains every approved synthetic scenario exactly once", () => {
    expect(goldenFixtures.map((fixture) => fixture.id)).toEqual(expected.requiredIds);
    expect(new Set(goldenFixtures.map((fixture) => fixture.id)).size).toBe(expected.fixtureCount);
    for (const fixture of goldenFixtures) {
      expect(fixture.expected).toEqual(expected.expectedById[fixture.id as keyof typeof expected.expectedById]);
    }
  });

  it("pins the Colombo month boundary", () => {
    expect(COLOMBO_BOUNDARY.januaryEndUtc).toBe(expected.colomboJanuaryEndUtc);
    expect(COLOMBO_BOUNDARY.februaryStartUtc).toBe(expected.colomboFebruaryStartUtc);
    expect(new Date(COLOMBO_BOUNDARY.februaryStartUtc).getTime() - new Date(COLOMBO_BOUNDARY.januaryEndUtc).getTime()).toBe(1);
    expect(stableJson({ at: new Date(COLOMBO_BOUNDARY.februaryStartUtc) })).toContain(COLOMBO_BOUNDARY.februaryStartUtc);
  });

  it("preserves money, attribution and inventory invariants", () => {
    const contribution = goldenFixtures.find((fixture) => fixture.id === "GF-006")!;
    const inventory = goldenFixtures.find((fixture) => fixture.id === "GF-014")!;
    expect(contribution.expected.totalBasisPoints).toBe(10000);
    expect(inventory.expected.valueCents).toBeNull();
    expect(boundaryFixtures.knownZeroMoneyCents).toBe(0);
    expect(boundaryFixtures.unknownMoneyCents).toBeNull();
    expect(new Date(boundaryFixtures.leapDayUtc).getUTCDate()).toBe(29);
  });
});
