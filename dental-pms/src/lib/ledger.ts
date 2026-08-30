import { Prisma, PrismaClient, TxDirection, Currency } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export type LedgerCategoryCode =
  | 'PATIENT_PAYMENT' | 'OTHER_INCOME'
  | 'REFUND' | 'SALARY' | 'RENT' | 'LAB_FEE' | 'SUPPLIES' | 'OTHER_EXPENSE'

interface LedgerEntry {
  direction:        TxDirection
  amountCents:      number
  categoryCode:     LedgerCategoryCode
  currency?:        Currency
  branchId?:        string | null
  recordedByUserId?: string | null
  serviceAccountId?: string | null
  refType?:         string
  refId?:           string
  notes?:           string | null
  date?:            Date
}

// Every money movement in the system goes through here — patient payments,
// refunds, salaries, expenses, supply purchases. The future AI finance agent
// consumes this ledger; nothing else is a source of financial truth.
export async function recordLedgerTx(db: Db, entry: LedgerEntry) {
  const category = await db.financeCategory.findUnique({
    where: { code: entry.categoryCode },
    select: { id: true },
  })
  if (!category) {
    // A missing category is a deployment error, not a user error — log loudly
    // but never block the underlying clinical/billing operation.
    console.error(`[ledger] Unknown finance category: ${entry.categoryCode}`)
    return null
  }

  return db.financialTransaction.create({
    data: {
      direction:        entry.direction,
      amountCents:      entry.amountCents,
      currency:         entry.currency ?? 'LKR',
      categoryId:       category.id,
      branchId:         entry.branchId ?? null,
      recordedByUserId: entry.recordedByUserId ?? null,
      serviceAccountId: entry.serviceAccountId ?? null,
      refType:          entry.refType ?? null,
      refId:            entry.refId ?? null,
      notes:            entry.notes ?? null,
      date:             entry.date ?? new Date(),
    },
  })
}
