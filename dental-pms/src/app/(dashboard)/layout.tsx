import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar }  from '@/components/layout/Topbar'
import { SessionGuard } from '@/components/auth/SessionGuard'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  })
  if (!user?.isActive) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <SessionGuard />
      {/* Sidebar — fixed left */}
      <Sidebar user={session.user} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar user={session.user} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
