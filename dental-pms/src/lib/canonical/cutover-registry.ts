export function assertCutoverReady(record: {
  approvalReference: string;
  evidenceManifestHash: string;
  migrationClasses: readonly string[];
}) {
  if (!record.approvalReference.trim() || !/^[a-f0-9]{64}$/i.test(record.evidenceManifestHash)) {
    throw new Error("Cutover requires approval and SHA-256 evidence manifest");
  }
  if (!record.migrationClasses.length || record.migrationClasses.some((value) => !["M1", "M2", "M3", "M4"].includes(value))) {
    throw new Error("Cutover migration classes are required");
  }
  return true;
}

export function cutoverCanEnableBehavior(featureFlagEnabled: boolean, domainGatePassed: boolean, scopedApproval: boolean) {
  return featureFlagEnabled && domainGatePassed && scopedApproval;
}
