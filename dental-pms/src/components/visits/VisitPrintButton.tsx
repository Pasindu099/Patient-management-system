'use client'

import { FileText, ReceiptText } from 'lucide-react'

interface Props {
  visitId:         string
  hasInvoice:      boolean
  hasPrescription: boolean
}

export function VisitPrintButton({ hasInvoice, hasPrescription }: Props) {
  if (!hasInvoice && !hasPrescription) return null

  const printDocument = (target: 'bill' | 'prescription') => {
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
    <div className="flex flex-wrap gap-2">
      {hasInvoice && (
        <button
          onClick={() => printDocument('bill')}
          className="btn-secondary !text-sm !px-4 !py-2"
        >
          <ReceiptText className="w-4 h-4" />
          Print bill
        </button>
      )}
      {hasPrescription && (
        <button
          onClick={() => printDocument('prescription')}
          className="btn-secondary !text-sm !px-4 !py-2"
        >
          <FileText className="w-4 h-4" />
          Print prescription
        </button>
      )}
    </div>
  )
}
