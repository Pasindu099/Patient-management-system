import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// Store fee schedule as an audit log entry (reusing existing table)
// In production, add a Settings table to schema
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }
  const body = await req.json()
  // Log fee schedule save as audit event
  await prisma.auditLog.create({
    data: {
      userId:   session.user.id,
      action:   'UPDATE',
      resource: 'fee_schedule',
      details:  body,
    },
  })
  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  // Return the most recent fee schedule save
  const log = await prisma.auditLog.findFirst({
    where: { resource: 'fee_schedule' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(log?.details ?? null)
}
