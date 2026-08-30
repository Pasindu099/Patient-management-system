import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Profile' }

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, role: true, lastLoginAt: true },
  })

  if (!user) redirect('/login')

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to settings
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">My profile</h1>
      <p className="text-base text-gray-500 mb-6">Update your name, phone and password.</p>
      <ProfileForm user={user} />
    </div>
  )
}
