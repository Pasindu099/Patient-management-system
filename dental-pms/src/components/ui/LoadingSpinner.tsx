import { cn } from '@/lib/utils'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin',
        className
      )}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <LoadingSpinner className="w-10 h-10 mx-auto mb-3" />
        <p className="text-base text-gray-500">Loading…</p>
      </div>
    </div>
  )
}
