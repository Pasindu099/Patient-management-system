import { Prisma, PrismaClient } from '@prisma/client'
import { sendSMS } from '@/lib/sms'

type Db = PrismaClient | Prisma.TransactionClient

const CHILD_MAX_AGE = 12

export function determinePatientType(dateOfBirth: Date, at: Date = new Date()): 'ADULT' | 'CHILD' {
  let age = at.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = at.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < dateOfBirth.getDate())) age--
  return age < CHILD_MAX_AGE ? 'CHILD' : 'ADULT'
}

// Fallback only for treatment rows added by hand (the "+ Add treatment"
// free-text row) that never went through the Treatment Plan step and so
// never picked up a feeId. Exact match first, then a loose contains-match.
async function findFeeIdByDescription(db: Db, description: string): Promise<string | null> {
  const clean = description.trim()
  if (!clean) return null

  const exact = await db.treatmentFee.findFirst({
    where: { name: { equals: clean, mode: 'insensitive' } },
    select: { id: true },
  })
  if (exact) return exact.id

  const loose = await db.treatmentFee.findFirst({
    where: { name: { contains: clean, mode: 'insensitive' } },
    select: { id: true },
  })
  return loose?.id ?? null
}

// ─── Scannable item codes ────────────────────────────────────────
// Printed on the shelf label as a QR code. Short and human-readable so a
// worn-out label can still be typed in by hand.
const CODE_PREFIX = 'LDS-'

// Scanners and manual entry disagree about case and stray whitespace;
// everything that hits a lookup goes through here first.
export function normaliseItemCode(raw: string): string {
  return raw.trim().toUpperCase()
}

// Next free sequential code. The unique index on `code` is the real guard —
// this just picks a likely-free candidate, and the caller retries on collision.
export async function nextItemCode(db: Db): Promise<string> {
  const latest = await db.inventoryItem.findFirst({
    where: { code: { startsWith: CODE_PREFIX } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })
  const lastNumber = latest?.code ? parseInt(latest.code.slice(CODE_PREFIX.length), 10) : 0
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1
  return `${CODE_PREFIX}${String(next).padStart(4, '0')}`
}

interface DeductResult { itemName: string; branchId: string; newQuantity: number; threshold: number }

// Auto-deduct inventory for treatments performed today. Never throws —
// a failed lookup or missing BOM just skips that item silently, so a
// missing/misconfigured BOM can never block the clinical save.
export async function deductForVisit(
  db: Db,
  params: { branchId: string; visitId: string; patientType: string; userId: string; treatmentItems: { description: string; feeId?: string }[] }
): Promise<DeductResult[]> {
  const crossed: DeductResult[] = []

  for (const item of params.treatmentItems) {
    try {
      const feeId = item.feeId || await findFeeIdByDescription(db, item.description)
      if (!feeId) continue

      const bom = await db.treatmentBOM.findUnique({
        where: { feeId_patientType: { feeId, patientType: params.patientType } },
        include: { lines: true },
      })
      if (!bom || bom.lines.length === 0) continue

      for (const line of bom.lines) {
        const stock = await db.inventoryStock.upsert({
          where: { itemId_branchId: { itemId: line.itemId, branchId: params.branchId } },
          update: {},
          create: { itemId: line.itemId, branchId: params.branchId, quantity: 0, reorderThreshold: 0 },
          include: { item: { select: { name: true } } },
        })

        const newQuantity = stock.quantity - line.quantity
        await db.inventoryStock.update({
          where: { id: stock.id },
          data: { quantity: newQuantity },
        })
        await db.stockAdjustment.create({
          data: {
            stockId: stock.id,
            delta: -line.quantity,
            kind: 'AUTO_DEDUCT',
            userId: params.userId,
            visitId: params.visitId,
          },
        })

        if (newQuantity <= stock.reorderThreshold) {
          crossed.push({ itemName: stock.item.name, branchId: params.branchId, newQuantity, threshold: stock.reorderThreshold })
        }
      }
    } catch (err) {
      console.error(`[inventory] auto-deduct failed for "${item.description}":`, err)
    }
  }

  return crossed
}

// Notify Admin once per threshold-crossing (dedup via lowStockAlertedAt);
// resets automatically once stock is topped back up above the threshold.
export async function alertLowStock(db: Db, branchId: string, itemName: string, newQuantity: number, threshold: number) {
  try {
    const stock = await db.inventoryStock.findFirst({
      where: { branchId, item: { name: itemName } },
      select: { id: true, lowStockAlertedAt: true },
    })
    if (!stock || stock.lowStockAlertedAt) return // already alerted since last restock

    await db.inventoryStock.update({ where: { id: stock.id }, data: { lowStockAlertedAt: new Date() } })

    const admins = await db.user.findMany({
      where: { role: 'ADMIN', isActive: true, phone: { not: null } },
      select: { phone: true },
    })
    const message = `Low stock alert: ${itemName} is down to ${newQuantity} (reorder threshold ${threshold}). Please restock.`
    for (const admin of admins) {
      if (admin.phone) await sendSMS(admin.phone, message)
    }
  } catch (err) {
    console.error('[inventory] low-stock alert failed:', err)
  }
}

// Clear the alert flag once stock rises back above threshold (e.g. after
// a RECEIVED adjustment), so the next crossing sends a fresh alert.
export async function clearLowStockFlagIfAboveThreshold(db: Db, stockId: string) {
  const stock = await db.inventoryStock.findUnique({ where: { id: stockId } })
  if (stock && stock.quantity > stock.reorderThreshold && stock.lowStockAlertedAt) {
    await db.inventoryStock.update({ where: { id: stockId }, data: { lowStockAlertedAt: null } })
  }
}
