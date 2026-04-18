import sql from '@/lib/db/pool'
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
  const rows = await sql<ActivityLogEntry[]>`
    SELECT *
    FROM activity_log
    WHERE org_id = ${orgId}
      AND entity_type = 'vendor_assessment'
      AND entity_id = ${assessmentId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows as unknown as ActivityLogEntry[]
}

/** Fetch activity log for a vendor, most recent first, with actor name joined. */
export async function getVendorActivityLog(
  orgId: string,
  vendorId: string,
  limit = 50,
): Promise<ActivityLogEntry[]> {
  const rows = await sql`
    SELECT al.*,
      COALESCE(u.name, u.email) AS actor_name
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.actor_user_id
    WHERE al.org_id = ${orgId}
      AND al.vendor_id = ${vendorId}
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  `
  return rows as unknown as ActivityLogEntry[]
}
