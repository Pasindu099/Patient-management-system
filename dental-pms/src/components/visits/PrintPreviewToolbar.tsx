'use client'

import Link from 'next/link'
import { FileText, Printer, ReceiptText, ChevronLeft } from 'lucide-react'

type Target = 'both' | 'bill' | 'prescription'

interface Props {
  hasInvoice:      boolean
  hasPrescription: boolean
  backHref:        string
  backLabel:       string
}

export function PrintPreviewToolbar({ hasInvoice, hasPrescription, backHref, backLabel }: Props) {
  // The document-level print CSS keys off data-print-target, so a single
  // window.print() can produce the bill, the prescription, or both on
  // separate sheets.
  const printDocument = (target: Target) => {
    document.body.dataset.printTarget = target

    const clearTarget = () => {
      delete document.body.dataset.printTarget
      window.removeEventListener('afterprint', clearTarget)
    }

    window.addEventListener('afterprint', clearTarget)
    window.print()
    window.setTimeout(clearTarget, 1200)
  }

  return (
    <div className="no-print sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800"
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {hasInvoice && hasPrescription && (
            <button onClick={() => printDocument('both')} className="btn-primary !px-4 !py-2 !text-sm">
              <Printer className="h-4 w-4" />
              Print bill + prescription
            </button>
          )}
          {hasInvoice && (
            <button onClick={() => printDocument('bill')} className="btn-secondary !px-4 !py-2 !text-sm">
              <ReceiptText className="h-4 w-4" />
              Print bill only
            </button>
          )}
          {hasPrescription && (
            <button onClick={() => printDocument('prescription')} className="btn-secondary !px-4 !py-2 !text-sm">
              <FileText className="h-4 w-4" />
              Print prescription only
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
