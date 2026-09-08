import { formatDate, formatDateTime, formatLKR, getAge, getPatientDisplayName, cn } from '@/lib/utils'
import type { VisitPrintData } from '@/lib/visit-print'

/**
 * Paper styles for the bill and the prescription pad.
 *
 * The layout rules live outside `@media print` so the on-screen preview
 * (/visits/[id]/print) shows exactly what comes out of the printer; only the
 * page setup and the per-document visibility switches are print-only.
 */
export function VisitPrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .print-document { color: #111827; font-family: Arial, Helvetica, sans-serif; }
          .print-document * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #print-bill { padding: 12mm; }
          #print-rx {
            width: 210mm;
            height: 297mm;
            max-width: none !important;
            margin: 0 auto;
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
            font-family: Georgia, "Times New Roman", serif;
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

          @media print {
            @page { size: A4; margin: 0; }
            body[data-print-target="bill"] #print-rx { display: none !important; }
            body[data-print-target="prescription"] #print-bill { display: none !important; }
            #print-rx { margin: 0 !important; }
            /* Bill and prescription always land on separate sheets. */
            #print-rx { break-before: page; page-break-before: always; }
            body[data-print-target="prescription"] #print-rx { break-before: auto; page-break-before: auto; }
          }
        `,
      }}
    />
  )
}

interface Props {
  visit: VisitPrintData
  /** `preview` renders the sheets on screen; otherwise they only appear on paper. */
  mode?: 'print-only' | 'preview'
  /** Render a single document — lets the preview put each sheet in its own frame. */
  only?: 'both' | 'bill' | 'prescription'
  canSeeBill?: boolean
}

export function VisitPrintDocuments({ visit, mode = 'print-only', only = 'both', canSeeBill = true }: Props) {
  const invoice         = canSeeBill ? visit.invoices[0]?.invoice : null
  const prescription    = visit.prescriptions[0]
  const installmentPlan = invoice?.installmentPlan
  const allergies       = (visit.patient.medicalHistory?.allergies as any[]) ?? []
  const patientName     = getPatientDisplayName(visit.patient)
  const branchName      = visit.branch?.name ?? 'DentalCare'
  const branchAddress   = [visit.branch?.address, visit.branch?.city].filter(Boolean).join(', ')
  const paidTotal       = invoice?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0
  const generatedAt     = new Date()

  const visibility = mode === 'preview' ? 'block' : 'hidden print:block'

  return (
    <>
      {/* ── PRINTABLE BILL ─────────────────────────────────────────────────── */}
      {invoice && only !== 'prescription' && (
        <div id="print-bill" className={cn('print-document mx-auto max-w-[760px] text-black', visibility)}>
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

      {/* ── PRINTABLE PRESCRIPTION ─────────────────────────────────────────── */}
      {prescription && only !== 'bill' && (
        <div id="print-rx" className={cn('print-document text-black', visibility)}>
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
    </>
  )
}
