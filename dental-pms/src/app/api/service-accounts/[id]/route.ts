import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

// PATCH { isActive: false } — revoke a service account (never deletes it,
// so audit history and past AgentActions stay attributable)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const { isActive } = await req.json()

  const account = await prisma.serviceAccount.update({
    where: { id },
    data: { isActive: !!isActive },
  })
  return NextResponse.json(account)
}
