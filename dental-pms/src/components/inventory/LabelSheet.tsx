'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

interface Label {
  id: string
  name: string
  unit: string
  code: string
  qr: string
}

export function LabelSheet({ labels }: { labels: Label[] }) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Screen-only header — hidden from the printed sheet so the paper
          contains nothing but labels. */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/inventory" className="btn-secondary !px-3 !py-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Inventory labels</h1>
          <p className="text-sm text-gray-500">
            {labels.length} label{labels.length !== 1 ? 's' : ''} · print, cut, and stick one on each item&apos;s shelf or box.
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer className="w-4 h-4" />Print
        </button>
      </div>

      {labels.length === 0 ? (
        <div className="section-card py-14 text-center text-gray-400 print:hidden">
          No catalog items with codes yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
          {labels.map(label => (
            <div
              key={label.id}
              className="border-2 border-dashed border-gray-300 rounded-lg p-3 flex flex-col items-center text-center break-inside-avoid print:border-gray-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={label.qr} alt={label.code} className="w-full max-w-[120px] aspect-square" />
              <p className="mt-2 text-sm font-bold text-gray-900 leading-tight line-clamp-2">{label.name}</p>
              <p className="text-xs font-mono text-gray-600 mt-0.5">{label.code}</p>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { margin: 10mm; }
          body { background: #fff; }
          /* The dashboard chrome (sidebar, top bar) must not eat the page. */
          aside, nav, header { display: none !important; }
        }
      `}</style>
    </div>
  )
}
