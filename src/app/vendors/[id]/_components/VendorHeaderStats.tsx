'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { RiskBand } from '@/lib/risk-score'
import type { VendorApprovalStatus } from '@/types/vendor'
import type { VendorReviewPack } from '@/types/review-pack'
import type { ReadinessSnapshot } from '@/lib/db/readiness-snapshots'
import type { PeerBenchmark } from '@/lib/db/peer-benchmark'
import { ReadinessTrendChart } from './ReadinessTrendChart'
import { ReadinessRadarChart } from './ReadinessRadarChart'

const APPROVAL_BADGE: Record<VendorApprovalStatus, { label: string; bg: string; color: string }> = {
  draft:                   { label: 'Draft',          bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  waiting_on_vendor:       { label: 'Waiting Vendor', bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  in_internal_review:      { label: 'In Review',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  approved:                { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception: { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  blocked:                 { label: 'Blocked',        bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  suspended:               { label: 'Suspended',      bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  offboarded:              { label: 'Offboarded',     bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

interface Props {
  vendorId: string
  readinessPct: number
  applicable: number
  completed: number
  riskBand: RiskBand
  riskScore: number
  riskFormula: string
  approvalStatus: VendorApprovalStatus
  approvedAt: string | null
  exceptionReason: string | null
  updateApprovalStatusAction: (
    vendorId: string,
    newStatus: VendorApprovalStatus,
    exceptionReason?: string,
  ) => Promise<{ message?: string; success?: boolean }>
  // Chart data (optional — collapses to compact tiles)
  snapshots?: ReadinessSnapshot[]
  currentReadinessPct?: number
  captureSnapshotAction?: (vendorId: string, notes?: string) => Promise<{ success?: boolean; message?: string }>
  reviewPacks?: VendorReviewPack[]
  benchmark?: PeerBenchmark | null
}

export function VendorHeaderStats(props: Props) {
  const {
    vendorId, readinessPct, applicable, completed,
    riskBand, riskScore, riskFormula,
    approvalStatus, approvedAt, exceptionReason,
    updateApprovalStatusAction,
    snapshots = [], currentReadinessPct = 0, captureSnapshotAction,
    reviewPacks = [], benchmark,
  } = props

  const risk = RISK_BAND_STYLE[riskBand]
  const approval = APPROVAL_BADGE[approvalStatus]
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [expandedChart, setExpandedChart] = useState<'trend' | 'radar' | null>(null)

  const router = useRouter()

  const handleSet = (status: VendorApprovalStatus) => {
    setPickerOpen(false)
    if (status === 'approved_with_exception') {
      const reason = prompt('Exception reason (required):')
      if (!reason?.trim()) return
      startTransition(async () => {
        await updateApprovalStatusAction(vendorId, status, reason.trim())
        router.refresh()
      })
      return
    }
    startTransition(async () => {
      await updateApprovalStatusAction(vendorId, status)
      router.refresh()
    })
  }

  // Trend summary
  const lastSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const delta = lastSnapshot ? currentReadinessPct - lastSnapshot.readiness_pct : 0

  const hasRadar = reviewPacks.filter((p) => p.item_counts && p.item_counts.total > 0).length >= 3

  return (
    <div className="mb-5 space-y-3">
      {/* Compact 4-tile row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Readiness */}
        <Tile label="Readiness">
          {applicable === 0 ? (
            <span className="text-sm font-medium" style={{ color: '#a99fd8' }}>No packs</span>
          ) : (
            <div>
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: readinessPct === 100 ? '#059669' : readinessPct >= 50 ? '#6c5dd3' : '#d97706' }}
              >
                {readinessPct}%
              </span>
              <span className="text-[10px] ml-1.5" style={{ color: '#a99fd8' }}>{completed} / {applicable}</span>
              <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: 'rgba(109,93,211,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${readinessPct}%`, background: readinessPct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }} />
              </div>
            </div>
          )}
        </Tile>

        {/* Risk Rating */}
        <Tile label="Risk Rating">
          <div className="flex items-center gap-2" title={riskFormula}>
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: risk.bg, color: risk.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.dot }} />
              {risk.label}
            </span>
            <span className="text-xs font-mono" style={{ color: '#a99fd8' }}>{riskScore}</span>
          </div>
        </Tile>

        {/* Approval Status */}
        <Tile label="Approval">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: approval.bg, color: approval.color }}>
              {approval.label}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={isPending}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md disabled:opacity-50"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}
              >
                {isPending ? '…' : 'Change'}
              </button>
              {pickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden min-w-[200px]" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 4px 16px rgba(109,93,211,0.15)' }}>
                  {Object.entries(APPROVAL_BADGE).filter(([k]) => k !== approvalStatus).map(([k, b]) => (
                    <button key={k} type="button" onClick={() => handleSet(k as VendorApprovalStatus)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[rgba(109,93,211,0.04)]" style={{ color: '#1e1550' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {approvalStatus === 'approved_with_exception' && exceptionReason && (
            <p className="text-[10px] mt-1 italic truncate" style={{ color: '#7c3aed' }} title={exceptionReason}>Exception: {exceptionReason}</p>
          )}
        </Tile>

        {/* Trend tile — compact sparkline + expand */}
        <Tile label="Trend">
          <div className="flex items-center gap-3">
            {/* Mini sparkline */}
            <div className="flex-1 min-w-0">
              {snapshots.length >= 2 ? (
                <MiniSparkline points={[...snapshots.map((s) => s.readiness_pct), currentReadinessPct]} />
              ) : snapshots.length === 1 ? (
                <MiniSparkline points={[snapshots[0].readiness_pct, currentReadinessPct]} />
              ) : (
                <div className="h-[28px] flex items-center">
                  <span className="text-[10px]" style={{ color: '#a99fd8' }}>No history</span>
                </div>
              )}
            </div>

            {/* Delta + expand */}
            <div className="shrink-0 text-right">
              {snapshots.length > 0 && (
                <div className="text-sm font-bold tabular-nums" style={{ color: delta > 0 ? '#059669' : delta < 0 ? '#e11d48' : '#94a3b8' }}>
                  {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}{Math.abs(delta)}
                </div>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => setExpandedChart(expandedChart === 'trend' ? null : 'trend')}
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: expandedChart === 'trend' ? '#6c5dd3' : 'rgba(109,93,211,0.06)', color: expandedChart === 'trend' ? 'white' : '#6c5dd3' }}
                >
                  Expand
                </button>
                {hasRadar && (
                  <button
                    type="button"
                    onClick={() => setExpandedChart(expandedChart === 'radar' ? null : 'radar')}
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: expandedChart === 'radar' ? '#6c5dd3' : 'rgba(109,93,211,0.06)', color: expandedChart === 'radar' ? 'white' : '#6c5dd3' }}
                  >
                    Radar
                </button>
              )}
            </div>
          </div>
        </Tile>
      </div>

      {/* Peer benchmark (compact, inline) */}
      {benchmark && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs" style={{ background: 'rgba(108,93,211,0.03)', border: '1px solid rgba(108,93,211,0.08)' }}>
          <span style={{ color: '#6c5dd3' }}>Category avg</span>
          <span style={{ color: '#4a4270' }}>({benchmark.categoryName}, {benchmark.vendorCount} peers):</span>
          <span className="font-bold tabular-nums">{benchmark.categoryAvgReadiness}%</span>
          <span>—</span>
          <span style={{ color: readinessPct >= benchmark.categoryAvgReadiness ? '#059669' : '#e11d48', fontWeight: 600 }}>
            This vendor: {readinessPct}%
            {readinessPct >= benchmark.categoryAvgReadiness ? ' ↑' : ' ↓'}
          </span>
        </div>
      )}

      {/* Expanded chart (trend or radar) */}
      {expandedChart === 'trend' && captureSnapshotAction && (
        <ReadinessTrendChart
          vendorId={vendorId}
          snapshots={snapshots}
          currentReadinessPct={currentReadinessPct}
          captureSnapshotAction={captureSnapshotAction}
        />
      )}
      {expandedChart === 'radar' && (
        <ReadinessRadarChart packs={reviewPacks} />
      )}
    </div>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 1px 4px rgba(109,93,211,0.04)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>{label}</div>
      {children}
    </div>
  )
}

/** Tiny sparkline — no axes, no labels, just the shape. */
function MiniSparkline({ points }: { points: number[] }) {
  const W = 90
  const H = 28
  const PAD = 2
  if (points.length < 2) return null

  const maxVal = Math.max(...points, 1)
  const minVal = Math.min(...points, 0)
  const range = Math.max(maxVal - minVal, 1)

  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - minVal) / range) * (H - PAD * 2)

  // Smooth path
  const pts = points.map((v, i) => ({ x: x(i), y: y(v) }))
  let path: string
  if (pts.length === 2) {
    path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`
  } else {
    const segments = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      const t = 0.3
      segments.push(`C ${(p1.x + (p2.x - p0.x) * t).toFixed(1)} ${(p1.y + (p2.y - p0.y) * t).toFixed(1)}, ${(p2.x - (p3.x - p1.x) * t).toFixed(1)} ${(p2.y - (p3.y - p1.y) * t).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
    }
    path = segments.join(' ')
  }

  const fillPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`
  const lastPt = pts[pts.length - 1]
  const trending = points[points.length - 1] >= points[0]
  const lineColor = trending ? '#6c5dd3' : '#e11d48'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#sparkFill)" />
      <path d={path} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={lineColor} />
    </svg>
  )
}
