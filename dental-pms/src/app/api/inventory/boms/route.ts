import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { z } from 'zod'

// GET /api/inventory/boms?feeId — both patient-type BOMs for a treatment
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const feeId = new URL(req.url).searchParams.get('feeId')
  if (!feeId) return NextResponse.json({ error: 'feeId required' }, { status: 400 })

  const boms = await prisma.treatmentBOM.findMany({
    where: { feeId },
    include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } } },
  })
  return NextResponse.json(boms)
}

const lineSchema = z.object({ itemId: z.string().min(1), quantity: z.number().positive() })
const schema = z.object({
  feeId: z.string().min(1),
  patientType: z.enum(['ADULT', 'CHILD']),
  lines: z.array(lineSchema),
})

// PUT /api/inventory/boms — replace the BOM lines for (fee, patientType)
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  const { feeId, patientType, lines } = parsed.data

  const bom = await prisma.$transaction(async tx => {
    const upserted = await tx.treatmentBOM.upsert({
      where: { feeId_patientType: { feeId, patientType } },
      update: {},
      create: { feeId, patientType },
    })
    await tx.treatmentBOMLine.deleteMany({ where: { bomId: upserted.id } })
    if (lines.length > 0) {
      await tx.treatmentBOMLine.createMany({
        data: lines.map(l => ({ bomId: upserted.id, itemId: l.itemId, quantity: l.quantity })),
      })
    }
    return tx.treatmentBOM.findUnique({
      where: { id: upserted.id },
      include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } } },
    })
  })

  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'treatment_bom',
      resourceId: bom!.id,
      details:  { feeId, patientType, lineCount: lines.length },
    },
  })

  return NextResponse.json(bom)
}
