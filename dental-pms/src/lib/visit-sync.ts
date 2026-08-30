import { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

// ReceptionQueueItem (CHECKED_IN|ASSIGNED|IN_CHAIR|COMPLETED|PAID|LEFT) and
// Visit (IN_PROGRESS|COMPLETED|READY_TO_PAY) each carry their own status.
// Whenever a visit's status changes, the linked queue item must follow,
// otherwise patients get stuck on the reception queue.
export function queueStatusForVisit(visitStatus: string): string {
  switch (visitStatus) {
    case 'READY_TO_PAY': return 'COMPLETED' // ready to pay -> reception's "today board"
    case 'COMPLETED':    return 'PAID'      // visit fully closed (paid/waived) -> off the board
    default:             return 'IN_CHAIR'
  }
}

export async function syncQueueWithVisit(db: Db, visitId: string, visitStatus: string) {
  const queueStatus = queueStatusForVisit(visitStatus)
  await db.receptionQueueItem.updateMany({
    where: { visitId, status: { notIn: ['PAID', 'LEFT'] } },
    data: {
      status: queueStatus,
      ...(queueStatus === 'COMPLETED' || queueStatus === 'PAID'
        ? { finishedAt: new Date() }
        : {}),
    },
  })
}

// When a payment is taken at the counter, close out any visits waiting
// on that invoice: Visit -> COMPLETED (drops off the Payment Queue) and
// the linked reception-queue item -> DONE (drops off the Reception
// Queue). The invoice itself keeps tracking any outstanding balance
// (PARTIAL / installment plans) — the patient has left the clinic, so
// the day's queues must not hold them.
export async function closeVisitsForPaidInvoice(db: Db, invoiceId: string) {
  const links = await db.visitInvoice.findMany({
    where: { invoiceId },
    select: { visitId: true },
  })

  for (const { visitId } of links) {
    await db.visit.updateMany({
      where: { id: visitId, status: { not: 'COMPLETED' } },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    })
    await db.receptionQueueItem.updateMany({
      where: { visitId, status: { notIn: ['PAID', 'LEFT'] } },
      data:  { status: 'PAID', finishedAt: new Date() },
    })
  }
}
