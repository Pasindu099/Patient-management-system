'use client'

import { useEffect, useRef } from 'react'

interface DataPoint { date: string; lkr: number; usd: number }

export function RevenueChart({ data }: { data: DataPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.length) return

    let Chart: any
    import('chart.js/auto').then(mod => {
      Chart = mod.default

      if (chartRef.current) {
        chartRef.current.destroy()
      }

      const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
      const textColor = isDark ? '#9ca3af' : '#6b7280'

      // Show last 30 points max for readability
      const displayData = data.slice(-30)

      const labels = displayData.map(d => {
        const dt = new Date(d.date)
        return dt.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })
      })

      chartRef.current = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'LKR Collected',
              data: displayData.map(d => Math.round(d.lkr)),
              backgroundColor: 'rgba(37, 99, 235, 0.75)',
              borderColor:     'rgba(37, 99, 235, 1)',
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2.2,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => ` Rs. ${ctx.raw.toLocaleString()}`,
              },
            },
          },
          scales: {
            x: {
              grid:  { color: gridColor },
              ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 10 },
            },
            y: {
              grid:  { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11 },
                callback: (v: any) => `Rs. ${(v / 1000).toFixed(0)}k`,
              },
              beginAtZero: true,
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])

  if (!data.length) {
    return <p className="text-center text-gray-400 py-8 text-sm">No revenue data for this period</p>
  }

  return <canvas ref={canvasRef} />
}
