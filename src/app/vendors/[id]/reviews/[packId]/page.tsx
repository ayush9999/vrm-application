import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewItems, getVendorListMetrics, getPreviousReviewDecisions } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import { createServerClient } from '@/lib/supabase/server'
import { ReviewPackClient } from './_components/ReviewPackClient'
import { PortalPanel } from './_components/PortalPanel'
import { ApprovalChain } from './_components/ApprovalChain'
import { ReviewAssignment } from '../_components/ReviewAssignment'
import {
  setReviewItemDecisionAction,
  aiAssistReviewItemAction,
  createPortalLinkAction,
  revokePortalLinkAction,
  createExceptionAction,
  addReviewCommentAction,
  getReviewCommentsAction,
  exportReviewCsvAction,
} from './actions'
import { ExportButton } from './_components/ExportButton'
import { ComplianceControlsSection } from './_components/ComplianceControlsSection'
import { ReviewStatusBar } from './_components/ReviewStatusBar'
import {
  assignReviewUsersAction,
  startReviewAction,
  submitReviewForApprovalAction,
  approveReviewAction,
  reopenReviewAction,
} from '../actions'
import { uploadEvidenceFileAction } from '../../evidence-actions'
import { listPortalLinks } from '@/lib/db/vendor-portal'
import { getOrgUsers } from '@/lib/db/organizations'

interface PageProps {
  params: Promise<{ id: string; packId: string }>
}

export default async function ReviewPackDetailPage({ params }: PageProps) {
  const { id: vendorId, packId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  // Fetch the vendor_review_pack + parent review_pack
  const supabase = await createServerClient()
  const { data: vrp } = await supabase
    .from('vendor_review_packs')
    .select(`
      *,
      review_packs!inner ( id, name, code, description )
    `)
    .eq('id', packId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!vrp) notFound()

  const items = await getVendorReviewItems(packId)
  const pack = (vrp as { review_packs: { id: string; name: string; code: string | null; description: string | null } }).review_packs

  // Pre-fill: load decisions from the most recent completed review of the same pack
  const previousDecisions = await getPreviousReviewDecisions(vendorId, pack.id, packId)
  // Serialize the Map for the client component
  const prefillData: Record<string, { decision: string; comment: string | null; decided_at: string | null }> = {}
  for (const [reqId, d] of previousDecisions) {
    prefillData[reqId] = d
  }

  // Vendor-level risk + readiness for the header badges
  const metricsMap = await getVendorListMetrics([{ id: vendorId, approval_status: vendor.approval_status }])
  const m = metricsMap.get(vendorId)
  const riskStyle = m ? RISK_BAND_STYLE[m.risk.band] : null

  // Portal links + org users + approval records
  const [portalLinks, orgUsers, approvalsRes] = await Promise.all([
    listPortalLinks(packId),
    getOrgUsers(user.orgId),
    supabase
      .from('review_approvals')
      .select(`
        id, level, user_id, decision, comment, decided_at,
        users!inner ( name, email )
      `)
      .eq('vendor_review_pack_id', packId)
      .order('decided_at'),
  ])
  const approvals = ((approvalsRes.data ?? []) as unknown as Array<{
    id: string; level: number; user_id: string; decision: string; comment: string | null; decided_at: string
    users: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
  }>).map((a) => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users
    return { ...a, user_name: u?.name ?? u?.email ?? null, users: undefined }
  })
  const vrpRow = vrp as unknown as {
    status: import('@/types/review-pack').VendorReviewPackStatus
    reviewer_user_id: string | null
    approver_user_id: string | null
    locked_at: string | null
    locked_by_user_id: string | null
    reopen_reason: string | null
  }
  const lockedByName = vrpRow.locked_by_user_id
    ? orgUsers.find((u) => u.id === vrpRow.locked_by_user_id)?.name ?? null
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb + Export */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
          <Link href="/reviews" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Reviews</Link>
          <span>/</span>
          <Link href={`/reviews/${vendorId}`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>{vendor.name}</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: '#1e1550' }}>{pack.name}</span>
        </div>
        <ExportButton vendorId={vendorId} packId={packId} exportAction={exportReviewCsvAction} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{pack.name}</h1>
            {pack.description && (
              <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>{pack.description}</p>
            )}
          </div>
          {/* Vendor-level summary badges */}
          {m && riskStyle && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                  Vendor Risk
                </div>
                <span
                  className="inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{ background: riskStyle.bg, color: riskStyle.color }}
                  title={m.risk.formula}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskStyle.dot }} />
                  {riskStyle.label} · {m.risk.score}
                </span>
              </div>
              <div className="h-10 w-px" style={{ background: 'rgba(109,93,211,0.1)' }} />
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                  Vendor Readiness
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: '#1e1550' }}>
                  {m.readinessPct}% · {m.completed} / {m.applicable}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar with primary action */}
      <ReviewStatusBar
        vendorId={vendorId}
        packId={packId}
        status={vrpRow.status}
        lockedAt={vrpRow.locked_at}
        lockedByName={lockedByName}
        reviewerName={orgUsers.find((u) => u.id === vrpRow.reviewer_user_id)?.name ?? null}
        approverName={orgUsers.find((u) => u.id === vrpRow.approver_user_id)?.name ?? null}
        startReviewAction={startReviewAction}
        submitForApprovalAction={submitReviewForApprovalAction}
        approveReviewAction={approveReviewAction}
      />

      {/* Assignment + Portal */}
      <div className="mb-4 space-y-3">
        <div
          className="rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
        >
          <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6c5dd3' }}>Assignment</div>
          <ReviewAssignment
            vendorId={vendorId}
            vendorReviewPackId={packId}
            currentReviewerId={vrpRow.reviewer_user_id}
            currentApproverId={vrpRow.approver_user_id}
            users={orgUsers}
            assignAction={assignReviewUsersAction}
          />
        </div>

        <PortalPanel
          vendorId={vendorId}
          vendorReviewPackId={packId}
          initialLinks={portalLinks}
          createAction={createPortalLinkAction}
          revokeAction={revokePortalLinkAction}
        />
      </div>

      <ReviewPackClient
        vendorId={vendorId}
        packId={packId}
        items={items}
        prefillData={prefillData}
        setDecisionAction={setReviewItemDecisionAction}
        aiAssistAction={aiAssistReviewItemAction}
        uploadEvidenceAction={uploadEvidenceFileAction}
        createExceptionAction={createExceptionAction}
        addCommentAction={addReviewCommentAction}
        getCommentsAction={getReviewCommentsAction}
        orgUsers={orgUsers}
      />

      {/* Compliance controls (expandable) */}
      <div className="mt-4">
        <ComplianceControlsSection items={items} />
      </div>

      {/* Approval chain */}
      <div className="mt-4">
        <ApprovalChain
          vendorId={vendorId}
          vendorReviewPackId={packId}
          status={vrpRow.status}
          lockedAt={vrpRow.locked_at}
          lockedByName={lockedByName}
          reopenReason={vrpRow.reopen_reason}
          approvals={approvals}
          isSiteAdmin={user.role === 'site_admin'}
          submitForApprovalAction={submitReviewForApprovalAction}
          approveReviewAction={approveReviewAction}
          reopenReviewAction={reopenReviewAction}
        />
      </div>
    </div>
  )
}
