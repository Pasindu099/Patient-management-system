import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isDoctorRole } from '@/lib/permissions'
import { getPatientDisplayName } from '@/lib/utils'
import { visitPrintInclude } from '@/lib/visit-print'
import { VisitPrintDocuments, VisitPrintStyles } from '@/components/visits/VisitPrintDocuments'
import { PrintPreviewToolbar } from '@/components/visits/PrintPreviewToolbar'
import type { Metadata } from 'next'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const v = await prisma.visit.findUnique({ where: { id }, select: { visitNumber: true } })
  return { title: v ? `Print ${v.visitNumber}` : 'Print visit' }
}

export default async function VisitPrintPreviewPage({ params, searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/login')
  const { id } = await params
  const query = await searchParams

  const visit = await prisma.visit.findUnique({ where: { id }, include: visitPrintInclude })
  if (!visit) notFound()

  if (session.user.role === 'ADMIN') redirect('/dashboard')
  if (isDoctorRole(session.user.role) && visit.doctorId !== session.user.id) redirect('/dashboard')

  const invoice      = visit.invoices[0]?.invoice
  const prescription = visit.prescriptions[0]
  const patientName  = getPatientDisplayName(visit.patient)

  // Doctors finish a visit straight into this preview, so send them back to the
  // queue; anyone opening it from the record goes back to the visit.
  const cameFromVisit = query.from !== 'complete'
  const backHref  = cameFromVisit ? `/visits/${visit.id}` : '/dashboard'
  const backLabel = cameFromVisit ? 'Back to visit' : 'Done — back to dashboard'

  return (
    <>
      <VisitPrintStyles />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media screen {
              .preview-stage { background: #e9edf2; padding: 28px 16px 64px; overflow-x: auto; }
              .preview-sheet {
                width: 210mm;
                min-height: 297mm;
                margin: 0 auto 28px;
                background: #fff;
                box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
              }
              .preview-sheet + .preview-caption { margin-top: -14px; }
            }
          `,
        }}
      />

      <PrintPreviewToolbar
        hasInvoice={!!invoice}
        hasPrescription={!!prescription}
        backHref={backHref}
        backLabel={backLabel}
      />

      <div className="no-print mx-auto max-w-5xl px-6 pt-5">
        <h1 className="text-xl font-bold text-gray-900">Print preview — {visit.visitNumber}</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {patientName} · {invoice && prescription
            ? 'Bill and prescription print on two separate sheets.'
            : invoice
              ? 'Bill only — no prescription was issued for this visit.'
              : prescription
                ? 'Prescription only — nothing was billed for this visit.'
                : 'Nothing to print for this visit.'}
        </p>
      </div>

      {!invoice && !prescription ? (
        <div className="no-print mx-auto max-w-5xl px-6 py-10 text-sm font-semibold text-gray-500">
          This visit has no bill and no prescription.
        </div>
      ) : (
        <div className="preview-stage">
          {invoice && (
            <>
              <p className="no-print mx-auto mb-2 max-w-[210mm] text-xs font-bold uppercase tracking-wide text-gray-500">
                Sheet 1 — Bill
              </p>
              <div className="preview-sheet">
                <VisitPrintDocuments visit={visit} mode="preview" only="bill" />
              </div>
            </>
          )}
          {prescription && (
            <>
              <p className="no-print mx-auto mb-2 max-w-[210mm] text-xs font-bold uppercase tracking-wide text-gray-500">
                Sheet {invoice ? 2 : 1} — Prescription
              </p>
              <div className="preview-sheet">
                <VisitPrintDocuments visit={visit} mode="preview" only="prescription" />
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
