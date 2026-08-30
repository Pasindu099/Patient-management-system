import { cn } from '@/lib/utils'

interface ProviderData {
  providerId: string
  _count:     { id: number }
  provider?:  { id: string; name: string; role: string } | null
}

export function ProviderTable({ providers }: { providers: ProviderData[] }) {
  if (!providers.length) {
    return <p className="text-center text-gray-400 py-8 text-sm italic">No completed appointments yet</p>
  }

  const max = Math.max(...providers.map(p => p._count.id), 1)

  return (
    <div className="space-y-3">
      {providers.map((p, i) => {
        const pct = Math.round((p._count.id / max) * 100)
        const medals = ['🥇', '🥈', '🥉']
        return (
          <div key={p.providerId}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">{medals[i] ?? ''}</span>
                <span className="text-base font-semibold text-gray-900">
                  {p.provider?.name ?? 'Unknown'}
                </span>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  p.provider?.role === 'DOCTOR'     ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {p.provider?.role === 'DOCTOR' ? 'Doctor' : p.provider?.role}
                </span>
              </div>
              <span className="text-base font-bold text-gray-900">
                {p._count.id} <span className="text-sm font-normal text-gray-400">appts</span>
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-teal-500' : 'bg-purple-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
