import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { formatDate, formatDateTime, formatLKR, getAge, getPatientDisplayName, cn } from '@/lib/utils'
import { VisitPrintButton } from '@/components/visits/VisitPrintButton'
import { AutoPrint }      from '@/components/visits/AutoPrint'
import { ObservationFeed } from '@/components/visits/ObservationFeed'
import { DoctorMedicalHistoryPanel } from '@/components/patients/DoctorMedicalHistoryPanel'
import { isDoctorRole } from '@/lib/permissions'
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
  const installmentPlan = invoice?.installmentPlan
  const allergies       = (visit.patient.medicalHistory?.allergies as any[]) ?? []
  const printTarget     = query.print === 'bill' || query.print === 'prescription' ? query.print : undefined
  const autoPrint       = query.print === '1' || !!printTarget
  const closeAfterPrint = query.close === '1'
  const patientName     = getPatientDisplayName(visit.patient)
  const branchName      = visit.branch?.name ?? 'DentalCare'
  const branchAddress   = [visit.branch?.address, visit.branch?.city].filter(Boolean).join(', ')
  const paidTotal       = invoice?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0
  const generatedAt     = new Date()

  return (
    <>
      {autoPrint && <AutoPrint target={printTarget} closeAfterPrint={closeAfterPrint} />}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 0; }
              body[data-print-target="bill"] #print-rx { display: none !important; }
              body[data-print-target="prescription"] #print-bill { display: none !important; }
              .print-document { color: #111827; font-family: Arial, Helvetica, sans-serif; }
              .print-document * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              #print-bill { padding: 12mm; }
              #print-rx {
                width: 210mm;
                height: 297mm;
                max-width: none !important;
                margin: 0 !important;
                padding: 54mm 24mm 42mm 24mm;
                color: #111;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 11pt;
                line-height: 1.35;
              }
              #print-rx .rx-pad-content {
                height: 201mm;
                overflow: hidden;
              }
              #print-rx .rx-pad-meta {
                display: grid;
                grid-template-columns: 1fr 32mm 42mm;
                gap: 7mm;
                align-items: end;
                margin-bottom: 10mm;
                font-size: 10.5pt;
              }
              #print-rx .rx-pad-field {
                border-bottom: 0.25mm solid #444;
                min-height: 8mm;
                padding-bottom: 1.5mm;
              }
              #print-rx .rx-pad-label {
                display: block;
                margin-bottom: 0.8mm;
                color: #555;
                font-size: 7.5pt;
                font-weight: 700;
                letter-spacing: 0.06em;
                text-transform: uppercase;
              }
              #print-rx .rx-pad-allergy {
                margin-bottom: 7mm;
                border: 0.25mm solid #111;
                padding: 2.5mm 3mm;
                font-size: 10pt;
                font-weight: 700;
              }
              #print-rx .rx-pad-symbol {
                margin-bottom: 5mm;
                font-family: Georgia, 'Times New Roman', serif;
                font-size: 25pt;
                font-weight: 700;
              }
              #print-rx .rx-pad-items {
                display: grid;
                gap: 4.5mm;
              }
              #print-rx .rx-pad-item {
                display: grid;
                grid-template-columns: 9mm 1fr 24mm;
                gap: 3mm;
                break-inside: avoid;
              }
              #print-rx .rx-pad-number {
                padding-top: 0.4mm;
                font-weight: 700;
              }
              #print-rx .rx-pad-drug {
                font-size: 13pt;
                font-weight: 700;
              }
              #print-rx .rx-pad-sig {
                margin-top: 1mm;
                font-size: 10.5pt;
              }
              #print-rx .rx-pad-qty {
                padding-top: 0.8mm;
                font-size: 10pt;
                font-weight: 700;
                text-align: right;
              }
              #print-rx .rx-pad-notes {
                margin-top: 8mm;
                border-top: 0.25mm solid #bbb;
                padding-top: 3mm;
                font-size: 10.5pt;
                font-weight: 600;
              }
            }
          `,
        }}
      />

      <div className="p-6 max-w-3xl mx-auto space-y-5 no-print">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/visits" className="inline-flex items-center gap-1.5 text-base text-gray-500 hover:text-gray-800 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to visits
          </Link>
          <VisitPrintButton visitId={visit.id} hasInvoice={!!invoice} hasPrescription={!!prescription} />
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
        {invoice && (
          <div className="section-card">
            <div className="section-card-header">
              <h2 className="text-lg font-semibold text-gray-900">Bill — {invoice.invoiceNumber}</h2>
              <span className={cn(
                'text-sm font-semibold px-3 py-1 rounded-full',
                invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                invoice.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {invoice.status}
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
                  {invoice.items.map(item => (
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
                <span>Subtotal</span><span>{formatLKR(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-base text-green-700 font-semibold">
                  <span>Waived / Discount</span><span>− {formatLKR(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total</span><span>{formatLKR(invoice.total)}</span>
              </div>
              {invoice.amountPaid > 0 && (
                <div className="flex justify-between text-base text-green-700">
                  <span>Paid</span><span>{formatLKR(invoice.amountPaid)}</span>
                </div>
              )}
              {invoice.balance > 0 && (
                <div className="flex justify-between text-lg font-bold text-red-700">
                  <span>Balance due</span><span>{formatLKR(invoice.balance)}</span>
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

      {/* ── PRINTABLE BILL ─────────────────────────────────────────────────── */}
      {invoice && (
        <div id="print-bill" className="print-document hidden print:block max-w-[760px] mx-auto text-black">
          <div className="rounded-2xl border border-gray-300 overflow-hidden">
            <div className="bg-gray-950 text-white px-8 py-6 flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-gray-300">Dental invoice</p>
                <h1 className="text-3xl font-bold mt-1">{branchName}</h1>
                {branchAddress && <p className="text-sm text-gray-200 mt-2">{branchAddress}</p>}
                {visit.branch?.phone && <p className="text-sm text-gray-200">Tel: {visit.branch.phone}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-300">Invoice no.</p>
                <p className="text-xl font-bold font-mono">{invoice.invoiceNumber}</p>
                <span className="inline-block mt-3 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                  {invoice.status}
                </span>
              </div>
            </div>

            <div className="px-8 py-6">
              <div className="grid grid-cols-2 gap-6 border-b border-gray-200 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Bill to</p>
                  <p className="mt-2 text-xl font-bold text-gray-950">{patientName}</p>
                  <p className="text-sm text-gray-600">Patient no: {visit.patient.patientNumber}</p>
                  {visit.patient.phone && <p className="text-sm text-gray-600">Phone: {visit.patient.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Visit details</p>
                  <p className="mt-2 text-sm text-gray-700">Date: <strong>{formatDate(visit.visitDate)}</strong></p>
                  <p className="text-sm text-gray-700">Doctor: <strong>Dr. {visit.doctor.name}</strong></p>
                  <p className="text-sm text-gray-700">Visit: <strong>{visit.visitNumber}</strong></p>
                </div>
              </div>

              <table className="w-full text-sm mt-6">
                <thead>
                  <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left rounded-l-lg">Treatment</th>
                    <th className="px-4 py-3 text-center">Tooth</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-950">{item.description}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.toothNumbers ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-950">Rs. {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 grid grid-cols-[1fr_280px] gap-6">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
                  <p className="font-bold text-gray-900 mb-1">Payment note</p>
                  <p>Please keep this invoice for clinic records. Any outstanding balance can be settled at the next visit.</p>
                </div>
                <div className="rounded-xl border border-gray-300 overflow-hidden">
                  <div className="space-y-2 p-4 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>Rs. {invoice.subtotal.toLocaleString()}</span></div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between font-semibold text-green-700"><span>Discount / waived</span><span>- Rs. {invoice.discount.toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-950">
                      <span>Total</span><span>Rs. {invoice.total.toLocaleString()}</span>
                    </div>
                    {invoice.payments.length > 0 && (
                      <div className="border-t border-gray-200 pt-2 space-y-1">
                        {invoice.payments.map(p => (
                          <div key={p.id} className="flex justify-between text-gray-600">
                            <span className="capitalize">{p.method.replace('_', ' ')}</span>
                            <span>Rs. {p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-950">
                      <span>Paid</span><span>Rs. {paidTotal.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className={cn(
                    'px-4 py-3 flex justify-between text-base font-bold',
                    invoice.balance > 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                  )}>
                    <span>{invoice.balance > 0 ? 'Balance due' : 'Balance'}</span>
                    <span>Rs. {invoice.balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {installmentPlan && (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
                  <p className="font-bold text-blue-950">Payment schedule</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {installmentPlan.installments.map(inst => (
                      <div key={inst.id} className="flex justify-between rounded-lg bg-white px-3 py-2">
                        <span>Payment {inst.number}</span>
                        <span className="font-bold">{formatLKR(inst.amount)} {inst.paidAt ? '(paid)' : '(pending)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10 grid grid-cols-2 gap-12 text-sm text-gray-600">
                <div className="border-t border-gray-400 pt-2">Patient / guardian signature</div>
                <div className="border-t border-gray-400 pt-2">Authorized by</div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-4 text-xs text-gray-500">
                <span>Generated {formatDateTime(generatedAt)}</span>
                <span>Thank you for choosing {branchName}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {invoice && (
        <div id="print-bill-legacy" className="hidden">
          {/* Clinic header */}
          <div className="text-center border-b-2 border-black pb-4 mb-5">
            <h1 className="text-2xl font-bold">{visit.branch?.name ?? 'DentalCare'}</h1>
            {visit.branch?.address && <p className="text-sm">{visit.branch.address}, {visit.branch.city}</p>}
            {visit.branch?.phone && <p className="text-sm">Tel: {visit.branch.phone}</p>}
            <p className="text-lg font-bold mt-2">INVOICE</p>
          </div>

          {/* Invoice details */}
          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div>
              <p><strong>Invoice No:</strong> {invoice.invoiceNumber}</p>
              <p><strong>Date:</strong> {formatDate(visit.visitDate)}</p>
              <p><strong>Doctor:</strong> Dr. {visit.doctor.name}</p>
            </div>
            <div>
              <p><strong>Patient:</strong> {getPatientDisplayName(visit.patient)}</p>
              <p><strong>Reg No:</strong> {visit.patient.patientNumber}</p>
              <p><strong>Phone:</strong> {visit.patient.phone}</p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-t border-b border-black">
                <th className="py-2 text-left">Treatment</th>
                <th className="py-2 text-center">Tooth</th>
                <th className="py-2 text-right">Price (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map(item => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-center">{item.toothNumbers ?? '—'}</td>
                  <td className="py-2 text-right">{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-black pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>Rs. {invoice.subtotal.toLocaleString()}</span></div>
            {invoice.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>Rs. {invoice.discount.toLocaleString()}</span></div>}
            <div className="flex justify-between font-bold text-base border-t border-black pt-1 mt-1">
              <span>Total</span><span>Rs. {invoice.total.toLocaleString()}</span>
            </div>
            {invoice.payments.length > 0 && invoice.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="capitalize">{p.method.replace('_', ' ')}</span>
                <span>Rs. {p.amount.toLocaleString()}</span>
              </div>
            ))}
            {invoice.balance > 0 && (
              <div className="flex justify-between font-bold text-base">
                <span>Balance due</span><span>Rs. {invoice.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          {installmentPlan && (
            <div className="mt-4 p-3 border border-black text-sm">
              <p className="font-bold">Installment plan: {installmentPlan.installments.map(inst => formatLKR(inst.amount)).join(' / ')}</p>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-gray-500">
            <p>Thank you for choosing {visit.branch?.name ?? 'DentalCare'}</p>
          </div>
        </div>
      )}

      {/* ── PRINTABLE PRESCRIPTION ─────────────────────────────────────────── */}
      {prescription && (
        <div id="print-rx" className="print-document hidden print:block text-black">
          <div className="rx-pad-content">
            <div className="rx-pad-meta">
              <div className="rx-pad-field">
                <span className="rx-pad-label">Patient</span>
                {patientName}
              </div>
              <div className="rx-pad-field">
                <span className="rx-pad-label">Age</span>
                {getAge(visit.patient.dateOfBirth)} yrs
              </div>
              <div className="rx-pad-field">
                <span className="rx-pad-label">Date</span>
                {formatDate(prescription.createdAt)}
              </div>
            </div>

            {allergies.length > 0 && (
              <div className="rx-pad-allergy">
                Allergy: {allergies.map((a: any) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}
              </div>
            )}

            <div className="rx-pad-symbol">Rx</div>

            <div className="rx-pad-items">
              {prescription.items.map((item, i) => (
                <div key={item.id} className="rx-pad-item">
                  <div className="rx-pad-number">{i + 1}.</div>
                  <div>
                    <div className="rx-pad-drug">{item.drugName}</div>
                    <div className="rx-pad-sig">
                      {[
                        item.dose,
                        item.frequency,
                        item.duration,
                        item.instructions,
                      ].filter(Boolean).join(' - ')}
                    </div>
                  </div>
                  <div className="rx-pad-qty">Qty: {item.quantity}</div>
                </div>
              ))}
            </div>

            {prescription.notes && (
              <div className="rx-pad-notes">
                {prescription.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {prescription && (
        <div id="print-rx-legacy" className="hidden">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-4 mb-5">
            <h1 className="text-2xl font-bold">{visit.branch?.name ?? 'DentalCare'}</h1>
            <p className="text-base font-semibold">Dr. {visit.doctor.name} — Dental Surgeon</p>
            {visit.branch?.address && <p className="text-sm">{visit.branch.address}</p>}
            {visit.branch?.phone && <p className="text-sm">Tel: {visit.branch.phone}</p>}
            <p className="text-xl font-bold mt-3">PRESCRIPTION</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
            <div>
              <p><strong>Rx No:</strong> {prescription.prescriptionNumber}</p>
              <p><strong>Date:</strong> {formatDate(prescription.createdAt)}</p>
            </div>
            <div>
              <p><strong>Patient:</strong> {getPatientDisplayName(visit.patient)}</p>
              <p><strong>Age:</strong> {getAge(visit.patient.dateOfBirth)} years</p>
            </div>
          </div>

          <div className="space-y-4">
            {prescription.items.map((item, i) => (
              <div key={item.id} className="border border-black p-3">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-lg">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="font-bold text-base">{item.drugName}</p>
                    <p className="text-sm">Dose: {item.dose} | {item.frequency} | {item.duration}</p>
                    {item.instructions && <p className="text-sm italic mt-0.5">{item.instructions}</p>}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">Qty: {item.quantity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {prescription.notes && (
            <div className="mt-4 p-3 border border-black text-sm">
              <p><strong>Instructions:</strong> {prescription.notes}</p>
            </div>
          )}

          <div className="mt-8 flex justify-between items-end">
            <div className="text-sm">
              <p className="text-gray-500">Diagnosis: {visit.diagnosis ?? '—'}</p>
            </div>
            <div className="text-center">
              <div className="border-b border-black w-40 mb-1" />
              <p className="text-sm">Dr. {visit.doctor.name}</p>
              <p className="text-xs text-gray-500">Signature & Stamp</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
