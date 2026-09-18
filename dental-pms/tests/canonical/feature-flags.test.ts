import { describe, expect, it } from "vitest";
import { readCanonicalEnvironment } from "../../src/lib/canonical/environment";
import { allCanonicalCapabilitiesOff, resolveCanonicalFlag, type FeatureFlag } from "../../src/lib/canonical/feature-flags";

const flag: FeatureFlag = {
  key: "finance.invoice.capture",
  controlType: "WRITE_CAPTURE",
  versions: [{ enabled: true, effectiveAt: new Date("2026-01-01T00:00:00Z"), approvalReference: "OWNER-1" }],
};

describe("canonical feature flags", () => {
  it("defaults every capability off", () => {
    const environment = readCanonicalEnvironment({});
    expect(allCanonicalCapabilitiesOff(environment)).toBe(true);
    expect(resolveCanonicalFlag(flag, environment)).toBe(false);
  });

  it("requires exact allowlist, execute mode and approval for writes", () => {
    const environment = readCanonicalEnvironment({ CANONICAL_MIGRATION_MODE: "execute", CANONICAL_WRITE_CAPTURE_ALLOWLIST: flag.key });
    expect(resolveCanonicalFlag(flag, environment, new Date("2026-09-18T00:00:00Z"))).toBe(true);
    expect(resolveCanonicalFlag({ ...flag, key: "finance.other" }, environment)).toBe(false);
    expect(resolveCanonicalFlag({ ...flag, versions: [{ ...flag.versions[0], approvalReference: null }] }, environment)).toBe(false);
  });

  it("keeps writes off in audit and dry-run modes", () => {
    for (const mode of ["audit", "dry-run"]) {
      const environment = readCanonicalEnvironment({ CANONICAL_MIGRATION_MODE: mode, CANONICAL_WRITE_CAPTURE_ALLOWLIST: flag.key });
      expect(resolveCanonicalFlag(flag, environment)).toBe(false);
    }
  });
});
