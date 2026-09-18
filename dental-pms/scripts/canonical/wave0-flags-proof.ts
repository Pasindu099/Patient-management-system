import { allCanonicalCapabilitiesOff } from "../../src/lib/canonical/feature-flags";
import { assertProductionAllowlistsEmpty, readCanonicalEnvironment } from "../../src/lib/canonical/environment";
import { writeEvidenceArtifact } from "../../src/lib/canonical/evidence";
import { fail } from "./common";

async function main() {
  const environment = readCanonicalEnvironment();
  if (environment.mode !== "disabled") throw new Error("Canonical production mode must be disabled");
  assertProductionAllowlistsEmpty(environment);
  if (!allCanonicalCapabilitiesOff(environment)) throw new Error("A canonical capability is effectively enabled");
  const controls = ["write_capture.*", "shadow_read.*", "metric_read.*", "domain_cutover.*", "alert_type.*", "ui_surface.*"];
  const artifact = await writeEvidenceArtifact(environment.artifactDir, "flags.json", {
    kind: "lumora-wave0-feature-flag-proof-v1",
    status: "PASS",
    migrationMode: environment.mode,
    productionAllowlists: Object.fromEntries(Object.keys(environment.allowlists).map((key) => [key, []])),
    effectiveCapabilities: Object.fromEntries(controls.map((key) => [key, "OFF"])),
  });
  console.log(JSON.stringify(artifact));
}

main().catch(fail);
