'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  title:   string
  message?: string
}

let toastQueue: ((t: Toast) => void) | null = null

export function showToast(type: ToastType, title: string, message?: string) {
  toastQueue?.({ id: Date.now().toString(), type, title, message })
}

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-green-300 bg-green-50',
  error:   'border-red-300   bg-red-50',
  warning: 'border-amber-300 bg-amber-50',
  info:    'border-blue-300  bg-blue-50',
}

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-green-600',
  error:   'text-red-600',
  warning: 'text-amber-600',
  info:    'text-blue-600',
}

const TITLE_STYLES: Record<ToastType, string> = {
  success: 'text-green-900',
  error:   'text-red-900',
  warning: 'text-amber-900',
  info:    'text-blue-900',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((t: Toast) => {
    setToasts(prev => [...prev, t])
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id))
    }, 5000)
  }, [])

  useEffect(() => {
    toastQueue = add
    return () => { toastQueue = null }
  }, [add])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
      {toasts.map(toast => {
        const Icon = ICONS[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 px-4 py-4 rounded-xl border-2 shadow-lg',
              'animate-fade-in',
              STYLES[toast.type]
            )}
            role="alert"
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', ICON_STYLES[toast.type])} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-base font-semibold', TITLE_STYLES[toast.type])}>
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-sm text-gray-600 mt-0.5">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== toast.id))}
              className="text-gray-400 hover:text-gray-700 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
