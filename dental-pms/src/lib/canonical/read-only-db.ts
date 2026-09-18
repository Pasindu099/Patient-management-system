import { Client, type QueryResultRow } from "pg";
import type { CanonicalEnvironment } from "./environment";
import { guardReadOnlySql } from "./sql-guard";

export type ReadOnlySessionEvidence = {
  currentUser: string;
  transactionReadOnly: string;
  statementTimeout: string;
  lockTimeout: string;
  rolledBack: boolean;
};

export async function withReadOnlyDatabase<T>(
  environment: CanonicalEnvironment,
  operation: (client: Client, evidence: ReadOnlySessionEvidence) => Promise<T>,
): Promise<{ result: T; evidence: ReadOnlySessionEvidence }> {
  if (!environment.auditDatabaseUrl || !environment.auditDatabaseUser) {
    throw new Error("Dedicated audit connection and expected role are required");
  }
  const client = new Client({ connectionString: environment.auditDatabaseUrl, application_name: "lumora-wave0-audit" });
  const evidence: ReadOnlySessionEvidence = {
    currentUser: "",
    transactionReadOnly: "",
    statementTimeout: "60s",
    lockTimeout: "5s",
    rolledBack: false,
  };
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const identity = await client.query<{ current_user: string; transaction_read_only: string }>(
      "SELECT current_user, current_setting('transaction_read_only') AS transaction_read_only",
    );
    evidence.currentUser = identity.rows[0]?.current_user ?? "";
    evidence.transactionReadOnly = identity.rows[0]?.transaction_read_only ?? "";
    if (evidence.currentUser !== environment.auditDatabaseUser || evidence.transactionReadOnly !== "on") {
      throw new Error("Audit session identity/read-only verification failed");
    }
    const result = await operation(client, evidence);
    return { result, evidence };
  } finally {
    try {
      await client.query("ROLLBACK");
      evidence.rolledBack = true;
    } finally {
      await client.end();
    }
  }
}

export async function executeGuardedQueryPack(
  environment: CanonicalEnvironment,
  sql: string,
  expectedHash: string,
) {
  const guarded = guardReadOnlySql(sql, expectedHash);
  return withReadOnlyDatabase(environment, async (client) => {
    const results: Array<{ command: string; rowCount: number | null; rows: QueryResultRow[] }> = [];
    for (const statement of guarded.statements) {
      const result = await client.query(statement);
      results.push({ command: result.command, rowCount: result.rowCount, rows: result.rows });
    }
    return { queryPack: { sha256: guarded.sha256, statementCount: guarded.statementCount }, results };
  });
}
