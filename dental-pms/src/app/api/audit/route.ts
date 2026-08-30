import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// GET /api/audit?resource&userId&from&to&limit — who changed what, when.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'audit.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const where: any = {}
  if (sp.get('resource')) where.resource = sp.get('resource')
  if (sp.get('userId'))   where.userId   = sp.get('userId')
  if (sp.get('from') || sp.get('to')) {
    where.createdAt = {}
    if (sp.get('from')) where.createdAt.gte = new Date(sp.get('from')!)
    if (sp.get('to'))   where.createdAt.lte = new Date(sp.get('to')! + 'T23:59:59')
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user:    { select: { name: true, role: true } },
      patient: { select: { firstName: true, lastName: true, patientNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(sp.get('limit')) || 100, 500),
  })

  return NextResponse.json(logs)
}
