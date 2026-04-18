'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import { createVendorReview } from '@/lib/db/vendor-reviews'
import type { ReviewType } from '@/types/review-pack'

/**
 * Create a new vendor review with one or more packs.
 * Creates a vendor_reviews row and links/creates vendor_review_packs for each pack.
 */
export async function createReviewAction(input: {
  vendorId: string
  packIds: string[]
  reviewType?: ReviewType
  reviewerUserId: string | null
  approverUserId: string | null
  dueAt: string | null
}): Promise<{ success?: boolean; reviewId?: string; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    if (!input.packIds || input.packIds.length === 0) {
      return { message: 'At least one review pack must be selected.' }
    }

    // Verify vendor belongs to this org
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', input.vendorId)
      .eq('org_id', user.orgId)
      .maybeSingle()
    if (!vendor) return { message: 'Vendor not found' }

    // Create the vendor review with linked packs
    const review = await createVendorReview({
      orgId: user.orgId,
      vendorId: input.vendorId,
      reviewType: input.reviewType ?? 'on_demand',
      reviewerUserId: input.reviewerUserId,
      approverUserId: input.approverUserId,
      dueAt: input.dueAt,
      createdByUserId: user.userId,
      packIds: input.packIds,
    })

    await logActivity({
      orgId: user.orgId,
      vendorId: input.vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review',
      entityId: review.id,
      action: 'review_created',
      title: `New review created (${review.review_code})`,
    })

    revalidatePath('/reviews')
    revalidatePath(`/vendors/${input.vendorId}`)
    return { success: true, reviewId: review.id }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create review' }
  }
}
