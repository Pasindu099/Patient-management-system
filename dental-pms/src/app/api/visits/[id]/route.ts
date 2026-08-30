import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncQueueWithVisit } from '@/lib/visit-sync'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.visit.findUnique({ where: { id }, select: { lockedAt: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.lockedAt) {
    return NextResponse.json({ error: 'This visit has ended and can no longer be edited.' }, { status: 409 })
  }

  const body   = await req.json()
  const { status, chiefComplaint, examination, diagnosis, treatmentDone, nextVisitPlan } = body

  const data: any = {}
  if (status)          data.status          = status
  if (chiefComplaint)  data.chiefComplaint  = chiefComplaint
  if (examination)     data.examination     = examination
  if (diagnosis)       data.diagnosis       = diagnosis
  if (treatmentDone)   data.treatmentDone   = treatmentDone
  if (nextVisitPlan !== undefined) data.nextVisitPlan = nextVisitPlan

  if (status === 'READY_TO_PAY' || status === 'COMPLETED') {
    data.completedAt = new Date()
    data.lockedAt     = new Date() // End visit: no more clinical edits after this
  }

  const visit = await prisma.$transaction(async tx => {
    const updated = await tx.visit.update({
      where: { id },
      data,
    })
    if (status) await syncQueueWithVisit(tx, id, updated.status)
    return updated
  })

  return NextResponse.json(visit)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const { id } = await params

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      patient: { include: { medicalHistory: true } },
      doctor:  { select: { id: true, name: true } },
      branch:  true,
      prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      invoices: {
        include: {
          invoice: {
            include: {
              items: true,
              payments: { orderBy: { paidAt: 'desc' } },
              installmentPlan: { include: { installments: { orderBy: { number: 'asc' } } } },
            },
          },
        },
      },
    },
  })

  if (!visit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(visit)
}
