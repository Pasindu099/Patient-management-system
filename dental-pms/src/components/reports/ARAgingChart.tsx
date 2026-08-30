'use client'

import { useEffect, useRef } from 'react'
import { formatLKR } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AgingData {
  current:   number
  days30:    number
  days60:    number
  days90plus: number
}

export function ARAgingChart({ aging }: { aging: AgingData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  const total = aging.current + aging.days30 + aging.days60 + aging.days90plus

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || total === 0) return

    import('chart.js/auto').then(mod => {
      const Chart = mod.default
      if (chartRef.current) chartRef.current.destroy()

      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

      chartRef.current = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Current', '1–30 days', '31–60 days', '60+ days'],
          datasets: [{
            data: [aging.current, aging.days30, aging.days60, aging.days90plus],
            backgroundColor: [
              'rgba(16,185,129,0.85)',
              'rgba(234,179,8,0.85)',
              'rgba(249,115,22,0.85)',
              'rgba(239,68,68,0.85)',
            ],
            borderColor: [
              'rgba(16,185,129,1)',
              'rgba(234,179,8,1)',
              'rgba(249,115,22,1)',
              'rgba(239,68,68,1)',
            ],
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: isDark ? '#9ca3af' : '#6b7280',
                font: { size: 12 },
                padding: 12,
                boxWidth: 12,
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => ` ${formatLKR(ctx.raw)}`,
              },
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [aging, total])

  if (total === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-2xl font-bold text-green-600 mb-1">Rs. 0</p>
        <p className="text-base text-gray-400">No outstanding balances</p>
      </div>
    )
  }

  const rows = [
    { label: 'Current',      amount: aging.current,    color: 'bg-emerald-500', risk: '' },
    { label: '1–30 days',    amount: aging.days30,     color: 'bg-yellow-400',  risk: 'low' },
    { label: '31–60 days',   amount: aging.days60,     color: 'bg-orange-500',  risk: 'medium' },
    { label: '60+ days',     amount: aging.days90plus, color: 'bg-red-500',     risk: 'high' },
  ]

  return (
    <div>
      {/* Donut chart */}
      <div style={{ height: '200px' }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Detail rows */}
      <div className="mt-4 space-y-2">
        {rows.map(r => {
          if (r.amount === 0) return null
          const pct = Math.round((r.amount / total) * 100)
          return (
            <div key={r.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full flex-shrink-0', r.color)} />
                <span className="text-gray-600 font-medium">{r.label}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">{formatLKR(r.amount)}</span>
                <span className="text-gray-400 ml-1">({pct}%)</span>
              </div>
            </div>
          )
        })}
        <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
          <span>Total outstanding</span>
          <span className="text-red-600">{formatLKR(total)}</span>
        </div>
      </div>
    </div>
  )
}
