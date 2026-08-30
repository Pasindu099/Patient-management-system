import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { AuditLogViewer } from '@/components/finance/AuditLogViewer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Audit Log' }

export default async function AuditPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'audit.view')) redirect('/dashboard')

  return <AuditLogViewer />
}
