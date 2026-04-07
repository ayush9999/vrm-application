'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { createVendor, updateVendor, softDeleteVendor } from '@/lib/db/vendors'
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
    // Explicitly selected frameworks from form — passed to createVendor so
    // the auto-created onboarding assessment can attach them
    const frameworkIds = formData.getAll('framework_ids').map(String).filter(Boolean)
    const vendor = await createVendor(user.orgId, parsed.data, user.userId, frameworkIds)
    vendorId = vendor.id
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create vendor' }
  }

  // Redirect to detail page defaulting to the documents tab so onboarding starts
  redirect(`/vendors/${vendorId}?tab=documents`)
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
