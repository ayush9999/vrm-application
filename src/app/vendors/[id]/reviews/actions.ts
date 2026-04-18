'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import { updateReviewStatus } from '@/lib/db/vendor-reviews'

/**
 * Start a review — move from not_started/upcoming to in_progress.
 */
export async function startReviewAction(
  vendorId: string,
  vendorReviewPackId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('vendor_review_packs')
      .update({ status: 'in_progress' })
      .eq('id', vendorReviewPackId)
      .eq('org_id', user.orgId)
      .in('status', ['not_started', 'upcoming'])
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: vendorReviewPackId,
      action: 'review_started',
      title: 'Review started',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to start review' }
  }
}

/**
 * Assign reviewer and/or approver to a vendor review pack.
 */
export async function assignReviewUsersAction(
  vendorId: string,
  vendorReviewPackId: string,
  reviewerUserId: string | null,
  approverUserId: string | null,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const update: Record<string, unknown> = {}
    if (reviewerUserId !== undefined) update.reviewer_user_id = reviewerUserId
    if (approverUserId !== undefined) update.approver_user_id = approverUserId

    const { error } = await supabase
      .from('vendor_review_packs')
      .update(update)
      .eq('id', vendorReviewPackId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: vendorReviewPackId,
      action: 'reviewer_assigned',
      title: 'Reviewer/approver assignment updated',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to assign' }
  }
}

/**
 * Submit review for approval — reviewer marks it done.
 */
export async function submitReviewForApprovalAction(
  vendorId: string,
  vendorReviewPackId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const { error: statusErr } = await supabase
      .from('vendor_review_packs')
      .update({ status: 'awaiting_approval' })
      .eq('id', vendorReviewPackId)
      .eq('org_id', user.orgId)
    if (statusErr) throw new Error(statusErr.message)

    // Log the approval step
    const { error: approvalErr } = await supabase
      .from('review_approvals')
      .insert({
        org_id: user.orgId,
        vendor_review_pack_id: vendorReviewPackId,
        level: 1,
        user_id: user.userId,
        decision: 'submitted',
        comment: null,
      })
    if (approvalErr) throw new Error(approvalErr.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: vendorReviewPackId,
      action: 'review_submitted_for_approval',
      title: 'Review submitted for approval',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to submit' }
  }
}

/**
 * Approver makes a decision on a submitted review.
 */
export async function approveReviewAction(
  vendorId: string,
  vendorReviewPackId: string,
  decision: 'approved' | 'approved_with_exception' | 'sent_back',
  comment: string | null,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    let newStatus: string
    if (decision === 'approved') newStatus = 'approved'
    else if (decision === 'approved_with_exception') newStatus = 'approved_with_exception'
    else newStatus = 'sent_back'

    const update: Record<string, unknown> = { status: newStatus }
    if (decision === 'approved' || decision === 'approved_with_exception') {
      update.completed_at = new Date().toISOString()
      update.locked_at = new Date().toISOString()
      update.locked_by_user_id = user.userId
    }

    const { error: statusErr } = await supabase
      .from('vendor_review_packs')
      .update(update)
      .eq('id', vendorReviewPackId)
      .eq('org_id', user.orgId)
    if (statusErr) throw new Error(statusErr.message)

    // Log the approval record
    const { error: approvalErr } = await supabase
      .from('review_approvals')
      .insert({
        org_id: user.orgId,
        vendor_review_pack_id: vendorReviewPackId,
        level: 2,
        user_id: user.userId,
        decision,
        comment,
      })
    if (approvalErr) throw new Error(approvalErr.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: vendorReviewPackId,
      action: decision === 'sent_back' ? 'review_sent_back' : 'review_approved',
      title: decision === 'sent_back'
        ? 'Review sent back for revision'
        : `Review ${decision.replace(/_/g, ' ')}`,
      description: comment,
    })

    // If approved, auto-schedule next review based on cadence
    if (decision === 'approved' || decision === 'approved_with_exception') {
      try {
        const { data: vrp } = await supabase
          .from('vendor_review_packs')
          .select(`
            id, vendor_id, review_pack_id, reviewer_user_id, approver_user_id, org_id,
            review_packs!inner ( review_cadence )
          `)
          .eq('id', vendorReviewPackId)
          .maybeSingle()

        if (vrp) {
          const raw = vrp as unknown as {
            vendor_id: string; review_pack_id: string
            reviewer_user_id: string | null; approver_user_id: string | null
            org_id: string
            review_packs: { review_cadence: string } | { review_cadence: string }[] | null
          }
          const packData = Array.isArray(raw.review_packs) ? raw.review_packs[0] : raw.review_packs
          const cadence = packData?.review_cadence

          let nextDueMs: number | null = null
          const now = Date.now()
          if (cadence === 'annual') nextDueMs = now + 365 * 86_400_000
          else if (cadence === 'biannual') nextDueMs = now + 182 * 86_400_000
          else if (cadence === 'quarterly') nextDueMs = now + 91 * 86_400_000

          if (nextDueMs) {
            // Only schedule if the pack is still in the vendor's assignments
            const { data: assignment } = await supabase
              .from('vendor_pack_assignments')
              .select('id')
              .eq('vendor_id', raw.vendor_id)
              .eq('review_pack_id', raw.review_pack_id)
              .is('removed_at', null)
              .maybeSingle()

            if (assignment) {
              // Check if an upcoming review already exists
              const { data: existing } = await supabase
                .from('vendor_review_packs')
                .select('id')
                .eq('vendor_id', raw.vendor_id)
                .eq('review_pack_id', raw.review_pack_id)
                .eq('status', 'upcoming')
                .is('deleted_at', null)
                .maybeSingle()

              if (!existing) {
                await supabase.from('vendor_review_packs').insert({
                  org_id: raw.org_id,
                  vendor_id: raw.vendor_id,
                  review_pack_id: raw.review_pack_id,
                  status: 'upcoming',
                  review_type: 'scheduled',
                  due_at: new Date(nextDueMs).toISOString(),
                  reviewer_user_id: raw.reviewer_user_id,
                  approver_user_id: raw.approver_user_id,
                })
              }
            }
          }
        }
      } catch {
        // Non-critical — scheduling failure doesn't block approval
      }

      // Capture readiness snapshot
      try {
        const { captureReadinessSnapshot } = await import('@/lib/db/readiness-snapshots')
        const { data: vendor } = await supabase
          .from('vendors')
          .select('approval_status')
          .eq('id', vendorId)
          .maybeSingle()
        if (vendor) {
          await captureReadinessSnapshot({
            orgId: user.orgId,
            vendorId,
            approvalStatus: (vendor as { approval_status: string }).approval_status as import('@/types/review-pack').VendorApprovalStatus,
            trigger: 'pack_completed',
            triggerUserId: user.userId,
            notes: `Review pack ${decision.replace(/_/g, ' ')}`,
          })
        }
      } catch {
        // Non-critical
      }
    }

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to process approval' }
  }
}

/**
 * Reopen a locked review (admin/senior only).
 */
export async function reopenReviewAction(
  vendorId: string,
  vendorReviewPackId: string,
  reason: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can reopen locked reviews.' }
    if (!reason.trim()) return { message: 'A reason is required to reopen a locked review.' }

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('vendor_review_packs')
      .update({
        status: 'in_progress',
        locked_at: null,
        locked_by_user_id: null,
        reopened_at: new Date().toISOString(),
        reopened_by_user_id: user.userId,
        reopen_reason: reason.trim(),
      })
      .eq('id', vendorReviewPackId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review_pack',
      entityId: vendorReviewPackId,
      action: 'review_reopened',
      title: 'Locked review reopened',
      description: reason.trim(),
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to reopen' }
  }
}

// ─── Review-level actions (vendor_reviews) ─────────────────────────────────

/**
 * Start a review at the vendor_reviews level — sets status to in_progress
 * and starts all non-excluded child packs.
 */
export async function startVendorReviewAction(
  vendorId: string,
  vendorReviewId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    // Update vendor_reviews status
    await updateReviewStatus(vendorReviewId, 'in_progress', {
      started_at: new Date().toISOString(),
    })

    // Set all non-excluded child packs to in_progress
    const { error: packErr } = await supabase
      .from('vendor_review_packs')
      .update({ status: 'in_progress' })
      .eq('vendor_review_id', vendorReviewId)
      .eq('org_id', user.orgId)
      .eq('is_excluded', false)
      .in('status', ['not_started', 'upcoming'])
      .is('deleted_at', null)
    if (packErr) throw new Error(packErr.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review',
      entityId: vendorReviewId,
      action: 'review_started',
      title: 'Review started',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to start review' }
  }
}

/**
 * Submit a review for approval at the vendor_reviews level.
 */
export async function submitVendorReviewForApprovalAction(
  vendorId: string,
  vendorReviewId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()

    await updateReviewStatus(vendorReviewId, 'submitted', {
      submitted_at: new Date().toISOString(),
    })

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review',
      entityId: vendorReviewId,
      action: 'review_submitted_for_approval',
      title: 'Review submitted for approval',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to submit review' }
  }
}

/**
 * Approve or reject a review at the vendor_reviews level.
 * Locks all child packs on approval.
 */
export async function approveVendorReviewAction(
  vendorId: string,
  vendorReviewId: string,
  decision: 'approved' | 'approved_with_exception',
  comment: string | null,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const now = new Date().toISOString()

    // Update vendor_reviews status
    await updateReviewStatus(vendorReviewId, decision, {
      completed_at: now,
      locked_at: now,
      locked_by_user_id: user.userId,
    })

    // Lock all child packs
    const { error: packErr } = await supabase
      .from('vendor_review_packs')
      .update({
        status: decision,
        completed_at: now,
        locked_at: now,
        locked_by_user_id: user.userId,
      })
      .eq('vendor_review_id', vendorReviewId)
      .eq('org_id', user.orgId)
      .eq('is_excluded', false)
      .is('deleted_at', null)
    if (packErr) throw new Error(packErr.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review',
      entityId: vendorReviewId,
      action: 'review_approved',
      title: `Review ${decision.replace(/_/g, ' ')}`,
      description: comment,
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to approve review' }
  }
}

/**
 * Reopen a review at the vendor_reviews level — sets status back to in_progress
 * and clears submitted_at.
 */
export async function reopenVendorReviewAction(
  vendorId: string,
  vendorReviewId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()

    await updateReviewStatus(vendorReviewId, 'in_progress', {
      submitted_at: null,
    })

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_review',
      entityId: vendorReviewId,
      action: 'review_reopened',
      title: 'Review reopened',
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/reviews')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to reopen review' }
  }
}

// ─── Re-export item-level actions for use in review workspace ──────────────
// These live in [packId]/actions.ts but are needed by the review-level page too.

export {
  setReviewItemDecisionAction,
  aiAssistReviewItemAction,
} from './[packId]/actions'
