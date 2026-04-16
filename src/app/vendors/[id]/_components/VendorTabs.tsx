'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { Vendor, VendorStatus } from '@/types/vendor'
import type { VendorDocumentsData, AssessmentDocRequest } from '@/types/document'
import type { ActivityLogEntry } from '@/types/activity'
import type { VendorIncident } from '@/types/incident'
import type { FormState } from '@/types/common'
import type { OrgRole } from '@/types/org'
import type { VendorIssueCounts } from '@/lib/db/issues'
import type { VendorReviewPack } from '@/types/review-pack'
import { getCountryName } from '@/lib/countries'
import { Spinner } from '@/app/_components/Spinner'
import { EvidenceTab } from './tabs/EvidenceTab'
import { ActivityTab } from './tabs/ActivityTab'
import { IncidentsTab } from './tabs/IncidentsTab'
import { ReviewsTab } from './tabs/ReviewsTab'
import { ApprovalWorkflow } from './ApprovalWorkflow'
import type { VendorApprovalStatus } from '@/types/vendor'
import type { EvidenceByPack } from '@/lib/evidence-ui'
import type { EvidenceStatus } from '@/types/review-pack'

type Tab = 'overview' | 'reviews' | 'evidence' | 'incidents' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'reviews',   label: 'Reviews' },
  { id: 'evidence',  label: 'Evidence' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'activity',  label: 'Activity' },
]

export interface VendorTabsProps {
  vendor: Vendor
  currentRole: OrgRole
  documents: VendorDocumentsData
  assessmentDocRequests: AssessmentDocRequest[]
  incidents: VendorIncident[]
  activityLog: ActivityLogEntry[]
  reviewPacks: VendorReviewPack[]
  evidenceGroups: EvidenceByPack[]
  defaultTab?: Tab
  createIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  updateIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteVendorAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  reapplyReviewPacksAction: () => Promise<{ message?: string; success?: boolean }>
  updateApprovalStatusAction: (
    vendorId: string,
    newStatus: VendorApprovalStatus,
    exceptionReason?: string,
  ) => Promise<{ message?: string; success?: boolean }>
  uploadEvidenceAction: (
    vendorId: string,
    evidenceId: string,
    formData: FormData,
  ) => Promise<{ message?: string; success?: boolean }>
  setEvidenceStatusAction: (
    vendorId: string,
    evidenceId: string,
    status: EvidenceStatus,
    comment: string | null,
  ) => Promise<{ message?: string; success?: boolean }>
  requestEvidenceAction: (
    vendorId: string,
    evidenceId: string,
  ) => Promise<{ message?: string; success?: boolean }>
  issueCounts: VendorIssueCounts
  vendorId: string
}

export function VendorTabs({
  vendor,
  currentRole,
  documents,
  incidents,
  activityLog,
  reviewPacks,
  evidenceGroups,
  defaultTab = 'overview',
  createIncidentAction,
  updateIncidentAction,
  deleteIncidentAction,
  deleteVendorAction,
  reapplyReviewPacksAction,
  updateApprovalStatusAction,
  uploadEvidenceAction,
  setEvidenceStatusAction,
  requestEvidenceAction,
  issueCounts,
  vendorId,
}: VendorTabsProps) {
  const [active, setActive] = useState<Tab>(defaultTab)

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 -mx-6 px-6" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-all border-b-2"
              style={
                active === tab.id
                  ? { color: '#6c5dd3', borderColor: '#6c5dd3' }
                  : { color: '#a99fd8', borderColor: 'transparent' }
              }
            >
              {tab.label}
              {tab.id === 'reviews' && reviewPacks.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: 'rgba(109,93,211,0.1)', color: '#6b5fa8' }}
                >
                  {reviewPacks.length}
                </span>
              )}
              {tab.id === 'evidence' && evidenceGroups.reduce((s, g) => s + g.rows.length, 0) > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: 'rgba(109,93,211,0.1)', color: '#6b5fa8' }}
                >
                  {evidenceGroups.reduce((s, g) => s + g.rows.length, 0)}
                </span>
              )}
              {tab.id === 'incidents' && incidents.filter(i => i.status === 'open').length > 0 && (
                <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full leading-none">
                  {incidents.filter(i => i.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {active === 'overview' && (
        <OverviewTab
          vendor={vendor}
          currentRole={currentRole}
          deleteVendorAction={deleteVendorAction}
          documents={documents}
          issueCounts={issueCounts}
          vendorId={vendorId}
          onSwitchTab={setActive}
          updateApprovalStatusAction={updateApprovalStatusAction}
        />
      )}
      {active === 'reviews' && (
        <ReviewsTab
          vendorId={vendor.id}
          reviewPacks={reviewPacks}
          reapplyReviewPacksAction={reapplyReviewPacksAction}
        />
      )}
      {active === 'evidence' && (
        <EvidenceTab
          vendorId={vendor.id}
          groups={evidenceGroups}
          uploadEvidenceAction={uploadEvidenceAction}
          setEvidenceStatusAction={setEvidenceStatusAction}
          requestEvidenceAction={requestEvidenceAction}
        />
      )}
      {active === 'incidents' && (
        <IncidentsTab
          incidents={incidents}
          createIncidentAction={createIncidentAction}
          updateIncidentAction={updateIncidentAction}
          deleteIncidentAction={deleteIncidentAction}
        />
      )}
      {active === 'activity' && <ActivityTab activityLog={activityLog} />}
    </div>
  )
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  vendor,
  currentRole,
  deleteVendorAction,
  documents,
  issueCounts,
  vendorId,
  onSwitchTab,
  updateApprovalStatusAction,
}: {
  vendor: Vendor
  currentRole: OrgRole
  deleteVendorAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  documents: VendorDocumentsData
  issueCounts: VendorIssueCounts
  vendorId: string
  onSwitchTab: (tab: Tab) => void
  updateApprovalStatusAction: (
    vendorId: string,
    newStatus: VendorApprovalStatus,
    exceptionReason?: string,
  ) => Promise<{ message?: string; success?: boolean }>
}) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Name', value: vendor.name },
    { label: 'Legal Name', value: vendor.legal_name ?? '—' },
    {
      label: 'Vendor Code',
      value: vendor.vendor_code ? (
        <code className="font-mono text-sm px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }}>{vendor.vendor_code}</code>
      ) : '—',
    },
    { label: 'Status', value: <VendorStatusBadge status={vendor.status} /> },
    { label: 'Category', value: vendor.vendor_categories?.name ?? '—' },
    { label: 'Internal Owner', value: vendor.internal_owner?.name ?? vendor.internal_owner?.email ?? '—' },
    {
      label: 'Critical',
      value: vendor.is_critical ? (
        <span className="text-amber-500 font-semibold">Yes ★</span>
      ) : 'No',
    },
    {
      label: 'Criticality Tier',
      value: vendor.criticality_tier != null ? ({
        1: '1 — Low',
        2: '2 — Medium',
        3: '3 — High',
        4: '4 — Critical',
        5: '5 — Very Critical',
      } as Record<number, string>)[vendor.criticality_tier] ?? vendor.criticality_tier : '—',
    },
    { label: 'Website', value: vendor.website_url ?? '—' },
    { label: 'Primary Email', value: vendor.primary_email ?? '—' },
    { label: 'Phone', value: vendor.phone ?? '—' },
    { label: 'Country', value: getCountryName(vendor.country_code) ?? '—' },
    {
      label: 'Next Review Due',
      value: vendor.next_review_due_at
        ? new Date(vendor.next_review_due_at).toLocaleDateString()
        : '—',
    },
    {
      label: 'Last Reviewed',
      value: vendor.last_reviewed_at
        ? new Date(vendor.last_reviewed_at).toLocaleDateString()
        : '—',
    },
    { label: 'Created', value: new Date(vendor.created_at).toLocaleString() },
    { label: 'Updated', value: new Date(vendor.updated_at).toLocaleString() },
    { label: 'Notes', value: vendor.notes ?? '—' },
  ]

  // Key summary fields shown inline always
  const summaryFields = [
    { label: 'Status', value: <VendorStatusBadge status={vendor.status} /> },
    { label: 'Category', value: vendor.vendor_categories?.name ?? '—' },
    { label: 'Owner', value: vendor.internal_owner?.name ?? vendor.internal_owner?.email ?? '—' },
    { label: 'Criticality', value: vendor.criticality_tier != null ? `Tier ${vendor.criticality_tier}` : '—' },
    { label: 'Next Review', value: vendor.next_review_due_at ? new Date(vendor.next_review_due_at).toLocaleDateString() : '—' },
  ]

  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="space-y-4">
      {/* Key summary — always visible */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.07)' }}
      >
        <div className="flex items-center gap-6 px-5 py-3">
          {summaryFields.map(f => (
            <div key={f.label} className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>{f.label}</div>
              <div className="text-sm mt-0.5" style={{ color: '#1e1550' }}>{f.value}</div>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link
              href={`/vendors/${vendor.id}/edit`}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
            >
              Edit
            </Link>
            {currentRole === 'site_admin' && (
              <DeleteVendorButton deleteAction={deleteVendorAction} />
            )}
          </div>
        </div>

        {/* Expandable full details */}
        <div
          className="flex items-center gap-2 px-5 py-2 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
          style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}
          onClick={() => setShowDetails(d => !d)}
        >
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 transition-transform"
            style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
          <span className="text-[11px] font-medium" style={{ color: '#8b7fd4' }}>
            {showDetails ? 'Hide details' : 'All details'}
          </span>
        </div>

        {showDetails && (
          <div className="px-5 pb-4 pt-1" style={{ borderTop: '1px solid rgba(109,93,211,0.04)' }}>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2.5">
              {fields.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>{label}</dt>
                  <dd className="text-sm mt-0.5" style={{ color: '#1e1550' }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Approval Workflow */}
      <ApprovalWorkflow
        vendorId={vendorId}
        currentStatus={vendor.approval_status}
        approvedAt={vendor.approved_at}
        exceptionReason={vendor.exception_reason}
        updateAction={updateApprovalStatusAction}
      />

      {/* Document Expiry Alerts */}
      <ExpiryAlertCard documents={documents} onSwitchTab={onSwitchTab} />

      {/* Issues Summary */}
      <IssuesSummaryCard issueCounts={issueCounts} vendorId={vendorId} />
    </div>
  )
}

// ─── Document expiry alert card ───────────────────────────────────────────────

function ExpiryAlertCard({ documents, onSwitchTab }: { documents: VendorDocumentsData; onSwitchTab: (tab: Tab) => void }) {
  const allDocs = [...documents.suggested, ...documents.custom]
  const now = Date.now()

  const expired: { name: string; date: string }[] = []
  const expiringSoon: { name: string; date: string; daysLeft: number }[] = []

  for (const doc of allDocs) {
    if (!doc.expiry_date || doc.status === 'missing') continue
    const exp = new Date(doc.expiry_date)
    const daysLeft = Math.ceil((exp.getTime() - now) / 86_400_000)
    const name = doc.doc_type_name ?? ('title' in doc ? (doc as { title?: string }).title : null) ?? 'Document'
    if (daysLeft < 0) {
      expired.push({ name, date: exp.toLocaleDateString() })
    } else if (daysLeft <= 90) {
      expiringSoon.push({ name, date: exp.toLocaleDateString(), daysLeft })
    }
  }

  if (expired.length === 0 && expiringSoon.length === 0) return null

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(245,158,11,0.06)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="7" />
          <path d="M8 4.5V8.5" />
          <circle cx="8" cy="11" r="0.5" fill="#d97706" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
          Document Expiry Alerts
        </span>
        <span className="ml-auto text-xs text-amber-600 font-medium">
          {expired.length + expiringSoon.length} document{expired.length + expiringSoon.length !== 1 ? 's' : ''} need attention
        </span>
      </div>
      <div className="px-4 py-3 bg-white space-y-2">
        {expired.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="font-medium text-red-700">{d.name}</span>
            <span className="text-xs text-red-500">expired {d.date}</span>
          </div>
        ))}
        {expiringSoon.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-medium text-amber-800">{d.name}</span>
            <span className="text-xs text-amber-600">
              {d.daysLeft <= 30 ? (
                <span className="font-semibold">{d.daysLeft}d left</span>
              ) : (
                <>{d.daysLeft}d left</>
              )}
              {' · '}{d.date}
            </span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onSwitchTab('evidence')}
          className="text-xs font-medium mt-1 hover:opacity-80 transition-opacity"
          style={{ color: '#6c5dd3' }}
        >
          Go to Evidence tab →
        </button>
      </div>
    </div>
  )
}

// ─── Issues summary card ──────────────────────────────────────────────────────

function IssuesSummaryCard({ issueCounts, vendorId }: { issueCounts: VendorIssueCounts; vendorId: string }) {
  const { total, open, in_progress, overdue, critical, high } = issueCounts

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(109,93,211,0.04)' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v3.5" />
          <circle cx="8" cy="11" r="0.5" fill="#6c5dd3" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a4270' }}>
          Remediation
        </span>
        <Link
          href={`/issues?vendor_id=${vendorId}`}
          className="ml-auto text-xs font-medium hover:underline"
          style={{ color: '#6c5dd3' }}
        >
          View all →
        </Link>
      </div>

      {total === 0 ? (
        <div className="px-4 py-2">
          <p className="text-xs" style={{ color: '#a99fd8' }}>No issues tracked for this vendor.</p>
        </div>
      ) : (
        <div className="flex items-center gap-5 px-4 py-2 bg-white">
          {[
            { label: 'Total', value: total, color: '#4a4270' },
            { label: 'Open', value: open, color: '#d97706' },
            { label: 'In Progress', value: in_progress, color: '#2563eb' },
            { label: 'Overdue', value: overdue, color: overdue > 0 ? '#e11d48' : '#a99fd8' },
            { label: 'Critical', value: critical, color: critical > 0 ? '#e11d48' : '#a99fd8' },
            { label: 'High', value: high, color: high > 0 ? '#ea580c' : '#a99fd8' },
          ].map(s => (
            <div key={s.label} className="text-center min-w-[40px]">
              <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] uppercase tracking-wider font-medium" style={{ color: '#a99fd8' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="px-4 py-2 flex items-center gap-3 bg-white" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
          <Link
            href={`/issues/new?vendor_id=${vendorId}`}
            className="text-xs font-medium px-3 py-1 rounded-full transition-all hover:opacity-80"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
          >
            + New Remediation
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Delete vendor button ──────────────────────────────────────────────────────

function DeleteVendorButton({
  deleteAction,
}: {
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, isPending] = useActionState(deleteAction, {})

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm('Delete this vendor? This can only be undone by a database admin.')) {
          e.preventDefault()
        }
      }}
    >
      {state.message && <p className="text-xs text-rose-600 mr-2 inline">{state.message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50 transition-colors"
      >
        {isPending && <Spinner />}
        {isPending ? 'Deleting…' : 'Delete Vendor'}
      </button>
    </form>
  )
}

function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const map: Record<VendorStatus, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
    under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
    suspended: { label: 'Suspended', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
  }
  const { label, className } = map[status]
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
