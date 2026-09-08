import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, Printer } from 'lucide-react'
import { formatDate, formatDateTime, formatLKR, getPatientDisplayName, cn } from '@/lib/utils'
import { VisitPrintButton } from '@/components/visits/VisitPrintButton'
import { AutoPrint }      from '@/components/visits/AutoPrint'
import { VisitPrintDocuments, VisitPrintStyles } from '@/components/visits/VisitPrintDocuments'
import { ObservationFeed } from '@/components/visits/ObservationFeed'
import { DoctorMedicalHistoryPanel } from '@/components/patients/DoctorMedicalHistoryPanel'
import { can, isDoctorRole } from '@/lib/permissions'
import type { Metadata } from 'next'

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string; close?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const v = await prisma.visit.findUnique({ where: { id }, select: { visitNumber: true } })
  return { title: v?.visitNumber ?? 'Visit' }
}

export default async function VisitDetailPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params
  const query = await searchParams

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      patient: {
        include: {
          medicalHistory: true,
          treatmentPlans: {
            where: { status: 'PLANNED' },
            include: {
              items: {
                where: { status: 'PLANNED' },
                orderBy: [{ phase: 'asc' }, { sequence: 'asc' }],
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      doctor:  { select: { id: true, name: true } },
      branch:  true,
      prescriptions: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      invoices: {
        include: {
          invoice: {
            include: {
              items:    true,
              payments: { orderBy: { paidAt: 'desc' } },
              installmentPlan: {
                include: { installments: { orderBy: { number: 'asc' } } },
              },
            },
          },
        },
      },
    },
  })

  if (!visit) notFound()

  // Admin has no clinical functions anywhere in this app; a doctor may only
  // open their own visits — everything else (nurse scribe, reception billing)
  // legitimately needs cross-doctor access, so only those two cases are blocked.
  if (session.user.role === 'ADMIN') redirect('/dashboard')
  if (isDoctorRole(session.user.role) && visit.doctorId !== session.user.id) redirect('/dashboard')

  const invoice         = visit.invoices[0]?.invoice
  const prescription    = visit.prescriptions[0]
  const canSeeVisitMoney = can(session.user.role, 'money.aggregate') ||
    (can(session.user.role, 'billing.visit') && visit.doctorId === session.user.id)
  const visibleInvoice  = canSeeVisitMoney ? invoice : null
  const installmentPlan = visibleInvoice?.installmentPlan
  const allergies       = (visit.patient.medicalHistory?.allergies as any[]) ?? []
  const printTarget     = query.print === 'bill' || query.print === 'prescription' ? query.print : undefined
  const autoPrint       = query.print === '1' || !!printTarget
  const closeAfterPrint = query.close === '1'

  return (
    <>
      {autoPrint && <AutoPrint target={printTarget} closeAfterPrint={closeAfterPrint} />}
      <VisitPrintStyles />

      <div className="p-6 max-w-3xl mx-auto space-y-5 no-print">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/visits" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to visits
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {(visibleInvoice || prescription) && (
              <Link href={`/visits/${visit.id}/print`} className="btn-secondary !text-sm !px-4 !py-2">
                <Printer className="w-4 h-4" />
                Print preview
              </Link>
            )}
            <VisitPrintButton visitId={visit.id} hasInvoice={!!visibleInvoice} hasPrescription={!!prescription} />
          </div>
        </div>

        {/* Allergy alert */}
        {allergies.length > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border-2 border-red-500 rounded-xl px-5 py-3 no-print">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <p className="text-base font-bold text-red-900">
              Allergy: {allergies.map((a: any) => `${a.substance} (${a.reaction})`).join(' | ')}
            </p>
          </div>
        )}

        <DoctorMedicalHistoryPanel patient={visit.patient} />

        {/* Visit summary */}
        <div className="section-card">
          <div className="section-card-header">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{visit.visitNumber}</h1>
              <p className="text-base text-gray-500">
                {formatDateTime(visit.visitDate)} | Dr. {visit.doctor.name}
                {visit.branch ? ` | ${visit.branch.name}` : ''}
              </p>
            </div>
            <span className={cn(
              'text-sm font-semibold px-3 py-1 rounded-full',
              visit.status === 'COMPLETED'    ? 'bg-green-100 text-green-700' :
              visit.status === 'READY_TO_PAY' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-700'
            )}>
              {visit.status === 'IN_PROGRESS'  ? 'In treatment' :
               visit.status === 'READY_TO_PAY' ? 'Ready to pay' : 'Completed'}
            </span>
          </div>
          <div className="section-card-body space-y-3">
            {[
              ['Chief complaint',  visit.chiefComplaint],
              ['Examination',      visit.examination],
              ['Diagnosis',        visit.diagnosis],
              ['Treatment done',   visit.treatmentDone],
              ['Next visit plan',  visit.nextVisitPlan],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string} className="flex gap-3">
                <span className="text-sm font-semibold text-gray-500 w-36 flex-shrink-0">{label as string}</span>
                <span className="text-base text-gray-900">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice */}
        {visibleInvoice && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="text-lg font-semibold text-gray-900">Bill — {visibleInvoice.invoiceNumber}</h2>
              <span className={cn(
                'text-sm font-semibold px-3 py-1 rounded-full',
                visibleInvoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                visibleInvoice.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {visibleInvoice.status}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-sm font-semibold text-gray-500">
                    <th className="px-5 py-3 text-left">Treatment</th>
                    <th className="px-4 py-3 text-center">Tooth</th>
                    <th className="px-4 py-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoice.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-center text-gray-500 font-mono text-sm">{item.toothNumbers ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatLKR(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 space-y-1.5">
              <div className="flex justify-between text-base text-gray-600">
                <span>Subtotal</span><span>{formatLKR(visibleInvoice.subtotal)}</span>
              </div>
              {visibleInvoice.discount > 0 && (
                <div className="flex justify-between text-base text-green-700 font-semibold">
                  <span>Waived / Discount</span><span>− {formatLKR(visibleInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total</span><span>{formatLKR(visibleInvoice.total)}</span>
              </div>
              {visibleInvoice.amountPaid > 0 && (
                <div className="flex justify-between text-base text-green-700">
                  <span>Paid</span><span>{formatLKR(visibleInvoice.amountPaid)}</span>
                </div>
              )}
              {visibleInvoice.balance > 0 && (
                <div className="flex justify-between text-lg font-bold text-red-700">
                  <span>Balance due</span><span>{formatLKR(visibleInvoice.balance)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Installment plan */}
        {installmentPlan && (
          <div className="section-card border-2 border-blue-200">
            <div className="section-card-header bg-blue-50">
              <h2 className="text-lg font-semibold text-blue-900">Installment plan</h2>
              <p className="text-base font-bold text-blue-700">
                {installmentPlan.installments.length} payment{installmentPlan.installments.length === 1 ? '' : 's'} - {formatLKR(installmentPlan.totalAmount)}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {installmentPlan.installments.map(inst => (
                <div key={inst.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      inst.paidAt ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {inst.number}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        Installment {inst.number}
                      </p>
                      {inst.paidAt && (
                        <p className="text-sm text-gray-400">Paid {formatDate(inst.paidAt)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-gray-900">
                      {formatLKR(inst.amount)}
                    </span>
                    {inst.paidAt ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nurse scribe / doctor observations — append-only, live between devices */}
        <ObservationFeed
          visitId={visit.id}
          doctorId={visit.doctor.id}
          doctorName={visit.doctor.name}
          currentUser={{ id: session.user.id, role: session.user.role }}
          locked={!!visit.lockedAt}
        />

        {/* Prescription summary */}
        {prescription && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="text-lg font-semibold text-gray-900">Prescription — {prescription.prescriptionNumber}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dose</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.items.map(item => (
                    <tr key={item.id}>
                      <td className="font-semibold">{item.drugName}</td>
                      <td>{item.dose}</td>
                      <td>{item.frequency}</td>
                      <td>{item.duration}</td>
                      <td className="text-gray-500 text-sm">{item.instructions ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <VisitPrintDocuments visit={visit} canSeeBill={canSeeVisitMoney} />
    </>
  )
}
