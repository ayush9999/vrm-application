export type AiProcessingStatus = 'queued' | 'processing' | 'done' | 'failed'
export type DocStatus = 'missing' | 'pending' | 'uploaded' | 'expired'

export interface DocumentType {
  id: string
  org_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CategoryRequiredDocument {
  id: string
  org_id: string
  category_id: string
  doc_type_id: string
  is_required: boolean
  created_at: string
  deleted_at: string | null
}

export interface VendorDocument {
  id: string
  org_id: string
  vendor_id: string
  doc_type_id: string
  expiry_date: string | null
  last_verified_at: string | null
  verified_by_user_id: string | null
  verification_notes: string | null
  current_version_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface VendorDocumentVersion {
  id: string
  org_id: string
  vendor_document_id: string
  file_key: string
  file_name: string | null
  mime_type: string | null
  uploaded_by_user_id: string | null
  uploaded_at: string
  ai_status: AiProcessingStatus
  ai_summary: string | null
  deleted_at: string | null
}

// ─── Enriched UI types ─────────────────────────────────────────────────────────

export interface SuggestedDocument {
  required_doc_id: string
  is_required: boolean
  doc_type_id: string
  doc_type_name: string
  vendor_doc_id: string | null
  current_version_id: string | null
  expiry_date: string | null
  last_verified_at: string | null
  verification_notes: string | null
  current_file_name: string | null
  current_file_key: string | null
  status: DocStatus
}

export interface CustomDocument {
  vendor_doc_id: string
  doc_type_id: string
  doc_type_name: string
  category: string | null
  current_version_id: string | null
  expiry_date: string | null
  last_verified_at: string | null
  current_file_name: string | null
  current_file_key: string | null
  status: DocStatus
}

export interface DocumentHistoryEntry {
  version_id: string
  vendor_document_id: string
  doc_type_name: string
  file_key: string
  file_name: string | null
  uploaded_at: string
  ai_status: AiProcessingStatus
}

export interface VendorDocumentsData {
  suggested: SuggestedDocument[]
  custom: CustomDocument[]
  history: DocumentHistoryEntry[]
}

export interface AssessmentDocRequest {
  doc_type_id: string
  doc_type_name: string
  required: boolean
  assessment_id: string
  assessment_title: string
  framework_name: string
  item_title: string
  vendor_doc_id: string | null
  current_file_name: string | null
  current_file_key: string | null
  expiry_date: string | null
  status: DocStatus
}
