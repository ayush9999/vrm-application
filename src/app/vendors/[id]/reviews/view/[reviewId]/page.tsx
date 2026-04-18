import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReview } from '@/lib/db/vendor-reviews'
import { getVendorReviewItems } from '@/lib/db/review-packs'
import { getOrgUsers } from '@/lib/db/organizations'
import { ReviewWorkspace } from './_components/ReviewWorkspace'
import {
  setReviewItemDecisionAction,
  aiAssistReviewItemAction,
  startVendorReviewAction,
  submitVendorReviewForApprovalAction,
  approveVendorReviewAction,
} from '../../../reviews/actions'
import { uploadEvidenceFileAction } from '../../../evidence-actions'
import type { VendorReviewItem } from '@/types/review-pack'

interface PageProps {
  params: Promise<{ id: string; reviewId: string }>
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id: vendorId, reviewId } = await params
  const user = await requireCurrentUser()

  const [vendor, review, orgUsers] = await Promise.all([
    getVendorById(user.orgId, vendorId),
    getVendorReview(reviewId),
    getOrgUsers(user.orgId),
  ])
  if (!vendor || !review) notFound()

  const packs = review.packs ?? []

  // Fetch items for all packs in parallel
  const packItemsMap: Record<string, VendorReviewItem[]> = {}
  const allPackItems = await Promise.all(
    packs.map((p) => getVendorReviewItems(p.id)),
  )
  packs.forEach((p, i) => {
    packItemsMap[p.id] = allPackItems[i]
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/vendors" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Vendors</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>{vendor.name}</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}?tab=reviews`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Reviews</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{review.review_code}</span>
      </div>

      <ReviewWorkspace
        vendorId={vendorId}
        review={review}
        packs={packs}
        packItemsMap={packItemsMap}
        orgUsers={orgUsers}
        setDecisionAction={setReviewItemDecisionAction}
        aiAssistAction={aiAssistReviewItemAction}
        uploadEvidenceAction={uploadEvidenceFileAction}
        startReviewAction={startVendorReviewAction}
        submitForApprovalAction={submitVendorReviewForApprovalAction}
        approveReviewAction={approveVendorReviewAction}
      />
    </div>
  )
}
