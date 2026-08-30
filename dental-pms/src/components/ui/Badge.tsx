import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray'
  size?:    'sm' | 'md'
  className?: string
}

const VARIANTS = {
  default: 'bg-gray-100    text-gray-700',
  success: 'bg-green-100   text-green-800',
  warning: 'bg-amber-100   text-amber-800',
  danger:  'bg-red-100     text-red-800',
  info:    'bg-blue-100    text-blue-800',
  purple:  'bg-purple-100  text-purple-800',
  gray:    'bg-gray-100    text-gray-600',
}

const SIZES = {
  sm: 'text-xs  px-2   py-0.5',
  md: 'text-sm  px-2.5 py-1',
}

export function Badge({
  children,
  variant  = 'default',
  size     = 'md',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {children}
    </span>
  )
}
