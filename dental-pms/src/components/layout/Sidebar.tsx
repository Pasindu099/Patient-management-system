'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, UserPlus, Users, CalendarDays,
  ClipboardList, Receipt, BarChart3, Settings,
  Stethoscope, Bell, ListOrdered,
  Wallet, ShieldCheck, Package, Smile, BriefcaseBusiness, Gauge,
} from 'lucide-react'
import { cn, ROLE_LABELS } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface Props {
  user: { name: string; email: string; role: UserRole }
}

// ─── NAV STRUCTURE ────────────────────────────────────────────────────────────
// Simple rule: empty allowedRoles = everyone sees it
const NAV = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard',        href: '/dashboard',          icon: LayoutDashboard, roles: [] as UserRole[] },
      { label: 'Register Patient', href: '/patients/new',       icon: UserPlus,        roles: ['NURSE','HEAD_NURSE','RECEPTIONIST'] as UserRole[] },
      { label: 'Patients',         href: '/patients',           icon: Users,           roles: ['DOCTOR','NURSE','HEAD_NURSE','RECEPTIONIST'] as UserRole[] },
      { label: 'Reception Queue',  href: '/queue',              icon: ListOrdered,     roles: ['RECEPTIONIST','HEAD_NURSE'] as UserRole[] },
      { label: 'Appointments',     href: '/appointments',       icon: CalendarDays,    roles: ['DOCTOR','NURSE','HEAD_NURSE','RECEPTIONIST'] as UserRole[] },
      { label: 'Appointment Slots', href: '/settings/slots',     icon: CalendarDays,    roles: ['DOCTOR'] as UserRole[] },
      { label: 'Inventory',        href: '/inventory',          icon: Package,         roles: ['NURSE','HEAD_NURSE','RECEPTIONIST','ADMIN'] as UserRole[] },
    ],
  },
  {
    // Doctor has no items here — the queue's "Receive to chair" is the only
    // entry into a visit, and doctors have no clinical menu (spec: one
    // screen, one job, no navigation clutter beyond Home + Patients).
    section: 'Clinical',
    items: [
      { label: 'Clinical',      href: '/clinical',            icon: ClipboardList, roles: ['NURSE','HEAD_NURSE'] as UserRole[] },
      { label: 'Active Visits', href: '/clinical/active',     icon: Stethoscope,  roles: ['NURSE','HEAD_NURSE'] as UserRole[] },
      { label: 'Diagnosis Assist', href: '/diagnosis',        icon: Smile,       roles: ['NURSE','HEAD_NURSE'] as UserRole[] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Billing',       href: '/billing',            icon: Receipt,  roles: ['HEAD_NURSE'] as UserRole[], title: 'Create and view invoices' },
      { label: 'Payment Queue',  href: '/billing/queue',      icon: Receipt,  roles: ['HEAD_NURSE'] as UserRole[], title: 'Patients ready to pay right now' },
      { label: 'Finance',     href: '/finance',            icon: Wallet,    roles: ['ADMIN'] as UserRole[], title: 'Clinic-wide ledger: expenses, debtors, profit' },
      { label: 'Earnings',    href: '/finance/net-cash',   icon: Receipt,   roles: ['ADMIN'] as UserRole[], title: 'Patient earnings report' },
      { label: 'Practice KPIs', href: '/kpi',              icon: Gauge,     roles: ['ADMIN'] as UserRole[], title: 'Per-doctor financial, productivity, retention and efficiency KPIs' },
      { label: 'Staff Profile', href: '/staff-profile',    icon: BriefcaseBusiness, roles: ['ADMIN'] as UserRole[], title: 'Per-staff salary and productivity' },
      { label: 'Reports',     href: '/reports',            icon: BarChart3, roles: ['ADMIN'] as UserRole[], title: 'Revenue trends and branch comparison over time' },
      { label: 'Audit Log',   href: '/audit',              icon: ShieldCheck, roles: ['ADMIN'] as UserRole[] },
      { label: 'Reminders',   href: '/settings/reminders', icon: Bell,     roles: ['ADMIN','HEAD_NURSE'] as UserRole[] },
    ],
  },
  {
    section: 'Practice',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] as UserRole[] },
    ],
  },
]

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:        'bg-purple-600',
  DOCTOR:       'bg-blue-600',
  HEAD_NURSE:   'bg-rose-600',
  NURSE:        'bg-green-600',
  RECEPTIONIST: 'bg-amber-600',
}

export function Sidebar({ user }: Props) {
  const pathname = usePathname()

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <aside className="w-[240px] flex-shrink-0 bg-slate-900 flex flex-col h-full border-r border-slate-800">

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-1.5">
          <Image src="/logo-icon.png" alt="Lumora Dental Studio"
            width={44} height={44} className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight tracking-wide">LUMORA</p>
          <p className="text-slate-400 text-xs">Dental Studio</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV.map(section => {
          const visible = section.items.filter(
            item => item.roles.length === 0 || item.roles.includes(user.role)
          )
          if (!visible.length) return null

          return (
            <div key={section.section}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {visible.map(item => {
                  // Exact match for dashboard and new patient, prefix for rest
                  const isActive =
                    item.href === '/dashboard' || item.href === '/patients/new' || item.href === '/finance'
                      ? pathname === item.href
                      : item.href === '/patients'
                        ? pathname === '/patients' || (pathname.startsWith('/patients/') && pathname !== '/patients/new')
                        : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={(item as any).title}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User at bottom */}
      <div className="border-t border-slate-800 p-4">
        <Link href="/settings/profile" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors">
          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm', ROLE_COLORS[user.role])}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user.name}</p>
            <p className="text-slate-400 text-xs">{ROLE_LABELS[user.role]}</p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
