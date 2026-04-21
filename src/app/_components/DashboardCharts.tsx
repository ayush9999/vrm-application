'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  DoughnutController,
  ArcElement,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'

Chart.register(
  DoughnutController,
  ArcElement,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
)

/* ------------------------------------------------------------------ */
/*  Gauge (doughnut)                                                  */
/* ------------------------------------------------------------------ */

export function GaugeChart({ score, bandColor }: { score: number; bandColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Band backdrop — shows zones: 0-30 red, 31-60 amber, 61-85 yellow, 86-100 green
    // Overlaid by the score fill on top
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        datasets: [
          // Bottom layer: band zones (always full 100%)
          {
            data: [30, 30, 25, 15],
            backgroundColor: ['#FCE4E4', '#FBE8CF', '#F4F0CC', '#DDE9CF'],
            borderWidth: 0,
            weight: 0.5,
          },
          // Top layer: score fill
          {
            data: [score, 100 - score],
            backgroundColor: [bandColor, 'transparent'],
            borderWidth: 0,
            borderRadius: [6, 0],
            weight: 1,
          },
        ],
      },
      options: {
        circumference: 220,
        rotation: -110,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: { duration: 1000 },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [score, bandColor])

  return <canvas ref={canvasRef} width={170} height={110} />
}

/* ------------------------------------------------------------------ */
/*  Radar                                                             */
/* ------------------------------------------------------------------ */

export function RadarChart({ labels, data }: { labels: string[]; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const pointColors = data.map((v) =>
      v >= 60 ? '#639922' : v >= 30 ? '#EF9F27' : '#E24B4A',
    )

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: 'rgba(55,138,221,0.12)',
            borderColor: '#378ADD',
            borderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: pointColors,
            pointBorderColor: 'transparent',
          },
        ],
      },
      options: {
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false },
            grid: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            angleLines: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            pointLabels: {
              font: { size: 10 },
              color: '#9a9890',
              padding: 4,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw}% readiness`,
            },
            backgroundColor: '#fff',
            borderColor: '#e8e5e0',
            borderWidth: 0.5,
            padding: 10,
            cornerRadius: 8,
            titleColor: '#18181b',
            bodyColor: '#18181b',
          },
        },
        animation: { duration: 1000 },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [labels, data])

  return <canvas ref={canvasRef} width={180} height={160} />
}
