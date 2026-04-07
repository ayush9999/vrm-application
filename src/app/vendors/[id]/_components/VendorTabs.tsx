'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Vendor, VendorStatus, ComplianceData } from '@/types/vendor'
import type { VendorDocumentsData, AssessmentDocRequest } from '@/types/document'
import type { FrameworkReadiness } from '@/lib/db/compliance'
import type { AssessmentFramework } from '@/types/assessment'
import type { VendorDispute } from '@/types/dispute'
import type { ActivityLogEntry } from '@/types/activity'
import type { VendorIncident } from '@/types/incident'
import type { FormState } from '@/types/common'
import type { OrgRole } from '@/types/org'
import type { VendorIssueCounts } from '@/lib/db/issues'
import { getCountryName } from '@/lib/countries'
import { Spinner } from '@/app/_components/Spinner'
import { DocumentsTab } from './tabs/DocumentsTab'
import { ComplianceTab } from './tabs/ComplianceTab'
import { DisputesTab } from './tabs/DisputesTab'
import { ActivityTab } from './tabs/ActivityTab'
import { IncidentsTab } from './tabs/IncidentsTab'

type Tab = 'overview' | 'documents' | 'compliance' | 'incidents' | 'activity' | 'disputes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'activity', label: 'Activity' },
  { id: 'disputes', label: 'Disputes' },
]

export interface VendorTabsProps {
  vendor: Vendor
  currentRole: OrgRole
  compliance: ComplianceData
  frameworkReadiness: FrameworkReadiness[]
  orgStandardIds: Set<string>
  /** Frameworks currently assigned to this vendor (via its assessments) */
  vendorFrameworks: AssessmentFramework[]
  /** All available frameworks in the org (for the add picker) */
  allFrameworks: AssessmentFramework[]
  documents: VendorDocumentsData
  assessmentDocRequests: AssessmentDocRequest[]
  disputes: VendorDispute[]
  incidents: VendorIncident[]
  activityLog: ActivityLogEntry[]
  onboardingAssessmentId: string | null
  /** Null when no onboarding assessment exists yet */
  addFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
  removeFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
  defaultTab?: Tab
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  addCustomDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteCustomDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  createDisputeAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  updateDisputeStatusAction: (vendorId: string, formData: FormData) => Promise<void>
  createIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  updateIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteIncidentAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteVendorAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  issueCounts: VendorIssueCounts
  vendorId: string
}

export function VendorTabs({
  vendor,
  currentRole,
  compliance,
  frameworkReadiness,
  orgStandardIds,
  vendorFrameworks,
  allFrameworks,
  documents,
  assessmentDocRequests,
  disputes,
  incidents,
  activityLog,
  onboardingAssessmentId,
  addFrameworkAction,
  removeFrameworkAction,
  defaultTab = 'overview',
  uploadDocAction,
  addCustomDocAction,
  deleteDocAction,
  deleteCustomDocAction,
  createDisputeAction,
  updateDisputeStatusAction,
  createIncidentAction,
  updateIncidentAction,
  deleteIncidentAction,
  deleteVendorAction,
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
              {tab.id === 'documents' && documents.suggested.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: 'rgba(109,93,211,0.1)', color: '#6b5fa8' }}
                >
                  {documents.suggested.length}
                </span>
              )}
              {tab.id === 'disputes' && disputes.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                  {disputes.length}
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
          compliance={compliance}
          currentRole={currentRole}
          vendorFrameworks={vendorFrameworks}
          allFrameworks={allFrameworks}
          addFrameworkAction={addFrameworkAction}
          removeFrameworkAction={removeFrameworkAction}
          deleteVendorAction={deleteVendorAction}
          documents={documents}
          issueCounts={issueCounts}
          vendorId={vendorId}
          onSwitchTab={setActive}
        />
      )}
      {active === 'documents' && (
        <DocumentsTab
          documents={documents}
          assessmentDocRequests={assessmentDocRequests}
          uploadDocAction={uploadDocAction}
          addCustomDocAction={addCustomDocAction}
          deleteDocAction={deleteDocAction}
          deleteCustomDocAction={deleteCustomDocAction}
        />
      )}
      {active === 'compliance' && (
        <ComplianceTab compliance={compliance} frameworkReadiness={frameworkReadiness} orgStandardIds={orgStandardIds} onboardingAssessmentId={onboardingAssessmentId} />
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
      {active === 'disputes' && (
        <DisputesTab
          vendorId={vendor.id}
          disputes={disputes}
          createDisputeAction={createDisputeAction}
          updateDisputeStatusAction={updateDisputeStatusAction}
        />
      )}
    </div>
  )
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  vendor,
  compliance,
  currentRole,
  vendorFrameworks,
  allFrameworks,
  addFrameworkAction,
  removeFrameworkAction,
  deleteVendorAction,
  documents,
  issueCounts,
  vendorId,
  onSwitchTab,
}: {
  vendor: Vendor
  compliance: ComplianceData
  currentRole: OrgRole
  vendorFrameworks: AssessmentFramework[]
  allFrameworks: AssessmentFramework[]
  addFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
  removeFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
  deleteVendorAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  documents: VendorDocumentsData
  issueCounts: VendorIssueCounts
  vendorId: string
  onSwitchTab: (tab: Tab) => void
}) {
  const score = compliance.score

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
    {
      label: 'Compliance Score',
      value: score !== null ? (
        <span
          className={`font-semibold ${
            score >= 80 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600'
          }`}
        >
          {score}%
        </span>
      ) : (
        <span style={{ color: '#a99fd8' }}>— (no category)</span>
      ),
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
    {
      label: 'Compliance',
      value: score !== null ? (
        <span className={`font-semibold ${score >= 80 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
          {score}%
        </span>
      ) : '—',
    },
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

      {/* Document Expiry Alerts */}
      <ExpiryAlertCard documents={documents} onSwitchTab={onSwitchTab} />

      {/* Risk Frameworks */}
      <RiskFrameworksSection
        vendorFrameworks={vendorFrameworks}
        allFrameworks={allFrameworks}
        addFrameworkAction={addFrameworkAction}
        removeFrameworkAction={removeFrameworkAction}
      />

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
          onClick={() => onSwitchTab('documents')}
          className="text-xs font-medium mt-1 hover:opacity-80 transition-opacity"
          style={{ color: '#6c5dd3' }}
        >
          Go to Documents tab →
        </button>
      </div>
    </div>
  )
}

// ─── Risk Frameworks section ───────────────────────────────────────────────────

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
          Issues & Remediation
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
            + New Issue
          </Link>
        </div>
      )}
    </div>
  )
}

function RiskFrameworksSection({
  vendorFrameworks,
  allFrameworks,
  addFrameworkAction,
  removeFrameworkAction,
}: {
  vendorFrameworks: AssessmentFramework[]
  allFrameworks: AssessmentFramework[]
  addFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
  removeFrameworkAction: ((frameworkId: string) => Promise<{ message?: string }>) | null
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set(vendorFrameworks.map(f => f.id)))

  const canEdit = !!addFrameworkAction

  // Merged + sorted list for the modal
  const allSorted = [
    ...vendorFrameworks,
    ...allFrameworks.filter(f => !vendorFrameworks.find(a => a.id === f.id)),
  ].sort((a, b) => a.name.localeCompare(b.name))

  function openModal() {
    setDraftIds(new Set(vendorFrameworks.map(f => f.id)))
    setSearch('')
    setError(null)
    setOpen(true)
  }

  function toggle(id: string) {
    setDraftIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const hasChanges = (() => {
    const currentIds = new Set(vendorFrameworks.map(f => f.id))
    if (draftIds.size !== currentIds.size) return true
    for (const id of draftIds) if (!currentIds.has(id)) return true
    return false
  })()

  function handleApply() {
    if (!addFrameworkAction || !removeFrameworkAction) return
    setError(null)
    const currentIds = new Set(vendorFrameworks.map(f => f.id))
    const toAdd    = [...draftIds].filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !draftIds.has(id))

    startTransition(async () => {
      const results = await Promise.all([
        ...toAdd.map(id => addFrameworkAction(id)),
        ...toRemove.map(id => removeFrameworkAction(id)),
      ])
      const err = results.find(r => r.message)
      if (err?.message) setError(err.message)
      else setOpen(false)
    })
  }

  return (
    <div className="pt-4" style={{ borderTop: '1px solid rgba(109,93,211,0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>
          Risk Frameworks
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', color: '#fff', boxShadow: '0 2px 8px rgba(109,93,211,0.25)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 1.5a1.414 1.414 0 012 2L4 11H1.5v-2.5L9.5 1.5z"/>
            </svg>
            Manage
          </button>
        )}
      </div>

      {/* Assigned pills */}
      {vendorFrameworks.length === 0 ? (
        <p className="text-sm" style={{ color: '#a99fd8' }}>
          No frameworks assigned.{canEdit ? ' Click "Manage" to add one.' : ''}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {vendorFrameworks.map((fw) => (
            <span
              key={fw.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#1e1550', border: '1px solid rgba(109,93,211,0.15)' }}
            >
              {fw.name}
            </span>
          ))}
        </div>
      )}

      {!canEdit && (
        <p className="text-[11px] mt-2" style={{ color: '#c4bae8' }}>
          Create an onboarding assessment first to manage frameworks here.
        </p>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(30,21,80,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => !isPending && setOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 16px 48px rgba(109,93,211,0.2)' }}
          >
            {/* Header */}
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Manage Risk Frameworks</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
                    Select frameworks to evaluate for this vendor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a99fd8] transition-colors hover:bg-[rgba(109,93,211,0.06)]"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-3" style={{ borderBottom: '1px solid rgba(109,93,211,0.08)' }}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 shrink-0" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6.5" cy="6.5" r="5" />
                  <path d="M10.5 10.5l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  placeholder="Search frameworks…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
                  style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.12)', color: '#1e1550' }}
                />
              </div>
            </div>

            {/* Framework list */}
            <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
              {(() => {
                const filtered = search.trim()
                  ? allSorted.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
                  : allSorted
                if (filtered.length === 0) return (
                  <p className="text-sm text-center py-6" style={{ color: '#a99fd8' }}>
                    {search ? 'No frameworks match your search.' : 'No frameworks available.'}
                  </p>
                )
                return filtered.map(fw => {
                  const checked = draftIds.has(fw.id)
                  return (
                    <label
                      key={fw.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        border: `1px solid ${checked ? 'rgba(109,93,211,0.3)' : 'rgba(109,93,211,0.1)'}`,
                        background: checked ? 'rgba(109,93,211,0.04)' : '#fff',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(fw.id)}
                        className="h-4 w-4 rounded shrink-0"
                        style={{ accentColor: '#6c5dd3' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1e1550' }}>{fw.name}</p>
                        {fw.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#a99fd8' }}>{fw.description}</p>
                        )}
                      </div>
                    </label>
                  )
                })
              })()}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(109,93,211,0.1)', background: 'rgba(109,93,211,0.02)' }}
            >
              <div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                {!error && (
                  <p className="text-xs" style={{ color: '#a99fd8' }}>
                    {draftIds.size} framework{draftIds.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-violet-50 disabled:opacity-50"
                  style={{ color: '#a99fd8' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isPending || !hasChanges}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
                >
                  {isPending && <Spinner />}
                  {isPending ? 'Applying…' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
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
