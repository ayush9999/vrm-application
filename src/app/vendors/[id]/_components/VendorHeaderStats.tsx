'use client'

import { useState, useTransition } from 'react'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { RiskBand } from '@/lib/risk-score'
import type { VendorApprovalStatus } from '@/types/vendor'

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
}

export function VendorHeaderStats({
  vendorId,
  readinessPct,
  applicable,
  completed,
  riskBand,
  riskScore,
  riskFormula,
  approvalStatus,
  approvedAt,
  exceptionReason,
  updateApprovalStatusAction,
}: Props) {
  const risk = RISK_BAND_STYLE[riskBand]
  const approval = APPROVAL_BADGE[approvalStatus]
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSet = (status: VendorApprovalStatus) => {
    setPickerOpen(false)
    if (status === 'approved_with_exception') {
      const reason = prompt('Exception reason (required):')
      if (!reason?.trim()) return
      startTransition(async () => {
        await updateApprovalStatusAction(vendorId, status, reason.trim())
      })
      return
    }
    startTransition(async () => {
      await updateApprovalStatusAction(vendorId, status)
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      {/* Readiness */}
      <StatCard label="Readiness">
        {applicable === 0 ? (
          <span className="text-sm font-medium" style={{ color: '#a99fd8' }}>No review packs</span>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: readinessPct === 100 ? '#059669' : readinessPct >= 50 ? '#6c5dd3' : '#d97706' }}
              >
                {readinessPct}%
              </span>
              <span className="text-xs" style={{ color: '#a99fd8' }}>
                {completed} / {applicable} applicable
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${readinessPct}%`,
                  background: readinessPct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)',
                }}
              />
            </div>
          </div>
        )}
      </StatCard>

      {/* Risk Rating */}
      <StatCard label="Risk Rating">
        <RiskInfoTooltip formula={riskFormula}>
          <div className="flex items-center gap-2 cursor-help">
            <span
              className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"
              style={{ background: risk.bg, color: risk.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.dot }} />
              {risk.label}
            </span>
            <span className="text-sm font-mono" style={{ color: '#a99fd8' }}>
              {riskScore} / 100
            </span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#c4bae8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 7.5v3" />
              <circle cx="8" cy="5" r="0.5" fill="#c4bae8" />
            </svg>
          </div>
        </RiskInfoTooltip>
      </StatCard>

      {/* Approval Status */}
      <StatCard label="Approval Status">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center text-sm px-2.5 py-1 rounded-full font-semibold"
            style={{ background: approval.bg, color: approval.color }}
          >
            {approval.label}
          </span>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={isPending}
              className="text-[10px] font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
            >
              {isPending ? '…' : 'Change'}
            </button>
            {pickerOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden min-w-[220px]"
                style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 4px 16px rgba(109,93,211,0.15)' }}
              >
                {Object.entries(APPROVAL_BADGE)
                  .filter(([k]) => k !== approvalStatus)
                  .map(([k, b]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleSet(k as VendorApprovalStatus)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[rgba(109,93,211,0.04)] transition-colors"
                      style={{ color: '#1e1550' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                      {b.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
        {approvedAt && approvalStatus === 'approved' && (
          <p className="text-[11px] mt-1.5" style={{ color: '#a99fd8' }}>
            Approved {new Date(approvedAt).toLocaleDateString()}
          </p>
        )}
        {approvalStatus === 'approved_with_exception' && exceptionReason && (
          <p className="text-[11px] mt-1.5 italic" style={{ color: '#7c3aed' }}>
            Exception: {exceptionReason}
          </p>
        )}
      </StatCard>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#a99fd8' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function RiskInfoTooltip({ formula, children }: { formula: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <div
          className="absolute z-20 left-0 top-full mt-2 p-3 rounded-xl text-xs whitespace-pre-line min-w-[280px] max-w-[360px]"
          style={{
            background: '#1c1c2e',
            color: 'white',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '11px',
            lineHeight: '1.6',
          }}
        >
          {formula}
        </div>
      )}
    </div>
  )
}
