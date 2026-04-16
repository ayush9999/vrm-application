'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createVendor, updateVendor, softDeleteVendor, getVendorById } from '@/lib/db/vendors'
import { autoAssignReviewPacks } from '@/lib/db/review-packs'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import { captureReadinessSnapshot } from '@/lib/db/readiness-snapshots'
import { listCustomFields, setVendorCustomFieldValues } from '@/lib/db/custom-fields'
import type { CustomField } from '@/lib/db/custom-fields'
import type { FormState } from '@/types/common'

/**
 * Extract custom field values from FormData (entries prefixed with cf_<id>).
 * Coerces to the field's declared type.
 */
function extractCustomFieldValues(
  fields: CustomField[],
  formData: FormData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const key = `cf_${f.id}`
    if (f.field_type === 'multi_select') {
      const values = formData.getAll(key).map(String).filter(Boolean)
      out[f.id] = values.length > 0 ? values : null
      continue
    }
    const raw = formData.get(key)
    if (raw === null) {
      out[f.id] = null
      continue
    }
    const str = String(raw).trim()
    if (str === '') {
      out[f.id] = null
      continue
    }
    switch (f.field_type) {
      case 'number':
        out[f.id] = Number.isFinite(Number(str)) ? Number(str) : null
        break
      case 'boolean':
        out[f.id] = str === 'true'
        break
      default:
        out[f.id] = str
    }
  }
  return out
}

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

    // Persist any custom field values from the form
    const customFields = await listCustomFields(user.orgId, 'vendor')
    if (customFields.length > 0) {
      const values = extractCustomFieldValues(customFields, formData)
      await setVendorCustomFieldValues(user.orgId, vendor.id, values)
    }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create vendor' }
  }

  // Redirect to detail page defaulting to the reviews tab to start the workflow
  redirect(`/vendors/${vendorId}?tab=reviews`)
}

// ─── Preview matched Review Packs (for the onboarding wizard) ────────────────

export async function previewMatchedReviewPacksAction(input: {
  category_id?: string | null
  criticality_tier?: number | null
  service_type: import('@/types/vendor').VendorServiceType
  data_access_level: import('@/types/vendor').VendorDataAccessLevel
  processes_personal_data: boolean
}): Promise<{ packs?: Array<{ id: string; name: string; code: string | null; description: string | null; matched_rule: string }>; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('review_packs')
      .select('*')
      .or(`org_id.is.null,org_id.eq.${user.orgId}`)
      .eq('is_active', true)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)

    const { matchReviewPacks } = await import('@/lib/db/review-packs')
    const fakeVendor = {
      id: 'preview',
      org_id: user.orgId,
      category_id: input.category_id ?? null,
      criticality_tier: input.criticality_tier ?? null,
      service_type: input.service_type,
      data_access_level: input.data_access_level,
      processes_personal_data: input.processes_personal_data,
    }
    const matched = matchReviewPacks((data ?? []) as import('@/types/review-pack').ReviewPack[], fakeVendor, false)

    return {
      packs: matched.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        matched_rule: describeRule(p.applicability_rules, fakeVendor),
      })),
    }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to preview packs' }
  }
}

function describeRule(
  rules: import('@/types/review-pack').ApplicabilityRules,
  v: { criticality_tier: number | null; service_type: string; data_access_level: string; processes_personal_data: boolean },
): string {
  if (v.criticality_tier === 1) return 'Tier 1 critical → all packs apply'
  if (rules.always) return 'Always assigned'
  if (rules.processes_personal_data && v.processes_personal_data) return 'Processes personal data'
  if (rules.data_access_levels?.includes(v.data_access_level as never)) return `Data access: ${v.data_access_level.replace(/_/g, ' ')}`
  if (rules.min_criticality_tier && v.criticality_tier && v.criticality_tier <= rules.min_criticality_tier) {
    return `Criticality tier ${v.criticality_tier} ≤ ${rules.min_criticality_tier}`
  }
  if (rules.service_types?.includes(v.service_type as never)) return `Service type: ${v.service_type.replace(/_/g, ' ')}`
  return 'Manually included'
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

    // Snapshot readiness at this moment for the trend chart.
    // Best-effort — never block the status change on snapshot failure.
    try {
      await captureReadinessSnapshot({
        orgId: user.orgId,
        vendorId,
        approvalStatus: newStatus,
        trigger: 'approval_change',
        triggerUserId: user.userId,
        notes: oldStatus ? `${oldStatus} → ${newStatus}` : `set to ${newStatus}`,
      })
    } catch {
      // ignore — snapshot is non-critical
    }

    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/vendors')
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update approval status' }
  }
}

// ─── Wizard create — non-redirecting variant for client-driven flow ──────────

export async function createVendorFromWizardAction(input: {
  name: string
  legal_name?: string | null
  category_id?: string | null
  is_critical: boolean
  criticality_tier?: number | null
  status: 'active' | 'under_review' | 'suspended'
  internal_owner_user_id?: string | null
  website_url?: string | null
  primary_email?: string | null
  phone?: string | null
  country_code?: string | null
  next_review_due_at?: string | null
  last_reviewed_at?: string | null
  notes?: string | null
  service_type: import('@/types/vendor').VendorServiceType
  data_access_level: import('@/types/vendor').VendorDataAccessLevel
  processes_personal_data: boolean
  annual_spend?: number | null
}): Promise<{ vendorId?: string; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const vendor = await createVendor(user.orgId, input, user.userId)
    await autoAssignReviewPacks({
      id: vendor.id,
      org_id: user.orgId,
      category_id: input.category_id ?? null,
      criticality_tier: input.criticality_tier ?? null,
      service_type: input.service_type,
      data_access_level: input.data_access_level,
      processes_personal_data: input.processes_personal_data,
    })
    return { vendorId: vendor.id }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create vendor' }
  }
}

// ─── Generate portal links for all packs assigned to a vendor ────────────────
// Used by the onboarding wizard's "send portal link" step after vendor creation.

export async function generatePortalLinksForVendorAction(
  vendorId: string,
  recipientEmail: string | null,
  expiryDays: number,
): Promise<{ urls?: string[]; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const supabase = await createServerClient()

    const { data: vrps, error } = await supabase
      .from('vendor_review_packs')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('org_id', user.orgId)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    if (!vrps || vrps.length === 0) return { urls: [] }

    const { createPortalLink } = await import('@/lib/db/vendor-portal')
    const { headers } = await import('next/headers')
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'

    const urls: string[] = []
    for (const v of vrps as { id: string }[]) {
      const link = await createPortalLink({
        orgId: user.orgId,
        vendorId,
        vendorReviewPackId: v.id,
        createdByUserId: user.userId,
        recipientEmail,
        expiryDays,
      })
      urls.push(`${proto}://${host}/portal/${link.token}`)
    }
    return { urls }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to generate portal links' }
  }
}

// ─── Manual snapshot ─────────────────────────────────────────────────────────

export async function captureReadinessSnapshotAction(
  vendorId: string,
  notes?: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const vendor = await getVendorById(user.orgId, vendorId)
    if (!vendor) return { message: 'Vendor not found' }
    await captureReadinessSnapshot({
      orgId: user.orgId,
      vendorId,
      approvalStatus: vendor.approval_status,
      trigger: 'manual',
      triggerUserId: user.userId,
      notes: notes ?? null,
    })
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to capture snapshot' }
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

    // Persist custom field values
    const customFields = await listCustomFields(user.orgId, 'vendor')
    if (customFields.length > 0) {
      const values = extractCustomFieldValues(customFields, formData)
      await setVendorCustomFieldValues(user.orgId, id, values)
    }
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
