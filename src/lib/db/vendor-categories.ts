import { createServerClient } from '@/lib/supabase/server'
import type { VendorCategory } from '@/types/vendor'

/** Fetch all active, non-deleted categories for an org */
export async function getVendorCategories(orgId: string): Promise<VendorCategory[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('vendor_categories')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as VendorCategory[]
}
