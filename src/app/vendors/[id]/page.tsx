import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorDocumentsData, getAssessmentDocRequestsForVendor } from '@/lib/db/documents'
import { getVendorActivityLog } from '@/lib/db/activity-log'
import { getVendorIncidents } from '@/lib/db/incidents'
import { getVendorIssueCounts } from '@/lib/db/issues'
import { getVendorReviewPacks, getVendorListMetrics, getReviewPacks } from '@/lib/db/review-packs'
import { getVendorReviews } from '@/lib/db/vendor-reviews'
import { getVendorEvidenceGrouped } from '@/lib/db/evidence'
import { getVendorSnapshots } from '@/lib/db/readiness-snapshots'
import { getPeerBenchmark } from '@/lib/db/peer-benchmark'
import { VendorHeaderStats } from './_components/VendorHeaderStats'
import { ReadinessTrendChart } from './_components/ReadinessTrendChart'
import { ReadinessRadarChart } from './_components/ReadinessRadarChart'
import { VendorTabs } from './_components/VendorTabs'
import {
  createIncidentAction,
  updateIncidentAction,
  deleteIncidentAction,
} from './actions'
import {
  uploadEvidenceFileAction,
  setEvidenceStatusAction,
  requestEvidenceFromVendorAction,
  getEvidenceVersionsAction,
  getEvidenceVersionDownloadAction,
} from './evidence-actions'
import { deleteVendorAction, updateApprovalStatusAction, captureReadinessSnapshotAction } from '@/app/vendors/actions'
import { assignPackToVendorAction, removePackFromVendorAction } from './reviews/assign-action'
import { getVendorAssignedPacks } from '@/lib/db/vendor-pack-assignments'
import type { VendorStatus } from '@/types/vendor'

const STATUS_BADGE: Record<VendorStatus, { label: string; className: string }> = {
  active:       { label: 'Active',       className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  suspended:    { label: 'Suspended',    className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function VendorDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, id)
  if (!vendor) notFound()

  const tabParam = sp.tab as
    | 'overview' | 'reviews' | 'evidence' | 'incidents' | 'activity'
    | undefined
  const defaultTab = tabParam ?? 'overview'

  // Essential data (always needed for header + overview)
  const [metricsMap, snapshots, issueCounts, reviewPacks, allPacks, assignments, vendorReviews] = await Promise.all([
    getVendorListMetrics([{ id, approval_status: vendor.approval_status }]),
    getVendorSnapshots(id),
    getVendorIssueCounts(user.orgId, id),
    getVendorReviewPacks(id),
    getReviewPacks(user.orgId),
    getVendorAssignedPacks(id),
    getVendorReviews(id),
  ])
  const metrics = metricsMap.get(id)!

  // All tab data fetched in parallel — fast on direct Postgres connection
  const [documents, activityLog, incidents, assessmentDocRequests, evidenceGroups, benchmark] = await Promise.all([
    getVendorDocumentsData(user.orgId, id, vendor.category_id),
    getVendorActivityLog(user.orgId, id),
    getVendorIncidents(user.orgId, id),
    getAssessmentDocRequestsForVendor(user.orgId, id),
    getVendorEvidenceGrouped(id),
    getPeerBenchmark(user.orgId, id, vendor.category_id),
  ])

  const boundDeleteVendor     = deleteVendorAction.bind(null, id)
  const boundCreateIncident   = createIncidentAction.bind(null, id)
  const boundUpdateIncident   = updateIncidentAction.bind(null, id)
  const boundDeleteIncident   = deleteIncidentAction.bind(null, id)
  const availablePacksList = allPacks.map((p) => ({ id: p.id, name: p.name, code: p.code }))
  const statusBadge = STATUS_BADGE[vendor.status]

  return (
    <div className="px-6 py-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link
          href="/vendors"
          className="transition-colors hover:text-[#6c5dd3]"
          style={{ color: '#a99fd8' }}
        >
          Vendors
        </Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{vendor.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{vendor.name}</h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
            {vendor.is_critical && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
                ★ Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {vendor.vendor_code && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }}
              >
                {vendor.vendor_code}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Compact stats row — Readiness, Risk, Approval, Trend in one line */}
      <VendorHeaderStats
        vendorId={id}
        readinessPct={metrics.readinessPct}
        applicable={metrics.applicable}
        completed={metrics.completed}
        riskBand={metrics.risk.band}
        riskScore={metrics.risk.score}
        riskFormula={metrics.risk.formula}
        approvalStatus={vendor.approval_status}
        approvedAt={vendor.approved_at}
        exceptionReason={vendor.exception_reason}
        updateApprovalStatusAction={updateApprovalStatusAction}
        snapshots={snapshots}
        currentReadinessPct={metrics.readinessPct}
        captureSnapshotAction={captureReadinessSnapshotAction}
        reviewPacks={reviewPacks}
        benchmark={benchmark}
      />

      {/* Tabs */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <VendorTabs
          vendor={vendor}
          currentRole={user.role}
          documents={documents}
          assessmentDocRequests={assessmentDocRequests}
          incidents={incidents}
          activityLog={activityLog}
          reviewPacks={reviewPacks}
          evidenceGroups={evidenceGroups}
          defaultTab={defaultTab}
          createIncidentAction={boundCreateIncident}
          updateIncidentAction={boundUpdateIncident}
          deleteIncidentAction={boundDeleteIncident}
          deleteVendorAction={boundDeleteVendor}
          assignments={assignments}
          availablePacks={availablePacksList}
          assignPackAction={assignPackToVendorAction}
          removePackAction={removePackFromVendorAction}
          uploadEvidenceAction={uploadEvidenceFileAction}
          setEvidenceStatusAction={setEvidenceStatusAction}
          requestEvidenceAction={requestEvidenceFromVendorAction}
          getEvidenceVersionsAction={getEvidenceVersionsAction}
          getEvidenceDownloadAction={getEvidenceVersionDownloadAction}
          issueCounts={issueCounts}
          vendorId={id}
          vendorReviews={vendorReviews}
        />
      </div>
    </div>
  )
}
