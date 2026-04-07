export interface ActivityLogEntry {
  id: string
  org_id: string
  vendor_id: string | null
  actor_user_id: string | null
  title: string | null
  description: string | null
  entity_type: string
  entity_id: string
  action: string
  metadata_json: Record<string, unknown> | null
  created_at: string
}
