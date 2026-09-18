import type { CanonicalEnvironment } from "./environment";

export type CanonicalControlType =
  | "WRITE_CAPTURE"
  | "SHADOW_READ"
  | "METRIC_READ"
  | "DOMAIN_CUTOVER"
  | "ALERT_TYPE"
  | "UI_SURFACE";

export type FeatureFlagVersion = {
  enabled: boolean;
  effectiveAt: Date;
  expiresAt?: Date | null;
  approvalReference?: string | null;
};

export type FeatureFlag = {
  key: string;
  controlType: CanonicalControlType;
  versions: readonly FeatureFlagVersion[];
};

export function resolveCanonicalFlag(
  flag: FeatureFlag | null | undefined,
  environment: CanonicalEnvironment,
  now = new Date(),
): boolean {
  if (!flag || environment.mode === "disabled") return false;
  if (!environment.allowlists[flag.controlType]?.has(flag.key)) return false;

  const version = [...flag.versions]
    .filter((candidate) => candidate.effectiveAt <= now)
    .sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime())[0];

  if (!version?.enabled || !version.approvalReference) return false;
  if (version.expiresAt && version.expiresAt <= now) return false;
  if (flag.controlType === "WRITE_CAPTURE" && environment.mode !== "execute") return false;
  if (flag.controlType === "DOMAIN_CUTOVER" && environment.mode !== "execute") return false;
  return true;
}

export function allCanonicalCapabilitiesOff(environment: CanonicalEnvironment): boolean {
  return Object.values(environment.allowlists).every((values) => values.size === 0);
}
