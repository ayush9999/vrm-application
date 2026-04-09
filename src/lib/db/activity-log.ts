import { createServerClient } from '@/lib/supabase/server'
import type { ActivityLogEntry } from '@/types/activity'

interface LogActivityParams {
  orgId: string
  vendorId?: string | null
  actorUserId?: string | null
  entityType: string
  entityId: string
  action: string
  title?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
}

/** Insert a single activity_log row. Errors are suppressed (never fail the main operation). */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const supabase = await createServerClient()
  await supabase.from('activity_log').insert({
    org_id: params.orgId,
    vendor_id: params.vendorId ?? null,
    actor_user_id: params.actorUserId ?? null,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    title: params.title ?? null,
    description: params.description ?? null,
    metadata_json: params.metadata ?? null,
  })
}

/** Fetch activity log for an assessment, most recent first */
export async function getAssessmentActivityLog(
  orgId: string,
  assessmentId: string,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'vendor_assessment')
    .eq('entity_id', assessmentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as ActivityLogEntry[]
}

/** Fetch activity log for a vendor, most recent first */
export async function getVendorActivityLog(
  orgId: string,
  vendorId: string,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as ActivityLogEntry[]
}
