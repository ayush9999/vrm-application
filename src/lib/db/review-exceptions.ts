import { createServerClient } from '@/lib/supabase/server'

export type ExceptionStatus = 'active' | 'expired' | 'renewed' | 'escalated'

export interface ReviewException {
  id: string
  org_id: string
  vendor_id: string
  vendor_review_item_id: string
  vendor_review_pack_id: string
  reason: string
  expiry_date: string
  owner_user_id: string
  owner_name?: string | null
  requires_countersign: boolean
  countersigned_by_user_id: string | null
  countersigned_at: string | null
  status: ExceptionStatus
  created_at: string
}

/** List all active exceptions for a vendor. */
export async function getVendorExceptions(vendorId: string): Promise<ReviewException[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_exceptions')
    .select(`
      *,
      owner:users!review_exceptions_owner_user_id_fkey ( name, email )
    `)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  type Row = ReviewException & { owner: { name: string | null; email: string | null } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    owner_name: r.owner?.name ?? r.owner?.email ?? null,
    owner: undefined as unknown as Row['owner'],
  })) as ReviewException[]
}

/** Count active exceptions expiring within N days for an org. */
export async function countExpiringExceptions(orgId: string, withinDays: number): Promise<number> {
  const supabase = await createServerClient()
  const cutoff = new Date(Date.now() + withinDays * 86_400_000).toISOString().split('T')[0]
  const { count, error } = await supabase
    .from('review_exceptions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
    .lte('expiry_date', cutoff)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Create an exception record for a review item. */
export async function createException(input: {
  orgId: string
  vendorId: string
  vendorReviewItemId: string
  vendorReviewPackId: string
  reason: string
  expiryDate: string
  ownerUserId: string
  requiresCountersign: boolean
  createdByUserId: string
}): Promise<ReviewException> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_exceptions')
    .insert({
      org_id: input.orgId,
      vendor_id: input.vendorId,
      vendor_review_item_id: input.vendorReviewItemId,
      vendor_review_pack_id: input.vendorReviewPackId,
      reason: input.reason,
      expiry_date: input.expiryDate,
      owner_user_id: input.ownerUserId,
      requires_countersign: input.requiresCountersign,
      created_by_user_id: input.createdByUserId,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ReviewException
}

/** Count open exceptions for a vendor (for dashboard/profile summary). */
export async function countVendorActiveExceptions(vendorId: string): Promise<number> {
  const supabase = await createServerClient()
  const { count, error } = await supabase
    .from('review_exceptions')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId)
    .eq('status', 'active')
  if (error) throw new Error(error.message)
  return count ?? 0
}
