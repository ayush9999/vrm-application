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

const W = 600
const H = 140
const PAD_X = 36
const PAD_Y = 18

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

  const x = (ts: number) => PAD_X + ((ts - minTs) / tsRange) * (W - PAD_X * 2)
  const y = (pct: number) => H - PAD_Y - (pct / 100) * (H - PAD_Y * 2)

  // Build path
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ts).toFixed(1)} ${y(p.pct).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ height: 140 }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={PAD_X} y1={y(tick)} x2={W - PAD_X} y2={y(tick)} stroke="rgba(109,93,211,0.08)" strokeDasharray={tick === 0 || tick === 100 ? undefined : '2 2'} />
          <text x={PAD_X - 6} y={y(tick) + 3} fontSize="9" textAnchor="end" fill="#a99fd8">{tick}</text>
        </g>
      ))}

      {/* Gradient fill under line */}
      <defs>
        <linearGradient id="fillgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c5dd3" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6c5dd3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${x(maxTs).toFixed(1)} ${(H - PAD_Y).toFixed(1)} L ${x(minTs).toFixed(1)} ${(H - PAD_Y).toFixed(1)} Z`}
        fill="url(#fillgrad)"
      />

      {/* Trend line */}
      <path d={path} fill="none" stroke="#6c5dd3" strokeWidth="2" />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.ts)} cy={y(p.pct)} r={i === points.length - 1 ? 4 : 3} fill={i === points.length - 1 ? '#6c5dd3' : 'white'} stroke="#6c5dd3" strokeWidth="2">
          <title>{`${p.pct}% — ${new Date(p.ts).toLocaleDateString()}`}</title>
        </circle>
      ))}
    </svg>
  )
}
