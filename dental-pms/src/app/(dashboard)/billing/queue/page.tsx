import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Clock, CheckCircle, ChevronRight } from 'lucide-react'
import { formatTime, formatLKR, getPatientDisplayName, cn } from '@/lib/utils'
import { PayInstallmentButton } from '@/components/visits/PayInstallmentButton'
import type { Metadata } from 'next'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Payment Queue' }

export default async function PaymentQueuePage() {
  const session = await auth()
  if (!session) redirect('/login')

  // Payments are handled by doctors after treatment.
  if (!can(session.user.role, 'billing.collect')) redirect('/dashboard')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Ready to pay — treatment done, waiting at reception
  const readyToPay = await prisma.visit.findMany({
    where: { status: 'READY_TO_PAY', doctorId: session.user.id, visitDate: { gte: today, lte: todayEnd } },
    orderBy: { completedAt: 'asc' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
      doctor:  { select: { name: true } },
      invoices: {
        include: {
          invoice: {
            include: {
              installmentPlan: { include: { installments: { orderBy: { number: 'asc' } } } },
              payments: true,
            },
          },
        },
      },
    },
  })

  // In treatment right now
  const inTreatment = await prisma.visit.findMany({
    where: { status: 'IN_PROGRESS', doctorId: session.user.id, visitDate: { gte: today, lte: todayEnd } },
    orderBy: { visitDate: 'asc' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      doctor:  { select: { name: true } },
    },
  })

  // Completed today
  const completedToday = await prisma.visit.findMany({
    where: { status: 'COMPLETED', doctorId: session.user.id, visitDate: { gte: today, lte: todayEnd } },
    orderBy: { completedAt: 'desc' },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      doctor:  { select: { name: true } },
    },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Payment Queue</h1>
        <p className="text-base text-gray-500 mt-1">
          Your patients finishing treatment today - {readyToPay.length} waiting to pay
        </p>
      </div>

      {/* ── READY TO PAY ─────────────────────────────────────────── */}
      <div className="section-card border-2 border-green-300">
        <div className="section-card-header bg-green-50">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-green-900">Ready to pay</h2>
            <span className="bg-green-600 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
              {readyToPay.length}
            </span>
          </div>
        </div>

        {readyToPay.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-base">No patients waiting to pay right now</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {readyToPay.map(visit => {
              const invoice         = visit.invoices[0]?.invoice
              const installmentPlan = invoice?.installmentPlan
              const nextUnpaid      = installmentPlan?.installments.find(i => !i.paidAt)
              const amountDue       = nextUnpaid
                ? nextUnpaid.amount
                : invoice?.balance ?? 0
              const isInstallment   = !!installmentPlan

              return (
                <div key={visit.id} className="px-6 py-5">
                  <div className="flex items-start gap-4 flex-wrap">

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xl font-bold text-gray-900">
                          {getPatientDisplayName(visit.patient)}
                        </p>
                        <span className="text-sm text-gray-400 font-mono">{visit.patient.patientNumber}</span>
                        {isInstallment && (
                          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Installment {(nextUnpaid?.number ?? 1)} of {installmentPlan!.numberOfInstallments}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Dr. {visit.doctor.name} · finished {formatTime(visit.completedAt ?? visit.visitDate)}
                      </p>
                    </div>

                    {/* Amount due */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-gray-500">
                        {isInstallment ? 'Instalment due' : 'Amount due'}
                      </p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatLKR(amountDue)}
                      </p>
                      {isInstallment && (
                        <p className="text-xs text-gray-400">
                          Total: {formatLKR(installmentPlan!.totalAmount)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-4 flex-wrap">
                    {invoice && nextUnpaid && (
                      <PayInstallmentButton
                        installmentId={nextUnpaid.id}
                        invoiceId={invoice.id}
                        visitId={visit.id}
                        amount={nextUnpaid.amount}
                      />
                    )}
                    {invoice && !isInstallment && invoice.balance > 0 && (
                      <Link
                        href={`/billing/${invoice.id}`}
                        className="btn-primary !bg-green-600 hover:!bg-green-700"
                      >
                        <Receipt className="w-4 h-4" />
                        Record full payment
                      </Link>
                    )}
                    <Link
                      href={`/visits/${visit.id}`}
                      className="btn-secondary"
                    >
                      View visit details
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── IN TREATMENT ─────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">In treatment now</h2>
            <span className="bg-amber-100 text-amber-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {inTreatment.length}
            </span>
          </div>
        </div>

        {inTreatment.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No patients in treatment right now</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inTreatment.map(visit => (
              <div key={visit.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">
                    {getPatientDisplayName(visit.patient)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Dr. {visit.doctor.name} · started {formatTime(visit.visitDate)}
                  </p>
                </div>
                <Link href={`/visits/${visit.id}`} className="text-gray-400 hover:text-blue-600">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── COMPLETED TODAY ───────────────────────────────────────── */}
      {completedToday.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Completed today</h2>
              <span className="bg-gray-100 text-gray-600 text-sm font-bold px-2.5 py-0.5 rounded-full">
                {completedToday.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {completedToday.map(visit => (
              <div key={visit.id} className="flex items-center gap-4 px-6 py-3">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-base font-medium text-gray-700">
                    {getPatientDisplayName(visit.patient)}
                  </span>
                  <span className="text-sm text-gray-400 ml-2">
                    · Dr. {visit.doctor.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
