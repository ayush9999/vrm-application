'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Vendor, VendorStatus } from '@/types/vendor'
import type { VendorDocumentsData, AssessmentDocRequest } from '@/types/document'
import type { ActivityLogEntry } from '@/types/activity'
import type { VendorIncident } from '@/types/incident'
import type { FormState } from '@/types/common'
import type { OrgRole } from '@/types/org'
import type { VendorIssueCounts } from '@/lib/db/issues'
import type { VendorReviewPack, VendorReview } from '@/types/review-pack'
import type { EvidenceRequest, EvidenceRequestSummary, EvidenceRequestItemStatus } from '@/lib/db/evidence-requests'
import { getCountryName } from '@/lib/countries'
import { Spinner } from '@/app/_components/Spinner'
import { EvidenceTab } from './tabs/EvidenceTab'
import { ActivityTab } from './tabs/ActivityTab'
import { IncidentsTab } from './tabs/IncidentsTab'
import { ReviewsTab } from './tabs/ReviewsTab'
import type { EvidenceByPack } from '@/lib/evidence-ui'
import type { EvidenceStatus } from '@/types/review-pack'

type Tab = 'overview' | 'reviews' | 'evidence' | 'incidents' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'evidence',  label: 'Evidence' },
  { id: 'reviews',   label: 'Reviews' },
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
  assignments: import('@/lib/db/vendor-pack-assignments').VendorPackAssignment[]
  availablePacks: { id: string; name: string; code: string | null }[]
  assignPackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
  removePackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
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
  getEvidenceVersionsAction: (
    vendorId: string,
    evidenceId: string,
  ) => Promise<{ versions?: import('@/lib/evidence-ui').EvidenceVersion[]; message?: string }>
  getEvidenceDownloadAction: (
    fileKey: string,
  ) => Promise<{ url?: string; message?: string }>
  evidenceRequests: EvidenceRequestSummary[]
  activeRequestByDoc: Record<string, { request_id: string; sent_at: string; status: EvidenceRequestItemStatus; replied_at: string | null }>
  createEvidenceRequestAction: (
    vendorId: string,
    input: {
      vendorDocumentIds: string[]
      message: string | null
      dueDate: string | null
      recipientEmails: string[]
      expiryDays: number
    },
  ) => Promise<{ url?: string; request?: EvidenceRequest; message?: string }>
  cancelEvidenceRequestAction: (
    vendorId: string,
    requestId: string,
  ) => Promise<{ success?: boolean; message?: string }>
  deleteEvidenceRequestAction: (
    vendorId: string,
    requestId: string,
  ) => Promise<{ success?: boolean; message?: string }>
  issueCounts: VendorIssueCounts
  vendorId: string
  vendorReviews: VendorReview[]
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
  assignments,
  availablePacks,
  assignPackAction,
  removePackAction,
  uploadEvidenceAction,
  setEvidenceStatusAction,
  requestEvidenceAction,
  getEvidenceVersionsAction,
  getEvidenceDownloadAction,
  evidenceRequests,
  activeRequestByDoc,
  createEvidenceRequestAction,
  cancelEvidenceRequestAction,
  deleteEvidenceRequestAction,
  issueCounts,
  vendorId,
  vendorReviews,
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
                  : { color: '#6b5fa8', borderColor: 'transparent' }
              }
            >
              {tab.label}
              {tab.id === 'reviews' && vendorReviews.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: 'rgba(109,93,211,0.1)', color: '#6b5fa8' }}
                >
                  {vendorReviews.length}
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
              {tab.id === 'incidents' && incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed').length > 0 && (
                <span className="text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full leading-none">
                  {incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed').length}
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
        />
      )}
      {active === 'reviews' && (
        <ReviewsTab
          vendorId={vendor.id}
          assignments={assignments}
          reviewPacks={reviewPacks}
          availablePacks={availablePacks}
          assignPackAction={assignPackAction}
          removePackAction={removePackAction}
          vendorReviews={vendorReviews}
        />
      )}
      {active === 'evidence' && (
        <EvidenceTab
          vendorId={vendor.id}
          vendorName={vendor.name}
          vendorPrimaryEmail={vendor.primary_email ?? null}
          groups={evidenceGroups}
          requests={evidenceRequests}
          activeRequestByDoc={activeRequestByDoc}
          uploadEvidenceAction={uploadEvidenceAction}
          setEvidenceStatusAction={setEvidenceStatusAction}
          requestEvidenceAction={requestEvidenceAction}
          getVersionsAction={getEvidenceVersionsAction}
          getDownloadUrlAction={getEvidenceDownloadAction}
          createRequestAction={createEvidenceRequestAction}
          cancelRequestAction={cancelEvidenceRequestAction}
          deleteRequestAction={deleteEvidenceRequestAction}
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
}: {
  vendor: Vendor
  currentRole: OrgRole
  deleteVendorAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  documents: VendorDocumentsData
  issueCounts: VendorIssueCounts
  vendorId: string
  onSwitchTab: (tab: Tab) => void
}) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: <VendorStatusBadge status={vendor.status} /> },
    { label: 'Categories', value: vendor.vendor_categories.length > 0 ? vendor.vendor_categories.map((c) => c.name).join(', ') : '—' },
    { label: 'Internal Owner', value: vendor.internal_owner?.name ?? vendor.internal_owner?.email ?? '—' },
    {
      label: 'Criticality',
      value: vendor.criticality_tier != null ? ({
        1: 'Tier 1 — Low',
        2: 'Tier 2 — Medium',
        3: 'Tier 3 — High',
        4: 'Tier 4 — Critical',
        5: 'Tier 5 — Very Critical',
      } as Record<number, string>)[vendor.criticality_tier] ?? `Tier ${vendor.criticality_tier}` : '—',
    },
    {
      label: 'Critical',
      value: vendor.is_critical ? (
        <span className="text-amber-500 font-semibold">Yes ★</span>
      ) : 'No',
    },
    { label: 'Legal Name', value: vendor.legal_name ?? '—' },
    { label: 'Website', value: vendor.website_url ?? '—' },
    { label: 'Primary Email', value: vendor.primary_email ?? '—' },
    { label: 'Phone', value: vendor.phone ?? '—' },
    { label: 'Country', value: getCountryName(vendor.country_code) ?? '—' },
    {
      label: 'Next Review',
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

  return (
    <div className="space-y-4">
      {/* Vendor details — always visible 2-col grid */}
      <div
        className="rounded-2xl"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.07)' }}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
            Vendor Details
          </h3>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/vendors/${vendor.id}/edit`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
              style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 2l3 3-9 9H2v-3z" />
              </svg>
              Edit
            </Link>
            {currentRole === 'site_admin' && (
              <VendorOverflowMenu deleteAction={deleteVendorAction} />
            )}
          </div>
        </div>

        <dl className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          {fields.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b5fa8' }}>{label}</dt>
              <dd className="text-sm font-medium mt-1 truncate" style={{ color: '#1e1550' }} title={typeof value === 'string' ? value : undefined}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

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
        <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white">
          <p className="text-xs" style={{ color: '#6b5fa8' }}>No issues tracked for this vendor.</p>
          <Link
            href={`/issues/new?vendor_id=${vendorId}`}
            className="text-xs font-medium px-3 py-1 rounded-full transition-all hover:opacity-80 shrink-0"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
          >
            + Track issue
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-5 px-4 py-2 bg-white">
          {[
            { label: 'Total', value: total, color: '#4a4270' },
            { label: 'Open', value: open, color: '#d97706' },
            { label: 'In Progress', value: in_progress, color: '#2563eb' },
            { label: 'Overdue', value: overdue, color: overdue > 0 ? '#e11d48' : '#6b5fa8' },
            { label: 'Critical', value: critical, color: critical > 0 ? '#e11d48' : '#6b5fa8' },
            { label: 'High', value: high, color: high > 0 ? '#ea580c' : '#6b5fa8' },
          ].map(s => (
            <div key={s.label} className="text-center min-w-[40px]">
              <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs uppercase tracking-wider font-medium" style={{ color: '#6b5fa8' }}>{s.label}</div>
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

// ─── Vendor overflow menu (kebab) ─────────────────────────────────────────────

function VendorOverflowMenu({
  deleteAction,
}: {
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(deleteAction, {})
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(109,93,211,0.08)]"
        style={{ color: '#6b5fa8' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
          style={{ minWidth: 200, background: 'white', border: '1px solid rgba(108,93,211,0.18)', boxShadow: '0 8px 24px rgba(30,21,80,0.12)' }}
        >
          <div
            className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: '#6b5fa8', borderBottom: '1px solid rgba(108,93,211,0.06)' }}
          >
            Danger zone
          </div>
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!confirm('Delete this vendor? This can only be undone by a database admin.')) {
                e.preventDefault()
              } else {
                setOpen(false)
              }
            }}
          >
            <button
              type="submit"
              disabled={isPending}
              className="w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-2"
              style={{ color: '#e11d48' }}
            >
              {isPending && <Spinner />}
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l1 9.5a1 1 0 001 .9h2a1 1 0 001-.9L11 4" />
              </svg>
              {isPending ? 'Deleting…' : 'Delete vendor'}
            </button>
            {state.message && <p className="px-3 pb-2 text-xs text-rose-600">{state.message}</p>}
          </form>
        </div>
      )}
    </div>
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
