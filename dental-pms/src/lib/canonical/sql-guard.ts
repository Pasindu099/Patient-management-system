import { parse, toSql } from "pgsql-ast-parser";
import { sha256 } from "./evidence";

const DISALLOWED_NODE_TYPES = new Set([
  "insert", "update", "delete", "truncate table", "merge", "do",
  "copy", "create table", "create schema", "create extension", "create index",
  "alter table", "drop table", "drop schema", "drop index", "grant", "revoke",
]);
const DISALLOWED_FUNCTIONS = new Set([
  "dblink", "dblink_exec", "lo_export", "lo_import", "pg_cancel_backend",
  "pg_create_restore_point", "pg_reload_conf", "pg_rotate_logfile", "pg_terminate_backend",
  "pg_write_file", "set_config",
]);
const REVIEWED_FUNCTIONS = new Set([
  "btrim", "coalesce", "count", "current_database", "current_setting", "exists", "extract",
  "max", "min", "round", "statement_timestamp", "sum",
]);
const META_COMMANDS = [/^\\set ON_ERROR_STOP on$/i, /^\\pset pager off$/i, /^\\pset null '\[NULL\]'$/i, /^\\echo\s+'[^']*'$/i];

export type GuardedSql = { statements: string[]; sha256: string; statementCount: number };

function stripApprovedHarnessLines(sql: string): string {
  const retained: string[] = [];
  for (const rawLine of sql.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("\\")) {
      if (!META_COMMANDS.some((pattern) => pattern.test(line))) throw new Error(`Unapproved psql meta-command: ${line}`);
      continue;
    }
    if (/^BEGIN(?: TRANSACTION)? READ ONLY;$/i.test(line)) continue;
    if (/^SET LOCAL (?:statement_timeout|lock_timeout)\s*=\s*'[^']+';$/i.test(line)) continue;
    if (/^ROLLBACK;$/i.test(line)) continue;
    retained.push(rawLine);
  }
  return retained.join("\n").trim();
}

function nodeType(value: unknown): string | undefined {
  return value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string"
    ? (value as { type: string }).type.toLowerCase()
    : undefined;
}

function functionName(node: Record<string, unknown>): string | undefined {
  const fn = node.function;
  if (typeof fn === "string") return fn.toLowerCase();
  if (fn && typeof fn === "object") {
    const name = (fn as { name?: unknown }).name;
    if (typeof name === "string") return name.toLowerCase();
  }
  return undefined;
}

function inspectAst(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(inspectAst);
    return;
  }
  const node = value as Record<string, unknown>;
  const type = nodeType(node);
  if (type && (DISALLOWED_NODE_TYPES.has(type) || /^(create|alter|drop|grant|revoke|truncate|insert|update|delete|merge|copy|do)\b/.test(type))) {
    throw new Error(`SQL node type is not read-only: ${type}`);
  }
  if (type === "call") {
    const name = functionName(node);
    if (!name || DISALLOWED_FUNCTIONS.has(name) || !REVIEWED_FUNCTIONS.has(name)) {
      throw new Error(`SQL function is not reviewed for audit use: ${name ?? "unknown"}`);
    }
  }
  if (node.for || node.locking || node.lock) throw new Error("Row-locking SELECT is forbidden");
  for (const child of Object.values(node)) inspectAst(child);
}

export function guardReadOnlySql(sql: string, expectedHash?: string): GuardedSql {
  const actualHash = sha256(sql);
  if (expectedHash && actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(`Query pack hash mismatch: expected ${expectedHash}, received ${actualHash}`);
  }
  const normalized = stripApprovedHarnessLines(sql);
  let ast;
  try {
    ast = parse(normalized);
  } catch (error) {
    throw new Error(`SQL parse failed closed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (ast.length === 0) throw new Error("SQL pack contains no statements");
  for (const statement of ast) {
    if (nodeType(statement) !== "select") throw new Error(`Only SELECT statements are permitted, received ${nodeType(statement) ?? "unknown"}`);
    inspectAst(statement);
  }
  const statements = ast.map((statement) => toSql.statement(statement));
  return { statements, sha256: actualHash, statementCount: statements.length };
}
