'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import {
  createCustomReviewPack,
  duplicatePackAsCustom,
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

/** Duplicate any pack (standard or custom) as a new editable custom pack. */
export async function duplicatePackAction(
  sourcePackId: string,
): Promise<{ packId?: string; message?: string }> {
  let newPackId: string | undefined
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can duplicate review packs.' }

    const supabase = await createServerClient()
    const { data: src } = await supabase
      .from('review_packs')
      .select('name')
      .eq('id', sourcePackId)
      .maybeSingle()
    if (!src) return { message: 'Source pack not found' }

    const newName = `${(src as { name: string }).name} (Copy)`
    newPackId = await duplicatePackAsCustom(sourcePackId, user.orgId, newName, user.userId)

    await logActivity({
      orgId: user.orgId,
      actorUserId: user.userId,
      entityType: 'review_pack',
      entityId: newPackId,
      action: 'review_pack_duplicated',
      title: `Pack duplicated as "${newName}"`,
    })

    revalidatePath('/settings/review-packs')
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to duplicate pack' }
  }
  if (newPackId) redirect(`/settings/review-packs/${newPackId}`)
  return { packId: newPackId }
}

// ─── Edit pack metadata ─────────────────────────────────────────────────────

export async function updatePackMetadataAction(
  packId: string,
  patch: {
    name?: string
    description?: string | null
    applicability_rules?: ApplicabilityRules
    review_cadence?: 'annual' | 'biannual' | 'on_incident' | 'on_renewal'
  },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    const supabase = await createServerClient()

    const { data: pack } = await supabase
      .from('review_packs')
      .select('source_type, org_id')
      .eq('id', packId)
      .maybeSingle()
    if (!pack) return { message: 'Pack not found' }
    if ((pack as { source_type: string }).source_type === 'standard') {
      return { message: 'Standard packs are read-only. Duplicate first.' }
    }

    const update: Record<string, unknown> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.description !== undefined) update.description = patch.description
    if (patch.applicability_rules !== undefined) update.applicability_rules = patch.applicability_rules
    if (patch.review_cadence !== undefined) update.review_cadence = patch.review_cadence

    const { error } = await supabase
      .from('review_packs')
      .update(update)
      .eq('id', packId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    revalidatePath('/settings/review-packs')
    revalidatePath(`/settings/review-packs/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update pack' }
  }
}

// ─── Evidence requirement CRUD ──────────────────────────────────────────────

export async function addEvidenceReqAction(
  packId: string,
  input: { name: string; description?: string | null; required: boolean; expiry_applies: boolean },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    if (!input.name?.trim()) return { message: 'Name is required' }
    const supabase = await createServerClient()

    const { data: existing } = await supabase
      .from('evidence_requirements')
      .select('sort_order')
      .eq('review_pack_id', packId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextSort = (existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1

    const { error } = await supabase
      .from('evidence_requirements')
      .insert({
        org_id: user.orgId,
        review_pack_id: packId,
        name: input.name.trim(),
        description: input.description ?? null,
        required: input.required,
        expiry_applies: input.expiry_applies,
        sort_order: nextSort + 1,
      })
    if (error) throw new Error(error.message)

    revalidatePath(`/settings/review-packs/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to add evidence requirement' }
  }
}

export async function updateEvidenceReqAction(
  evidenceReqId: string,
  patch: { name?: string; description?: string | null; required?: boolean; expiry_applies?: boolean },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    const supabase = await createServerClient()
    const { error, data } = await supabase
      .from('evidence_requirements')
      .update(patch)
      .eq('id', evidenceReqId)
      .eq('org_id', user.orgId)
      .select('review_pack_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) revalidatePath(`/settings/review-packs/${(data as { review_pack_id: string }).review_pack_id}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update' }
  }
}

export async function deleteEvidenceReqAction(
  evidenceReqId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('evidence_requirements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', evidenceReqId)
      .eq('org_id', user.orgId)
      .select('review_pack_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) revalidatePath(`/settings/review-packs/${(data as { review_pack_id: string }).review_pack_id}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete' }
  }
}

// ─── Review requirement CRUD ────────────────────────────────────────────────

export async function addReviewReqAction(
  packId: string,
  input: {
    name: string
    description?: string | null
    required: boolean
    creates_remediation_on_fail: boolean
    linked_evidence_requirement_id?: string | null
    compliance_references?: { standard: string; reference: string }[]
  },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    if (!input.name?.trim()) return { message: 'Name is required' }
    const supabase = await createServerClient()

    const { data: existing } = await supabase
      .from('review_requirements')
      .select('sort_order')
      .eq('review_pack_id', packId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextSort = (existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1

    const { error } = await supabase
      .from('review_requirements')
      .insert({
        org_id: user.orgId,
        review_pack_id: packId,
        name: input.name.trim(),
        description: input.description ?? null,
        required: input.required,
        creates_remediation_on_fail: input.creates_remediation_on_fail,
        linked_evidence_requirement_id: input.linked_evidence_requirement_id ?? null,
        compliance_references: input.compliance_references ?? [],
        sort_order: nextSort + 1,
      })
    if (error) throw new Error(error.message)

    revalidatePath(`/settings/review-packs/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to add review requirement' }
  }
}

export async function updateReviewReqAction(
  reviewReqId: string,
  patch: {
    name?: string
    description?: string | null
    required?: boolean
    creates_remediation_on_fail?: boolean
    linked_evidence_requirement_id?: string | null
    compliance_references?: { standard: string; reference: string }[]
  },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    const supabase = await createServerClient()
    const { error, data } = await supabase
      .from('review_requirements')
      .update(patch)
      .eq('id', reviewReqId)
      .eq('org_id', user.orgId)
      .select('review_pack_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) revalidatePath(`/settings/review-packs/${(data as { review_pack_id: string }).review_pack_id}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update' }
  }
}

export async function deleteReviewReqAction(
  reviewReqId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (user.role !== 'site_admin') return { message: 'Only site admins can edit packs.' }
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('review_requirements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', reviewReqId)
      .eq('org_id', user.orgId)
      .select('review_pack_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) revalidatePath(`/settings/review-packs/${(data as { review_pack_id: string }).review_pack_id}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete' }
  }
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
