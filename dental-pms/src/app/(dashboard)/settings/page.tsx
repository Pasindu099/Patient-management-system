import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, Users, DollarSign,
  Stethoscope, User, ChevronRight, MessageCircle, Globe,
  Package, Bot,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

const SECTIONS = [
  {
    href:    '/settings/clinic',
    icon:    Stethoscope,
    label:   'Clinic profile',
    desc:    'Name, logo, address, contact details — appears on invoice headers',
    color:   'bg-blue-100 text-blue-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/branches',
    icon:    Building2,
    label:   'Branch management',
    desc:    'Add and edit branches, assign staff to each location',
    color:   'bg-teal-100 text-teal-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/staff',
    icon:    Users,
    label:   'Staff management',
    desc:    'Add staff accounts, set roles, manage branch access',
    color:   'bg-purple-100 text-purple-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/fees',
    icon:    DollarSign,
    label:   'Fee schedule',
    desc:    'Set prices for all 86 treatments — prices auto-fill when selecting treatments during a visit',
    color:   'bg-amber-100 text-amber-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/inventory',
    icon:    Package,
    label:   'Treatment material usage',
    desc:    'Set average material usage per treatment (adult/child) — auto-deducted from inventory',
    color:   'bg-teal-100 text-teal-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/agents',
    icon:    Bot,
    label:   'AI agent access',
    desc:    'Manage scoped service accounts for the future bookkeeping agent, and review its pending proposals',
    color:   'bg-purple-100 text-purple-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/roster',
    icon:    Users,
    label:   'Doctor roster & sessions',
    desc:    'Schedule doctors per branch, weekday and session; set chairs and slot capacities',
    color:   'bg-indigo-100 text-indigo-600',
    roles:   ['ADMIN'],
  },
  {
    href:    '/settings/slots',
    icon:    Globe,
    label:   'Online booking slots',
    desc:    'Choose which time slots doctors accept online appointments from the website',
    color:   'bg-blue-100 text-blue-600',
    roles:   ['ADMIN','DOCTOR'],
  },
  {
    href:    '/settings/reminders',
    icon:    MessageCircle,
    label:   'SMS & WhatsApp reminders',
    desc:    'Send appointment reminders in Sinhala or English via Mobitel or WhatsApp',
    color:   'bg-green-100 text-green-600',
    roles:   ['ADMIN','RECEPTIONIST','HEAD_NURSE'],
  },
  {
    href:    '/settings/profile',
    icon:    User,
    label:   'My profile',
    desc:    'Change your name, phone number and password',
    color:   'bg-gray-100 text-gray-600',
    roles:   ['ADMIN','DOCTOR','HEAD_NURSE','NURSE','RECEPTIONIST'],
  },
]

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const userSections = SECTIONS.filter(s => s.roles.includes(session.user.role))

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-base text-gray-500 mt-1">
          Manage your clinic, branches, staff and preferences.
        </p>
      </div>

      <div className="space-y-3">
        {userSections.map(s => (
          <Link
            key={`${s.href}-${s.label}`}
            href={s.href}
            className="flex items-center gap-5 p-5 bg-white rounded-2xl border-2
                       border-gray-200 hover:border-blue-300 hover:shadow-md
                       transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <s.icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-900">{s.label}</p>
              <p className="text-base text-gray-500 mt-0.5">{s.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}
