import { createServerClient } from '@/lib/supabase/server'
import type { VendorDispute, DisputeStatus } from '@/types/dispute'

export async function getVendorDisputes(
  orgId: string,
  vendorId: string,
): Promise<VendorDispute[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_disputes')
    .select('*')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VendorDispute[]
}

export async function createDispute(
  orgId: string,
  vendorId: string,
  input: {
    title: string
    description?: string | null
    vendor_document_id?: string | null
    created_by_user_id?: string | null
  },
): Promise<VendorDispute> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_disputes')
    .insert({ org_id: orgId, vendor_id: vendorId, ...input })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as VendorDispute
}

export async function updateDisputeStatus(
  orgId: string,
  disputeId: string,
  status: DisputeStatus,
): Promise<void> {
  const supabase = await createServerClient()
  const update: Record<string, unknown> = { status }
  if (status === 'resolved') update.resolved_at = new Date().toISOString()

  const { error } = await supabase
    .from('vendor_disputes')
    .update(update)
    .eq('id', disputeId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}
