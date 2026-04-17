'use client'

import type { VendorReviewPack } from '@/types/review-pack'

interface Props {
  packs: VendorReviewPack[]
}

const SIZE = 300
const CX = SIZE / 2
const CY = SIZE / 2
const R = 110

/**
 * Radar / spider chart where each axis is a review pack.
 * Score per axis = readiness % for that pack.
 * Pure SVG — no chart library.
 */
export function ReadinessRadarChart({ packs }: Props) {
  const packScores = packs
    .filter((p) => p.item_counts && p.item_counts.total > 0)
    .map((p) => {
      const c = p.item_counts!
      const applicable = c.total - c.na
      const completed = c.passed
      const pct = applicable > 0 ? Math.round((completed / applicable) * 100) : 0
      return { name: p.review_pack_name ?? 'Pack', code: p.review_pack_code, pct }
    })

  if (packScores.length < 3) {
    return (
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: '#a99fd8' }}>
          Radar chart requires at least 3 active review packs with items.
        </p>
      </div>
    )
  }

  const n = packScores.length
  const angleStep = (2 * Math.PI) / n

  // Helper to convert (index, radius) to SVG coords
  const point = (i: number, r: number) => ({
    x: CX + r * Math.sin(i * angleStep),
    y: CY - r * Math.cos(i * angleStep),
  })

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [25, 50, 75, 100]

  // Data polygon points
  const dataPoints = packScores.map((p, i) => point(i, (p.pct / 100) * R))
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6c5dd3' }}>
        Readiness by Review Pack
      </h3>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 320, height: 'auto' }}>
          {/* Grid rings */}
          {rings.map((pct) => {
            const r = (pct / 100) * R
            const ringPath = Array.from({ length: n }, (_, i) => {
              const p = point(i, r)
              return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
            }).join(' ') + ' Z'
            return (
              <g key={pct}>
                <path d={ringPath} fill="none" stroke="rgba(108,93,211,0.08)" strokeWidth="1" />
                <text
                  x={CX + 4}
                  y={CY - r + 3}
                  fontSize="8"
                  fill="#c4bae8"
                >
                  {pct}%
                </text>
              </g>
            )
          })}

          {/* Axis lines + labels */}
          {packScores.map((p, i) => {
            const outer = point(i, R + 24)
            const axisEnd = point(i, R)
            return (
              <g key={i}>
                <line
                  x1={CX} y1={CY}
                  x2={axisEnd.x} y2={axisEnd.y}
                  stroke="rgba(108,93,211,0.1)" strokeWidth="1"
                />
                <text
                  x={outer.x}
                  y={outer.y}
                  fontSize="9"
                  fill="#4a4270"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontWeight={600}
                >
                  {p.code ?? p.name.substring(0, 10)}
                </text>
              </g>
            )
          })}

          {/* Data polygon — filled */}
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6c5dd3" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6c5dd3" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={dataPath} fill="url(#radarFill)" stroke="#6c5dd3" strokeWidth="2" />

          {/* Data points */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="white" stroke="#6c5dd3" strokeWidth="2">
              <title>{`${packScores[i].name}: ${packScores[i].pct}%`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Legend table */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {packScores.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.pct >= 80 ? '#059669' : p.pct >= 50 ? '#6c5dd3' : p.pct > 0 ? '#d97706' : '#a99fd8' }}
            />
            <span className="truncate" style={{ color: '#4a4270' }}>{p.name}</span>
            <span className="font-bold tabular-nums ml-auto" style={{ color: p.pct >= 80 ? '#059669' : p.pct >= 50 ? '#6c5dd3' : '#d97706' }}>
              {p.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
