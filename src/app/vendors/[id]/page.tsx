import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorDocumentsData, getAssessmentDocRequestsForVendor } from '@/lib/db/documents'
import { getVendorDisputes } from '@/lib/db/disputes'
import { getVendorActivityLog } from '@/lib/db/activity-log'
import { computeComplianceScore, getVendorComplianceReadiness } from '@/lib/db/compliance'
import { getVendorIncidents } from '@/lib/db/incidents'
import { getVendorAssessmentFrameworks, getVendorOnboardingAssessmentId, getFrameworks } from '@/lib/db/assessments'
import { getOrgFrameworkSelections } from '@/lib/db/organizations'
import { getVendorIssueCounts } from '@/lib/db/issues'
import { VendorTabs } from './_components/VendorTabs'
import {
  uploadDocumentAction,
  addCustomDocumentAction,
  deleteDocumentAction,
  deleteCustomDocumentAction,
  createDisputeAction,
  updateDisputeStatusAction,
  createIncidentAction,
  updateIncidentAction,
  deleteIncidentAction,
  addVendorFrameworkAction,
  removeVendorFrameworkAction,
} from './actions'
import { deleteVendorAction } from '@/app/vendors/actions'
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

  const [documents, disputes, activityLog, compliance, incidents, assessmentDocRequests, frameworkReadiness, vendorFrameworks, orgStandardSelections, onboardingAssessmentId, allFrameworks, issueCounts] = await Promise.all([
    getVendorDocumentsData(user.orgId, id, vendor.category_id),
    getVendorDisputes(user.orgId, id),
    getVendorActivityLog(user.orgId, id),
    computeComplianceScore(user.orgId, id, vendor.category_id),
    getVendorIncidents(user.orgId, id),
    getAssessmentDocRequestsForVendor(user.orgId, id),
    getVendorComplianceReadiness(user.orgId, id),
    getVendorAssessmentFrameworks(user.orgId, id),
    getOrgFrameworkSelections(user.orgId),
    getVendorOnboardingAssessmentId(user.orgId, id),
    getFrameworks(user.orgId),
    getVendorIssueCounts(user.orgId, id),
  ])

  const orgStandardIds = new Set(orgStandardSelections.map(s => s.framework_id))

  const tabParam = sp.tab as
    | 'overview' | 'documents' | 'compliance' | 'incidents' | 'activity' | 'disputes'
    | undefined
  const defaultTab = tabParam ?? 'overview'

  const boundUploadDoc        = uploadDocumentAction.bind(null, id)
  const boundAddCustomDoc     = addCustomDocumentAction.bind(null, id)
  const boundDeleteDoc        = deleteDocumentAction.bind(null, id)
  const boundDeleteCustomDoc  = deleteCustomDocumentAction.bind(null, id)
  const boundCreateDispute    = createDisputeAction.bind(null, id)
  const boundDeleteVendor     = deleteVendorAction.bind(null, id)
  const boundCreateIncident   = createIncidentAction.bind(null, id)
  const boundUpdateIncident   = updateIncidentAction.bind(null, id)
  const boundDeleteIncident   = deleteIncidentAction.bind(null, id)
  const boundAddFramework     = onboardingAssessmentId
    ? addVendorFrameworkAction.bind(null, id, onboardingAssessmentId)
    : null
  const boundRemoveFramework  = onboardingAssessmentId
    ? removeVendorFrameworkAction.bind(null, id, onboardingAssessmentId)
    : null
  const statusBadge = STATUS_BADGE[vendor.status]

  // Overall compliance score from framework readiness (same logic as ComplianceTab)
  const _totalSatisfied = frameworkReadiness.reduce((s, fw) => s + fw.satisfied, 0)
  const _totalControls  = frameworkReadiness.reduce((s, fw) => s + fw.total, 0)
  const _totalAssess    = frameworkReadiness.reduce((s, fw) => s + fw.needs_assessment, 0)
  const _evaluable      = _totalControls - _totalAssess
  const overallComplianceScore = frameworkReadiness.length > 0 && _evaluable > 0
    ? Math.floor((_totalSatisfied / _evaluable) * 100)
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
            {overallComplianceScore !== null && (
              <span className="text-xs" style={{ color: '#a99fd8' }}>
                Compliance:{' '}
                <span className={`font-semibold ${
                  overallComplianceScore >= 80 ? 'text-emerald-600'
                    : overallComplianceScore >= 40 ? 'text-amber-600'
                    : 'text-rose-600'
                }`}>
                  {overallComplianceScore}%
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <VendorTabs
          vendor={vendor}
          currentRole={user.role}
          compliance={compliance}
          frameworkReadiness={frameworkReadiness}
          orgStandardIds={orgStandardIds}
          vendorFrameworks={vendorFrameworks}
          allFrameworks={allFrameworks}
          onboardingAssessmentId={onboardingAssessmentId}
          addFrameworkAction={boundAddFramework}
          removeFrameworkAction={boundRemoveFramework}
          documents={documents}
          assessmentDocRequests={assessmentDocRequests}
          disputes={disputes}
          incidents={incidents}
          activityLog={activityLog}
          defaultTab={defaultTab}
          uploadDocAction={boundUploadDoc}
          addCustomDocAction={boundAddCustomDoc}
          deleteDocAction={boundDeleteDoc}
          deleteCustomDocAction={boundDeleteCustomDoc}
          createDisputeAction={boundCreateDispute}
          updateDisputeStatusAction={updateDisputeStatusAction}
          createIncidentAction={boundCreateIncident}
          updateIncidentAction={boundUpdateIncident}
          deleteIncidentAction={boundDeleteIncident}
          deleteVendorAction={boundDeleteVendor}
          issueCounts={issueCounts}
          vendorId={id}
        />
      </div>
    </div>
  )
}
