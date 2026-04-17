'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Bulk assign reviewer to multiple vendor_review_packs.
 */
export async function bulkAssignReviewerAction(
  vrpIds: string[],
  reviewerUserId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()
    for (const vrpId of vrpIds) {
      await supabase
        .from('vendor_review_packs')
        .update({ reviewer_user_id: reviewerUserId })
        .eq('id', vrpId)
        .eq('org_id', user.orgId)
    }
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to assign' }
  }
}

/**
 * Bulk assign approver to multiple vendor_review_packs.
 */
export async function bulkAssignApproverAction(
  vrpIds: string[],
  approverUserId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()
    for (const vrpId of vrpIds) {
      await supabase
        .from('vendor_review_packs')
        .update({ approver_user_id: approverUserId })
        .eq('id', vrpId)
        .eq('org_id', user.orgId)
    }
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to assign' }
  }
}

/**
 * Bulk start reviews — change status from not_started/upcoming to in_progress.
 */
export async function bulkStartReviewsAction(
  vrpIds: string[],
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()
    for (const vrpId of vrpIds) {
      await supabase
        .from('vendor_review_packs')
        .update({ status: 'in_progress' })
        .eq('id', vrpId)
        .eq('org_id', user.orgId)
        .in('status', ['not_started', 'upcoming'])
    }
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to start reviews' }
  }
}
