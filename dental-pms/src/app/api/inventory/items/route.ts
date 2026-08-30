import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { nextItemCode, normaliseItemCode } from '@/lib/inventory'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// GET /api/inventory/items — full catalog (any clinical/reception role)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(items)
}

const schema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).default('unit'),
  // Optional: paste a manufacturer barcode instead of minting a new LDS- code,
  // so a box that already carries a printed barcode needs no label of its own.
  code: z.string().min(1).optional(),
})

const updateSchema = z.object({
  id: z.string().min(1),
  code: z.string().nullable().optional(),
  generateCode: z.boolean().optional(),
})

// POST /api/inventory/items — add a catalog item (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const { name, unit, code } = parsed.data

  if (code) {
    const supplied = normaliseItemCode(code)
    const clash = await prisma.inventoryItem.findUnique({ where: { code: supplied } })
    if (clash) return NextResponse.json({ error: `Code ${supplied} is already used by ${clash.name}` }, { status: 409 })
    const item = await prisma.inventoryItem.create({ data: { name, unit, code: supplied } })
    return NextResponse.json(item, { status: 201 })
  }

  // Auto-assign the next sequential code. Two admins adding an item at the
  // same moment can pick the same candidate, so retry on the unique violation.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const item = await prisma.inventoryItem.create({
        data: { name, unit, code: await nextItemCode(prisma) },
      })
      return NextResponse.json(item, { status: 201 })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
      throw err
    }
  }
  return NextResponse.json({ error: 'Could not allocate an item code, please retry' }, { status: 503 })
}

// PATCH /api/inventory/items - edit, remove, or regenerate an item's QR code
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'settings.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { id, generateCode } = parsed.data
  let code = parsed.data.code

  const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (generateCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const updated = await prisma.inventoryItem.update({
          where: { id },
          data: { code: await nextItemCode(prisma) },
        })
        return NextResponse.json(updated)
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
        throw err
      }
    }
    return NextResponse.json({ error: 'Could not allocate an item code, please retry' }, { status: 503 })
  }

  code = code === null ? null : code ? normaliseItemCode(code) : null
  if (code) {
    const clash = await prisma.inventoryItem.findUnique({ where: { code } })
    if (clash && clash.id !== id) {
      return NextResponse.json({ error: `Code ${code} is already used by ${clash.name}` }, { status: 409 })
    }
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: { code },
  })
  return NextResponse.json(updated)
}
