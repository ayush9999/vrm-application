import { createServerClient } from '@/lib/supabase/server'
import type {
  VendorIncident,
  CreateIncidentInput,
  UpdateIncidentInput,
} from '@/types/incident'

export async function getVendorIncidents(
  orgId: string,
  vendorId: string,
): Promise<VendorIncident[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendor_incidents')
    .select('*')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('incident_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VendorIncident[]
}

export async function createIncident(
  orgId: string,
  vendorId: string,
  input: CreateIncidentInput,
  actorUserId: string | null,
): Promise<VendorIncident> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendor_incidents')
    .insert({
      org_id: orgId,
      vendor_id: vendorId,
      incident_date: input.incident_date,
      severity: input.severity,
      status: input.status ?? 'open',
      description: input.description,
      notes: input.notes ?? null,
      created_by_user_id: actorUserId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as VendorIncident
}

export async function updateIncident(
  orgId: string,
  incidentId: string,
  input: UpdateIncidentInput,
): Promise<VendorIncident> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendor_incidents')
    .update(input)
    .eq('id', incidentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as VendorIncident
}

export async function deleteIncident(
  orgId: string,
  incidentId: string,
  actorUserId: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('vendor_incidents')
    .update({ deleted_at: new Date().toISOString(), deleted_by_user_id: actorUserId })
    .eq('id', incidentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}
