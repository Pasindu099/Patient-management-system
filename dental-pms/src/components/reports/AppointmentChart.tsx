'use client'

import { useEffect, useRef } from 'react'

interface DataPoint { date: string; total: number; completed: number }

export function AppointmentChart({ data }: { data: DataPoint[] }) {
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

      const displayData = data.slice(-30)
      const labels = displayData.map(d => {
        const dt = new Date(d.date)
        return dt.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })
      })

      chartRef.current = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Total',
              data: displayData.map(d => d.total),
              borderColor: 'rgba(139, 92, 246, 0.9)',
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
            {
              label: 'Completed',
              data: displayData.map(d => d.completed),
              borderColor: 'rgba(16, 185, 129, 0.9)',
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2.2,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: { color: textColor, font: { size: 12 }, boxWidth: 12, padding: 16 },
            },
          },
          scales: {
            x: {
              grid:  { color: gridColor },
              ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 10 },
            },
            y: {
              grid:  { color: gridColor },
              ticks: { color: textColor, font: { size: 11 }, stepSize: 1 },
              beginAtZero: true,
            },
          },
        },
      })
    })

    return () => { if (chartRef.current) chartRef.current.destroy() }
  }, [data])

  if (!data.length) {
    return <p className="text-center text-gray-400 py-8 text-sm">No appointment data for this period</p>
  }

  return <canvas ref={canvasRef} />
}
