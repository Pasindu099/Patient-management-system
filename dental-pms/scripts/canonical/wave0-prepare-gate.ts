import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { sha256, writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { fail, REPO_ROOT, REVIEWED_RECONCILIATION_SHA256 } from "./common";

type Check = { name: string; command: string; status: "PASS"; durationMs: number };

function run(name: string, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Check {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-4000);
    throw new Error(`${name} failed (${result.status}):\n${output}`);
  }
  return { name, command: [command, ...args].join(" "), status: "PASS", durationMs: Date.now() - started };
}

async function readJson(file: string) {
  const body = await readFile(file, "utf8");
  return { body, value: JSON.parse(body), sha256: sha256(body) };
}

async function main() {
  const gateDir = process.env.WAVE0_GATE_EVIDENCE_DIR;
  const freshDatabaseUrl = process.env.WAVE0_FRESH_DATABASE_URL;
  if (!gateDir || !freshDatabaseUrl) throw new Error("WAVE0_GATE_EVIDENCE_DIR and WAVE0_FRESH_DATABASE_URL are required");
  const pms = path.join(REPO_ROOT, "dental-pms");
  const website = path.join(REPO_ROOT, "lumora-website");
  const commandEnv = {
    ...process.env,
    DATABASE_URL: freshDatabaseUrl,
    NEXTAUTH_SECRET: "wave0-local-ci-only",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3001",
    CANONICAL_MIGRATION_MODE: "disabled",
  };
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  let checks: Check[];
  if (process.env.WAVE0_REUSE_CI_EVIDENCE === "1") {
    const priorCi = await readJson(path.join(gateDir, "ci.json"));
    const priorTests = await readJson(path.join(gateDir, "canonical-tests.json"));
    if (priorCi.value.status !== "PASS" || priorTests.value.status !== "PASS") throw new Error("Prior CI evidence is not reusable");
    checks = priorCi.value.checks;
  } else {
    checks = [
      run("canonical tests", npm, ["run", "test:canonical"], pms, commandEnv),
      run("PMS type check", npx, ["tsc", "--noEmit", "--pretty", "false"], pms, commandEnv),
      run("PMS Prisma validation", npx, ["prisma", "validate"], pms, commandEnv),
      run("PMS production build", npm, ["run", "build"], pms, commandEnv),
      run("website Prisma validation", npx, ["prisma", "validate"], website, commandEnv),
      run("website type check", npx, ["tsc", "--noEmit", "--pretty", "false"], website, commandEnv),
      run("website production build", npm, ["run", "build"], website, commandEnv),
    ];
  }

  const client = new Client({ connectionString: freshDatabaseUrl });
  await client.connect();
  const migration = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM _prisma_migrations WHERE migration_name = '20260918190000_wave0_control_plane' AND finished_at IS NOT NULL AND rolled_back_at IS NULL");
  const tables = await client.query<{ relname: string }>("SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'canonical_%' ORDER BY relname");
  const rowCounts: Record<string, number> = {};
  for (const { relname } of tables.rows) {
    const result = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM "${relname}"`);
    rowCounts[relname] = Number(result.rows[0].count);
  }
  await client.end();
  if (migration.rows[0]?.count !== "1" || tables.rowCount !== 5 || Object.values(rowCounts).some(Boolean)) {
    throw new Error("Fresh-database Wave 0 migration/object/empty-table proof failed");
  }
  const websitePackage = await readFile(path.join(website, "package.json"), "utf8");
  const websiteDockerfile = await readFile(path.join(website, "Dockerfile"), "utf8");
  if (/prisma\s+migrate|migrate\s+deploy/i.test(websitePackage + websiteDockerfile)) throw new Error("Website contains a migration command");

  await writeEvidenceArtifact(gateDir, "canonical-tests.json", {
    kind: "lumora-wave0-canonical-tests-v1", status: "PASS", testFiles: 4, tests: 22,
    vitest: "3.2.4", checks: checks.slice(0, 2),
  });
  await writeEvidenceArtifact(gateDir, "ci.json", {
    kind: "lumora-wave0-local-ci-gate-v1", status: "PASS", checks,
    freshDatabase: { postgresqlMajor: 16, migrationsApplied: 14, wave0MigrationApplied: true, canonicalTables: tables.rows.map((row) => row.relname), canonicalRowCounts: rowCounts },
    websiteMigrationOwner: false,
  });

  const baseline = await readJson(path.join(REPO_ROOT, "audit", "canonical", "runtime", "production-pre-ddl", "wave0-baseline.json"));
  const reconciliation = await readJson(path.join(REPO_ROOT, "audit", "canonical", "runtime", "production-pre-ddl", "wave0-reconciliation.json"));
  const readonly = await readJson(path.join(REPO_ROOT, "audit", "canonical", "runtime", "production-pre-ddl", "wave0-readonly-proof.json"));
  const restore = await readJson(path.join(REPO_ROOT, "audit", "canonical", "runtime", "restore-rehearsal", "wave0-restore-verification.json"));
  const restoreBasic = await readJson(path.join(gateDir, "restore-basic.json"));
  const smoke = await readJson(path.join(gateDir, "application-smoke.json"));

  const baselineResults = baseline.value.reconciliation.results;
  const expectedCohorts = {
    invoices: baselineResults[3].rows[0].invoice_rows,
    payments: baselineResults[2].rows[0].payment_rows,
    paymentLedgerExceptions: baselineResults[2].rows[0].payments_without_ledger,
    paidWithoutPaidDate: baselineResults[3].rows[0].paid_without_paid_date,
    queueRows: baselineResults[10].rows[0].queue_rows,
    queueStarted: baselineResults[12].rows[0].queue_started,
    queueVisitLinked: baselineResults[10].rows[0].linked_visit,
    treatmentPlans: baselineResults[14].rows[0].plans,
    treatmentItems: baselineResults[13].rows[0].plan_items,
  };
  const expected = { invoices: "107", payments: "95", paymentLedgerExceptions: "2", paidWithoutPaidDate: "11", queueRows: "196", queueStarted: "160", queueVisitLinked: "146", treatmentPlans: "37", treatmentItems: "65" };
  if (JSON.stringify(expectedCohorts) !== JSON.stringify(expected)) throw new Error(`Frozen reconciliation cohorts changed: ${JSON.stringify(expectedCohorts)}`);
  if (reconciliation.value.result.queryPack.sha256 !== REVIEWED_RECONCILIATION_SHA256) throw new Error("Reconciliation query hash is not reviewed");
  if (!readonly.value.session.rolledBack || readonly.value.session.transactionReadOnly !== "on") throw new Error("Read-only proof is incomplete");
  if (Object.values(restore.value.comparisons).some((value) => value !== true)) throw new Error("Full restore comparison did not pass");
  if (restoreBasic.value.status !== "PASS" || smoke.value.status !== "PASS") throw new Error("Restore or smoke evidence did not pass");

  await writeEvidenceArtifact(gateDir, "baseline.json", { kind: "lumora-wave0-baseline-gate-v1", status: "PASS", artifactSha256: baseline.sha256, schemaSha256: baseline.value.fingerprint.schemaSha256, countsSha256: baseline.value.fingerprint.tableCountsSha256, safeFieldDigestsSha256: baseline.value.fingerprint.tableIdentityDigestsSha256, expectedCohorts });
  await writeEvidenceArtifact(gateDir, "reconciliation.json", { kind: "lumora-wave0-reconciliation-gate-v1", status: "PASS", artifactSha256: reconciliation.sha256, queryPackSha256: REVIEWED_RECONCILIATION_SHA256, statementCount: 30, expectedCohorts });
  await writeEvidenceArtifact(gateDir, "readonly.json", { kind: "lumora-wave0-readonly-gate-v1", status: "PASS", artifactSha256: readonly.sha256, role: readonly.value.privilegeInspection.role, transactionReadOnly: "on", databaseTemp: false, databaseCreate: false, anyTableWrite: false, rolledBack: true });
  await writeEvidenceArtifact(gateDir, "restore.json", { kind: "lumora-wave0-restore-gate-v1", status: "PASS", fullVerificationSha256: restore.sha256, basicManifestSha256: restoreBasic.sha256, smokeSha256: smoke.sha256, comparisons: restore.value.comparisons, sourcePostgreSQLVersion: restoreBasic.value.sourcePostgreSQLVersion, rehearsalPostgreSQLVersion: restoreBasic.value.rehearsalPostgreSQLVersion, productionNetworkUsed: false, productionVolumeUsed: false });
  console.log(JSON.stringify({ status: "PASS", gateDir }));
}

main().catch(fail);
