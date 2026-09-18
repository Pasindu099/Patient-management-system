import { createHash, randomUUID } from "node:crypto";

export const IDENTIFIER_STRATEGY = "uuid-v4-runtime-fallback" as const;

export function newCanonicalId(): string {
  return randomUUID();
}

export function stableCanonicalId(namespace: string, ...parts: string[]): string {
  return createHash("sha256").update([namespace, ...parts].join("\u001f"), "utf8").digest("hex");
}

export function identifierCapabilityEvidence() {
  return {
    requested: "uuid-v7",
    selected: IDENTIFIER_STRATEGY,
    reason: "Node 20 and the verified runtime do not provide a guaranteed native UUIDv7 generator",
  };
}
