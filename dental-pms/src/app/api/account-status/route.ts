import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ active: false }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })

  return NextResponse.json({ active: !!user?.isActive })
}
