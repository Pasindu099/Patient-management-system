import type { Prisma } from '@prisma/client'

// Everything the printable bill / prescription documents need. The visit detail
// page loads a superset of this, so it can hand its own record straight to the
// print components.
export const visitPrintInclude = {
  patient: { include: { medicalHistory: true } },
  doctor:  { select: { id: true, name: true } },
  branch:  true,
  prescriptions: {
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  invoices: {
    include: {
      invoice: {
        include: {
          items:    true,
          payments: { orderBy: { paidAt: 'desc' } },
          installmentPlan: {
            include: { installments: { orderBy: { number: 'asc' } } },
          },
        },
      },
    },
  },
} satisfies Prisma.VisitInclude

export type VisitPrintData = Prisma.VisitGetPayload<{ include: typeof visitPrintInclude }>
