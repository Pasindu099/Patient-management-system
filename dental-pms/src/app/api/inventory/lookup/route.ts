import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { normaliseItemCode } from '@/lib/inventory'

// GET /api/inventory/lookup?code=&branchId= — resolve a scanned label to the
// item and its current quantity at that branch. Deliberately narrow: it powers
// the scan screen, so it is gated on the same permission as adjusting stock.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !can(session.user.role, 'inventory.adjust')) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
  }

  const params = new URL(req.url).searchParams
  const rawCode = params.get('code')
  const branchId = params.get('branchId')
  if (!rawCode) return NextResponse.json({ error: 'code required' }, { status: 400 })
  if (!branchId) return NextResponse.json({ error: 'branchId required' }, { status: 400 })

  const code = normaliseItemCode(rawCode)
  const item = await prisma.inventoryItem.findUnique({
    where: { code },
    include: { stock: { where: { branchId } } },
  })

  // Unknown label: tell the scan screen the code was read fine but matches
  // nothing, so it can offer to map it to an item instead of showing an error.
  if (!item || !item.isActive) {
    return NextResponse.json({ error: 'No item with this code', code }, { status: 404 })
  }

  return NextResponse.json({
    itemId: item.id,
    name: item.name,
    unit: item.unit,
    code: item.code,
    quantity: item.stock[0]?.quantity ?? 0,
    reorderThreshold: item.stock[0]?.reorderThreshold ?? 0,
    lowStock: item.stock[0] ? item.stock[0].quantity <= item.stock[0].reorderThreshold : false,
  })
}
