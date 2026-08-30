import { prisma } from '@/lib/prisma'
import { PublicIntakeForm } from '@/components/intake/PublicIntakeForm'

export const metadata = { title: 'Patient Intake' }
export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, city: true },
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <PublicIntakeForm branches={JSON.parse(JSON.stringify(branches))} />
    </main>
  )
}
