import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClinicProfileForm } from '@/components/settings/ClinicProfileForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Clinic Profile' }

// Store clinic settings in a simple key-value table via audit_logs trick
// In production you'd have a Settings table — for now we use a JSON approach
export default async function ClinicProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  // Get first branch as the "main" clinic info seed
  const mainBranch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Clinic profile</h1>
      <p className="text-base text-gray-500 mb-6">This information appears on invoice headers and patient communications.</p>
      <ClinicProfileForm initialData={mainBranch} />
    </div>
  )
}
