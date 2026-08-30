// Money helpers for the integer-cents convention (v2).
// All currency amounts are stored as Int cents (LKR cents / US cents).
// Floats never touch stored money values after the cents migration.

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

// Parse user-typed amounts ("1,500.50") safely into cents
export function parseCents(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '')
  if (cleaned === '' || isNaN(Number(cleaned))) return null
  return toCents(Number(cleaned))
}

export function formatCents(cents: number, currency: 'LKR' | 'USD' = 'LKR'): string {
  const amount = fromCents(cents)
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Sum a list of cent values (avoids accidental float creep)
export function sumCents(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}
