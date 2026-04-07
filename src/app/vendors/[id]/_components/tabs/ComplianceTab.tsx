'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ComplianceData } from '@/types/vendor'
import type { FrameworkReadiness, ControlStatus } from '@/lib/db/compliance'

const CONTROL_STATUS_CONFIG: Record<ControlStatus, { icon: string; label: string; className: string }> = {
  satisfied:        { icon: '✓', label: 'Satisfied',              className: 'text-emerald-600 bg-emerald-50' },
  evidence_present: { icon: '◑', label: 'Doc Available — Review', className: 'text-blue-600 bg-blue-50' },
  missing:          { icon: '✗', label: 'Missing',                className: 'text-rose-600 bg-rose-50' },
  expired:          { icon: '⚠', label: 'Expired',                className: 'text-amber-600 bg-amber-50' },
  needs_assessment: { icon: '○', label: 'Needs Assessment',       className: 'text-slate-400 bg-slate-50' },
}

interface ComplianceTabProps {
  compliance: ComplianceData
  frameworkReadiness: FrameworkReadiness[]
  orgStandardIds: Set<string>
  onboardingAssessmentId: string | null
}

export function ComplianceTab({ compliance, frameworkReadiness, orgStandardIds, onboardingAssessmentId }: ComplianceTabProps) {
  // All collapsed by default
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<string>>(new Set())
  const allExpanded = frameworkReadiness.length > 0 && expandedFrameworks.size === frameworkReadiness.length

  function toggleFramework(id: string) {
    setExpandedFrameworks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function expandAll() { setExpandedFrameworks(new Set(frameworkReadiness.map(fw => fw.framework_id))) }
  function collapseAll() { setExpandedFrameworks(new Set()) }

  // Aggregate score across all frameworks
  const totalSatisfied       = frameworkReadiness.reduce((s, fw) => s + fw.satisfied, 0)
  const totalEvidencePresent = frameworkReadiness.reduce((s, fw) => s + fw.evidence_present, 0)
  const totalMissing         = frameworkReadiness.reduce((s, fw) => s + fw.missing, 0)
  const totalExpired         = frameworkReadiness.reduce((s, fw) => s + fw.expired, 0)
  const totalAssess          = frameworkReadiness.reduce((s, fw) => s + fw.needs_assessment, 0)
  const totalControls        = frameworkReadiness.reduce((s, fw) => s + fw.total, 0)
  const evaluable            = totalControls - totalAssess
  // Hybrid scoring: satisfied=100%, evidence_present=50%, missing/expired=0%
  // Docs pending review count as partial — full credit only after assessor confirms
  const overallScore = frameworkReadiness.length > 0 && evaluable > 0
    ? Math.floor(((totalSatisfied + totalEvidencePresent * 0.5) / evaluable) * 100)
    : null
  // Width of each segment in the stacked progress bar (% of evaluable)
  const confirmedBarPct = evaluable > 0 ? (totalSatisfied / evaluable) * 100 : 0
  const pendingBarPct   = evaluable > 0 ? (totalEvidencePresent * 0.5 / evaluable) * 100 : 0

  const color = overallScore === null ? 'text-slate-400'
    : overallScore >= 80 ? 'text-emerald-600'
    : overallScore >= 40 ? 'text-amber-500'
    : 'text-rose-500'
  const barColor = overallScore === null ? 'bg-slate-200'
    : overallScore >= 80 ? 'bg-emerald-500'
    : overallScore >= 40 ? 'bg-amber-400'
    : 'bg-rose-400'

  return (
    <div className="space-y-6">

      {/* ── Onboarding assessment link ── */}
      {onboardingAssessmentId && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.15)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: '#1e1550' }}>Onboarding Assessment</p>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>Review controls and confirm compliance evidence</p>
          </div>
          <Link
            href={`/assessments/${onboardingAssessmentId}`}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'rgba(109,93,211,0.12)', color: '#6c5dd3' }}
          >
            Open Assessment →
          </Link>
        </div>
      )}

      {/* ── Overall compliance score ── */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}>
        {/* Card header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              Overall Compliance Score
            </h2>
            {frameworkReadiness.length > 0 ? (
              <p className="text-xs mt-0.5 text-slate-400">
                {frameworkReadiness.length} framework{frameworkReadiness.length !== 1 ? 's' : ''} · {evaluable} evaluable controls
                {totalAssess > 0 && ` · ${totalAssess} manual`}
              </p>
            ) : (
              <p className="text-xs mt-0.5 text-slate-400">No risk frameworks assigned</p>
            )}
          </div>
          {/* Info tooltip trigger */}
          {frameworkReadiness.length > 0 && evaluable > 0 && (
            <span className="relative group cursor-help shrink-0">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold select-none transition-colors"
                style={{ background: 'rgba(169,159,216,0.12)', color: '#a99fd8' }}
              >
                i
              </span>
              {/* Tooltip */}
              <div
                className="hidden group-hover:block absolute right-0 top-8 z-20 w-72 rounded-xl shadow-xl p-4 text-xs"
                style={{ background: '#fff', border: '1px solid #e2e8f0' }}
              >
                <p className="font-semibold text-slate-700 mb-3">How this score is calculated</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      Confirmed ({totalSatisfied} controls)
                    </span>
                    <span className="font-semibold text-emerald-700 shrink-0">× 100%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-blue-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                      Doc uploaded, pending review ({totalEvidencePresent})
                    </span>
                    <span className="font-semibold text-blue-600 shrink-0">× 50%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" />
                      Missing / Expired ({totalMissing + totalExpired})
                    </span>
                    <span className="font-semibold shrink-0">× 0%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-200 shrink-0" />
                      Needs manual assessment ({totalAssess})
                    </span>
                    <span className="font-semibold shrink-0">excluded</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2.5 mt-0.5 flex items-center justify-between text-slate-600 font-semibold">
                    <span>Score</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      ({totalSatisfied} + {totalEvidencePresent}×½) ÷ {evaluable} = {overallScore}%
                    </span>
                  </div>
                </div>
                <p className="text-slate-400 mt-3 text-[10px] leading-relaxed border-t border-slate-50 pt-2.5">
                  Uploaded docs count at 50% — full credit only after an assessor confirms them.
                </p>
              </div>
            </span>
          )}
        </div>

        {frameworkReadiness.length > 0 ? (
          <>
            {/* Score + stacked bar */}
            <div className="flex items-center gap-5">
              <div className={`text-4xl font-bold leading-none tracking-tight shrink-0 tabular-nums ${color}`}>
                {overallScore !== null ? `${overallScore}%` : '—'}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Stacked bar */}
                <div className="h-3 bg-[rgba(109,93,211,0.06)] rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 shrink-0"
                    style={{ width: `${confirmedBarPct}%` }}
                  />
                  <div
                    className="h-full bg-blue-400 transition-all duration-500 shrink-0"
                    style={{ width: `${pendingBarPct}%` }}
                  />
                </div>
                {/* Bar legend */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block shrink-0" />
                    Confirmed
                  </span>
                  {totalEvidencePresent > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-500 font-medium">
                      <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block shrink-0" />
                      Pending review (½ credit)
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: '#a99fd8' }}>
                    <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.15)' }} />
                    Gap remaining
                  </span>
                </div>
              </div>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                ✓ {totalSatisfied} confirmed
              </span>
              {totalEvidencePresent > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  ◑ {totalEvidencePresent} pending review
                </span>
              )}
              {totalMissing > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                  ✗ {totalMissing} missing
                </span>
              )}
              {totalExpired > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                  ⚠ {totalExpired} expired
                </span>
              )}
              {totalAssess > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500">
                  ○ {totalAssess} need assessment
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: '#a99fd8' }}>Add a vendor category to apply Vendor Risk Frameworks and start tracking compliance.</p>
        )}
      </div>

      {/* ── Framework readiness ── */}
      {frameworkReadiness.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No risk frameworks applicable</p>
          <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
            Assign a vendor category to automatically apply the relevant Vendor Risk Frameworks.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Framework Readiness</h3>
              <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>Control-level evaluation against assigned Vendor Risk Frameworks</p>
            </div>
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {frameworkReadiness.map((fw) => {
            const isExpanded = expandedFrameworks.has(fw.framework_id)
            const fwScore = fw.score
            const fwColor = fwScore === null ? 'text-slate-400'
              : fwScore >= 80 ? 'text-emerald-600'
              : fwScore >= 40 ? 'text-amber-600'
              : 'text-rose-600'
            const fwBarColor = fwScore === null ? 'bg-slate-200'
              : fwScore >= 80 ? 'bg-emerald-500'
              : fwScore >= 40 ? 'bg-amber-400'
              : 'bg-rose-400'

            // Group items by category
            const categories = Array.from(
              fw.items.reduce((acc, item) => {
                const cat = item.category ?? 'General'
                if (!acc.has(cat)) acc.set(cat, [])
                acc.get(cat)!.push(item)
                return acc
              }, new Map<string, typeof fw.items>()),
            )

            return (
              <div
                key={fw.framework_id}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'rgba(109,93,211,0.12)' }}
              >
                {/* Framework header — click to expand */}
                <button
                  type="button"
                  onClick={() => toggleFramework(fw.framework_id)}
                  className="w-full flex items-center gap-3 px-5 py-4 bg-white hover:bg-slate-50/60 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{fw.framework_name}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-400">
                        Controls: <span className="text-slate-600 font-medium">{fw.total}</span>
                      </span>
                      <span className="text-xs text-emerald-600 font-medium">✓ {fw.satisfied} confirmed</span>
                      {fw.evidence_present > 0 && (
                        <span className="text-xs text-blue-600 font-medium">◑ {fw.evidence_present} pending review</span>
                      )}
                      {fw.missing > 0 && (
                        <span className="text-xs text-rose-600 font-medium">✗ {fw.missing} missing</span>
                      )}
                      {fw.expired > 0 && (
                        <span className="text-xs text-amber-600 font-medium">⚠ {fw.expired} expired</span>
                      )}
                      {fw.needs_assessment > 0 && (
                        <span className="text-xs text-slate-400">○ {fw.needs_assessment} need assessment</span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right min-w-[72px]">
                    {fwScore !== null ? (
                      <>
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-xl font-bold ${fwColor}`}>{fwScore}%</span>
                          {/* Per-framework breakdown tooltip */}
                          {(() => {
                            const fwEval = fw.total - fw.needs_assessment
                            if (fwEval === 0) return null
                            return (
                              <span className="relative group cursor-help">
                                <span className="text-slate-300 text-[10px] leading-none select-none">ⓘ</span>
                                <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 z-20 w-60 rounded-xl shadow-xl p-3 text-xs"
                                  style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-emerald-600">
                                      <span>✓ Confirmed ({fw.satisfied})</span><span className="font-semibold">× 100%</span>
                                    </div>
                                    {fw.evidence_present > 0 && (
                                      <div className="flex justify-between text-blue-500">
                                        <span>◑ Pending review ({fw.evidence_present})</span><span className="font-semibold">× 50%</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-slate-400">
                                      <span>✗ Missing/Expired ({fw.missing + fw.expired})</span><span className="font-semibold">× 0%</span>
                                    </div>
                                    {fw.needs_assessment > 0 && (
                                      <div className="flex justify-between text-slate-400">
                                        <span>○ Needs assessment ({fw.needs_assessment})</span><span className="font-semibold">excl.</span>
                                      </div>
                                    )}
                                    <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between font-semibold text-slate-600 font-mono text-[10px]">
                                      <span>Score</span>
                                      <span>({fw.satisfied}+{fw.evidence_present}×½)÷{fwEval}</span>
                                    </div>
                                  </div>
                                </div>
                              </span>
                            )
                          })()}
                        </div>
                        {/* Stacked bar */}
                        {(() => {
                          const fwEval = fw.total - fw.needs_assessment
                          const sPct = fwEval > 0 ? (fw.satisfied / fwEval) * 100 : 0
                          const ePct = fwEval > 0 ? (fw.evidence_present * 0.5 / fwEval) * 100 : 0
                          return (
                            <div className="mt-1 h-1 w-16 bg-slate-200 rounded-full overflow-hidden ml-auto flex">
                              <div className="h-full bg-emerald-500 shrink-0" style={{ width: `${sPct}%` }} />
                              <div className="h-full bg-blue-400 shrink-0" style={{ width: `${ePct}%` }} />
                            </div>
                          )
                        })()}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Assessment<br />required</span>
                    )}
                  </div>
                  <span className="text-slate-300 text-xs ml-2 shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded: controls grouped by category */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {categories.map(([cat, items]) => (
                      <div key={cat}>
                        <div className="px-5 py-2" style={{ background: 'rgba(109,93,211,0.03)' }}>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            {cat}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {items.map((item) => {
                            const cfg = CONTROL_STATUS_CONFIG[item.status]
                            return (
                              <div
                                key={item.framework_item_id}
                                className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/40 transition-colors"
                              >
                                <span
                                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${cfg.className}`}
                                >
                                  {cfg.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-700">{item.title}</p>
                                  {item.doc_type_name && item.status === 'evidence_present' && (
                                    <p className="text-xs text-blue-500 mt-0.5">
                                      {item.doc_type_name} uploaded — awaiting assessor review
                                    </p>
                                  )}
                                  {item.doc_type_name && (item.status === 'missing' || item.status === 'expired') && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Expects: {item.doc_type_name}
                                    </p>
                                  )}
                                  {(() => {
                                    const refs = item.mapped_standard_refs?.filter(r => orgStandardIds.has(r.standard_id))
                                    if (!refs?.length) return null
                                    return (
                                      <p className="text-xs mt-1 flex items-center gap-1 flex-wrap">
                                        <span className="text-slate-400 shrink-0">Compliance Impact:</span>
                                        {refs.map(r => (
                                          <span key={`${r.standard_id}-${r.ref}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }}>
                                            {r.standard_name} {r.ref}
                                          </span>
                                        ))}
                                      </p>
                                    )
                                  })()}
                                </div>
                                <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                                  {cfg.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
