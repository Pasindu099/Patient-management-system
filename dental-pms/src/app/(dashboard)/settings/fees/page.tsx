import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, DollarSign } from 'lucide-react'
import { FeeScheduleEditor } from '@/components/settings/FeeScheduleEditor'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Fee Schedule' }

export default async function FeeSchedulePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  const fees = await prisma.treatmentFee.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  const grouped = fees.reduce((acc, fee) => {
    if (!acc[fee.category]) acc[fee.category] = []
    acc[fee.category].push(fee)
    return acc
  }, {} as Record<string, typeof fees>)

  const pricedCount = fees.filter(f => f.price > 0).length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fee Schedule</h1>
          <p className="text-base text-gray-500">
            {pricedCount} of {fees.length} treatments have prices · prices auto-fill when selecting treatments during a visit
          </p>
        </div>
      </div>

      <div className="mt-2 mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700">
        Treatments showing <strong>Rs. 0</strong> have no price yet — click the price to edit.
        All 86 treatments from your clinic fee schedule are loaded.
      </div>

      <FeeScheduleEditor grouped={JSON.parse(JSON.stringify(grouped))} />
    </div>
  )
}
