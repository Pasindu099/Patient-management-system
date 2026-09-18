import type { Client } from "pg";
import { sha256, stableJson } from "./evidence";

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function captureDatabaseFingerprint(client: Client) {
  const version = await client.query(`
    SELECT current_setting('server_version') AS "serverVersion",
           current_setting('server_version_num') AS "serverVersionNum",
           current_database() AS database,
           current_user AS "currentUser",
           current_setting('transaction_read_only') AS "transactionReadOnly"
  `);
  const objects = await client.query(`
    SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
           pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S')
    ORDER BY c.relkind, c.relname
  `);
  const columns = await client.query(`
    SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const constraints = await client.query(`
    SELECT conrelid::regclass::text AS table_name, conname, contype,
           pg_get_constraintdef(oid, true) AS definition
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `);
  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY tablename, indexname
  `);
  const tables = objects.rows.filter((row) => row.kind === "r" || row.kind === "p").map((row) => String(row.name));
  const tableCounts: Record<string, string> = {};
  const tableIdentityDigests: Record<string, string | null> = {};
  const primaryKeys = await client.query<{ table_name: string; column_name: string; ordinal_position: number }>(`
    SELECT cls.relname AS table_name, attr.attname AS column_name, key.ordinality::int AS ordinal_position
    FROM pg_constraint constraint_row
    JOIN pg_class cls ON cls.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = cls.relnamespace
    CROSS JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key(attnum, ordinality)
    JOIN pg_attribute attr ON attr.attrelid = cls.oid AND attr.attnum = key.attnum
    WHERE namespace.nspname = 'public' AND constraint_row.contype = 'p'
    ORDER BY cls.relname, key.ordinality
  `);
  for (const table of tables) {
    const count = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${quoteIdentifier(table)}`);
    tableCounts[table] = count.rows[0]?.count ?? "0";
    const keyColumns = primaryKeys.rows.filter((row) => row.table_name === table).map((row) => quoteIdentifier(row.column_name));
    if (keyColumns.length === 0) {
      tableIdentityDigests[table] = null;
    } else {
      const identity = `concat_ws(E'\\x1f', ${keyColumns.map((column) => `${column}::text`).join(", ")})`;
      const digest = await client.query<{ digest: string }>(
        `SELECT md5(coalesce(string_agg(md5(${identity}), '' ORDER BY ${identity}), '')) AS digest FROM ${quoteIdentifier(table)}`,
      );
      tableIdentityDigests[table] = digest.rows[0]?.digest ?? null;
    }
  }
  const migrationHistory = tables.includes("_prisma_migrations")
    ? (await client.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at, migration_name`)).rows
    : [];
  const schema = {
    objects: objects.rows.map(({ owner: _owner, ...object }) => object),
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
  };
  return {
    capturedAt: new Date().toISOString(),
    database: version.rows[0],
    schema,
    objectOwners: Object.fromEntries(objects.rows.map((row) => [`${row.schema}.${row.name}`, row.owner])),
    schemaSha256: sha256(stableJson(schema)),
    tableCounts,
    tableCountsSha256: sha256(stableJson(tableCounts)),
    tableIdentityDigests,
    tableIdentityDigestsSha256: sha256(stableJson(tableIdentityDigests)),
    migrationHistory,
    migrationHistorySha256: sha256(stableJson(migrationHistory)),
  };
}
