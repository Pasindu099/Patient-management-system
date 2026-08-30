import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  patientId:     z.string().min(1),
  appointmentId: z.string().optional(),
  noteType:      z.enum(['soap', 'general', 'tooth_record', 'perio']),
  subjective:    z.string().optional(),
  objective:     z.string().optional(),
  assessment:    z.string().optional(),
  plan:          z.string().optional(),
  content:       z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const note = await prisma.clinicalNote.create({
    data: {
      patientId:     d.patientId,
      appointmentId: d.appointmentId || null,
      authorId:      session.user.id,
      noteType:      d.noteType,
      subjective:    d.subjective || null,
      objective:     d.objective  || null,
      assessment:    d.assessment || null,
      plan:          d.plan       || null,
      content:       d.content    || null,
      isLocked:      true,  // All notes locked immediately on save
      lockedAt:      new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId:     session.user.id,
      patientId:  d.patientId,
      action:     'CREATE',
      resource:   'clinical_note',
      resourceId: note.id,
      details:    { noteType: d.noteType },
    },
  })

  return NextResponse.json(note, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patientId')
  const noteType  = searchParams.get('noteType')

  const notes = await prisma.clinicalNote.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(noteType  ? { noteType  } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } } },
  })

  return NextResponse.json(notes)
}
