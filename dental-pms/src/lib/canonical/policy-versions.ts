export function policyWindowsOverlap(a: { from: Date; to?: Date }, b: { from: Date; to?: Date }): boolean {
  const aEnd = a.to?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.to?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aEnd <= a.from.getTime() || bEnd <= b.from.getTime()) throw new Error("Invalid policy interval");
  return a.from.getTime() < bEnd && b.from.getTime() < aEnd;
}

export function policyScopeKey(family: string, scopeType: string, scopeKey: string): string {
  if (![family, scopeType, scopeKey].every((value) => value.trim())) throw new Error("Policy scope is required");
  return [family, scopeType, scopeKey].join("\u001f");
}
