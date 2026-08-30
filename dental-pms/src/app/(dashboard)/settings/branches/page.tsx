import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BranchManager } from '@/components/settings/BranchManager'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Branch Management' }

export default async function BranchesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { appointments: true } },
      users:  { include: { user: { select: { id: true, name: true, role: true } } } },
    },
  })

  const allStaff = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true, email: true },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Branch management</h1>
      <p className="text-base text-gray-500 mb-6">Add branches and assign staff to each location.</p>
      <BranchManager
        initialBranches={JSON.parse(JSON.stringify(branches))}
        allStaff={allStaff}
      />
    </div>
  )
}
