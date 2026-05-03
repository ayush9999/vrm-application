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
  type ChartConfiguration,
  type Plugin,
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
}: GaugeProps & { labelFontSize: number; dotRadius: number }): Plugin<'doughnut'> {
  return {
    id: 'gaugeOverlay',
    afterDatasetsDraw(chart: Chart<'doughnut'>) {
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

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data: [30, 30, 25, 15],
            backgroundColor: ['#FCE4E4', '#FBE8CF', '#F4F0CC', '#DDE9CF'],
            borderWidth: 0,
            weight: 1,
          },
          {
            data: [score, 100 - score],
            backgroundColor: [bandColor, 'transparent'],
            borderWidth: 0,
            borderRadius: 0,
            weight: 1,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        circumference: 180,
        rotation: -90,
        cutout: '74%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 900 },
        layout: { padding: { top: 4, left: 4, right: 4, bottom: 0 } },
      },
      plugins: [buildGaugeOverlay({ ...props, labelFontSize: 12, dotRadius: 5 })],
    }
    chartRef.current = new Chart(canvasRef.current, config)

    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [score, bandColor, nextThreshold, nextBandName, nextBandColor])

  return <canvas ref={canvasRef} width={280} height={160} />
}

// Larger version for modal/expanded views
export function GaugeChartLarge(props: GaugeProps) {
  const { score, bandColor, nextThreshold, nextBandName, nextBandColor } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        datasets: [
          { data: [30, 30, 25, 15], backgroundColor: ['#FCE4E4', '#FBE8CF', '#F4F0CC', '#DDE9CF'], borderWidth: 0, weight: 1 },
          { data: [score, 100 - score], backgroundColor: [bandColor, 'transparent'], borderWidth: 0, borderRadius: 0, weight: 1 },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        circumference: 180, rotation: -90, cutout: '70%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 900 },
        layout: { padding: { top: 10, left: 10, right: 10, bottom: 0 } },
      },
      plugins: [buildGaugeOverlay({ ...props, labelFontSize: 13, dotRadius: 8 })],
    }
    chartRef.current = new Chart(canvasRef.current, config)
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [score, bandColor, nextThreshold, nextBandName, nextBandColor])

  return <canvas ref={canvasRef} width={420} height={250} />
}

/* ------------------------------------------------------------------ */
/*  Radar                                                             */
/* ------------------------------------------------------------------ */

function pointColorFor(v: number) {
  return v >= 60 ? '#639922' : v >= 30 ? '#EF9F27' : '#E24B4A'
}

// Auto-scale the radar axis to the data with ~30% headroom, snapped to a
// readable step. Floor at 20 so a single small value doesn't fill the chart.
function radarAxisMax(values: number[]): number {
  const peak = Math.max(0, ...values)
  if (peak >= 75) return 100
  const padded = peak * 1.3
  const step = padded < 25 ? 5 : 10
  return Math.max(20, Math.ceil(padded / step) * step)
}

export function RadarChart({ labels, data }: { labels: string[]; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const pointColors = data.map(pointColorFor)
    const axisMax = radarAxisMax(data)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: 'rgba(55,138,221,0.22)',
            borderColor: '#378ADD',
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: pointColors,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: axisMax,
            ticks: { display: false },
            grid: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            angleLines: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            pointLabels: {
              font: { size: 12 },
              color: '#6a6860',
              padding: 10,
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
        layout: { padding: 18 },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [labels, data])

  return <canvas ref={canvasRef} width={320} height={260} />
}

// Larger version for modal
export function RadarChartLarge({ labels, data }: { labels: string[]; data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const pointColors = data.map(pointColorFor)
    const axisMax = radarAxisMax(data)
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(55,138,221,0.22)',
          borderColor: '#378ADD',
          borderWidth: 2.2,
          pointRadius: 7, pointHoverRadius: 10,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0, max: axisMax,
            ticks: { display: false },
            grid: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            angleLines: { color: 'rgba(0,0,0,0.07)', lineWidth: 0.5 },
            pointLabels: { font: { size: 12 }, color: '#4a4270', padding: 12 },
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
        layout: { padding: 22 },
      },
    })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  }, [labels, data])

  return <canvas ref={canvasRef} width={420} height={380} />
}
