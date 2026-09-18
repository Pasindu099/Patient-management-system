import { writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { withReadOnlyDatabase } from "../../src/lib/canonical/read-only-db";
import { guardReadOnlySql } from "../../src/lib/canonical/sql-guard";
import { auditEnvironment, fail } from "./common";

async function main() {
  const environment = auditEnvironment();
  const proof = await withReadOnlyDatabase(environment, async (client) => {
    const privileges = await client.query(`
      SELECT current_user AS role,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_database_privilege(current_user, current_database(), 'TEMP') AS database_temp,
        coalesce(bool_or(has_table_privilege(current_user, format('%I.%I', schemaname, tablename), 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')), false) AS any_table_write
      FROM pg_tables WHERE schemaname = 'public' GROUP BY current_user
    `);
    const row = privileges.rows[0];
    if (!row || row.database_create || row.database_temp || row.any_table_write) throw new Error("Audit role has mutation, TEMP, or CREATE privileges");
    return row;
  });
  const rejected: string[] = [];
  for (const sql of ["UPDATE patients SET id = id", "SELECT * FROM patients FOR UPDATE", "WITH x AS (DELETE FROM patients RETURNING *) SELECT * FROM x", "SELECT set_config('x','y',false)"]) {
    try { guardReadOnlySql(sql); } catch { rejected.push(sql); }
  }
  if (rejected.length !== 4) throw new Error("SQL guard negative proof failed");
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "wave0-readonly-proof.json", {
    kind: "lumora-wave0-readonly-proof-v1", privilegeInspection: proof.result,
    session: proof.evidence, mutationProbeEnvironment: "not-run-production", guardRejectedCount: rejected.length,
  });
  console.log(JSON.stringify(artifact));
}
main().catch(fail);
