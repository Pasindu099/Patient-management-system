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

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }

const PRINT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const PRINT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const PRINT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const PRINT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]
const PRINT_ALL_TEETH = [...PRINT_UPPER_RIGHT, ...PRINT_UPPER_LEFT, ...PRINT_LOWER_RIGHT, ...PRINT_LOWER_LEFT]

const PRINT_TOOTH_CONDITIONS: Record<string, { label: string; color: string; border: string }> = {
  healthy:   { label: 'Healthy', color: '#ffffff', border: '#cbd5e1' },
  caries:    { label: 'Caries', color: '#fee2e2', border: '#ef4444' },
  filled:    { label: 'Filled', color: '#dbeafe', border: '#3b82f6' },
  crown:     { label: 'Crown', color: '#fef3c7', border: '#d97706' },
  rootcanal: { label: 'Root Canal', color: '#ede9fe', border: '#7c3aed' },
  extracted: { label: 'Extracted', color: '#f1f5f9', border: '#64748b' },
  missing:   { label: 'Missing', color: '#f8fafc', border: '#cbd5e1' },
  implant:   { label: 'Implant', color: '#dcfce7', border: '#16a34a' },
  fracture:  { label: 'Fracture', color: '#ffedd5', border: '#ea580c' },
  watch:     { label: 'Watch', color: '#fef9c3', border: '#ca8a04' },
  bridge:    { label: 'Bridge', color: '#dbeafe', border: '#2563eb' },
  denture:   { label: 'Denture', color: '#f0fdf4', border: '#16a34a' },
}

type PrintableToothState = {
  condition?: string
  notes?: string
  selected?: boolean
}

function printableToothFindings(value: unknown): Record<string, PrintableToothState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, PrintableToothState>
}

function conditionForPrint(state?: PrintableToothState) {
  return PRINT_TOOTH_CONDITIONS[state?.condition ?? 'healthy'] ?? PRINT_TOOTH_CONDITIONS.healthy
}

function hasPrintableFindings(findings: Record<string, PrintableToothState>) {
  return PRINT_ALL_TEETH.some(number => {
    const state = findings[String(number)]
    return state?.selected || (!!state?.condition && state.condition !== 'healthy') || !!state?.notes
  })
}

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
  const patientName     = getPatientDisplayName(visit.patient)
  const branchName      = visit.branch?.name ?? 'DentalCare'
  const branchAddress   = [visit.branch?.address, visit.branch?.city].filter(Boolean).join(', ')
  const paidTotal       = invoice?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0
  const generatedAt     = new Date()
  const toothFindings   = printableToothFindings(visit.toothFindings)
  const showToothChart  = hasPrintableFindings(toothFindings)
  const pendingTreatmentItems = visit.patient.treatmentPlans.flatMap(plan =>
    plan.items.map(item => ({
      id:          item.id,
      planTitle:   plan.title,
      description: item.procedureName,
      tooth:       item.toothNumbers,
      amount:      item.patientEst || item.fee,
    }))
  )
  const pendingTreatmentTotal = pendingTreatmentItems.reduce((sum, item) => sum + item.amount, 0)
  const contractTotalDue = (invoice?.balance ?? 0) + pendingTreatmentTotal

  return (
    <>
      {autoPrint && <AutoPrint target={printTarget} />}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 12mm; }
              body[data-print-target="bill"] #print-rx { display: none !important; }
              body[data-print-target="prescription"] #print-bill { display: none !important; }
              .print-document { color: #111827; font-family: Arial, Helvetica, sans-serif; }
              .print-document * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
              Allergy: {allergies.map((a: any) => `${a.substance} (${a.reaction})`).join(' · ')}
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
                {formatDateTime(visit.visitDate)} · Dr. {visit.doctor.name}
                {visit.branch ? ` · ${visit.branch.name}` : ''}
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
        <div id="print-rx" className="print-document hidden print:block max-w-[760px] mx-auto text-black">
          <div className="rounded-2xl border border-gray-300 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-blue-700 font-bold">Prescription</p>
                <h1 className="text-3xl font-bold text-gray-950 mt-1">{branchName}</h1>
                <p className="text-base font-semibold text-gray-800 mt-2">Dr. {visit.doctor.name}</p>
                {branchAddress && <p className="text-sm text-gray-600">{branchAddress}</p>}
                {visit.branch?.phone && <p className="text-sm text-gray-600">Tel: {visit.branch.phone}</p>}
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-right min-w-44">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Rx no.</p>
                <p className="text-lg font-bold font-mono text-gray-950">{prescription.prescriptionNumber}</p>
                <p className="text-sm text-gray-600 mt-1">{formatDate(prescription.createdAt)}</p>
              </div>
            </div>

            <div className="px-8 py-6">
              <div className="grid grid-cols-3 gap-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Patient</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{patientName}</p>
                  <p className="text-sm text-gray-600">{visit.patient.patientNumber}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Age</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{getAge(visit.patient.dateOfBirth)} years</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Visit</p>
                  <p className="mt-1 text-lg font-bold text-gray-950">{visit.visitNumber}</p>
                  <p className="text-sm text-gray-600">{formatDate(visit.visitDate)}</p>
                </div>
              </div>

              {(visit.diagnosis || allergies.length > 0) && (
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Diagnosis</p>
                    <p className="mt-1 text-sm font-semibold text-gray-950">{visit.diagnosis ?? 'Not recorded'}</p>
                  </div>
                  <div className={cn(
                    'rounded-xl border p-4',
                    allergies.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  )}>
                    <p className={cn(
                      'text-xs font-bold uppercase tracking-wide',
                      allergies.length > 0 ? 'text-red-700' : 'text-gray-500'
                    )}>Allergies</p>
                    <p className="mt-1 text-sm font-semibold text-gray-950">
                      {allergies.length > 0
                        ? allergies.map((a: any) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')
                        : 'No allergies recorded'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {prescription.items.map((item, i) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{i + 1}</span>
                        <div>
                          <p className="text-lg font-bold text-gray-950">{item.drugName}</p>
                          <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-950">{item.duration}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Dose</p>
                        <p className="font-semibold text-gray-950">{item.dose}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Frequency</p>
                        <p className="font-semibold text-gray-950">{item.frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Instructions</p>
                        <p className="font-semibold text-gray-950">{item.instructions || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {prescription.notes && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Doctor instructions</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">{prescription.notes}</p>
                </div>
              )}

              {showToothChart && (
                <PrintableToothChart findings={toothFindings} />
              )}

              {(pendingTreatmentItems.length > 0 || (invoice?.balance ?? 0) > 0) && (
                <div className="mt-6 rounded-2xl border-2 border-gray-950 overflow-hidden">
                  <div className="bg-gray-950 text-white px-5 py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-300">Patient acknowledgement</p>
                      <h2 className="text-xl font-bold mt-1">Pending treatment and due balance</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-300">Total pending value</p>
                      <p className="text-2xl font-bold">Rs. {contractTotalDue.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {pendingTreatmentItems.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Treatments still to be completed</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                              <th className="px-3 py-2 text-left rounded-l-lg">Treatment</th>
                              <th className="px-3 py-2 text-center">Tooth</th>
                              <th className="px-3 py-2 text-right rounded-r-lg">Pending amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingTreatmentItems.map(item => (
                              <tr key={item.id} className="border-b border-gray-100">
                                <td className="px-3 py-2">
                                  <p className="font-semibold text-gray-950">{item.description}</p>
                                  <p className="text-xs text-gray-500">{item.planTitle}</p>
                                </td>
                                <td className="px-3 py-2 text-center text-gray-700">{item.tooth || '-'}</td>
                                <td className="px-3 py-2 text-right font-bold text-gray-950">Rs. {item.amount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {invoice && invoice.balance > 0 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-red-700">Current bill balance</p>
                            <p className="text-sm font-semibold text-gray-950 mt-1">Invoice {invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-600">This is the unpaid amount from today's bill.</p>
                          </div>
                          <p className="text-xl font-bold text-red-800">Rs. {invoice.balance.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs leading-relaxed text-gray-700">
                      I acknowledge that the above treatment plan, pending treatment charges, and any current bill balance have been explained to me. I understand that the final amount may change if the doctor changes the treatment plan, adds new procedures, or changes the treatment duration.
                    </div>

                    <div className="grid grid-cols-2 gap-10 pt-6 text-sm text-gray-700">
                      <div className="border-t border-gray-500 pt-2">
                        Patient / guardian signature
                      </div>
                      <div className="border-t border-gray-500 pt-2">
                        Clinic representative
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-12 grid grid-cols-[1fr_220px] gap-12 items-end">
                <div className="text-xs text-gray-500">
                  <p>Generated {formatDateTime(generatedAt)}</p>
                  <p>Bring this prescription to the next visit if requested by the doctor.</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-500 pt-2">
                    <p className="text-sm font-semibold text-gray-950">Dr. {visit.doctor.name}</p>
                    <p className="text-xs text-gray-500">Signature and stamp</p>
                  </div>
                </div>
              </div>
            </div>
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
                    <p className="text-sm">Dose: {item.dose} · {item.frequency} · {item.duration}</p>
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

function PrintableToothChart({ findings }: { findings: Record<string, PrintableToothState> }) {
  const selectedTeeth = PRINT_ALL_TEETH
    .map(number => ({ number, state: findings[String(number)] }))
    .filter(({ state }) => state?.selected || (!!state?.condition && state.condition !== 'healthy') || !!state?.notes)

  return (
    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Tooth chart</p>
          <p className="mt-1 text-sm font-semibold text-gray-950">Marked findings explained during this visit</p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
          FDI numbering
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <PrintQuadrantLabel side="UR" label="Upper right" />
          <PrintArchLabel label="Upper arch" />
          <PrintQuadrantLabel side="UL" label="Upper left" align="right" />
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2">
          <PrintQuadrant numbers={PRINT_UPPER_RIGHT} findings={findings} />
          <div className="w-px bg-gray-300" />
          <PrintQuadrant numbers={PRINT_UPPER_LEFT} findings={findings} />
        </div>

        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
            Midline
          </span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
          <PrintQuadrant numbers={PRINT_LOWER_RIGHT} findings={findings} />
          <div className="w-px bg-gray-300" />
          <PrintQuadrant numbers={PRINT_LOWER_LEFT} findings={findings} />
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <PrintQuadrantLabel side="LR" label="Lower right" />
          <PrintArchLabel label="Lower arch" />
          <PrintQuadrantLabel side="LL" label="Lower left" align="right" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {selectedTeeth.map(({ number, state }) => {
          const condition = conditionForPrint(state)
          return (
            <div key={number} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="font-bold text-gray-950">
                Tooth {number}: <span style={{ color: condition.border }}>{condition.label}</span>
              </p>
              {state?.notes && <p className="mt-0.5 font-semibold text-gray-600">{state.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrintQuadrant({ numbers, findings }: { numbers: number[]; findings: Record<string, PrintableToothState> }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {numbers.map(number => {
        const state = findings[String(number)]
        const condition = conditionForPrint(state)
        const marked = state?.selected || (!!state?.condition && state.condition !== 'healthy') || !!state?.notes

        return (
          <div key={number} className="text-center">
            <div className="text-[10px] font-bold text-gray-500">{number}</div>
            <div
              className={cn(
                'mx-auto mt-1 flex h-7 w-5 items-center justify-center rounded-b-md rounded-t-sm border text-[9px] font-bold',
                marked ? 'ring-2 ring-blue-200' : ''
              )}
              style={{
                backgroundColor: condition.color,
                borderColor: marked ? condition.border : '#cbd5e1',
                color: marked ? condition.border : '#9ca3af',
              }}
            >
              {marked ? 'X' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PrintQuadrantLabel({ side, label, align = 'left' }: { side: string; label: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('flex items-center gap-2', align === 'right' && 'justify-end')}>
      <span className="rounded-md bg-gray-950 px-2 py-1 text-[10px] font-bold text-white">{side}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  )
}

function PrintArchLabel({ label }: { label: string }) {
  return <span className="w-20 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
}
