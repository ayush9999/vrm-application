'use client'

import type { VendorReviewItem } from '@/types/review-pack'

interface Props {
  items: VendorReviewItem[]
  orgStandards: string[]
  isCompleted: boolean
}

interface CoverageRow {
  standard: string
  totalMapped: number
  passed: number
  pct: number
}

const POSITIVE_DECISIONS = new Set(['pass', 'exception_approved'])

/**
 * Shows how well this review covers each of the org's selected compliance standards.
 * Only shown on completed reviews.
 */
export function FrameworkCoverage({ items, orgStandards, isCompleted }: Props) {
  if (!isCompleted || orgStandards.length === 0) return null

  // Build coverage per standard
  const coverage: CoverageRow[] = orgStandards.map((standard) => {
    const mapped = items.filter((it) =>
      it.compliance_references?.some((r) => r.standard === standard),
    )
    const passed = mapped.filter((it) => POSITIVE_DECISIONS.has(it.decision)).length
    return {
      standard,
      totalMapped: mapped.length,
      passed,
      pct: mapped.length > 0 ? Math.round((passed / mapped.length) * 100) : 0,
    }
  }).filter((c) => c.totalMapped > 0) // Only show standards that have mappings

  if (coverage.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(109,93,211,0.03)', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5L2 5v4.5c0 3 2.5 5 6 6.5 3.5-1.5 6-3.5 6-6.5V5L8 1.5z" />
            <path d="M5.5 8l2 2 3.5-4" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>Framework Coverage</span>
        </div>
        <span className="text-[10px]" style={{ color: '#8b7fd4' }}>
          Based on your org&apos;s selected compliance standards
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: 'rgba(109,93,211,0.04)' }}>
        {coverage.map((c) => (
          <div key={c.standard} className="px-5 py-3 flex items-center gap-4">
            <div className="w-32 shrink-0">
              <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{c.standard}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px]" style={{ color: '#8b7fd4' }}>
                  {c.passed} / {c.totalMapped} requirements passed
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: c.pct === 100 ? '#059669' : c.pct >= 75 ? '#6c5dd3' : c.pct >= 50 ? '#d97706' : '#e11d48' }}
                >
                  {c.pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${c.pct}%`,
                    background: c.pct === 100 ? '#059669' : c.pct >= 75 ? '#6c5dd3' : c.pct >= 50 ? '#d97706' : '#e11d48',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
