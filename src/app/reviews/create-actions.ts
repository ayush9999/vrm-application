'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import type { ReviewItemDecision } from '@/types/review-pack'

/**
 * Manually create a new vendor review pack instance.
 * Generates vendor_review_items for every requirement in the pack.
 */
export async function createReviewAction(input: {
  vendorId: string
  reviewPackId: string
  reviewerUserId: string | null
  approverUserId: string | null
  dueAt: string | null
}): Promise<{ success?: boolean; vrpId?: string; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    // Verify vendor belongs to this org
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', input.vendorId)
      .eq('org_id', user.orgId)
      .maybeSingle()
    if (!vendor) return { message: 'Vendor not found' }

    // Check if this vendor already has an active review for this pack
    const { data: existing } = await supabase
      .from('vendor_review_packs')
      .select('id, status')
      .eq('vendor_id', input.vendorId)
      .eq('review_pack_id', input.reviewPackId)
      .in('status', ['not_started', 'in_progress', 'awaiting_approval', 'sent_back'])
      .is('deleted_at', null)
      .maybeSingle()
    if (existing) {
      return { message: 'This vendor already has an active review for this pack. Complete or archive it first.' }
    }

    // Create the vendor_review_pack
    const { data: vrp, error: vrpErr } = await supabase
      .from('vendor_review_packs')
      .insert({
        org_id: user.orgId,
        vendor_id: input.vendorId,
        review_pack_id: input.reviewPackId,
        status: 'in_progress',
        review_type: 'on_demand',
        reviewer_user_id: input.reviewerUserId,
        approver_user_id: input.approverUserId,
        due_at: input.dueAt,
        created_by_user_id: user.userId,
      })
      .select('id')
      .single()
    if (vrpErr) throw new Error(vrpErr.message)

    // Create vendor_review_items for all requirements in this pack
    const { data: reqs } = await supabase
      .from('review_requirements')
      .select('id')
      .eq('review_pack_id', input.reviewPackId)
      .is('deleted_at', null)

    if (reqs && reqs.length > 0) {
      const items = (reqs as { id: string }[]).map((req) => ({
        org_id: user.orgId,
        vendor_review_pack_id: (vrp as { id: string }).id,
        review_requirement_id: req.id,
        decision: 'not_started' as ReviewItemDecision,
      }))
      const { error: itemErr } = await supabase.from('vendor_review_items').insert(items)
      if (itemErr) throw new Error(itemErr.message)
    }

    await logActivity({
      orgId: user.orgId,
      vendorId: input.vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: (vrp as { id: string }).id,
      action: 'review_created',
      title: 'New review created manually',
    })

    revalidatePath('/reviews')
    revalidatePath(`/reviews/${input.vendorId}`)
    return { success: true, vrpId: (vrp as { id: string }).id }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create review' }
  }
}
