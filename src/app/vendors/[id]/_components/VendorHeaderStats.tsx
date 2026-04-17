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

        {/* Trend tile — compact with expand */}
        <Tile label="Trend">
          <div className="flex items-center justify-between">
            <div>
              {snapshots.length === 0 ? (
                <span className="text-xs" style={{ color: '#a99fd8' }}>No snapshots</span>
              ) : (
                <div className="flex items-baseline gap-1.5">
                  {delta !== 0 && (
                    <span className="text-sm font-bold" style={{ color: delta > 0 ? '#059669' : '#e11d48' }}>
                      {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
                    </span>
                  )}
                  {delta === 0 && <span className="text-sm font-bold" style={{ color: '#94a3b8' }}>→ 0</span>}
                  <span className="text-[10px]" style={{ color: '#a99fd8' }}>pts since last</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpandedChart(expandedChart === 'trend' ? null : 'trend')}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                style={{ background: expandedChart === 'trend' ? '#6c5dd3' : 'rgba(109,93,211,0.06)', color: expandedChart === 'trend' ? 'white' : '#6c5dd3' }}
              >
                Chart
              </button>
              {hasRadar && (
                <button
                  type="button"
                  onClick={() => setExpandedChart(expandedChart === 'radar' ? null : 'radar')}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md"
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
