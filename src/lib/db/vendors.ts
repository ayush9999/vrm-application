import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import { getCategoryFrameworkSuggestions } from '@/lib/db/vendor-frameworks'
import { createAssessment, addAssessmentFrameworkSelection, instantiateFrameworkItems } from '@/lib/db/assessments'
import type {
  Vendor,
  VendorRow,
  CreateVendorInput,
  UpdateVendorInput,
  VendorStatus,
} from '@/types/vendor'

export interface GetVendorsOptions {
  search?: string
  status?: VendorStatus | ''
  criticalOnly?: boolean
}

/** List vendors for an org with optional search/filter */
export async function getVendors(
  orgId: string,
  opts: GetVendorsOptions = {},
): Promise<Vendor[]> {
  const supabase = createServerClient()

  let query = supabase
    .from('vendors')
    .select(
      `*, vendor_categories(name), internal_owner:users!vendors_internal_owner_user_id_fkey(name, email)`,
    )
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('name')

  if (opts.search) query = query.ilike('name', `%${opts.search}%`)
  if (opts.status) query = query.eq('status', opts.status)
  if (opts.criticalOnly) query = query.eq('is_critical', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Vendor[]
}

/** Fetch a single vendor by id (scoped to org) */
export async function getVendorById(orgId: string, id: string): Promise<Vendor | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendors')
    .select(
      `*, vendor_categories(name), internal_owner:users!vendors_internal_owner_user_id_fkey(name, email)`,
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Vendor | null
}

/** Generate the next VND-XXXX code for an org (includes deleted vendors to avoid reuse) */
async function generateVendorCode(
  orgId: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<string> {
  const { data } = await supabase
    .from('vendors')
    .select('vendor_code')
    .eq('org_id', orgId)
    .not('vendor_code', 'is', null)

  let maxNum = 0
  for (const row of (data ?? []) as { vendor_code: string | null }[]) {
    const match = row.vendor_code?.match(/^VND-(\d+)$/)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }
  return `VND-${String(maxNum + 1).padStart(4, '0')}`
}

/** Create a vendor, then auto-create an onboarding assessment with the given frameworks.
 *  frameworks = explicitly selected + category suggestions (merged, deduplicated).
 */
export async function createVendor(
  orgId: string,
  input: CreateVendorInput,
  actorUserId?: string | null,
  explicitFrameworkIds: string[] = [],
): Promise<VendorRow> {
  const supabase = createServerClient()
  const vendorCode = await generateVendorCode(orgId, supabase)
  const { data, error } = await supabase
    .from('vendors')
    .insert({ ...input, org_id: orgId, vendor_code: vendorCode })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const vendor = data as VendorRow

  await logActivity({
    orgId,
    vendorId: vendor.id,
    actorUserId: actorUserId ?? null,
    entityType: 'vendor',
    entityId: vendor.id,
    action: 'created',
    title: `Vendor "${vendor.name}" created`,
    metadata: { vendor_code: vendor.vendor_code, status: vendor.status },
  })

  // Auto-create the onboarding assessment and attach frameworks
  await createOnboardingAssessment(orgId, vendor.id, vendor.name, vendor.category_id ?? null, explicitFrameworkIds, actorUserId ?? null)

  return vendor
}

/** Auto-create the onboarding assessment for a new vendor.
 *  Merges explicitly selected frameworks with category suggestions (deduplicated).
 *  Creates the assessment as is_onboarding=true and instantiates all framework items.
 */
export async function createOnboardingAssessment(
  orgId: string,
  vendorId: string,
  vendorName: string,
  categoryId: string | null,
  explicitFrameworkIds: string[],
  actorUserId: string | null,
): Promise<void> {
  // Merge explicit + category suggestions, preserving order, deduplicating
  const suggested = await getCategoryFrameworkSuggestions(orgId, categoryId)
  const suggestedIds = suggested.map(f => f.id)
  const explicitSet = new Set(explicitFrameworkIds)
  const allFrameworkIds = [
    ...explicitFrameworkIds,
    ...suggestedIds.filter(id => !explicitSet.has(id)),
  ]

  if (allFrameworkIds.length === 0) return  // No frameworks — skip creating empty assessment

  const assessment = await createAssessment({
    orgId,
    vendorId,
    title: `${vendorName} — Onboarding Assessment`,
    isOnboarding: true,
    createdByUserId: actorUserId,
  })

  for (const fwId of allFrameworkIds) {
    const source = explicitSet.has(fwId) ? 'manual' : 'onboarding'
    await addAssessmentFrameworkSelection(assessment.id, fwId, source as 'manual' | 'onboarding', actorUserId)
    await instantiateFrameworkItems(orgId, assessment.id, fwId, actorUserId)
  }
}

/** Update a vendor and write an activity_log entry */
export async function updateVendor(
  orgId: string,
  id: string,
  input: UpdateVendorInput,
  actorUserId?: string | null,
): Promise<VendorRow> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendors')
    .update(input)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()
  if (error) throw new Error(error.message)

  const vendor = data as VendorRow

  await logActivity({
    orgId,
    vendorId: id,
    actorUserId: actorUserId ?? null,
    entityType: 'vendor',
    entityId: id,
    action: 'updated',
    title: `Vendor "${vendor.name}" updated`,
    metadata: { changes: input },
  })

  return vendor
}

/**
 * Soft-delete a vendor (site_admin only — caller must check role before calling).
 * Sets deleted_at = now().
 */
export async function softDeleteVendor(
  orgId: string,
  id: string,
  actorUserId?: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('name')
    .single()
  if (error) throw new Error(error.message)

  const vendorName = (data as { name: string }).name

  await logActivity({
    orgId,
    vendorId: id,
    actorUserId: actorUserId ?? null,
    entityType: 'vendor',
    entityId: id,
    action: 'deleted',
    title: `Vendor "${vendorName}" deleted (soft)`,
  })
}
