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

  // Needle angle: gauge sweeps from -110° to +110° (220° total)
  // Score 0 → -110°, score 50 → 0° (top), score 100 → +110°
  const needleAngle = -110 + (score / 100) * 220

  return (
    <div style={{ position: 'relative', width: 170, height: 110 }}>
      <canvas ref={canvasRef} width={170} height={110} />

      {/* Needle wrapper: positions the pivot at the arc center */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '75%',
          width: 0,
          height: 0,
          transform: `rotate(${needleAngle}deg)`,
          transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none',
        }}
      >
        {/* Needle — extends upward from the wrapper's origin (which is the pivot) */}
        <div
          style={{
            position: 'absolute',
            left: -1,
            bottom: 0,
            width: 2,
            height: 48,
            background: '#1e1550',
            borderRadius: 1,
            boxShadow: '0 1px 2px rgba(30,21,80,0.15)',
          }}
        />
      </div>

      {/* Needle pivot dot — centered on the pivot point */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '75%',
          width: 10,
          height: 10,
          marginLeft: -5,
          marginTop: -5,
          background: '#1e1550',
          borderRadius: '50%',
          pointerEvents: 'none',
          boxShadow: '0 0 0 2px white, 0 1px 3px rgba(30,21,80,0.3)',
        }}
      />
    </div>
  )
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
