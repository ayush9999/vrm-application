import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import type {
  Vendor,
  VendorRow,
  CreateVendorInput,
  UpdateVendorInput,
  VendorStatus,
} from '@/types/vendor'

export type VendorSortField = 'name' | 'created_at' | 'criticality_tier' | 'next_review_due_at' | 'approval_status'

// Validated sort columns — prevents SQL injection in ORDER BY
const SORT_COLUMNS: Record<VendorSortField, string> = {
  name: 'v.name',
  created_at: 'v.created_at',
  criticality_tier: 'v.criticality_tier',
  next_review_due_at: 'v.next_review_due_at',
  approval_status: 'v.approval_status',
}

export interface GetVendorsOptions {
  search?: string
  status?: VendorStatus | ''
  criticalOnly?: boolean
  sort?: VendorSortField
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface VendorListPage {
  rows: Vendor[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** List vendors for an org with optional search/filter/sort/paginate. */
export async function getVendors(
  orgId: string,
  opts: GetVendorsOptions = {},
): Promise<VendorListPage> {
  const sort = opts.sort ?? 'name'
  const sortDir = opts.sortDir ?? 'asc'
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = opts.pageSize ?? 25
  const offset = (page - 1) * pageSize

  const orderCol = SORT_COLUMNS[sort] ?? 'v.name'
  const orderDir = sortDir === 'desc' ? 'DESC' : 'ASC'

  const rows = await sql`
    SELECT
      v.*,
      COUNT(*) OVER() AS _total_count,
      CASE WHEN vc.id IS NOT NULL
        THEN jsonb_build_object('name', vc.name)
        ELSE NULL
      END AS vendor_categories,
      CASE WHEN u.id IS NOT NULL
        THEN jsonb_build_object('name', u.name, 'email', u.email)
        ELSE NULL
      END AS internal_owner
    FROM vendors v
    LEFT JOIN vendor_categories vc ON vc.id = v.category_id
    LEFT JOIN users u ON u.id = v.internal_owner_user_id
    WHERE v.org_id = ${orgId}
      AND v.deleted_at IS NULL
      AND v.archived_at IS NULL
      ${opts.search ? sql`AND v.name ILIKE ${`%${opts.search}%`}` : sql``}
      ${opts.status ? sql`AND v.status = ${opts.status}` : sql``}
      ${opts.criticalOnly ? sql`AND v.is_critical = true` : sql``}
    ORDER BY ${sql.unsafe(orderCol)} ${sql.unsafe(orderDir)} NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `

  const total = rows.length > 0 ? Number(rows[0]._total_count) : 0

  // Strip the _total_count helper column before returning
  const cleaned = rows.map(({ _total_count, ...rest }) => rest) as unknown as Vendor[]

  return {
    rows: cleaned,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Fetch a single vendor by id (scoped to org) */
export async function getVendorById(orgId: string, id: string): Promise<Vendor | null> {
  const rows = await sql`
    SELECT
      v.*,
      CASE WHEN vc.id IS NOT NULL
        THEN jsonb_build_object('name', vc.name)
        ELSE NULL
      END AS vendor_categories,
      CASE WHEN u.id IS NOT NULL
        THEN jsonb_build_object('name', u.name, 'email', u.email)
        ELSE NULL
      END AS internal_owner
    FROM vendors v
    LEFT JOIN vendor_categories vc ON vc.id = v.category_id
    LEFT JOIN users u ON u.id = v.internal_owner_user_id
    WHERE v.id = ${id}
      AND v.org_id = ${orgId}
      AND v.deleted_at IS NULL
    LIMIT 1
  `
  return (rows[0] as unknown as Vendor) ?? null
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
