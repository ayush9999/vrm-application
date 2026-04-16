'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createVendor, updateVendor, softDeleteVendor, getVendorById } from '@/lib/db/vendors'
import { autoAssignReviewPacks } from '@/lib/db/review-packs'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import type { FormState } from '@/types/common'

// ─── Shared Zod schema ─────────────────────────────────────────────────────────

const nullableStr = z
  .string()
  .optional()
  .transform((v) => v?.trim() || null)

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  legal_name: nullableStr,
  category_id: z
    .string()
    .uuid('Invalid category')
    .optional()
    .nullable()
    .transform((v) => v || null),
  is_critical: z.boolean().default(false),
  criticality_tier: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(5).nullable().optional(),
  ),
  status: z.enum(['active', 'under_review', 'suspended']).default('active'),
  internal_owner_user_id: z
    .string()
    .uuid('Invalid owner')
    .optional()
    .nullable()
    .transform((v) => v || null),
  website_url: nullableStr,
  primary_email: nullableStr,
  phone: nullableStr,
  country_code: z
    .string()
    .optional()
    .transform((v) => v?.trim().slice(0, 2).toUpperCase() || null),
  next_review_due_at: nullableStr,
  last_reviewed_at: nullableStr,
  notes: nullableStr,
  service_type: z.enum(['saas', 'contractor', 'supplier', 'logistics', 'professional_services', 'other']).default('other'),
  data_access_level: z.enum(['none', 'internal_only', 'personal_data', 'sensitive_personal_data', 'financial_data']).default('none'),
  processes_personal_data: z.boolean().default(false),
  annual_spend: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().min(0).nullable().optional(),
  ),
})

function parseVendorFormData(formData: FormData) {
  return {
    name: formData.get('name') as string,
    legal_name: (formData.get('legal_name') as string) ?? '',
    category_id: (formData.get('category_id') as string) || null,
    is_critical: formData.get('is_critical') === 'true',
    criticality_tier: formData.get('criticality_tier') as string,
    status: formData.get('status') as string,
    internal_owner_user_id: (formData.get('internal_owner_user_id') as string) || null,
    website_url: (formData.get('website_url') as string) ?? '',
    primary_email: (formData.get('primary_email') as string) ?? '',
    phone: (formData.get('phone') as string) ?? '',
    country_code: (formData.get('country_code') as string) ?? '',
    next_review_due_at: (formData.get('next_review_due_at') as string) ?? '',
    last_reviewed_at: (formData.get('last_reviewed_at') as string) ?? '',
    notes: (formData.get('notes') as string) ?? '',
    service_type: (formData.get('service_type') as string) ?? 'other',
    data_access_level: (formData.get('data_access_level') as string) ?? 'none',
    processes_personal_data: formData.get('processes_personal_data') === 'true',
    annual_spend: (formData.get('annual_spend') as string) ?? '',
  }
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createVendorAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = parseVendorFormData(formData)
  const parsed = vendorSchema.safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  let vendorId: string
  try {
    const user = await requireCurrentUser()
    const vendor = await createVendor(user.orgId, parsed.data, user.userId)
    vendorId = vendor.id

    // Auto-apply Review Packs based on the vendor's risk profile
    await autoAssignReviewPacks({
      id: vendor.id,
      org_id: user.orgId,
      category_id: parsed.data.category_id,
      criticality_tier: parsed.data.criticality_tier ?? null,
      service_type: parsed.data.service_type,
      data_access_level: parsed.data.data_access_level,
      processes_personal_data: parsed.data.processes_personal_data,
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create vendor' }
  }

  // Redirect to detail page defaulting to the reviews tab to start the workflow
  redirect(`/vendors/${vendorId}?tab=reviews`)
}

// ─── Update Approval Status ───────────────────────────────────────────────────

export async function updateApprovalStatusAction(
  vendorId: string,
  newStatus: 'draft' | 'waiting_on_vendor' | 'in_internal_review' | 'approved' | 'approved_with_exception' | 'blocked' | 'suspended' | 'offboarded',
  exceptionReason?: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    // Read previous status for audit trail
    const { data: existing } = await supabase
      .from('vendors')
      .select('approval_status, name')
      .eq('id', vendorId)
      .eq('org_id', user.orgId)
      .maybeSingle()
    const oldStatus = existing?.approval_status as string | undefined

    if (oldStatus === newStatus && !exceptionReason) {
      return { success: true } // no-op
    }

    const update: Record<string, unknown> = { approval_status: newStatus }
    if (newStatus === 'approved' || newStatus === 'approved_with_exception') {
      update.approved_at = new Date().toISOString()
      update.approved_by_user_id = user.userId
    }
    if (newStatus === 'approved_with_exception' && exceptionReason) {
      update.exception_reason = exceptionReason
    }

    const { error } = await supabase
      .from('vendors')
      .update(update)
      .eq('id', vendorId)
      .eq('org_id', user.orgId)
    if (error) throw new Error(error.message)

    const friendly = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const title = oldStatus
      ? `Approval status changed from "${friendly(oldStatus)}" to "${friendly(newStatus)}"`
      : `Approval status set to "${friendly(newStatus)}"`

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor',
      entityId: vendorId,
      action: 'approval_status_changed',
      title,
      description: exceptionReason ? `Exception: ${exceptionReason}` : undefined,
      metadata: { from: oldStatus ?? null, to: newStatus, exception_reason: exceptionReason ?? null },
    })

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/vendors')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update approval status' }
  }
}

// ─── Re-apply Review Packs (for existing vendors) ─────────────────────────────

export async function reapplyReviewPacksAction(
  vendorId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    const vendor = await getVendorById(user.orgId, vendorId)
    if (!vendor) return { message: 'Vendor not found' }

    await autoAssignReviewPacks({
      id: vendor.id,
      org_id: user.orgId,
      category_id: vendor.category_id,
      criticality_tier: vendor.criticality_tier,
      service_type: vendor.service_type,
      data_access_level: vendor.data_access_level,
      processes_personal_data: vendor.processes_personal_data,
    })

    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to re-apply review packs' }
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateVendorAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = parseVendorFormData(formData)
  const parsed = vendorSchema.safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  try {
    const user = await requireCurrentUser()
    await updateVendor(user.orgId, id, parsed.data, user.userId)
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update vendor' }
  }

  redirect(`/vendors/${id}`)
}

// ─── Soft Delete (site_admin only) ────────────────────────────────────────────

export async function deleteVendorAction(
  id: string,
  _prevState: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireCurrentUser()

    if (user.role !== 'site_admin') {
      return { message: 'Permission denied: only Site Admins can delete vendors.' }
    }

    await softDeleteVendor(user.orgId, id, user.userId)
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete vendor' }
  }

  redirect('/vendors')
}
