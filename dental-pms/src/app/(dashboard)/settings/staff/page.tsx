import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { StaffManager } from '@/components/settings/StaffManager'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Staff Management' }

export default async function StaffPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  const staff = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: {
      branches: {
        include: { branch: { select: { id: true, name: true } } },
      },
    },
  })

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Staff management</h1>
      <p className="text-base text-gray-500 mb-6">Add staff accounts, set roles, and manage branch access.</p>
      <StaffManager
        initialStaff={JSON.parse(JSON.stringify(staff))}
        branches={branches}
      />
    </div>
  )
}
