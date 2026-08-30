import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft, Printer, Phone, MessageCircle } from 'lucide-react'
import {
  formatDate, formatCurrency, getPatientDisplayName, cn,
} from '@/lib/utils'
import { PrintButton } from '@/components/billing/PrintButton'
import { RecordPaymentForm } from '@/components/billing/RecordPaymentForm'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } })
  return { title: inv?.invoiceNumber ?? 'Invoice' }
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:       'bg-gray-100    text-gray-700',
  SENT:        'bg-blue-100    text-blue-700',
  PARTIAL:     'bg-amber-100   text-amber-800',
  PAID:        'bg-green-100   text-green-800',
  OVERDUE:     'bg-red-100     text-red-700',
  CANCELLED:   'bg-gray-100    text-gray-500',
  WRITTEN_OFF: 'bg-gray-100    text-gray-500',
}

export default async function InvoiceDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!can(session.user.role, 'billing.collect')) redirect('/dashboard')

  const { id } = await params
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, nicNumber: true, phone: true, addressLine1: true, city: true } },
      branch:  true,
      items:   { orderBy: { id: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      visitInvoices: { include: { visit: { select: { doctorId: true } } } },
    },
  })

  if (!inv) notFound()
  if (!inv.visitInvoices.some(link => link.visit.doctorId === session.user.id)) redirect('/billing')

  const cur = inv.currency as 'LKR' | 'USD'
  const canRecordPayment = inv.balance > 0 && !['CANCELLED','WRITTEN_OFF','PAID'].includes(inv.status)
  const USD_RATE = inv.exchangeRate ?? 320

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <Link href="/billing" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to billing
        </Link>
  <PrintButton />
      </div>

      {/* Invoice card */}
      <div className="section-card" id="printable">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{inv.invoiceNumber}</h1>
              <span className={cn('text-sm font-semibold px-3 py-1 rounded-full', STATUS_STYLES[inv.status] ?? STATUS_STYLES.DRAFT)}>
                {inv.status}
              </span>
              {inv.currency === 'USD' && (
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">USD</span>
              )}
            </div>
            <p className="text-base text-gray-500">{inv.branch?.name ?? 'DentalCare'}</p>
            {inv.branch?.address && <p className="text-sm text-gray-400">{inv.branch.address}, {inv.branch.city}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Date issued</p>
            <p className="text-base font-semibold text-gray-900">{formatDate(inv.createdAt)}</p>
            {inv.dueDate && (
              <>
                <p className="text-sm text-gray-500 mt-1">Due date</p>
                <p className={cn('text-base font-semibold', new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' ? 'text-red-600' : 'text-gray-900')}>
                  {formatDate(inv.dueDate)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Patient info */}
        <div className="px-8 py-5 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bill to</p>
          <div className="flex items-start justify-between">
            <div>
              <Link href={`/patients/${inv.patient.id}`} className="text-lg font-bold text-gray-900 hover:text-blue-600">
                {getPatientDisplayName(inv.patient)}
              </Link>
              <p className="text-sm text-gray-500">
                {inv.patient.patientNumber}
                {inv.patient.nicNumber ? ` · NIC: ${inv.patient.nicNumber}` : ''}
              </p>
              {inv.patient.addressLine1 && (
                <p className="text-sm text-gray-500">{inv.patient.addressLine1}, {inv.patient.city}</p>
              )}
            </div>
            {inv.patient.phone && (
              <div className="flex gap-2">
                <a href={`tel:${inv.patient.phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
                  <Phone className="w-4 h-4" />{inv.patient.phone}
                </a>
                <a href={`https://wa.me/${inv.patient.phone.replace(/\D/g,'')}`} target="_blank"
                   className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-800">
                  <MessageCircle className="w-4 h-4" />WA
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="px-8 py-5">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b-2 border-gray-200">
                <th className="pb-3 font-semibold">Description</th>
                <th className="pb-3 font-semibold">Tooth</th>
                <th className="pb-3 font-semibold text-center">Qty</th>
                <th className="pb-3 font-semibold text-right">Unit price</th>
                <th className="pb-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map(item => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 font-medium text-gray-900">{item.description}</td>
                  <td className="py-3 text-gray-500 text-sm">{item.toothNumbers || '—'}</td>
                  <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-700">{formatCurrency(item.unitPrice, cur)}</td>
                  <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 py-5 border-t-2 border-gray-200 bg-gray-50">
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-base text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(inv.subtotal, cur)}</span>
            </div>
            {inv.discount > 0 && (
              <div className="flex justify-between text-base text-green-700">
                <span>Discount</span>
                <span>− {formatCurrency(inv.discount, cur)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t-2 border-gray-300">
              <span>Total</span>
              <span>{formatCurrency(inv.total, cur)}</span>
            </div>
            {inv.currency === 'USD' && (
              <p className="text-sm text-gray-400 text-right">≈ {formatCurrency(inv.total * USD_RATE, 'LKR')}</p>
            )}
            <div className="flex justify-between text-base text-gray-600">
              <span>Amount paid</span>
              <span className="text-green-700 font-semibold">{formatCurrency(inv.amountPaid, cur)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
              <span className={inv.balance > 0 ? 'text-red-700' : 'text-green-700'}>Balance due</span>
              <span className={inv.balance > 0 ? 'text-red-700' : 'text-green-700'}>
                {formatCurrency(inv.balance, cur)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="px-8 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Notes</p>
            <p className="text-base text-gray-700">{inv.notes}</p>
          </div>
        )}
      </div>

      {/* Payment history */}
      {inv.payments.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="text-lg font-semibold text-gray-900">Payment history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.payments.map(p => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidAt)}</td>
                    <td className="capitalize">{p.method.replace('_', ' ')}</td>
                    <td className="text-gray-500">{p.reference || '—'}</td>
                    <td className="text-right font-semibold text-green-700">
                      {formatCurrency(p.amount, p.currency as 'LKR' | 'USD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record payment */}
      {canRecordPayment && (
        <RecordPaymentForm
          invoiceId={inv.id}
          balance={inv.balance}
          currency={cur}
        />
      )}
    </div>
  )
}
