'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-secondary !text-sm !px-4 !py-2 no-print"
    >
      <Printer className="w-4 h-4" />
      Print / PDF
    </button>
  )
}
