import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const doctors = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'DOCTOR',
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(doctors)
  } catch (err) {
    console.error('[API/slots/doctors]', err)
    return NextResponse.json([], { status: 200 })
  }
}
