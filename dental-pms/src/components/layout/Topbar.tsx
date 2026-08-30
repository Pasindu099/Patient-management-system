'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Search, Bell, LogOut, ChevronDown,
  User, Settings, Clock,
} from 'lucide-react'
import { cn, ROLE_LABELS, ROLE_COLORS, formatClinicClock } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface TopbarProps {
  user: {
    name:  string
    email: string
    role:  UserRole
  }
}

export function Topbar({ user }: TopbarProps) {
  const router = useRouter()
  const [query, setQuery]           = useState('')
  const [menuOpen, setMenuOpen]     = useState(false)
  const [now, setNow]               = useState(() => new Date())
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/patients?search=${encodeURIComponent(query.trim())}`)
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: '/login' })
  }

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const clinicClock = formatClinicClock(now)

  return (
    <header className="h-16 bg-white border-b-2 border-gray-200 flex items-center
                       gap-4 px-6 flex-shrink-0 z-10">

      {/* Global patient search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5
                             text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search patients by name, ID, or phone…"
            className="w-full pl-11 pr-4 py-2.5 text-base border-2 border-gray-200
                       rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400
                       focus:outline-none transition-all placeholder:text-gray-400"
            aria-label="Search patients"
          />
          {query && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs
                            text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border
                            border-gray-200 font-mono">
              Enter
            </kbd>
          )}
        </div>
      </form>

      {/* Spacer */}
      <div className="flex-1" />

      {user.role === 'DOCTOR' && (
        <div className="hidden lg:flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-blue-800">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <div className="text-right">
            <p className="text-sm font-bold leading-tight">
              {clinicClock.time}
            </p>
            <p className="text-xs font-semibold leading-tight text-blue-600">
              {clinicClock.date}
            </p>
          </div>
        </div>
      )}

      {/* Notification bell */}
      <button
        className="relative p-2.5 rounded-xl text-gray-500 hover:bg-gray-100
                   hover:text-gray-800 transition-colors min-h-[44px] min-w-[44px]
                   flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {/* Unread dot */}
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500
                         rounded-full border-2 border-white" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl',
            'hover:bg-gray-100 transition-colors min-h-[44px]',
            menuOpen && 'bg-gray-100'
          )}
          aria-label="User menu"
          aria-expanded={menuOpen}
        >
          {/* Avatar circle */}
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center
                          justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{user.name}</p>
            <p className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5',
              ROLE_COLORS[user.role]
            )}>
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-gray-400 transition-transform duration-150',
            menuOpen && 'rotate-180'
          )} />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl
                            border-2 border-gray-200 shadow-xl z-20 overflow-hidden
                            animate-fade-in">
              {/* User info header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings/profile') }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-base
                             text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <User className="w-5 h-5 text-gray-400" />
                  My profile
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings') }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-base
                             text-gray-700 hover:bg-gray-50 transition-colors text-left"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                  Settings
                </button>
              </div>

              <div className="border-t border-gray-200 py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-base
                             text-red-600 hover:bg-red-50 transition-colors text-left
                             font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
