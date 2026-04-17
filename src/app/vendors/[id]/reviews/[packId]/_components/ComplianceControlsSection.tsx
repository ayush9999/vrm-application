'use client'

import { useState } from 'react'
import type { VendorReviewItem } from '@/types/review-pack'

interface Props {
  items: VendorReviewItem[]
}

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Pending', color: '#94a3b8' },
  pass: { label: 'Pass', color: '#059669' },
  fail: { label: 'Fail', color: '#e11d48' },
  na: { label: 'N/A', color: '#64748b' },
  needs_follow_up: { label: 'Follow-up', color: '#d97706' },
  exception_approved: { label: 'Exception', color: '#7c3aed' },
}

/**
 * Expandable section showing all review items grouped as "framework controls"
 * with their compliance references + current decision. Read-only summary view.
 */
export function ComplianceControlsSection({ items }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const withRefs = items.filter((i) => i.compliance_references && i.compliance_references.length > 0)
  const totalRefs = withRefs.reduce((s, i) => s + (i.compliance_references?.length ?? 0), 0)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M5 6h6M5 8.5h6M5 11h3" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
            Framework Controls & Compliance References
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}>
            {items.length} controls · {totalRefs} refs
          </span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
          {items.map((item, idx) => {
            const dec = DECISION_LABEL[item.decision] ?? { label: item.decision, color: '#94a3b8' }
            return (
              <div
                key={item.id}
                className="px-5 py-3 flex items-start gap-3"
                style={{ borderBottom: idx === items.length - 1 ? undefined : '1px solid rgba(109,93,211,0.04)' }}
              >
                {/* Decision dot */}
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: dec.color }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
                      {item.requirement_name ?? 'Unnamed control'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ color: dec.color, background: `${dec.color}15` }}>
                      {dec.label}
                    </span>
                  </div>

                  {item.requirement_description && (
                    <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{item.requirement_description}</p>
                  )}

                  {/* Compliance references */}
                  {item.compliance_references && item.compliance_references.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {item.compliance_references.map((ref, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded font-mono"
                          style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}
                        >
                          {ref.standard} — {ref.reference}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Comment */}
                  {item.reviewer_comment && (
                    <p className="text-[11px] mt-1 italic" style={{ color: '#8b7fd4' }}>
                      {item.reviewer_comment}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
