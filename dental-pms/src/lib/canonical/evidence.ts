import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function stableJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, normalize(child)]),
      );
    }
    return typeof item === "bigint" ? item.toString() : item;
  };
  return JSON.stringify(normalize(value), null, 2) + "\n";
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function redactConnectionString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "REDACTED";
    if (parsed.username) parsed.username = "REDACTED";
    return parsed.toString();
  } catch {
    return "REDACTED";
  }
}

export async function writeEvidenceArtifact(directory: string, name: string, value: unknown) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const body = stableJson(value);
  const finalPath = path.join(directory, name);
  const temporaryPath = `${finalPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, body, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, finalPath);
  return { path: finalPath, sha256: sha256(body), bytes: Buffer.byteLength(body) };
}
