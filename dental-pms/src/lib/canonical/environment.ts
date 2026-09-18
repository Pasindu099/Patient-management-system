import path from "node:path";

export const CANONICAL_MODES = ["disabled", "audit", "dry-run", "execute"] as const;
export type CanonicalMode = (typeof CANONICAL_MODES)[number];

export type CanonicalEnvironment = {
  mode: CanonicalMode;
  artifactDir: string;
  auditDatabaseUrl?: string;
  auditDatabaseUser?: string;
  allowlists: Record<string, ReadonlySet<string>>;
};

const ALLOWLIST_ENV = {
  WRITE_CAPTURE: "CANONICAL_WRITE_CAPTURE_ALLOWLIST",
  SHADOW_READ: "CANONICAL_SHADOW_READ_ALLOWLIST",
  METRIC_READ: "CANONICAL_METRIC_READ_ALLOWLIST",
  DOMAIN_CUTOVER: "CANONICAL_DOMAIN_CUTOVER_ALLOWLIST",
  ALERT_TYPE: "CANONICAL_ALERT_TYPE_ALLOWLIST",
  UI_SURFACE: "CANONICAL_UI_SURFACE_ALLOWLIST",
} as const;

function parseAllowlist(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function readCanonicalEnvironment(env: Record<string, string | undefined> = process.env): CanonicalEnvironment {
  const rawMode = env.CANONICAL_MIGRATION_MODE ?? "disabled";
  if (!CANONICAL_MODES.includes(rawMode as CanonicalMode)) {
    throw new Error(`Invalid CANONICAL_MIGRATION_MODE: ${rawMode}`);
  }

  const allowlists = Object.fromEntries(
    Object.entries(ALLOWLIST_ENV).map(([key, envName]) => [key, parseAllowlist(env[envName])]),
  );

  return {
    mode: rawMode as CanonicalMode,
    artifactDir: path.resolve(env.CANONICAL_ARTIFACT_DIR ?? ".canonical-artifacts"),
    auditDatabaseUrl: env.AUDIT_DATABASE_URL || undefined,
    auditDatabaseUser: env.AUDIT_DATABASE_USER || undefined,
    allowlists,
  };
}

export function requireAuditEnvironment(env = readCanonicalEnvironment()): CanonicalEnvironment {
  if (!env.auditDatabaseUrl || !env.auditDatabaseUser) {
    throw new Error("AUDIT_DATABASE_URL and AUDIT_DATABASE_USER are required; writer fallback is forbidden");
  }
  if (!new Set<CanonicalMode>(["audit", "dry-run"]).has(env.mode)) {
    throw new Error(`Read-only tooling is disabled in canonical mode ${env.mode}`);
  }
  return env;
}

export function assertProductionAllowlistsEmpty(env = readCanonicalEnvironment()): void {
  const enabled = Object.entries(env.allowlists).filter(([, values]) => values.size > 0);
  if (enabled.length > 0) {
    throw new Error(`Canonical production allowlists must be empty: ${enabled.map(([key]) => key).join(", ")}`);
  }
}
