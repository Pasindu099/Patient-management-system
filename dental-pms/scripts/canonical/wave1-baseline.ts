import { Client } from "pg";
import path from "node:path";
import { writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { withReadOnlyDatabase } from "../../src/lib/canonical/read-only-db";
import { auditEnvironment, fail } from "./common";

export const WAVE1_TABLES = [
  "canonical_event_headers", "canonical_aggregate_sequences", "canonical_event_corrections",
  "canonical_source_record_references", "canonical_policy_versions", "canonical_policy_transition_events",
  "canonical_policy_current_states", "canonical_cutover_registry", "canonical_cutover_transition_events",
  "canonical_cutover_current_states", "canonical_reconciliation_rule_versions", "canonical_reconciliation_runs",
  "canonical_reconciliation_run_events", "canonical_data_quality_exceptions", "canonical_exception_lifecycle_events",
  "canonical_exception_evidence", "canonical_approved_exception_versions",
] as const;

export async function captureWave1Tables(client: Client, expected: "absent" | "empty") {
  const catalog = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'canonical_%' ORDER BY tablename",
  );
  const found = catalog.rows.map((row) => row.tablename);
  const wave1Found = found.filter((name) => ![
    "canonical_migration_batches", "canonical_migration_batch_counts", "canonical_migration_run_events",
    "canonical_feature_flags", "canonical_feature_flag_versions",
  ].includes(name));
  if (wave1Found.length !== (expected === "empty" ? WAVE1_TABLES.length : 0) ||
      wave1Found.some((name) => !WAVE1_TABLES.includes(name as (typeof WAVE1_TABLES)[number]))) {
    throw new Error(`Wave 1 table allowlist mismatch: ${wave1Found.join(",")}`);
  }
  const counts: Record<string, number> = {};
  if (expected === "empty") {
    for (const table of WAVE1_TABLES) {
      const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM "${table}"`);
      counts[table] = Number(result.rows[0].count);
      if (counts[table] !== 0) throw new Error(`${table} must contain zero rows`);
    }
  }
  return { expected, tables: wave1Found, counts };
}

export async function captureWave1Objects(client: Client) {
  const tables = [...WAVE1_TABLES];
  const enums = await client.query<{ name: string }>(
    `SELECT typname AS name FROM pg_type WHERE typname = ANY($1::text[]) ORDER BY typname`,
    [["CanonicalMigrationClass", "CanonicalCorrectionKind", "CanonicalGovernanceStatus",
      "CanonicalReconciliationStatus", "CanonicalExceptionStatus", "CanonicalAttributionState"]],
  );
  const indexes = await client.query<{ table: string; name: string; definition: string }>(
    `SELECT tablename AS "table", indexname AS name, indexdef AS definition
     FROM pg_indexes WHERE schemaname='public' AND tablename = ANY($1::text[]) ORDER BY tablename,indexname`, [tables],
  );
  const constraints = await client.query<{ table: string; name: string; kind: string; definition: string }>(
    `SELECT c.relname AS "table", con.conname AS name, con.contype::text AS kind, pg_get_constraintdef(con.oid) AS definition
     FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname = ANY($1::text[]) ORDER BY c.relname,con.conname`, [tables],
  );
  const triggers = await client.query<{ table: string; name: string; definition: string }>(
    `SELECT c.relname AS "table", t.tgname AS name, pg_get_triggerdef(t.oid) AS definition
     FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname = ANY($1::text[]) ORDER BY c.relname,t.tgname`, [tables],
  );
  const functions = await client.query<{ name: string }>(
    `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname LIKE 'canonical_w1_%' ORDER BY p.proname`,
  );
  const grants = await client.query<{ table: string; grantee: string; privilege: string }>(
    `SELECT table_name AS "table", grantee, privilege_type AS privilege FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name = ANY($1::text[]) AND grantee='lumora_audit_ro'
     ORDER BY table_name,privilege_type`, [tables],
  );
  const auditRole = await client.query<{ present: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='lumora_audit_ro') AS present",
  );
  if (auditRole.rows[0].present) {
    if (grants.rows.length !== tables.length || grants.rows.some((grant) => grant.privilege !== "SELECT")) {
      throw new Error("Audit role must have exactly one SELECT grant on each Wave 1 table");
    }
    const permissions = await client.query<{ table: string; canSelect: boolean; canInsert: boolean; canUpdate: boolean; canDelete: boolean }>(
      `SELECT name AS "table", has_table_privilege('lumora_audit_ro', format('public.%I', name), 'SELECT') AS "canSelect",
        has_table_privilege('lumora_audit_ro', format('public.%I', name), 'INSERT') AS "canInsert",
        has_table_privilege('lumora_audit_ro', format('public.%I', name), 'UPDATE') AS "canUpdate",
        has_table_privilege('lumora_audit_ro', format('public.%I', name), 'DELETE') AS "canDelete"
       FROM unnest($1::text[]) AS name`, [tables],
    );
    if (permissions.rows.some((row) => !row.canSelect || row.canInsert || row.canUpdate || row.canDelete)) {
      throw new Error("Audit role Wave 1 table privileges are not read-only");
    }
    const elevated = await client.query<{ elevated: boolean }>(
      "SELECT has_schema_privilege('lumora_audit_ro', 'public', 'CREATE') OR has_database_privilege('lumora_audit_ro', current_database(), 'CREATE') OR has_database_privilege('lumora_audit_ro', current_database(), 'TEMP') AS elevated",
    );
    if (elevated.rows[0].elevated) throw new Error("Audit role has CREATE or TEMP privilege");
  }
  return {
    enums: enums.rows,
    indexes: indexes.rows,
    constraints: constraints.rows,
    triggers: triggers.rows,
    functions: functions.rows,
    grants: grants.rows,
    auditRolePresent: auditRole.rows[0].present,
  };
}

async function main() {
  const expected = process.argv[2] === "post" ? "empty" : "absent";
  const localUrl = process.env.WAVE1_TEST_DATABASE_URL;
  if (localUrl) {
    const url = new URL(localUrl);
    if (!(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname.startsWith("/wave1"))) {
      throw new Error("Disposable baseline URL must point to local wave1 database");
    }
    const client = new Client({ connectionString: localUrl });
    await client.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const result = await captureWave1Tables(client, expected);
      const objects = expected === "empty" ? await captureWave1Objects(client) : undefined;
      const artifact = await writeEvidenceArtifact(path.resolve(process.cwd(), "../audit/canonical/runtime/wave1"),
        "wave1-local-table-proof.json", { kind: "lumora-wave1-disposable-table-proof-v1", ...result, objects });
      console.log(JSON.stringify({ ...result, objectCounts: objects && Object.fromEntries(
        Object.entries(objects).filter(([, values]) => Array.isArray(values)).map(([key, values]) => [key, values.length])), evidence: artifact }));
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
    return;
  }
  const environment = auditEnvironment();
  const capture = await withReadOnlyDatabase(environment, (client) => captureWave1Tables(client, expected));
  const objects = expected === "empty" ? await withReadOnlyDatabase(environment, captureWave1Objects) : undefined;
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave1-baseline.json", {
    kind: "lumora-wave1-baseline-v1", ...capture.result, objects: objects?.result,
    readOnlyEvidence: [capture.evidence, objects?.evidence].filter(Boolean),
  });
  console.log(JSON.stringify(artifact));
}

if (process.argv[1]?.includes("wave1-baseline")) main().catch(fail);
