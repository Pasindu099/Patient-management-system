'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open:        boolean
  title:       string
  description: string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:      'danger' | 'warning' | 'info'
  onConfirm:   () => void
  onCancel:    () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Dialog */}
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            variant === 'danger'  && 'bg-red-100',
            variant === 'warning' && 'bg-amber-100',
            variant === 'info'    && 'bg-blue-100',
          )}>
            <AlertTriangle className={cn(
              'w-6 h-6',
              variant === 'danger'  && 'text-red-600',
              variant === 'warning' && 'text-amber-600',
              variant === 'info'    && 'text-blue-600',
            )} />
          </div>
          <div>
            <h2 id="confirm-title" className="text-xl font-bold text-gray-900">
              {title}
            </h2>
            <p className="text-base text-gray-600 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              variant === 'danger' ? 'btn-danger' : 'btn-primary'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
