import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { computeKpis } from '@/lib/kpi'

// GET /api/kpi?period=month|quarter|year|custom&from=&to=&branchId=
//
// ADMIN ONLY. The payload names individual doctors alongside their revenue,
// discounting and re-treatment figures — there is no filtered-down version of
// this route for other roles, by design.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (!can(session.user.role, 'kpi.admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'month'
  const branchId = searchParams.get('branchId') || undefined

  const to = searchParams.get('to')
    ? new Date(`${searchParams.get('to')}T23:59:59`)
    : new Date()
  let from: Date

  if (searchParams.get('from')) {
    from = new Date(searchParams.get('from')!)
  } else {
    from = new Date(to)
    from.setHours(0, 0, 0, 0)
    if (period === 'week') from.setDate(to.getDate() - 7)
    else if (period === 'quarter') from.setMonth(to.getMonth() - 3, 1)
    else if (period === 'year') from.setMonth(0, 1)
    else from.setDate(1)  // month to date
  }

  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  const result = await computeKpis({ from, to, branchId })
  return NextResponse.json(result)
}
