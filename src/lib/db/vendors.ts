import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
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
  const supabase = await createServerClient()

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
  const supabase = await createServerClient()
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
  supabase: Awaited<ReturnType<typeof createServerClient>>,
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

/** Create a vendor and log activity. */
export async function createVendor(
  orgId: string,
  input: CreateVendorInput,
  actorUserId?: string | null,
): Promise<VendorRow> {
  const supabase = await createServerClient()
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

  return vendor
}

/** Update a vendor and write an activity_log entry */
export async function updateVendor(
  orgId: string,
  id: string,
  input: UpdateVendorInput,
  actorUserId?: string | null,
): Promise<VendorRow> {
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
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
