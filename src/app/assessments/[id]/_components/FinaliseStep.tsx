'use client'

import React, { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type {
  VendorAssessment,
  AssessmentItem,
  AssessmentFinding,
  AssessmentFramework,
  AssessmentFormState,
  AssessmentItemStatus,
} from '@/types/assessment'
import type { VendorDocStatus } from '@/lib/db/documents'
import { Spinner } from '@/app/_components/Spinner'
import { SubmitButton } from '@/app/_components/SubmitButton'

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<AssessmentItemStatus, string> = {
  not_started:     '#a99fd8',
  in_progress:     '#6c5dd3',
  satisfactory:    '#059669',
  needs_attention: '#d97706',
  high_risk:       '#e11d48',
  mitigated:       '#0ea5e9',
  not_applicable:  '#94a3b8',
}
const STATUS_LABEL: Record<AssessmentItemStatus, string> = {
  not_started:     'Not Started',
  in_progress:     'In Progress',
  satisfactory:    'Satisfactory',
  needs_attention: 'Needs Attention',
  high_risk:       'High Risk',
  mitigated:       'Mitigated',
  not_applicable:  'N/A',
}

const SEVERITY_CLS: Record<string, string> = {
  high:   'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-[rgba(169,159,216,0.12)] text-[#a99fd8]',
}

const FINDING_STATUS_CLS: Record<string, string> = {
  open:      'bg-amber-50 text-amber-700',
  mitigated: 'bg-emerald-50 text-emerald-700',
  accepted:  'bg-sky-50 text-sky-700',
  closed:    'bg-[rgba(169,159,216,0.08)] text-[#a99fd8]',
}

function itemSignalBorder(status: AssessmentItemStatus): string {
  if (status === 'satisfactory' || status === 'mitigated') return '#059669'
  if (status === 'high_risk' || status === 'needs_attention') return '#e11d48'
  return 'rgba(109,93,211,0.2)'
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface FinaliseStepProps {
  assessment: VendorAssessment
  items: AssessmentItem[]
  findings: AssessmentFinding[]
  frameworks: AssessmentFramework[]
  vendorDocStatus: Map<string, VendorDocStatus>
  orgStandardIds: Set<string>
  saveSummaryAction: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  updateStatusAction: (formData: FormData) => Promise<void>
  onNext?: () => void
  isFinished: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FinaliseStep({
  assessment,
  items,
  findings,
  frameworks,
  vendorDocStatus,
  orgStandardIds,
  saveSummaryAction,
  updateStatusAction,
  onNext,
  isFinished,
}: FinaliseStepProps) {
  const router = useRouter()
  const [summaryState, summaryFormAction, summaryPending] = useActionState(saveSummaryAction, {})

  useEffect(() => {
    if (summaryState.success) router.refresh()
  }, [summaryState.success, router])

  const openFindings = findings.filter(f => f.status === 'open')
  const highFindings = findings.filter(f => f.severity === 'high' && f.status === 'open')
  const mitigatedFindings = findings.filter(f => f.status === 'mitigated')

  // Group items by framework → domain
  const frameworkById = new Map(frameworks.map(f => [f.id, f]))
  const byFramework = new Map<string | null, Map<string, AssessmentItem[]>>()
  for (const item of items) {
    const fwId = item.framework_id ?? null
    if (!byFramework.has(fwId)) byFramework.set(fwId, new Map())
    const byDomain = byFramework.get(fwId)!
    const domain = item.category ?? 'Uncategorised'
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain)!.push(item)
  }
  const orderedFwIds = [
    ...frameworks.map(f => f.id).filter(id => byFramework.has(id)),
    ...(byFramework.has(null) ? [null] : []),
  ] as (string | null)[]

  // Doc evidence items
  const docCheckItems = items.filter(i => i.expected_document_type_id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Finalise Assessment</h2>
        <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
          Review the complete assessment, add your final summary, and submit.
        </p>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total Controls',  value: items.length,             color: '#6c5dd3' },
          { label: 'Passed',          value: items.filter(i => i.status === 'satisfactory' || i.status === 'mitigated').length, color: '#059669' },
          { label: 'Failed',          value: items.filter(i => i.status === 'high_risk' || i.status === 'needs_attention').length, color: items.filter(i => i.status === 'high_risk' || i.status === 'needs_attention').length > 0 ? '#e11d48' : '#059669' },
          { label: 'Findings',        value: findings.length,          color: '#6c5dd3' },
          { label: 'Open Findings',   value: openFindings.length,      color: openFindings.length > 0 ? '#d97706' : '#059669' },
          { label: 'High Severity',   value: highFindings.length,      color: highFindings.length > 0 ? '#e11d48' : '#059669' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.1)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{label}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Summary form ───────────────────────────────────────────── */}
      {!isFinished ? (
        <form action={summaryFormAction} className="space-y-4">
          {summaryState.message && (
            <p className={`text-xs ${summaryState.message === 'Saved.' ? 'text-emerald-600' : 'text-rose-500'}`}>
              {summaryState.message}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3d2e8a' }}>Final Summary</label>
            <textarea
              name="final_summary"
              rows={4}
              defaultValue={assessment.final_summary ?? ''}
              placeholder="Executive summary of the overall risk assessment…"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3d2e8a' }}>Recommendation</label>
            <select
              name="final_recommendation"
              defaultValue={assessment.final_recommendation ?? ''}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
            >
              <option value="">— Select recommendation —</option>
              <option value="Approve">Approve</option>
              <option value="Approve with conditions">Approve with conditions</option>
              <option value="Escalate for review">Escalate for review</option>
              <option value="Reject">Reject</option>
              <option value="Monitor closely">Monitor closely</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3d2e8a' }}>Reviewer Notes</label>
            <textarea
              name="human_notes"
              rows={2}
              defaultValue={assessment.human_notes ?? ''}
              placeholder="Internal notes for this assessment…"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
            />
          </div>
          <button
            type="submit"
            disabled={summaryPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
          >
            {summaryPending && <Spinner />}
            {summaryPending ? 'Saving…' : 'Save Draft'}
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          {assessment.final_summary && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#a99fd8' }}>Final Summary</p>
              <p className="text-sm leading-relaxed" style={{ color: '#1e1550' }}>{assessment.final_summary}</p>
            </div>
          )}
          {assessment.final_recommendation && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#a99fd8' }}>Recommendation</p>
              <p className="text-sm font-semibold" style={{ color: '#059669' }}>{assessment.final_recommendation}</p>
            </div>
          )}
          {assessment.human_notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#a99fd8' }}>Reviewer Notes</p>
              <p className="text-sm leading-relaxed" style={{ color: '#6b5fa8' }}>{assessment.human_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Submit / complete actions ──────────────────────────────── */}
      {!isFinished && (
        <div
          className="flex items-center gap-3 pt-4"
          style={{ borderTop: '1px solid rgba(109,93,211,0.1)' }}
        >
          <form action={updateStatusAction}>
            <input type="hidden" name="status" value="submitted" />
            <SubmitButton
              label="Submit Assessment"
              pendingLabel="Submitting…"
              className="px-6 py-2.5 rounded-full text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
            />
          </form>
          <form action={updateStatusAction}>
            <input type="hidden" name="status" value="completed" />
            <SubmitButton
              label="Mark Completed"
              className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
              style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}
            />
          </form>
        </div>
      )}

      {/* ── Reopen banner (when finished) ─────────────────────────── */}
      {isFinished && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)' }}
        >
          <p className="text-sm font-semibold text-emerald-700">
            Assessment {assessment.status === 'completed' ? 'completed' : assessment.status} ✓
          </p>
          <form action={updateStatusAction}>
            <input type="hidden" name="status" value="in_review" />
            <SubmitButton
              label="Reopen Assessment"
              pendingLabel="Reopening…"
              className="px-5 py-2 rounded-full text-xs font-medium transition-all"
              style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)' }}
            />
          </form>
        </div>
      )}

      {/* ── Full Assessment Overview (expandable sections) ─────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(109,93,211,0.15)' }}
      >
        <div
          className="px-5 py-3"
          style={{ background: 'rgba(109,93,211,0.05)', borderBottom: '1px solid rgba(109,93,211,0.1)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Full Assessment Overview
          </p>
        </div>

        {/* ── Assessment Metadata ──────────────────────────────────── */}
        <CollapsibleSection title="Assessment Details" defaultOpen>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            <MetaField label="Title" value={assessment.title ?? 'Untitled'} />
            <MetaField label="Vendor" value={assessment.vendor?.name ?? '—'} />
            <MetaField label="Status" value={assessment.status.replace(/_/g, ' ')} />
            <MetaField label="Period" value={assessment.period_type ?? '—'} />
            {assessment.period_start && <MetaField label="Start" value={new Date(assessment.period_start).toLocaleDateString()} />}
            {assessment.period_end && <MetaField label="End" value={new Date(assessment.period_end).toLocaleDateString()} />}
            <MetaField label="Risk Level" value={assessment.risk_level ?? '—'} />
            <MetaField label="Overall Score" value={assessment.overall_score !== null && assessment.overall_score !== undefined ? `${assessment.overall_score}%` : '—'} />
            <MetaField label="Frameworks" value={assessment.frameworks?.map(f => f.name).join(', ') || '—'} />
          </div>
        </CollapsibleSection>

        {/* ── Items by Framework → Domain ──────────────────────────── */}
        <CollapsibleSection title={`Review Items (${items.length})`} defaultOpen>
          {orderedFwIds.length === 0 ? (
            <p className="text-xs" style={{ color: '#a99fd8' }}>No items in this assessment.</p>
          ) : (
            <div className="space-y-4">
              {orderedFwIds.map(fwId => {
                const fw = fwId ? frameworkById.get(fwId) : null
                const domains = byFramework.get(fwId)!
                return (
                  <div key={fwId ?? 'none'}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#6c5dd3' }}>
                      {fw?.name ?? 'Other Items'}
                    </p>
                    {Array.from(domains.entries()).map(([domain, domainItems]) => (
                      <div key={domain} className="mb-3">
                        <p className="text-[11px] font-medium mb-1.5 pl-2" style={{ color: '#8b7fd4', borderLeft: '2px solid rgba(109,93,211,0.2)' }}>
                          {domain || 'General'}
                        </p>
                        <div className="space-y-1">
                          {domainItems.map(item => {
                            const docStatus = item.expected_document_type_id
                              ? vendorDocStatus.get(item.expected_document_type_id)
                              : null
                            const refs = (item.mapped_standard_refs ?? []).filter(r => orgStandardIds.has(r.standard_id))
                            return (
                              <div
                                key={item.id}
                                className="flex items-stretch gap-0 rounded-lg overflow-hidden hover:bg-[rgba(109,93,211,0.03)]"
                                style={{ border: `1px solid ${itemSignalBorder(item.status)}25` }}
                              >
                                {/* Left status stripe */}
                                <span
                                  className="w-1 shrink-0 rounded-l"
                                  style={{ background: STATUS_COLOR[item.status] }}
                                />
                                <div className="flex-1 min-w-0 py-1.5 px-2.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{item.title}</span>
                                    {(item.status === 'satisfactory' || item.status === 'mitigated') ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
                                        style={{ color: '#fff', background: '#059669' }}
                                      >
                                        ✓ Pass
                                      </span>
                                    ) : (item.status === 'high_risk' || item.status === 'needs_attention') ? (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
                                        style={{ color: '#fff', background: '#e11d48' }}
                                      >
                                        ✗ Fail
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                        style={{ background: `${STATUS_COLOR[item.status]}15`, color: STATUS_COLOR[item.status], border: `1px solid ${STATUS_COLOR[item.status]}30` }}
                                      >
                                        {STATUS_LABEL[item.status]}
                                      </span>
                                    )}
                                    {item.required && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">Required</span>
                                    )}
                                    {item.score !== null && (
                                      <span className="text-[10px] font-semibold" style={{ color: '#6c5dd3' }}>Score: {item.score}</span>
                                    )}
                                  </div>
                                  {item.rationale && (
                                    <p className="text-[11px] mt-0.5" style={{ color: '#6b5fa8' }}>{item.rationale}</p>
                                  )}
                                  {docStatus && (
                                    <span
                                      className="inline-flex text-[10px] mt-0.5 px-1.5 py-0.5 rounded font-medium"
                                      style={{
                                        background: docStatus.status === 'uploaded' ? 'rgba(5,150,105,0.08)' : docStatus.status === 'expired' ? 'rgba(225,29,72,0.08)' : 'rgba(169,159,216,0.1)',
                                        color: docStatus.status === 'uploaded' ? '#059669' : docStatus.status === 'expired' ? '#e11d48' : '#a99fd8',
                                      }}
                                    >
                                      Doc: {docStatus.status === 'uploaded' ? 'Uploaded' : docStatus.status === 'expired' ? 'Expired' : 'Missing'}
                                    </span>
                                  )}
                                  {refs.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                      {refs.map(r => (
                                        <span
                                          key={`${r.standard_id}-${r.ref}`}
                                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                          style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                                        >
                                          {r.standard_name} › {r.ref}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Findings with mitigations ────────────────────────────── */}
        <CollapsibleSection title={`Findings (${findings.length})`} defaultOpen={findings.length > 0}>
          {findings.length === 0 ? (
            <p className="text-xs" style={{ color: '#a99fd8' }}>No findings recorded.</p>
          ) : (
            <div className="space-y-3">
              {findings.map(f => (
                <div key={f.id} className="rounded-lg p-3" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.08)' }}>
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${SEVERITY_CLS[f.severity] ?? 'bg-[rgba(169,159,216,0.12)] text-[#a99fd8]'}`}>
                      {f.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{f.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${FINDING_STATUS_CLS[f.status] ?? ''}`}>
                          {f.status}
                        </span>
                        {f.risk_domain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.06)', color: '#8b7fd4' }}>
                            {f.risk_domain}
                          </span>
                        )}
                      </div>
                      {f.description && (
                        <p className="text-[11px] mt-1" style={{ color: '#6b5fa8' }}>{f.description}</p>
                      )}
                      {/* Compliance mapping for finding's linked item */}
                      {f.assessment_item_id && (() => {
                        const linkedItem = items.find(i => i.id === f.assessment_item_id)
                        const refs = (linkedItem?.mapped_standard_refs ?? []).filter(r => orgStandardIds.has(r.standard_id))
                        if (refs.length === 0) return null
                        return (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            <span className="text-[10px]" style={{ color: '#a99fd8' }}>Compliance:</span>
                            {refs.map(r => (
                              <span
                                key={`${r.standard_id}-${r.ref}`}
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                              >
                                {r.standard_name} › {r.ref}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                      {/* Mitigations */}
                      {f.mitigations && f.mitigations.length > 0 && (
                        <div className="mt-2 pl-3" style={{ borderLeft: '2px solid rgba(5,150,105,0.2)' }}>
                          <p className="text-[10px] font-semibold mb-1" style={{ color: '#059669' }}>Mitigations</p>
                          {f.mitigations.map(m => (
                            <div key={m.id} className="mb-1.5">
                              <p className="text-[11px] font-medium" style={{ color: '#1e1550' }}>{m.action}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px]" style={{ color: '#a99fd8' }}>
                                  Status: {m.status}
                                </span>
                                {m.due_at && (
                                  <span className="text-[10px]" style={{ color: '#a99fd8' }}>
                                    Due: {new Date(m.due_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {m.notes && <p className="text-[10px] mt-0.5" style={{ color: '#6b5fa8' }}>{m.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Document Evidence ─────────────────────────────────────── */}
        <CollapsibleSection title={`Document Evidence (${docCheckItems.length})`} defaultOpen={docCheckItems.length > 0}>
          {docCheckItems.length === 0 ? (
            <p className="text-xs" style={{ color: '#a99fd8' }}>No document evidence items.</p>
          ) : (
            <div className="space-y-1.5">
              {docCheckItems.map(item => {
                const ds = vendorDocStatus.get(item.expected_document_type_id!)
                const statusLabel = ds?.status === 'uploaded' ? 'Uploaded' : ds?.status === 'expired' ? 'Expired' : 'Missing'
                const statusColor = ds?.status === 'uploaded' ? '#059669' : ds?.status === 'expired' ? '#e11d48' : '#a99fd8'
                return (
                  <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[rgba(109,93,211,0.03)]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: statusColor }}
                      />
                      <span className="text-xs" style={{ color: '#1e1550' }}>{item.title}</span>
                      {item.required && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-rose-50 text-rose-600 font-medium">Req</span>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${statusColor}12`, color: statusColor }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CollapsibleSection>
      </div>

    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid rgba(109,93,211,0.08)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[rgba(109,93,211,0.03)]"
      >
        <span className="text-xs font-semibold" style={{ color: '#3d2e8a' }}>{title}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="#a99fd8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5.5l4 4 4-4" />
        </svg>
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#c4bae8' }}>{label}</p>
      <p className="text-sm capitalize" style={{ color: '#3d2e8a' }}>{value}</p>
    </div>
  )
}
