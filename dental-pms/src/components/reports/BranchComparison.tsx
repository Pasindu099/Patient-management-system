'use client'

import { useEffect, useRef } from 'react'
import { formatLKR } from '@/lib/utils'

interface BranchData {
  branch:       string
  appointments: number
  revenue:      number
}

export function BranchComparison({ data }: { data: BranchData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.length) return

    import('chart.js/auto').then(mod => {
      const Chart = mod.default
      if (chartRef.current) chartRef.current.destroy()

      const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      const textColor = isDark ? '#9ca3af' : '#6b7280'

      chartRef.current = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map(d => d.branch),
          datasets: [
            {
              label: 'Appointments',
              data: data.map(d => d.appointments),
              backgroundColor: ['rgba(37,99,235,0.75)', 'rgba(16,185,129,0.75)', 'rgba(139,92,246,0.75)'],
              borderColor:     ['rgba(37,99,235,1)',    'rgba(16,185,129,1)',    'rgba(139,92,246,1)'],
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                afterLabel: (ctx: any) => `Revenue: ${formatLKR(data[ctx.dataIndex].revenue)}`,
              },
            },
          },
          scales: {
            x: {
              grid:  { color: gridColor },
              ticks: { color: textColor, font: { size: 11 }, stepSize: 1 },
              beginAtZero: true,
            },
            y: {
              grid:  { display: false },
              ticks: { color: textColor, font: { size: 13, weight: 500 } },
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])

  // Summary cards below chart
  return (
    <div>
      <div style={{ height: `${Math.max(120, data.length * 60)}px` }}>
        {data.length === 0
          ? <p className="text-center text-gray-400 py-8 text-sm">No branch data</p>
          : <canvas ref={canvasRef} />
        }
      </div>
      {data.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.map((d, i) => (
            <div key={d.branch} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-700">{d.branch}</span>
              <div className="text-right">
                <p className="font-bold text-gray-900">{formatLKR(d.revenue)}</p>
                <p className="text-xs text-gray-400">{d.appointments} appts completed</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
