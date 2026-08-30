import { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

// Effective-dated catalog price: the price in force at a given moment.
// TreatmentFee.priceCents always mirrors the LATEST entry, so the catalog
// dropdown never needs this — use it for historical reports/verification.
export async function effectivePriceCents(db: Db, feeId: string, at: Date = new Date()): Promise<number | null> {
  const entry = await db.treatmentPriceHistory.findFirst({
    where:   { feeId, effectiveFrom: { lte: at } },
    orderBy: { effectiveFrom: 'desc' },
    select:  { priceCents: true },
  })
  return entry?.priceCents ?? null
}

// Admin sets a new price: append a history row and update the current mirror.
export async function setTreatmentPrice(db: Db, feeId: string, priceCents: number, userId: string) {
  await db.treatmentPriceHistory.create({
    data: { feeId, priceCents, setByUserId: userId },
  })
  return db.treatmentFee.update({
    where: { id: feeId },
    data:  { priceCents, price: priceCents / 100 }, // float = frozen legacy mirror
  })
}
