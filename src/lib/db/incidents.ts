import sql from '@/lib/db/pool'
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
  const rows = await sql<VendorIncident[]>`
    SELECT *
    FROM vendor_incidents
    WHERE org_id = ${orgId}
      AND vendor_id = ${vendorId}
      AND deleted_at IS NULL
    ORDER BY incident_date DESC
  `
  return rows as unknown as VendorIncident[]
}

export async function createIncident(
  orgId: string,
  vendorId: string,
  input: CreateIncidentInput,
  actorUserId: string | null,
): Promise<VendorIncident> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_incidents')
    .insert({
      ...input,
      org_id: orgId,
      vendor_id: vendorId,
      status: input.status ?? 'detected',
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
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_incidents')
    .update({ deleted_at: new Date().toISOString(), deleted_by_user_id: actorUserId })
    .eq('id', incidentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}
