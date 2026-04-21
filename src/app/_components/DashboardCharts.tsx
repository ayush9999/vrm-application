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

interface GaugeProps {
  score: number
  bandColor: string
  nextThreshold?: number
  nextBandName?: string
  nextBandColor?: string
}

function buildGaugeOverlay({
  bandColor,
  score,
  nextThreshold,
  nextBandName,
  nextBandColor,
  labelFontSize,
  dotRadius,
}: GaugeProps & { labelFontSize: number; dotRadius: number }) {
  return {
    id: 'gaugeOverlay',
    afterDatasetsDraw(chart: Chart) {
      const ctx = chart.ctx
      const meta = chart.getDatasetMeta(1)
      const scoreArc = meta.data[0] as unknown as {
        x: number; y: number;
        innerRadius: number; outerRadius: number;
        startAngle: number; endAngle: number;
      }
      if (!scoreArc) return

      const { x: cx, y: cy, innerRadius, outerRadius, startAngle, endAngle } = scoreArc
      const rMid = (innerRadius + outerRadius) / 2

      // Endpoint dot at the tip of the score fill
      const dotX = cx + rMid * Math.cos(endAngle)
      const dotY = cy + rMid * Math.sin(endAngle)
      ctx.save()
      ctx.fillStyle = bandColor
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      // Next-threshold tick + label
      if (
        nextThreshold !== undefined &&
        nextBandName &&
        nextThreshold > score &&
        nextThreshold < 100
      ) {
        const fullSpan = Math.PI // 180° arc
        const tickAngle = startAngle + (nextThreshold / 100) * fullSpan

        const tickR1 = outerRadius + 1
        const tickR2 = outerRadius + 8
        const tx1 = cx + tickR1 * Math.cos(tickAngle)
        const ty1 = cy + tickR1 * Math.sin(tickAngle)
        const tx2 = cx + tickR2 * Math.cos(tickAngle)
        const ty2 = cy + tickR2 * Math.sin(tickAngle)

        const tickColor = nextBandColor ?? '#BA7517'
        ctx.save()
        ctx.strokeStyle = tickColor
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx1, ty1)
        ctx.lineTo(tx2, ty2)
        ctx.stroke()

        const labelR = outerRadius + 16
        const lx = cx + labelR * Math.cos(tickAngle)
        const ly = cy + labelR * Math.sin(tickAngle)
        ctx.fillStyle = tickColor
        ctx.font = `500 ${labelFontSize}px system-ui, -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${nextThreshold} → ${nextBandName}`, lx, ly)
        ctx.restore()
      }
    },
  }
}

export function GaugeChart(props: GaugeProps) {
  const { score, bandColor, nextThreshold, nextBandName, nextBandColor } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: [30, 30, 25, 15],
            backgroundColor: ['#FCE4E4', '#FBE8CF', '#F4F0CC', '#DDE9CF'],
            borderWidth: 0,
            weight: 0.55,
          },
          {
            data: [score, 100 - score],
            backgroundColor: [bandColor, 'transparent'],
            borderWidth: 0,
            borderRadius: [10, 0],
            weight: 1,
          },
        ],
      },
      options: {
        circumference: 180,
        rotation: -90,
        cutout: '66%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 900 },
        layout: { padding: { top: 22, left: 22, right: 22, bottom: 4 } },
      },
      plugins: [buildGaugeOverlay({ ...props, labelFontSize: 10, dotRadius: 6 })],
    })

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [score, bandColor, nextThreshold, nextBandName, nextBandColor])

  return <canvas ref={canvasRef} width={240} height={150} />
}

// Larger version for modal/expanded views
export function GaugeChartLarge(props: GaugeProps) {
  const { score, bandColor, nextThreshold, nextBandName, nextBandColor } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        datasets: [
          { data: [30, 30, 25, 15], backgroundColor: ['#FCE4E4', '#FBE8CF', '#F4F0CC', '#DDE9CF'], borderWidth: 0, weight: 0.55 },
          { data: [score, 100 - score], backgroundColor: [bandColor, 'transparent'], borderWidth: 0, borderRadius: [12, 0], weight: 1 },
        ],
      },
      options: {
        circumference: 180, rotation: -90, cutout: '64%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 900 },
        layout: { padding: { top: 32, left: 32, right: 32, bottom: 4 } },
      },
      plugins: [buildGaugeOverlay({ ...props, labelFontSize: 13, dotRadius: 9 })],
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [score, bandColor, nextThreshold, nextBandName, nextBandColor])

  return <canvas ref={canvasRef} width={420} height={250} />
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

// Larger version for modal
export function RadarChartLarge({ labels, data }: { labels: string[]; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const pointColors = data.map((v) => v >= 60 ? '#639922' : v >= 30 ? '#EF9F27' : '#E24B4A')
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(55,138,221,0.12)',
          borderColor: '#378ADD',
          borderWidth: 1.8,
          pointRadius: 5, pointHoverRadius: 7,
          pointBackgroundColor: pointColors, pointBorderColor: 'transparent',
        }],
      },
      options: {
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { display: false },
            grid: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            angleLines: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            pointLabels: { font: { size: 12 }, color: '#4a4270', padding: 8 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.raw}% readiness` },
            backgroundColor: '#fff', borderColor: '#e8e5e0', borderWidth: 0.5,
            padding: 10, cornerRadius: 8,
            titleColor: '#18181b', bodyColor: '#18181b',
          },
        },
        animation: { duration: 1000 },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [labels, data])

  return <canvas ref={canvasRef} width={420} height={380} />
}
