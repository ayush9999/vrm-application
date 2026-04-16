'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import {
  createCustomReviewPack,
  type CustomEvidenceReqInput,
  type CustomReviewReqInput,
} from '@/lib/db/review-packs'
import type { ApplicabilityRules } from '@/types/review-pack'

/** Archive (deactivate) a custom Review Pack. Standard packs can't be archived. */
export async function archiveReviewPackAction(
  packId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const { data: pack } = await supabase
      .from('review_packs')
      .select('id, org_id, name, source_type')
      .eq('id', packId)
      .maybeSingle()

    if (!pack) return { message: 'Review pack not found' }
    if (pack.source_type === 'standard') {
      return { message: 'Standard packs cannot be archived. Duplicate it as a custom pack first.' }
    }
    if (pack.org_id !== user.orgId) return { message: 'Permission denied' }

    const { error } = await supabase
      .from('review_packs')
      .update({ is_active: false })
      .eq('id', packId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      actorUserId: user.userId,
      entityType: 'review_pack',
      entityId: packId,
      action: 'review_pack_archived',
      title: `Review pack "${pack.name}" archived`,
    })

    revalidatePath('/settings/review-packs')
    revalidatePath(`/settings/review-packs/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to archive pack' }
  }
}

/** Restore (re-activate) an archived custom Review Pack. */
export async function restoreReviewPackAction(
  packId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const { data: pack } = await supabase
      .from('review_packs')
      .select('id, org_id, name')
      .eq('id', packId)
      .maybeSingle()
    if (!pack) return { message: 'Review pack not found' }
    if (pack.org_id !== user.orgId) return { message: 'Permission denied' }

    const { error } = await supabase
      .from('review_packs')
      .update({ is_active: true })
      .eq('id', packId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      actorUserId: user.userId,
      entityType: 'review_pack',
      entityId: packId,
      action: 'review_pack_restored',
      title: `Review pack "${pack.name}" restored`,
    })

    revalidatePath('/settings/review-packs')
    revalidatePath(`/settings/review-packs/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to restore pack' }
  }
}

/** Create a brand-new custom Review Pack with its evidence + review requirements. */
export async function createCustomPackAction(input: {
  name: string
  description: string | null
  applicability_rules: ApplicabilityRules
  review_cadence: 'annual' | 'biannual' | 'on_incident' | 'on_renewal'
  evidence_requirements: CustomEvidenceReqInput[]
  review_requirements: CustomReviewReqInput[]
}): Promise<{ message?: string; packId?: string }> {
  let packId: string | undefined
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can create review packs.' }
    if (!input.name?.trim()) return { message: 'Name is required' }

    const { packId: id } = await createCustomReviewPack({
      orgId: user.orgId,
      name: input.name.trim(),
      description: input.description,
      applicabilityRules: input.applicability_rules,
      reviewCadence: input.review_cadence,
      evidenceRequirements: input.evidence_requirements,
      reviewRequirements: input.review_requirements,
      createdByUserId: user.userId,
    })
    packId = id

    await logActivity({
      orgId: user.orgId,
      actorUserId: user.userId,
      entityType: 'review_pack',
      entityId: id,
      action: 'review_pack_created',
      title: `Custom review pack "${input.name}" created`,
    })

    revalidatePath('/settings/review-packs')
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create pack' }
  }
  if (packId) redirect(`/settings/review-packs/${packId}`)
  return { packId }
}

/** Soft-delete a custom Review Pack (hard removal from list, can be recovered by DB admin). */
export async function deleteReviewPackAction(
  packId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') {
      return { message: 'Only site admins can delete review packs.' }
    }
    const supabase = await createServerClient()

    const { data: pack } = await supabase
      .from('review_packs')
      .select('id, org_id, name, source_type')
      .eq('id', packId)
      .maybeSingle()
    if (!pack) return { message: 'Review pack not found' }
    if (pack.source_type === 'standard') return { message: 'Standard packs cannot be deleted.' }
    if (pack.org_id !== user.orgId) return { message: 'Permission denied' }

    const { error } = await supabase
      .from('review_packs')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', packId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    await logActivity({
      orgId: user.orgId,
      actorUserId: user.userId,
      entityType: 'review_pack',
      entityId: packId,
      action: 'review_pack_deleted',
      title: `Review pack "${pack.name}" deleted`,
    })

    revalidatePath('/settings/review-packs')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete pack' }
  }
}
