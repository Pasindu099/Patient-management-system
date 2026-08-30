import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { can } from '@/lib/permissions'
import { AgentSettingsClient } from '@/components/settings/AgentSettingsClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AI Agent Access' }

export default async function AgentsSettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'settings.admin')) redirect('/settings')

  return <AgentSettingsClient />
}
