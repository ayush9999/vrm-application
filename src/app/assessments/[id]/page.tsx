import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getAssessmentDetail, computeItemProgress, getAssessmentFrameworks, getFrameworks } from '@/lib/db/assessments'
import { getAssessmentActivityLog } from '@/lib/db/activity-log'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorDocStatusMap } from '@/lib/db/documents'
import type { VendorDocStatus } from '@/lib/db/documents'
import { getOrgFrameworkSelections, getOrgUsers } from '@/lib/db/organizations'
import { getAssessmentFindingIssueLinks, getIssues } from '@/lib/db/issues'

import { AssessmentWorkflow } from './_components/AssessmentWorkflow'
import { AssessmentFrameworksEditor } from './_components/AssessmentFrameworksEditor'
import { DeleteAssessmentButton } from './_components/DeleteAssessmentButton'
import { AssessmentActivityLog } from './_components/AssessmentActivityLog'
import {
  updateAssessmentStatusAction,
  saveAssessmentSummaryAction,
  updateAssessmentItemAction,
  createFindingAction,
  updateFindingStatusAction,
  createMitigationAction,
  deleteAssessmentAction,
  addAssessmentFrameworkAction,
  removeAssessmentFrameworkAction,
} from '../actions'
import type { AssessmentStatus, AssessmentRiskLevel } from '@/types/assessment'
import type { Vendor } from '@/types/vendor'

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  draft:                'Draft',
  in_review:            'In Review',
  pending_ai_review:    'Pending AI Review',
  pending_human_review: 'Pending Human Review',
  submitted:            'Submitted',
  completed:            'Completed',
  archived:             'Archived',
}

const RISK_COLOR: Record<AssessmentRiskLevel, string> = {
  critical:     '#e11d48',
  high:         '#f43f5e',
  medium:       '#f59e0b',
  low:          '#10b981',
  informational:'#0ea5e9',
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string }>
}

export default async function AssessmentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const user = await requireCurrentUser()

  const detail = await getAssessmentDetail(user.orgId, id)
  if (!detail) notFound()

  const { assessment, items, findings, reports } = detail
  const progress = computeItemProgress(items)

  // Fetch full vendor profile for the context card
  const vendor = assessment.vendor?.id
    ? await getVendorById(user.orgId, assessment.vendor.id)
    : null

  // Fetch vendor document status map for cross-referencing framework item document requests
  const vendorDocStatus: Map<string, VendorDocStatus> = assessment.vendor?.id
    ? await getVendorDocStatusMap(user.orgId, assessment.vendor.id)
    : new Map()

  const currentStep = sp.step ?? deriveStep(assessment.status)

  // Org compliance standards (for mapping display)
  const orgStandardSelections = await getOrgFrameworkSelections(user.orgId)
  const orgStandardIds = new Set(orgStandardSelections.map(s => s.framework_id))

  // Frameworks active in this assessment + all available VRFs + activity log + finding issue links
  const findingIds = findings.map(f => f.id)
  const [assessmentFrameworks, allVrfs, activityLog, findingIssueLinks, assessmentIssues, orgUsers] = await Promise.all([
    getAssessmentFrameworks(id),
    getFrameworks(user.orgId, 'vendor_risk_framework'),
    getAssessmentActivityLog(user.orgId, id),
    getAssessmentFindingIssueLinks(findingIds),
    getIssues(user.orgId, { assessmentId: id }),
    getOrgUsers(user.orgId),
  ])

  // Bind actions
  const boundUpdateStatus      = updateAssessmentStatusAction.bind(null, id)
  const boundSaveSummary       = saveAssessmentSummaryAction.bind(null, id)
  const boundUpdateItem        = updateAssessmentItemAction
  const boundCreateFinding     = createFindingAction.bind(null, id)
  const boundCreateMitigation  = createMitigationAction.bind(null, id)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* ── Consolidated Header Card ─────────────────────────────── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {/* Row 1: Breadcrumb + Actions */}
        <div
          className="flex items-center justify-between px-5 py-2.5"
          style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
            <Link href="/assessments" className="transition-colors hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>
              Assessments
            </Link>
            <span>/</span>
            <span className="font-medium" style={{ color: '#6b5fa8' }}>
              {assessment.title ?? 'Assessment'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AssessmentActivityLog entries={activityLog} />
            <DeleteAssessmentButton
              assessmentId={assessment.id}
              assessmentTitle={assessment.title ?? 'Untitled Assessment'}
              deleteAction={deleteAssessmentAction}
            />
          </div>
        </div>

        {/* Row 2: Title + Status + Risk + Score */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              {assessment.assessment_code && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0"
                  style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                >
                  {assessment.assessment_code}
                </span>
              )}
              <h1 className="text-xl font-semibold tracking-tight truncate" style={{ color: '#1e1550' }}>
                {assessment.title ?? 'Untitled Assessment'}
              </h1>
              <StatusChip status={assessment.status} />
              {assessment.risk_level && (
                <span
                  className="font-semibold px-2 py-0.5 rounded-full text-white text-[11px] shrink-0"
                  style={{ background: RISK_COLOR[assessment.risk_level] }}
                >
                  {assessment.risk_level.toUpperCase()}
                </span>
              )}
            </div>
            {assessment.overall_score !== null && assessment.overall_score !== undefined && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>Score</span>
                <span className="text-2xl font-bold leading-none" style={{ color: '#6c5dd3' }}>{assessment.overall_score}%</span>
              </div>
            )}
          </div>

          {/* Row 3: Vendor, category, period — inline meta */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {assessment.vendor && (
              <Link
                href={`/vendors/${assessment.vendor.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}
              >
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="12" height="12" rx="1.5" />
                  <path d="M1 4.5h12M4.5 4.5v7.5" />
                </svg>
                {assessment.vendor.name}
              </Link>
            )}
            {vendor?.vendor_categories?.name && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                {vendor.vendor_categories.name}
              </span>
            )}
            {vendor?.criticality_tier && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                Tier {vendor.criticality_tier}
              </span>
            )}
            {assessment.period_type && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                {assessment.period_type}
              </span>
            )}
            {assessment.period_start && assessment.period_end && (
              <span className="text-[11px]" style={{ color: '#a99fd8' }}>
                {new Date(assessment.period_start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – {new Date(assessment.period_end).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Row 4: Frameworks */}
        <div className="px-5 pb-3">
          <AssessmentFrameworksEditor
            assessmentId={id}
            activeFrameworks={assessmentFrameworks}
            availableFrameworks={allVrfs}
            addAction={addAssessmentFrameworkAction}
            removeAction={removeAssessmentFrameworkAction}
          />
        </div>

        {/* Row 5: Progress bar (inline, slim) */}
        {progress.total > 0 && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress.pct}%`, background: 'linear-gradient(90deg, #6c5dd3 0%, #7c6be0 100%)' }}
                />
              </div>
              <span className="text-[11px] font-medium shrink-0" style={{ color: '#6b5fa8' }}>
                {progress.done}/{progress.total}
              </span>
              {progress.flagged > 0 && (
                <span className="text-[11px] font-medium text-amber-600 shrink-0">{progress.flagged} flagged</span>
              )}
              <span className="text-[11px] font-semibold shrink-0" style={{ color: '#6c5dd3' }}>{progress.pct}%</span>
            </div>
          </div>
        )}

        {/* Row 6: Vendor details (collapsible) */}
        {vendor && <VendorContextCollapsible vendor={vendor} />}
      </div>

      {/* Journey workflow */}
      <AssessmentWorkflow
        assessment={assessment}
        items={items}
        findings={findings}
        reports={reports}
        currentStep={currentStep}
        vendorDocStatus={vendorDocStatus}
        orgStandardIds={orgStandardIds}
        frameworks={assessmentFrameworks}
        updateStatusAction={boundUpdateStatus}
        saveSummaryAction={boundSaveSummary}
        updateItemAction={boundUpdateItem}
        createFindingAction={boundCreateFinding}
        updateFindingStatusAction={updateFindingStatusAction}
        createMitigationAction={boundCreateMitigation}
        findingIssueLinks={findingIssueLinks}
        assessmentIssues={assessmentIssues}
        orgUsers={orgUsers}
      />
    </div>
  )
}

function VendorContextCollapsible({ vendor }: { vendor: Vendor }) {
  const TIER_COLOR: Record<number, string> = { 1: '#e11d48', 2: '#f59e0b', 3: '#6c5dd3', 4: '#0ea5e9', 5: '#10b981' }
  const STATUS_LABEL: Record<string, string> = { active: 'Active', under_review: 'Under Review', suspended: 'Suspended' }
  const STATUS_CLS: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20',
    under_review: 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20',
    suspended: 'bg-red-50 text-red-700 ring-1 ring-red-500/20',
  }

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[vendor.status]}`}>
        {STATUS_LABEL[vendor.status]}
      </span>
    )},
    { label: 'Country', value: vendor.country_code ?? '—' },
    { label: 'Contact', value: vendor.primary_email
      ? <a href={`mailto:${vendor.primary_email}`} className="hover:underline" style={{ color: '#6c5dd3' }}>{vendor.primary_email}</a>
      : '—'
    },
    { label: 'Website', value: vendor.website_url
      ? <a href={vendor.website_url} target="_blank" rel="noreferrer" className="hover:underline truncate block max-w-[180px]" style={{ color: '#6c5dd3' }}>{vendor.website_url.replace(/^https?:\/\//, '')}</a>
      : '—'
    },
    { label: 'Owner', value: vendor.internal_owner?.name ?? vendor.internal_owner?.email ?? '—' },
    { label: 'Last Reviewed', value: vendor.last_reviewed_at
      ? new Date(vendor.last_reviewed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : '—'
    },
  ]

  return (
    <details className="group" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
      <summary
        className="flex items-center justify-between px-5 py-2.5 cursor-pointer select-none transition-colors hover:bg-violet-50/40 list-none [&::-webkit-details-marker]:hidden"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Vendor Details
          </span>
          {vendor.is_blocklisted && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 ring-1 ring-red-500/20">
              Blocklisted
            </span>
          )}
          {vendor.is_critical && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 ring-1 ring-rose-500/20">
              Critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/vendors/${vendor.id}`}
            className="text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: '#6c5dd3' }}
          >
            View full profile →
          </Link>
          <svg
            width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#a99fd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform group-open:rotate-180"
          >
            <path d="M3 5.5l4 4 4-4" />
          </svg>
        </div>
      </summary>

      <div className="px-5 pb-4 pt-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-2.5">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#c4bae8' }}>{label}</p>
              <p className="text-xs" style={{ color: '#3d2e8a' }}>{value}</p>
            </div>
          ))}
        </div>

        {vendor.notes && (
          <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#c4bae8' }}>Notes</p>
            <p className="text-xs leading-relaxed" style={{ color: '#6b5fa8' }}>{vendor.notes}</p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
          <Link href={`/vendors/${vendor.id}?tab=documents`} className="text-[11px] transition-colors hover:opacity-70" style={{ color: '#a99fd8' }}>
            Documents
          </Link>
          <Link href={`/vendors/${vendor.id}?tab=compliance`} className="text-[11px] transition-colors hover:opacity-70" style={{ color: '#a99fd8' }}>
            Compliance
          </Link>
          <Link href={`/vendors/${vendor.id}?tab=incidents`} className="text-[11px] transition-colors hover:opacity-70" style={{ color: '#a99fd8' }}>
            Incidents
          </Link>
          <Link href={`/vendors/${vendor.id}?tab=activity`} className="text-[11px] transition-colors hover:opacity-70" style={{ color: '#a99fd8' }}>
            Activity
          </Link>
        </div>
      </div>
    </details>
  )
}

function deriveStep(status: AssessmentStatus): string {
  switch (status) {
    case 'draft':
    case 'in_review':
    case 'pending_ai_review':
    case 'pending_human_review':   return 'items'
    case 'submitted':
    case 'completed':
    case 'archived':               return 'finalise'
    default:                       return 'items'
  }
}

function StatusChip({ status }: { status: AssessmentStatus }) {
  const map: Record<AssessmentStatus, { label: string; cls: string }> = {
    draft:                { label: 'Draft',         cls: 'bg-[rgba(169,159,216,0.12)] text-[#6b5fa8] ring-1 ring-[rgba(109,93,211,0.2)]' },
    in_review:            { label: 'In Review',     cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20' },
    pending_ai_review:    { label: 'AI Review',     cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20' },
    pending_human_review: { label: 'Human Review',  cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20' },
    submitted:            { label: 'Submitted',     cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-500/20' },
    completed:            { label: 'Completed',     cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
    archived:             { label: 'Archived',      cls: 'bg-[rgba(169,159,216,0.06)] text-[#a99fd8] ring-1 ring-[rgba(109,93,211,0.12)]' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
  )
}

