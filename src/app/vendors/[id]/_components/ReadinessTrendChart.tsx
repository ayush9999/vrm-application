'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ReadinessSnapshot } from '@/lib/db/readiness-snapshots'
import { RISK_BAND_STYLE } from '@/lib/risk-score'

interface Props {
  snapshots: ReadinessSnapshot[]
  currentReadinessPct: number
  captureSnapshotAction: (vendorId: string, notes?: string) => Promise<{ success?: boolean; message?: string }>
  vendorId: string
}

const W = 640
const H = 200
const PAD_L = 40
const PAD_R = 20
const PAD_T = 16
const PAD_B = 28

export function ReadinessTrendChart({ snapshots, currentReadinessPct, captureSnapshotAction, vendorId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleCapture = () => {
    setError(null)
    startTransition(async () => {
      const r = await captureSnapshotAction(vendorId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed')
    })
  }

  // Always include the "current" point on the right edge
  const points = snapshots.map((s) => ({ ts: new Date(s.created_at).getTime(), pct: s.readiness_pct }))
  if (snapshots.length === 0 || snapshots[snapshots.length - 1].readiness_pct !== currentReadinessPct) {
    points.push({ ts: Date.now(), pct: currentReadinessPct })
  }

  const lastSnapshot = snapshots[snapshots.length - 1] ?? null
  const delta = lastSnapshot ? currentReadinessPct - lastSnapshot.readiness_pct : 0

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Readiness Trend</div>
          <div className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            {lastSnapshot && (
              <span>
                {' '}· Last captured {new Date(lastSnapshot.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                {delta !== 0 && (
                  <span style={{ color: delta > 0 ? '#059669' : '#e11d48', fontWeight: 600 }}>
                    {' '} ({delta > 0 ? '↑' : '↓'} {Math.abs(delta)} pts since)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCapture}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
        >
          {isPending ? 'Capturing…' : '📸 Capture snapshot'}
        </button>
      </div>

      {points.length < 2 ? (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: '#a99fd8' }}>
            Not enough snapshots to draw a trend yet. Capture one to start the history, or change approval status (auto-captures).
          </p>
        </div>
      ) : (
        <Chart points={points} />
      )}

      {error && <p className="text-xs mt-2" style={{ color: '#e11d48' }}>{error}</p>}

      {/* Snapshot list */}
      {snapshots.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] cursor-pointer" style={{ color: '#6c5dd3' }}>
            Show snapshot history ({snapshots.length})
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {[...snapshots].reverse().map((s) => {
              const risk = RISK_BAND_STYLE[s.risk_band]
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(108,93,211,0.03)' }}>
                  <span className="w-16" style={{ color: '#a99fd8' }}>
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="font-bold tabular-nums w-12" style={{ color: '#1e1550' }}>{s.readiness_pct}%</span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                    style={{ background: risk.bg, color: risk.color }}
                  >
                    {risk.label}
                  </span>
                  <span className="flex-1 truncate" style={{ color: '#4a4270' }}>
                    {s.notes ?? s.trigger.replace(/_/g, ' ')}
                  </span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

function Chart({ points }: { points: { ts: number; pct: number }[] }) {
  const minTs = points[0].ts
  const maxTs = points[points.length - 1].ts
  const tsRange = Math.max(1, maxTs - minTs)
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const x = (ts: number) => PAD_L + ((ts - minTs) / tsRange) * chartW
  const y = (pct: number) => PAD_T + (1 - pct / 100) * chartH
  const baseline = PAD_T + chartH // y(0)

  // Smooth line path using cardinal spline approximation
  const pts = points.map((p) => ({ x: x(p.ts), y: y(p.pct) }))
  let path: string
  if (pts.length === 2) {
    path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`
  } else {
    // Build smooth cubic bezier through all points
    const segments: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      const tension = 0.3
      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = p1.y + (p2.y - p0.y) * tension
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = p2.y - (p3.y - p1.y) * tension
      segments.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
    }
    path = segments.join(' ')
  }

  // Date labels on X axis
  const dateLabels = points.length <= 8
    ? points
    : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: `${W}/${H}` }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_L} y1={y(tick)} x2={W - PAD_R} y2={y(tick)}
            stroke={tick === 0 ? 'rgba(109,93,211,0.15)' : 'rgba(109,93,211,0.06)'}
            strokeDasharray={tick === 0 || tick === 100 ? undefined : '4 3'}
          />
          <text x={PAD_L - 8} y={y(tick) + 4} fontSize="10" textAnchor="end" fill="#8b7fd4" fontFamily="system-ui">{tick}%</text>
        </g>
      ))}

      {/* Date labels on X axis */}
      {dateLabels.map((p, i) => (
        <text key={i} x={x(p.ts)} y={H - 6} fontSize="9" textAnchor="middle" fill="#a99fd8" fontFamily="system-ui">
          {new Date(p.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
      ))}

      {/* Gradient fill under curve */}
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c5dd3" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#7c6be0" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${pts[pts.length - 1].x.toFixed(1)} ${baseline.toFixed(1)} L ${pts[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`}
        fill="url(#trendFill)"
      />

      {/* Trend line — smooth */}
      <path d={path} fill="none" stroke="#6c5dd3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1
        return (
          <g key={i}>
            {/* Glow */}
            {isLast && <circle cx={x(p.ts)} cy={y(p.pct)} r="8" fill="rgba(108,93,211,0.12)" />}
            <circle
              cx={x(p.ts)} cy={y(p.pct)}
              r={isLast ? 5 : 3.5}
              fill={isLast ? '#6c5dd3' : 'white'}
              stroke="#6c5dd3"
              strokeWidth="2"
            >
              <title>{`${p.pct}% — ${new Date(p.ts).toLocaleDateString()}`}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
