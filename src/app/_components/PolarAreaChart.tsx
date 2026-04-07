'use client'

import { useState } from 'react'

export interface CategoryScore {
  label: string
  score: number   // 0–100
  count: number   // number of vendors in category
}

const CX = 110
const CY = 110
const MAX_R = 90

function toRad(deg: number) { return (deg * Math.PI) / 180 }

function polarXY(r: number, angleDeg: number) {
  return {
    x: Math.round((CX + r * Math.cos(toRad(angleDeg))) * 100) / 100,
    y: Math.round((CY + r * Math.sin(toRad(angleDeg))) * 100) / 100,
  }
}

function segmentPath(r: number, startDeg: number, endDeg: number) {
  const s = polarXY(r, startDeg)
  const e = polarXY(r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

function scoreStyle(score: number) {
  if (score >= 75) return { fill: 'rgba(16,185,129,0.55)', stroke: '#059669', dot: 'bg-emerald-500', label: 'text-emerald-700' }
  if (score >= 50) return { fill: 'rgba(245,158,11,0.55)', stroke: '#d97706', dot: 'bg-amber-400',   label: 'text-amber-700'  }
  return              { fill: 'rgba(239,68,68,0.55)',   stroke: '#dc2626', dot: 'bg-rose-500',    label: 'text-rose-600'  }
}

const GRID_PCTS = [25, 50, 75, 100]

export function PolarAreaChart({ data }: { data: CategoryScore[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const n = data.length
  const sliceDeg = 360 / n
  const startOffset = -90  // start from top

  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Compliance by Category
          </h2>
          <p className="text-xs mt-0.5 text-slate-400">Average score per vendor category</p>
        </div>
        {/* Score scale */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />≥75%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />50–74%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />&lt;50%</span>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-3">
        {/* SVG chart */}
        <div className="shrink-0">
          <svg width="220" height="220" viewBox="0 0 220 220">
            {/* Grid circles */}
            {GRID_PCTS.map(pct => (
              <circle
                key={pct}
                cx={CX} cy={CY}
                r={MAX_R * pct / 100}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={pct === 100 ? 1 : 0.6}
                strokeDasharray={pct === 100 ? 'none' : '3,3'}
              />
            ))}

            {/* Grid labels (25/50/75/100) */}
            {GRID_PCTS.map(pct => (
              <text
                key={pct}
                x={CX + 3}
                y={CY - MAX_R * pct / 100 + 4}
                fontSize="6"
                fill="#cbd5e1"
                textAnchor="start"
              >
                {pct}%
              </text>
            ))}

            {/* Spoke lines */}
            {data.map((_, i) => {
              const angleDeg = startOffset + i * sliceDeg
              const spoke = polarXY(MAX_R, angleDeg)
              return (
                <line
                  key={i}
                  x1={CX} y1={CY}
                  x2={spoke.x} y2={spoke.y}
                  stroke="#e2e8f0" strokeWidth="0.6"
                />
              )
            })}

            {/* Segments */}
            {data.map((d, i) => {
              const startDeg = startOffset + i * sliceDeg
              const endDeg   = startOffset + (i + 1) * sliceDeg
              const r = MAX_R * (d.score / 100)
              const style = scoreStyle(d.score)
              const isHovered = hovered === i
              return (
                <path
                  key={i}
                  d={segmentPath(r, startDeg, endDeg)}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isHovered ? 2 : 1}
                  opacity={hovered !== null && !isHovered ? 0.45 : 1}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              )
            })}

            {/* Category label at mid-angle outside */}
            {data.map((d, i) => {
              const midDeg = startOffset + (i + 0.5) * sliceDeg
              const labelR = MAX_R + 16
              const pos = polarXY(labelR, midDeg)
              const anchor = pos.x > CX + 4 ? 'start' : pos.x < CX - 4 ? 'end' : 'middle'
              // Shorten label if needed
              const short = d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label
              return (
                <text
                  key={i}
                  x={pos.x}
                  y={pos.y + 3}
                  fontSize="7.5"
                  fill={hovered === i ? scoreStyle(d.score).stroke : '#94a3b8'}
                  textAnchor={anchor}
                  fontWeight={hovered === i ? '700' : '500'}
                  className="transition-all duration-150 select-none"
                >
                  {short}
                </text>
              )
            })}

            {/* Centre dot */}
            <circle cx={CX} cy={CY} r="3" fill="#e2e8f0" />
          </svg>
        </div>

        {/* Legend / detail list */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {data.map((d, i) => {
            const style = scoreStyle(d.score)
            const isHovered = hovered === i
            return (
              <div
                key={i}
                className="flex items-center gap-3 py-1.5 px-2 rounded-lg cursor-default transition-colors"
                style={{ background: isHovered ? 'rgba(109,93,211,0.05)' : 'transparent' }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{d.label}</span>
                <span className="text-xs text-slate-400 shrink-0">{d.count}v</span>
                <span className={`text-sm font-bold tabular-nums shrink-0 w-10 text-right ${style.label}`}>
                  {d.score}%
                </span>
              </div>
            )
          })}
          <p className="text-[10px] text-slate-300 pt-1 pl-2">
            Dummy data — replace with live scores
          </p>
        </div>
      </div>
    </div>
  )
}
