export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected'

export interface VendorDispute {
  id: string
  org_id: string
  vendor_id: string
  vendor_document_id: string | null
  title: string
  description: string | null
  status: DisputeStatus
  created_by_user_id: string | null
  assigned_to_user_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  deleted_at: string | null
}
