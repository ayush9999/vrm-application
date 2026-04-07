'use client'

import React, { useState, useActionState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type {
  VendorAssessment,
  AssessmentFramework,
  AssessmentItem,
  AssessmentFinding,
  AssessmentReport,
  AssessmentFormState,
  AssessmentItemStatus,
} from '@/types/assessment'
import type { VendorDocStatus } from '@/lib/db/documents'
import type { FindingIssueLink } from '@/lib/db/issues'
import type { Issue } from '@/types/issue'
import type { OrgUser } from '@/lib/db/organizations'
import Link from 'next/link'
import { Spinner } from '@/app/_components/Spinner'
import { FinaliseStep } from './FinaliseStep'
import { ExportReportStep } from './ExportReportStep'
import { AssessmentIssuesModal } from './AssessmentIssuesModal'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'items',    label: 'Review Items' },
  { id: 'findings', label: 'Findings' },
  { id: 'finalise', label: 'Finalise' },
] as const

type StepId = typeof STEPS[number]['id']

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkflowProps {
  assessment: VendorAssessment
  items: AssessmentItem[]
  findings: AssessmentFinding[]
  reports: AssessmentReport[]
  currentStep: string
  vendorDocStatus: Map<string, VendorDocStatus>
  orgStandardIds: Set<string>
  frameworks: AssessmentFramework[]
  updateStatusAction: (formData: FormData) => Promise<void>
  saveSummaryAction: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  updateItemAction: (itemId: string, prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  createFindingAction: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  updateFindingStatusAction: (vendorId: string, formData: FormData) => Promise<void>
  createMitigationAction: (prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  findingIssueLinks?: FindingIssueLink[]
  assessmentIssues?: Issue[]
  orgUsers?: OrgUser[]
}

// ─── Root component ───────────────────────────────────────────────────────────

export function AssessmentWorkflow(props: WorkflowProps) {
  const [activeStep, setActiveStep] = useState<StepId>(
    (STEPS.find(s => s.id === props.currentStep)?.id) ?? 'items'
  )
  const [showIssuesModal, setShowIssuesModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const stepIndex = STEPS.findIndex(s => s.id === activeStep)
  const isFinished = ['submitted', 'completed', 'archived'].includes(props.assessment.status)
  const isFinalised = isFinished || props.assessment.status === 'submitted' || props.assessment.status === 'completed'
  const issueCount = props.assessmentIssues?.length ?? 0

  return (
    <div className="space-y-4">
      {/* Step nav + action buttons */}
      <div
        className="bg-white rounded-2xl p-4"
        style={{ boxShadow: '0 2px 8px rgba(109,93,211,0.07)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {STEPS.map((step, i) => {
            const isDone = i < stepIndex
            const isActive = step.id === activeStep
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setActiveStep(step.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                  style={
                    isActive
                      ? { background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }
                      : isDone
                      ? { color: '#059669' }
                      : { color: '#a99fd8' }
                  }
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: isActive ? '#6c5dd3' : isDone ? '#059669' : 'rgba(109,93,211,0.12)',
                      color: isActive || isDone ? '#fff' : '#a99fd8',
                    }}
                  >
                    {isDone ? '✓' : i + 1}
                  </span>
                  {step.label}
                </button>
                {i < STEPS.length - 1 && (
                  <span className="text-xs mx-0.5" style={{ color: 'rgba(109,93,211,0.2)' }}>→</span>
                )}
              </React.Fragment>
            )
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons — always visible, disabled until finalised */}
          <button
            onClick={() => setShowIssuesModal(true)}
            disabled={!isFinalised}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            style={isFinalised
              ? { background: 'rgba(225,29,72,0.06)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }
              : { background: 'rgba(109,93,211,0.04)', color: '#a99fd8', border: '1px solid rgba(109,93,211,0.1)' }
            }
            title={isFinalised ? 'Create & manage issues' : 'Finalise assessment first to create issues'}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="7" />
              <path d="M8 5v3" />
              <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
            </svg>
            Issues{issueCount > 0 ? ` (${issueCount})` : ''}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={!isFinalised}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            style={isFinalised
              ? { background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }
              : { background: 'rgba(109,93,211,0.04)', color: '#a99fd8', border: '1px solid rgba(109,93,211,0.1)' }
            }
            title={isFinalised ? 'Export assessment report' : 'Finalise assessment first to export report'}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h8a1 1 0 001-1V5.5L9.5 2H4a1 1 0 00-1 1v10a1 1 0 001 1z" />
              <path d="M9 2v4h4" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      {/* Read-only banner */}
      {isFinished && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" />
            <path d="M5 6V4a3 3 0 0 1 6 0v2" />
          </svg>
          This assessment has been {props.assessment.status === 'submitted' ? 'submitted' : props.assessment.status === 'archived' ? 'archived' : 'completed'} and is read-only. Reopen it from the Finalise tab to make changes.
        </div>
      )}

      {/* Step content */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {activeStep === 'items' && (
          <ItemsStep
            assessment={props.assessment}
            items={props.items}
            frameworks={props.frameworks}
            vendorDocStatus={props.vendorDocStatus}
            orgStandardIds={props.orgStandardIds}
            updateItemAction={props.updateItemAction}
            updateStatusAction={props.updateStatusAction}
            onNext={() => setActiveStep('findings')}
            isFinished={isFinished}
          />
        )}
        {activeStep === 'findings' && (
          <FindingsStep
            findings={props.findings}
            vendorId={props.assessment.vendor?.id ?? null}
            assessmentId={props.assessment.id}
            createFindingAction={props.createFindingAction}
            createMitigationAction={props.createMitigationAction}
            onNext={() => setActiveStep('finalise')}
            isFinished={isFinished}
            findingIssueLinks={props.findingIssueLinks ?? []}
          />
        )}
        {activeStep === 'finalise' && (
          <FinaliseStep
            assessment={props.assessment}
            items={props.items}
            findings={props.findings}
            frameworks={props.frameworks}
            vendorDocStatus={props.vendorDocStatus}
            orgStandardIds={props.orgStandardIds}
            saveSummaryAction={props.saveSummaryAction}
            updateStatusAction={props.updateStatusAction}
            isFinished={isFinished}
          />
        )}
      </div>

      {/* Issues modal */}
      {showIssuesModal && (
        <AssessmentIssuesModal
          assessment={props.assessment}
          items={props.items}
          findings={props.findings}
          frameworks={props.frameworks}
          issues={props.assessmentIssues ?? []}
          orgUsers={props.orgUsers ?? []}
          findingIssueLinks={props.findingIssueLinks ?? []}
          onClose={() => setShowIssuesModal(false)}
        />
      )}

      {/* Export report modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(30,21,80,0.5)' }}>
          <div
            className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative"
            style={{ boxShadow: '0 25px 50px rgba(109,93,211,0.25)' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#1e1550' }}>Export Report</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: '#a99fd8' }}
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <ExportReportStep
                assessment={props.assessment}
                items={props.items}
                findings={props.findings}
                reports={props.reports}
                frameworks={props.frameworks}
                vendorDocStatus={props.vendorDocStatus}
                orgStandardIds={props.orgStandardIds}
                isFinished={isFinished}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step: Review Items ───────────────────────────────────────────────────────

const ITEM_STATUS_OPTIONS: { value: AssessmentItemStatus; label: string; color: string }[] = [
  { value: 'not_started',    label: 'Not Started',    color: '#a99fd8' },
  { value: 'in_progress',    label: 'In Progress',    color: '#6c5dd3' },
  { value: 'satisfactory',   label: 'Satisfactory',   color: '#059669' },
  { value: 'needs_attention',label: 'Needs Attention', color: '#d97706' },
  { value: 'high_risk',      label: 'High Risk',      color: '#e11d48' },
  { value: 'mitigated',      label: 'Mitigated',      color: '#0ea5e9' },
  { value: 'not_applicable', label: 'N/A',             color: '#94a3b8' },
]

// Pass / fail / neutral classification for visual treatment
function statusSignal(status: AssessmentItemStatus): 'pass' | 'fail' | 'neutral' {
  if (status === 'satisfactory' || status === 'mitigated') return 'pass'
  if (status === 'high_risk' || status === 'needs_attention') return 'fail'
  return 'neutral'
}

const SIGNAL_STYLES = {
  pass:    { border: '#059669', bg: 'rgba(5,150,105,0.04)' },
  fail:    { border: '#e11d48', bg: 'rgba(225,29,72,0.03)' },
  neutral: { border: 'rgba(109,93,211,0.15)', bg: 'rgba(109,93,211,0.01)' },
} as const

// Bulk-set all items in a group to a chosen status
function BulkStatusDropdown({
  items,
  updateItemAction,
  label = 'Mark all as ▾',
}: {
  items: AssessmentItem[]
  updateItemAction: (itemId: string, prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  label?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleBulk(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const status = e.target.value
    if (!status) return
    setPending(true)
    try {
      await Promise.all(
        items
          .filter(i => i.status !== status)
          .map(i => {
            const fd = new FormData()
            fd.set('status', status)
            fd.set('score', i.score?.toString() ?? '')
            fd.set('rationale', i.rationale ?? '')
            fd.set('reviewer_notes', i.reviewer_notes ?? '')
            return updateItemAction(i.id, {}, fd)
          })
      )
      router.refresh()
    } finally {
      setPending(false)
    }
    // reset dropdown
    e.target.value = ''
  }

  return (
    <select
      value=""
      onChange={handleBulk}
      onClick={(e) => e.stopPropagation()}
      disabled={pending}
      className="text-[11px] font-medium rounded-lg px-2 py-1 focus:outline-none cursor-pointer disabled:opacity-50 ml-auto"
      style={{ border: '1px solid rgba(109,93,211,0.25)', color: '#6b5fa8', background: 'rgba(109,93,211,0.06)', minWidth: '100px' }}
      title="Set all items in this group to a status"
    >
      <option value="">{pending ? 'Applying…' : label}</option>
      {ITEM_STATUS_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function ItemsStep({
  assessment,
  items,
  frameworks,
  vendorDocStatus,
  orgStandardIds,
  updateItemAction,
  updateStatusAction,
  onNext,
  isFinished = false,
}: {
  assessment: VendorAssessment
  items: AssessmentItem[]
  frameworks: AssessmentFramework[]
  vendorDocStatus: Map<string, VendorDocStatus>
  orgStandardIds: Set<string>
  updateItemAction: (itemId: string, prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  updateStatusAction: WorkflowProps['updateStatusAction']
  onNext: () => void
  isFinished?: boolean
}) {
  // Build framework lookup and group items: framework_id → domain → items
  const frameworkById = new Map(frameworks.map(f => [f.id, f]))

  // Group: framework_id → category → items
  const byFramework = new Map<string | null, Map<string, AssessmentItem[]>>()
  for (const item of items) {
    const fwId = item.framework_id ?? null
    if (!byFramework.has(fwId)) byFramework.set(fwId, new Map())
    const byDomain = byFramework.get(fwId)!
    const domain = item.category ?? ''
    if (!byDomain.has(domain)) byDomain.set(domain, [])
    byDomain.get(domain)!.push(item)
  }

  // Order: known frameworks first (in frameworks array order), then null/unknown
  const orderedFwIds = [
    ...frameworks.map(f => f.id).filter(id => byFramework.has(id)),
    ...(byFramework.has(null) ? [null] : []),
  ] as (string | null)[]

  const isDraft = assessment.status === 'draft'

  // Gap summary stats for framework items with doc checks
  const docCheckItems = items.filter(i => i.expected_document_type_id)
  const uploadedCount = docCheckItems.filter(i => {
    const s = vendorDocStatus.get(i.expected_document_type_id!)?.status
    return s === 'uploaded' || s === 'expired'
  }).length
  const missingRequired = docCheckItems.filter(i => {
    const s = vendorDocStatus.get(i.expected_document_type_id!)?.status
    return i.required && (!s || s === 'missing')
  }).length
  const missingOptional = docCheckItems.filter(i => {
    const s = vendorDocStatus.get(i.expected_document_type_id!)?.status
    return !i.required && (!s || s === 'missing')
  }).length

  return (
    <ItemsStepInner
      assessment={assessment}
      items={items}
      frameworkById={frameworkById}
      byFramework={byFramework}
      orderedFwIds={orderedFwIds}
      docCheckItems={docCheckItems}
      uploadedCount={uploadedCount}
      missingRequired={missingRequired}
      missingOptional={missingOptional}
      isDraft={isDraft}
      vendorDocStatus={vendorDocStatus}
      orgStandardIds={orgStandardIds}
      updateItemAction={updateItemAction}
      updateStatusAction={updateStatusAction}
      onNext={onNext}
      isFinished={isFinished}
    />
  )
}

type FilterMode = 'all' | 'mandatory' | 'optional' | 'missing' | 'flagged'

function ItemsStepInner({
  assessment,
  items,
  frameworkById,
  byFramework,
  orderedFwIds,
  docCheckItems,
  uploadedCount,
  missingRequired,
  missingOptional,
  isDraft,
  vendorDocStatus,
  orgStandardIds,
  updateItemAction,
  updateStatusAction,
  onNext,
  isFinished = false,
}: {
  assessment: VendorAssessment
  items: AssessmentItem[]
  frameworkById: Map<string, AssessmentFramework>
  byFramework: Map<string | null, Map<string, AssessmentItem[]>>
  orderedFwIds: (string | null)[]
  docCheckItems: AssessmentItem[]
  uploadedCount: number
  missingRequired: number
  missingOptional: number
  isDraft: boolean
  vendorDocStatus: Map<string, VendorDocStatus>
  orgStandardIds: Set<string>
  updateItemAction: (itemId: string, prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  updateStatusAction: WorkflowProps['updateStatusAction']
  onNext: () => void
  isFinished?: boolean
}) {
  const [filter, setFilter] = useState<FilterMode>('all')

  // All framework and domain keys (for expand/collapse all)
  const allFwKeys = orderedFwIds.map(id => id ?? '__unknown__')
  const allDomainKeys = orderedFwIds.flatMap(fwId => {
    const fwKey = fwId ?? '__unknown__'
    return [...(byFramework.get(fwId)?.keys() ?? [])].map(d => `${fwKey}::${d}`)
  })

  // Collapsed state — default: all collapsed
  const [collapsedFw, setCollapsedFw] = useState<Set<string>>(() => new Set(allFwKeys))
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(() => new Set(allDomainKeys))

  const allExpanded = collapsedFw.size === 0

  function toggleFw(key: string) {
    setCollapsedFw(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleDomain(key: string) {
    setCollapsedDomains(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function expandAll() { setCollapsedFw(new Set()); setCollapsedDomains(new Set()) }
  function collapseAll() { setCollapsedFw(new Set(allFwKeys)); setCollapsedDomains(new Set(allDomainKeys)) }

  // Framework-level and domain-level notes (local state — persistence coming later)
  const [fwNotes, setFwNotes] = useState<Record<string, string>>({})
  const [domainNotes, setDomainNotes] = useState<Record<string, string>>({})

  // Apply filter to items
  function matchesFilter(item: AssessmentItem): boolean {
    if (filter === 'all') return true
    if (filter === 'mandatory') return item.required
    if (filter === 'optional') return !item.required
    if (filter === 'missing') {
      const s = item.expected_document_type_id ? vendorDocStatus.get(item.expected_document_type_id)?.status : undefined
      return item.required && (!s || s === 'missing')
    }
    if (filter === 'flagged') return item.status === 'needs_attention' || item.status === 'high_risk'
    return true
  }

  const FILTERS: { key: FilterMode; label: string; hint: string }[] = [
    { key: 'all',       label: `All Controls (${items.length})`,                                                                         hint: 'All controls across all frameworks' },
    { key: 'mandatory', label: `Required (${items.filter(i => i.required).length})`,                                                     hint: 'Controls that must be reviewed' },
    { key: 'optional',  label: `Optional (${items.filter(i => !i.required).length})`,                                                    hint: 'Controls that are recommended but not required' },
    { key: 'missing',   label: `Missing Evidence (${missingRequired})`,                                                                  hint: 'Required controls whose supporting document has not been uploaded' },
    { key: 'flagged',   label: `Flagged (${items.filter(i => i.status === 'needs_attention' || i.status === 'high_risk').length})`,       hint: 'Controls marked as Needs Attention or High Risk' },
  ]

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Review Items</h2>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            Evaluate each control from the assigned frameworks. Mark status, add rationale, and flag risks.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && (
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
          <button
            onClick={onNext}
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Next: Findings →
          </button>
        </div>
      </div>

      {/* Filter bar + bulk set all */}
      {items.length > 0 && (
        <div
          className="flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-xl"
          style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.08)' }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{ color: '#a99fd8' }}>Filter</span>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.hint}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={filter === f.key
                ? { background: '#6c5dd3', color: '#fff' }
                : { background: 'white', color: '#6b5fa8', border: '1px solid rgba(109,93,211,0.15)' }
              }
            >
              {f.label}
            </button>
          ))}
          {/* Bulk set all visible controls */}
          {!isFinished && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-medium" style={{ color: '#6b5fa8' }}>
                {items.filter(matchesFilter).length} visible
              </span>
              <BulkStatusDropdown
                items={items.filter(matchesFilter)}
                updateItemAction={updateItemAction}
                label="Mark all as ▾"
              />
            </div>
          )}
        </div>
      )}

      {/* Gap summary bar */}
      {docCheckItems.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-5 flex-wrap"
          style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.1)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }} title="Controls that require a supporting document — shows how many have evidence uploaded vs missing">Evidence Gap</span>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#059669' }} title="Controls whose required document has been uploaded">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{uploadedCount} Evidenced
            </span>
            {missingRequired > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#e11d48' }} title="Required controls with no supporting document uploaded">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />{missingRequired} Required Missing
              </span>
            )}
            {missingOptional > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94a3b8' }} title="Optional controls with no supporting document uploaded">
                <span className="w-2 h-2 rounded-full bg-[#a99fd8] inline-block" />{missingOptional} Optional Missing
              </span>
            )}
            {missingRequired === 0 && docCheckItems.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#059669' }}>✓ All required evidence provided</span>
            )}
          </div>
        </div>
      )}

      {/* Vendor documents on file */}
      <VendorDocsOnFile vendorDocStatus={vendorDocStatus} />

      {items.length === 0 ? (
        <div
          className="text-center py-12 rounded-xl"
          style={{ border: '1.5px dashed rgba(109,93,211,0.2)', background: 'rgba(109,93,211,0.02)' }}
        >
          <p className="text-sm" style={{ color: '#a99fd8' }}>No framework items. This assessment was created without a framework.</p>
          <p className="text-xs mt-1" style={{ color: '#c4bae8' }}>You can proceed directly to Findings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orderedFwIds.map((fwId) => {
            const fw = fwId ? frameworkById.get(fwId) : undefined
            const byDomain = byFramework.get(fwId)!
            const orderedDomains = [...byDomain.keys()].sort()
            const fwKey = fwId ?? '__unknown__'
            const fwCollapsed = collapsedFw.has(fwKey)

            // Count visible items in this framework after filter
            const fwVisibleCount = orderedDomains.reduce((acc, d) =>
              acc + (byDomain.get(d) ?? []).filter(matchesFilter).length, 0
            )
            if (fwVisibleCount === 0 && filter !== 'all') return null

            return (
              <div
                key={fwKey}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(109,93,211,0.12)', background: 'white' }}
              >
                {/* Framework header — clickable to collapse */}
                <button
                  type="button"
                  onClick={() => toggleFw(fwKey)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors hover:bg-violet-50/50"
                  style={{ background: 'rgba(109,93,211,0.04)', borderBottom: fwCollapsed ? 'none' : '1px solid rgba(109,93,211,0.1)' }}
                >
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#a99fd8" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0 transition-transform"
                    style={{ transform: fwCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Framework</span>
                  <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{fw?.name ?? 'Unknown Framework'}</span>
                  {fw?.framework_type && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}>
                      {fw.framework_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.06)', color: '#a99fd8' }}>
                    {fwVisibleCount} item{fwVisibleCount !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Domains — hidden when framework collapsed */}
                {!fwCollapsed && (
                  <div>
                    {/* Framework-level summary */}
                    <div className="px-4 py-2.5" style={{ background: 'rgba(109,93,211,0.02)', borderBottom: '1px solid rgba(109,93,211,0.08)' }}>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>
                        Framework Summary
                      </label>
                      <textarea
                        rows={2}
                        value={fwNotes[fwKey] ?? ''}
                        onChange={e => setFwNotes(prev => ({ ...prev, [fwKey]: e.target.value }))}
                        placeholder={`Overall notes for ${fw?.name ?? 'this framework'}…`}
                        disabled={isFinished}
                        className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-none disabled:opacity-60"
                        style={{ border: '1px solid rgba(109,93,211,0.15)', color: '#1e1550', background: 'white' }}
                      />
                    </div>

                    {orderedDomains.map((domain, di) => {
                      const domainItems = (byDomain.get(domain) ?? []).filter(matchesFilter)
                      if (domainItems.length === 0) return null
                      const domainKey = `${fwKey}::${domain}`
                      const domainCollapsed = collapsedDomains.has(domainKey)

                      return (
                        <div
                          key={domain}
                          style={{ borderTop: di > 0 ? '1px solid rgba(109,93,211,0.12)' : undefined }}
                        >
                          {/* Domain header — clickable to collapse */}
                          <div className="flex items-center px-4 py-2 transition-colors hover:bg-violet-50/30">
                            <button
                              type="button"
                              onClick={() => toggleDomain(domainKey)}
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                            >
                              <svg
                                width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#8b7fd4" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round"
                                className="shrink-0 transition-transform"
                                style={{ transform: domainCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                              >
                                <path d="M2 4l4 4 4-4" />
                              </svg>
                              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a4270' }}>
                                {domain || 'General'}
                              </span>
                              <span className="text-[11px] font-medium ml-1" style={{ color: '#8b7fd4' }}>
                                {domainItems.length}
                              </span>
                            </button>
                            {!isFinished && (
                              <BulkStatusDropdown
                                items={domainItems}
                                updateItemAction={updateItemAction}
                              />
                            )}
                          </div>

                          {/* Domain notes + Items */}
                          {!domainCollapsed && (
                            <div className="px-4 pb-3 space-y-2">
                              {/* Domain-level notes */}
                              <div className="pt-1">
                                <textarea
                                  rows={1}
                                  value={domainNotes[domainKey] ?? ''}
                                  onChange={e => setDomainNotes(prev => ({ ...prev, [domainKey]: e.target.value }))}
                                  placeholder={`Notes for ${domain || 'General'}…`}
                                  disabled={isFinished}
                                  className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none resize-none disabled:opacity-60"
                                  style={{ border: '1px solid rgba(109,93,211,0.12)', color: '#1e1550', background: 'rgba(109,93,211,0.02)' }}
                                  onFocus={e => { if (e.target.rows < 3) e.target.rows = 3 }}
                                  onBlur={e => { if (!e.target.value) e.target.rows = 1 }}
                                />
                              </div>
                              {domainItems.map((item) => {
                                const docStatus = item.expected_document_type_id
                                  ? vendorDocStatus.get(item.expected_document_type_id) ?? null
                                  : null
                                const isMissingRequired = !!(item.required && item.expected_document_type_id &&
                                  (!docStatus || docStatus.status === 'missing'))
                                return (
                                  <ItemRow
                                    key={item.id}
                                    item={item}
                                    docStatus={docStatus}
                                    highlight={isMissingRequired}
                                    vendorId={assessment.vendor?.id ?? null}
                                    orgStandardIds={orgStandardIds}
                                    updateItemAction={updateItemAction}
                                    isFinished={isFinished}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isDraft && (
        <form action={updateStatusAction}>
          <input type="hidden" name="status" value="in_review" />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
          >
            Mark as In Review
          </button>
        </form>
      )}
    </div>
  )
}

function VendorDocsOnFile({ vendorDocStatus }: { vendorDocStatus: Map<string, VendorDocStatus> }) {
  const [expanded, setExpanded] = useState(false)
  const docs = Array.from(vendorDocStatus.values())

  if (docs.length === 0) return null

  const uploaded = docs.filter(d => d.status === 'uploaded').length
  const pending  = docs.filter(d => d.status === 'pending').length
  const expired  = docs.filter(d => d.status === 'expired').length
  const missing  = docs.filter(d => d.status === 'missing').length

  const sorted = [...docs].sort((a, b) => {
    const order = { uploaded: 0, pending: 1, expired: 2, missing: 3 }
    return order[a.status] - order[b.status]
  })

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(109,93,211,0.12)', background: 'white' }}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[rgba(109,93,211,0.03)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: '#1e1550' }}>Vendor Documents Uploaded</span>
          <div className="flex items-center gap-2">
            {uploaded > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                {uploaded} uploaded
              </span>
            )}
            {pending > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.08)', color: '#0ea5e9' }}>
                {pending} pending
              </span>
            )}
            {expired > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                {expired} expired
              </span>
            )}
            {missing > 0 && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8' }}>
                {missing} missing
              </span>
            )}
          </div>
        </div>
        <span className="text-xs" style={{ color: '#c4bae8' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: 'rgba(109,93,211,0.08)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'rgba(109,93,211,0.03)' }}>
                <th className="px-4 py-2 text-left font-semibold text-[11px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>Document</th>
                <th className="px-4 py-2 text-left font-semibold text-[11px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>Status</th>
                <th className="px-4 py-2 text-left font-semibold text-[11px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>File</th>
                <th className="px-4 py-2 text-left font-semibold text-[11px] uppercase tracking-wider" style={{ color: '#a99fd8' }}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((doc) => (
                <tr key={doc.vendor_doc_id} className="border-t hover:bg-[rgba(109,93,211,0.03)] transition-colors" style={{ borderColor: 'rgba(109,93,211,0.06)' }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: '#1e1550' }}>{doc.doc_type_name}</td>
                  <td className="px-4 py-2.5">
                    {doc.status === 'uploaded' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#059669' }}>✓ Uploaded</span>
                    )}
                    {doc.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#0ea5e9' }}>⏳ Pending</span>
                    )}
                    {doc.status === 'expired' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#d97706' }}>⚠ Expired</span>
                    )}
                    {doc.status === 'missing' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#94a3b8' }}>— Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: '#6b5fa8' }}>
                    {doc.file_name ?? <span style={{ color: '#c4bae8' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: '#a99fd8' }}>
                    {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : <span style={{ color: '#c4bae8' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DocStatusBadge({ docStatus, required }: { docStatus: VendorDocStatus | null; required: boolean }) {
  if (!docStatus) {
    // Document not uploaded at all
    return required ? (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}
        title="Document not uploaded"
      >
        ✗ Not uploaded
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}
        title="Optional document not uploaded"
      >
        ○ Optional
      </span>
    )
  }
  if (docStatus.status === 'uploaded') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}
        title={`${docStatus.doc_type_name} → ${docStatus.file_name ?? 'Uploaded'}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        {docStatus.doc_type_name}
      </span>
    )
  }
  if (docStatus.status === 'expired') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}
        title={`Expired${docStatus.expiry_date ? ': ' + new Date(docStatus.expiry_date).toLocaleDateString() : ''}`}
      >
        ⚠ Expired
      </span>
    )
  }
  if (docStatus.status === 'pending') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{ background: 'rgba(14,165,233,0.08)', color: '#0ea5e9' }}
      >
        ⏳ Pending
      </span>
    )
  }
  return null
}

function ItemRow({
  item,
  docStatus,
  highlight,
  vendorId,
  orgStandardIds,
  updateItemAction,
  isFinished = false,
}: {
  item: AssessmentItem
  docStatus: VendorDocStatus | null
  highlight?: boolean
  vendorId?: string | null
  orgStandardIds: Set<string>
  updateItemAction: (itemId: string, prev: AssessmentFormState, formData: FormData) => Promise<AssessmentFormState>
  isFinished?: boolean
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const boundAction = useMemo(
    () => updateItemAction.bind(null, item.id),
    [updateItemAction, item.id],
  )
  const [state, formAction, isPending] = useActionState(boundAction, {})
  const [quickPending, setQuickPending] = useState(false)

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  const statusOpt = ITEM_STATUS_OPTIONS.find(o => o.value === item.status) ?? ITEM_STATUS_OPTIONS[0]

  // Inline quick status change — no expand needed
  function handleQuickStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const newStatus = e.target.value
    if (newStatus === item.status) return
    setQuickPending(true)
    const fd = new FormData()
    fd.set('status', newStatus)
    fd.set('score', item.score?.toString() ?? '')
    fd.set('rationale', item.rationale ?? '')
    fd.set('reviewer_notes', item.reviewer_notes ?? '')
    updateItemAction(item.id, {}, fd).then(() => {
      setQuickPending(false)
      router.refresh()
    })
  }

  const signal = statusSignal(item.status)
  const sig = SIGNAL_STYLES[signal]

  return (
    <div
      className="rounded-xl transition-all overflow-hidden"
      style={highlight
        ? { border: '1px solid rgba(225,29,72,0.25)', background: 'rgba(225,29,72,0.02)' }
        : { border: `1px solid ${sig.border}`, background: sig.bg }
      }
    >
      <div
        className="flex items-center gap-2 py-2.5 pr-3 cursor-pointer"
        style={{ paddingLeft: '0' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Left status stripe */}
        <span
          className="w-1 self-stretch rounded-l shrink-0"
          style={{ background: statusOpt.color }}
        />
        {/* Pass / Fail verdict */}
        {signal === 'pass' && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wide"
            style={{ color: '#fff', background: '#059669' }}
          >
            ✓ Pass
          </span>
        )}
        {signal === 'fail' && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wide"
            style={{ color: '#fff', background: '#e11d48' }}
          >
            ✗ Fail
          </span>
        )}
        {signal === 'neutral' && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
            style={{ color: statusOpt.color, background: `${statusOpt.color}15`, border: `1px solid ${statusOpt.color}30` }}
          >
            {statusOpt.label}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug" style={{ color: '#1e1550' }}>
            {item.title}
            {item.required && (
              <span className="ml-1 text-[9px] text-rose-500 font-semibold">REQ</span>
            )}
          </p>
        </div>
        {item.expected_document_type_id && (
          <DocStatusBadge docStatus={docStatus} required={item.required} />
        )}
        {/* Inline quick status dropdown */}
        {!isFinished ? (
          <select
            value={item.status}
            onChange={handleQuickStatus}
            onClick={(e) => e.stopPropagation()}
            disabled={quickPending}
            className="text-[11px] font-medium rounded-lg px-1.5 py-1 focus:outline-none cursor-pointer disabled:opacity-50"
            style={{ border: `1px solid ${statusOpt.color}30`, color: statusOpt.color, background: `${statusOpt.color}08`, minWidth: '100px' }}
            title="Quick status change"
          >
            {ITEM_STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: statusOpt.color, background: `${statusOpt.color}18` }}>
            {statusOpt.label}
          </span>
        )}
        <span className="text-[10px]" style={{ color: '#c4bae8' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <form action={formAction} className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'rgba(109,93,211,0.08)' }}>
          {state?.message && (
            <p className="text-xs text-rose-500 pt-2">{state.message}</p>
          )}

          {/* Full description (when expanded) */}
          {item.description && (
            <p className="text-xs leading-relaxed pt-3" style={{ color: '#6b5fa8' }}>{item.description}</p>
          )}

          {/* Compliance impact */}
          {(() => {
            const refs = item.mapped_standard_refs?.filter(r => orgStandardIds.has(r.standard_id))
            if (!refs?.length) return null
            return (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] font-medium" style={{ color: '#a99fd8' }}>Compliance Impact:</span>
                {refs.map(r => (
                  <span
                    key={`${r.standard_id}-${r.ref}`}
                    title={r.ref_name ?? undefined}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }}
                  >
                    <span style={{ color: '#a99fd8' }}>{r.standard_name}</span>
                    <span style={{ color: 'rgba(109,93,211,0.4)' }}>›</span>
                    <span className="font-semibold">{r.ref}</span>
                    {r.ref_name && (
                      <span style={{ color: '#8b7fd4' }}>{r.ref_name}</span>
                    )}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Document evidence mapping */}
          {item.item_type === 'document_check' && item.expected_document_type_id && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.12)' }}>
              {/* Card header */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: 'rgba(109,93,211,0.04)', borderBottom: '1px solid rgba(109,93,211,0.08)' }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L9 2z" />
                  <path d="M9 2v4h4" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                  Document Evidence
                </span>
              </div>

              {/* Mapping rows */}
              <div className="px-4 py-3 space-y-3 bg-white">
                {/* Row 1: Required doc type */}
                <div className="flex items-start gap-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider pt-0.5 w-16 shrink-0"
                    style={{ color: '#c4bae8' }}
                  >
                    Requires
                  </span>
                  <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                    {docStatus?.doc_type_name ?? 'Document required'}
                  </span>
                </div>

                {/* Connector */}
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-px" style={{ background: 'rgba(109,93,211,0.2)' }} />
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4h6M4 1l3 3-3 3" stroke="rgba(169,159,216,0.5)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[10px]" style={{ color: '#d4cef0' }}>mapped to</span>
                  </div>
                </div>

                {/* Row 2: Evidence on file */}
                <div className="flex items-start gap-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider pt-0.5 w-16 shrink-0"
                    style={{ color: '#c4bae8' }}
                  >
                    On file
                  </span>
                  <div className="flex-1 min-w-0">
                    {docStatus?.status === 'uploaded' ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium" style={{ color: '#1e1550' }}>
                          {docStatus.file_name ?? 'File uploaded'}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}
                          >
                            ✓ Uploaded
                          </span>
                          {(() => {
                            if (!docStatus.expiry_date) return (
                              <span className="text-[11px]" style={{ color: '#94a3b8' }}>No expiry date set</span>
                            )
                            const exp = new Date(docStatus.expiry_date)
                            const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
                            if (daysLeft < 0) return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                                Expired {exp.toLocaleDateString()}
                              </span>
                            )
                            if (daysLeft <= 30) return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706' }}>
                                Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} ({exp.toLocaleDateString()})
                              </span>
                            )
                            if (daysLeft <= 90) return (
                              <span className="text-[11px]" style={{ color: '#d97706' }}>
                                Expires {exp.toLocaleDateString()} ({daysLeft} days)
                              </span>
                            )
                            return (
                              <span className="text-[11px]" style={{ color: '#a99fd8' }}>
                                Expires {exp.toLocaleDateString()}
                              </span>
                            )
                          })()}
                        </div>
                        <p className="text-[11px]" style={{ color: '#c4bae8' }}>
                          Review the document content, then mark this item Satisfactory.
                        </p>
                      </div>
                    ) : docStatus?.status === 'expired' ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium" style={{ color: '#1e1550' }}>
                          {docStatus.file_name ?? 'Expired document'}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}
                        >
                          ⚠ Expired{docStatus.expiry_date ? ` · ${new Date(docStatus.expiry_date).toLocaleDateString()}` : ''}
                        </span>
                        <p className="text-[11px]" style={{ color: '#a99fd8' }}>Request a renewed document from the vendor.</p>
                      </div>
                    ) : docStatus?.status === 'pending' ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: 'rgba(14,165,233,0.08)', color: '#0ea5e9' }}
                      >
                        ⏳ Pending upload
                      </span>
                    ) : (
                      <div className="space-y-1.5">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(225,29,72,0.06)', color: '#e11d48' }}
                        >
                          ✗ Not yet uploaded
                        </span>
                        <p className="text-[11px]" style={{ color: '#a99fd8' }}>
                          Request from vendor, then upload in their profile — this will update automatically.
                        </p>
                        {vendorId && (
                          <a
                            href={`/vendors/${vendorId}?tab=documents`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium hover:opacity-80 transition-opacity"
                            style={{ color: '#6c5dd3' }}
                          >
                            Go to vendor documents →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Compact Status + Score row */}
          <div className="flex items-center gap-3 pt-3">
            <input type="hidden" name="reviewer_notes" value={item.reviewer_notes ?? ''} />
            <input type="hidden" name="rationale" value={item.rationale ?? ''} />
            <select
              name="status"
              defaultValue={item.status}
              disabled={isFinished}
              className="rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none disabled:opacity-60"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: isFinished ? '#f8f7fc' : 'white', minWidth: '120px' }}
            >
              {ITEM_STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              name="score"
              type="number"
              min="0"
              max="100"
              defaultValue={item.score ?? ''}
              placeholder="Score"
              disabled={isFinished}
              className="rounded-lg px-2 py-1.5 text-xs focus:outline-none disabled:opacity-60 w-20"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: isFinished ? '#f8f7fc' : 'white' }}
            />
            {!isFinished && (
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#6c5dd3' }}
              >
                {isPending && <Spinner />}
                {isPending ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Step: Findings ───────────────────────────────────────────────────────────

function FindingsStep({
  findings,
  vendorId,
  assessmentId,
  createFindingAction,
  createMitigationAction,
  onNext,
  isFinished = false,
  findingIssueLinks = [],
}: {
  findings: AssessmentFinding[]
  vendorId: string | null
  assessmentId: string
  createFindingAction: WorkflowProps['createFindingAction']
  createMitigationAction: WorkflowProps['createMitigationAction']
  onNext: () => void
  isFinished?: boolean
  findingIssueLinks?: FindingIssueLink[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [findingState, findingFormAction, isPending] = useActionState(createFindingAction, {})

  useEffect(() => {
    if (findingState.success) {
      setShowForm(false)
      router.refresh()
    }
  }, [findingState.success, router])

  const open = findings.filter(f => f.status === 'open')
  const closed = findings.filter(f => f.status !== 'open')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Findings</h2>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            Formal issues identified during this assessment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && (
            <button
              onClick={() => setShowForm(f => !f)}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
            >
              + Add Finding
            </button>
          )}
          <button
            onClick={onNext}
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Next: AI Review →
          </button>
        </div>
      </div>

      {showForm && (
        <form
          action={findingFormAction}
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.12)' }}
        >
          {findingState.message && (
            <p className="text-xs text-rose-500">{findingState.message}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: '#a99fd8' }}>Title *</label>
              <input
                name="title"
                type="text"
                required
                placeholder="Finding title"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#a99fd8' }}>Severity</label>
              <select
                name="severity"
                defaultValue="medium"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#a99fd8' }}>Risk Domain</label>
              <input
                name="risk_domain"
                type="text"
                placeholder="e.g. Data Privacy"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: '#a99fd8' }}>Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Describe the finding…"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
            >
              {isPending && <Spinner />}
              {isPending ? 'Saving…' : 'Save Finding'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs"
              style={{ color: '#a99fd8' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {findings.length === 0 ? (
        <div className="text-center py-8" style={{ color: '#c4bae8' }}>
          <p className="text-sm">No findings yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <FindingList
              label="Open Findings"
              findings={open}
              vendorId={vendorId}
              assessmentId={assessmentId}
              createMitigationAction={createMitigationAction}
              isFinished={isFinished}
              findingIssueLinks={findingIssueLinks}
            />
          )}
          {closed.length > 0 && (
            <FindingList
              label="Resolved"
              findings={closed}
              vendorId={vendorId}
              assessmentId={assessmentId}
              createMitigationAction={createMitigationAction}
              muted
              isFinished={isFinished}
              findingIssueLinks={findingIssueLinks}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FindingList({
  label,
  findings,
  vendorId,
  assessmentId,
  createMitigationAction,
  muted = false,
  isFinished = false,
  findingIssueLinks = [],
}: {
  label: string
  findings: AssessmentFinding[]
  vendorId: string | null
  assessmentId: string
  createMitigationAction: WorkflowProps['createMitigationAction']
  muted?: boolean
  isFinished?: boolean
  findingIssueLinks?: FindingIssueLink[]
}) {
  const SEVERITY_COLOR: Record<string, string> = {
    high: '#e11d48', medium: '#f59e0b', low: '#6b7280',
  }
  return (
    <div>
      <h3
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: muted ? '#c4bae8' : '#a99fd8' }}
      >
        {label}
      </h3>
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {findings.map((f, idx) => (
          <FindingCard
            key={f.id}
            finding={f}
            vendorId={vendorId}
            assessmentId={assessmentId}
            severityColor={SEVERITY_COLOR[f.severity] ?? '#94a3b8'}
            createMitigationAction={createMitigationAction}
            isFinished={isFinished}
            issueLink={findingIssueLinks.find(l => l.finding_id === f.id)}
            last={idx === findings.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function FindingCard({
  finding,
  vendorId,
  assessmentId,
  severityColor,
  createMitigationAction,
  isFinished = false,
  issueLink,
  last = false,
}: {
  finding: AssessmentFinding
  vendorId: string | null
  assessmentId: string
  severityColor: string
  createMitigationAction: WorkflowProps['createMitigationAction']
  isFinished?: boolean
  issueLink?: FindingIssueLink
  last?: boolean
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [showMitigation, setShowMitigation] = useState(false)
  const [mitState, mitFormAction, mitPending] = useActionState(createMitigationAction, {})

  useEffect(() => {
    if (mitState.success) {
      setShowMitigation(false)
      router.refresh()
    }
  }, [mitState.success, router])

  const mitCount = finding.mitigations?.length ?? 0

  return (
    <div style={{ borderBottom: last ? undefined : '1px solid rgba(109,93,211,0.06)' }}>
      {/* Collapsed row — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Severity stripe dot */}
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: severityColor }} />

        {/* Title */}
        <span className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: '#1e1550' }}>
          {finding.title}
        </span>

        {/* Severity badge */}
        <span
          className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase shrink-0"
          style={{ color: severityColor, background: `${severityColor}18` }}
        >
          {finding.severity}
        </span>

        {/* Risk domain */}
        {finding.risk_domain && (
          <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(109,93,211,0.06)', color: '#6b5fa8' }}>
            {finding.risk_domain}
          </span>
        )}

        {/* Status */}
        <span className="text-[11px] shrink-0 w-[50px]" style={{ color: '#a99fd8' }}>{finding.status}</span>

        {/* Mitigation count */}
        {mitCount > 0 && (
          <span className="text-[10px] shrink-0" style={{ color: '#059669' }}>{mitCount} fix</span>
        )}

        {/* Issue link badge */}
        {issueLink && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
            style={{
              background: issueLink.issue_status === 'closed' || issueLink.issue_status === 'resolved'
                ? 'rgba(5,150,105,0.1)' : 'rgba(245,158,11,0.1)',
              color: issueLink.issue_status === 'closed' || issueLink.issue_status === 'resolved'
                ? '#059669' : '#d97706',
            }}
          >
            Issue
          </span>
        )}

        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-3" style={{ background: 'rgba(109,93,211,0.015)' }}>
          {/* Description */}
          {finding.description && (
            <p className="text-xs leading-relaxed" style={{ color: '#4a4270' }}>{finding.description}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {issueLink && (
              <Link
                href={`/issues/${issueLink.issue_id}`}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                View Issue →
              </Link>
            )}
            {!isFinished && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowMitigation(m => !m) }}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                + Mitigation
              </button>
            )}
          </div>

          {/* Existing mitigations */}
          {mitCount > 0 && (
            <div className="space-y-1">
              {finding.mitigations!.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(109,93,211,0.04)' }}
                >
                  <span className="text-emerald-500">→</span>
                  <span style={{ color: '#1e1550' }}>{m.action}</span>
                  <span className="ml-auto" style={{ color: '#a99fd8' }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mitigation form */}
          {showMitigation && (
            <form
              action={mitFormAction}
              className="space-y-2 pt-2 border-t"
              style={{ borderColor: 'rgba(109,93,211,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              <input type="hidden" name="finding_id" value={finding.id} />
              {mitState.message && <p className="text-xs text-rose-500">{mitState.message}</p>}
              <input
                name="action"
                type="text"
                required
                placeholder="Describe the mitigation action…"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="due_at"
                  type="date"
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
                />
                <input
                  name="notes"
                  type="text"
                  placeholder="Notes (optional)"
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={mitPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
                >
                  {mitPending && <Spinner />}
                  {mitPending ? 'Saving…' : 'Add Mitigation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMitigation(false)}
                  className="text-xs"
                  style={{ color: '#a99fd8' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}


