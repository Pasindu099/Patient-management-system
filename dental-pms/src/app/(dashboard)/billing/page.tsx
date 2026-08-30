import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Search, ChevronRight,
  AlertCircle, CheckCircle, Clock, XCircle,
  TrendingUp, Receipt, DollarSign,
} from 'lucide-react'
import {
  formatDate, formatCurrency, getPatientDisplayName,
  cn,
} from '@/lib/utils'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Billing' }

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  DRAFT:       { label: 'Draft',        icon: Clock,         badge: 'bg-gray-100 text-gray-600' },
  SENT:        { label: 'Sent',         icon: Clock,         badge: 'bg-blue-100 text-blue-700' },
  PARTIAL:     { label: 'Partial',      icon: AlertCircle,   badge: 'bg-amber-100 text-amber-700' },
  PAID:        { label: 'Paid',         icon: CheckCircle,   badge: 'bg-green-100 text-green-700' },
  OVERDUE:     { label: 'Overdue',      icon: AlertCircle,   badge: 'bg-red-100 text-red-700' },
  CANCELLED:   { label: 'Cancelled',    icon: XCircle,       badge: 'bg-gray-100 text-gray-500' },
  WRITTEN_OFF: { label: 'Written off',  icon: XCircle,       badge: 'bg-gray-100 text-gray-500' },
}

export default async function BillingPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'billing.collect')) redirect('/dashboard')

  const params = await searchParams

  const status = params.status ?? 'all'
  const search = params.search?.trim() ?? ''
  const page   = Math.max(1, parseInt(params.page ?? '1'))
  const limit  = 25
  const skip   = (page - 1) * limit

  const where: any = {}
  where.visitInvoices = { some: { visit: { doctorId: session.user.id } } }
  if (status !== 'all') where.status = status
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { patient: { firstName: { contains: search, mode: 'insensitive' } } },
      { patient: { lastName:  { contains: search, mode: 'insensitive' } } },
      { patient: { nicNumber: { contains: search } } },
    ]
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, nicNumber: true } },
        branch:  { select: { name: true } },
        payments: { select: { amount: true, method: true } },
        visitInvoices: { include: { visit: { select: { doctorId: true } } } },
        _count: { select: { items: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])

  // Summary stats (all time, across statuses)
  const [totalOutstanding, totalPaidThisMonth, overdueCount] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] },
        visitInvoices: { some: { visit: { doctorId: session.user.id } } },
      },
      _sum: { balance: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: 'PAID',
        paidDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        currency: 'LKR',
        visitInvoices: { some: { visit: { doctorId: session.user.id } } },
      },
      _sum: { total: true },
    }),
    prisma.invoice.count({
      where: {
        status: 'OVERDUE',
        visitInvoices: { some: { visit: { doctorId: session.user.id } } },
      },
    }),
  ])

  const statusTabs = [
    { key: 'all',     label: 'All' },
    { key: 'DRAFT',   label: 'Draft' },
    { key: 'SENT',    label: 'Sent' },
    { key: 'PARTIAL', label: 'Partial' },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'PAID',    label: 'Paid' },
  ]

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
          <p className="text-base text-gray-500 mt-0.5">{total.toLocaleString()} invoice{total !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/billing/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          New invoice
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="stat-card-label">Outstanding</p>
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="stat-card-value text-red-700">
            {formatCurrency(totalOutstanding._sum.balance ?? 0, 'LKR')}
          </p>
          <p className="stat-card-sub">{overdueCount} overdue invoice{overdueCount !== 1 ? 's' : ''}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="stat-card-label">Collected this month</p>
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="stat-card-value text-green-700">
            {formatCurrency(totalPaidThisMonth._sum.total ?? 0, 'LKR')}
          </p>
          <p className="stat-card-sub">LKR collections</p>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between mb-2">
            <p className="stat-card-label">Invoices this month</p>
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="stat-card-value">{total}</p>
          <p className="stat-card-sub">Total invoices</p>
        </div>
      </div>

      <div className="section-card">
        {/* Search + status tabs */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          <form method="GET">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Search by invoice number, patient name or NIC…"
                className="form-input pl-12"
              />
              {status !== 'all' && <input type="hidden" name="status" value={status} />}
            </div>
          </form>

          <div className="flex gap-2 flex-wrap">
            {statusTabs.map(t => (
              <Link
                key={t.key}
                href={`/billing?status=${t.key}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors min-h-[44px] flex items-center',
                  status === t.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Invoice table */}
        {invoices.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-xl font-semibold text-gray-500">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.DRAFT
                  const StatusIcon = cfg.icon
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link
                          href={`/billing/${inv.id}`}
                          className="text-base font-mono font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{inv._count.items} item{inv._count.items !== 1 ? 's' : ''}</p>
                      </td>
                      <td>
                        <Link
                          href={`/patients/${inv.patient.id}`}
                          className="text-base font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {getPatientDisplayName(inv.patient)}
                        </Link>
                        <p className="text-sm text-gray-400">{inv.patient.patientNumber}</p>
                      </td>
                      <td className="text-base text-gray-700">{formatDate(inv.createdAt)}</td>
                      <td className="text-base text-gray-600">{inv.branch?.name ?? '—'}</td>
                      <td>
                        <p className="text-base font-semibold text-gray-900">
                          {formatCurrency(inv.total, inv.currency as 'LKR' | 'USD')}
                        </p>
                        {inv.currency === 'USD' && (
                          <p className="text-xs text-gray-400">USD</p>
                        )}
                      </td>
                      <td>
                        <p className={cn(
                          'text-base font-bold',
                          inv.balance > 0 ? 'text-red-600' : 'text-green-600'
                        )}>
                          {formatCurrency(inv.balance, inv.currency as 'LKR' | 'USD')}
                        </p>
                      </td>
                      <td>
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
                          cfg.badge
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td>
                        <Link href={`/billing/${inv.id}`}>
                          <ChevronRight className="w-5 h-5 text-gray-400 hover:text-blue-600 transition-colors" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-base text-gray-500">
              Showing {skip + 1}–{Math.min(skip + limit, total)} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/billing?page=${page - 1}&status=${status}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="btn-secondary !px-5 !py-2 !text-sm">← Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/billing?page=${page + 1}&status=${status}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="btn-primary !px-5 !py-2 !text-sm">Next →</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
