// ─── Enums (mirror the PostgreSQL enums in 001_init.sql) ──────────────────────

export type VendorStatus = 'active' | 'under_review' | 'suspended'
export type CriticalityTier = 1 | 2 | 3 | 4 | 5
export type { VendorDataAccessLevel, VendorServiceType, VendorApprovalStatus } from './review-pack'

// ─── Core row shapes ──────────────────────────────────────────────────────────

export interface VendorCategory {
  id: string
  org_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

/** Raw vendors row (no joins) */
export interface VendorRow {
  id: string
  org_id: string
  vendor_code: string | null
  name: string
  legal_name: string | null
  category_id: string | null
  is_critical: boolean
  criticality_tier: number | null
  status: VendorStatus
  internal_owner_user_id: string | null
  website_url: string | null
  primary_email: string | null
  phone: string | null
  country_code: string | null
  last_reviewed_at: string | null
  next_review_due_at: string | null
  is_blocklisted: boolean
  blocklist_reason: string | null
  blocklisted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
  // New classification + approval columns (migration 018)
  data_access_level: import('./review-pack').VendorDataAccessLevel
  annual_spend: number | null
  service_type: import('./review-pack').VendorServiceType
  processes_personal_data: boolean
  approval_status: import('./review-pack').VendorApprovalStatus
  approved_by_user_id: string | null
  approved_at: string | null
  exception_reason: string | null
}

/** vendors row with joined relations used in the list and detail views */
export interface Vendor extends VendorRow {
  vendor_categories: { name: string } | null
  internal_owner: { name: string | null; email: string | null } | null
}

// ─── Mutation input shapes ─────────────────────────────────────────────────────

export interface CreateVendorInput {
  name: string
  legal_name?: string | null
  category_id?: string | null
  is_critical: boolean
  criticality_tier?: number | null
  status: VendorStatus
  internal_owner_user_id?: string | null
  website_url?: string | null
  primary_email?: string | null
  phone?: string | null
  country_code?: string | null
  next_review_due_at?: string | null
  last_reviewed_at?: string | null
  notes?: string | null
  data_access_level?: import('./review-pack').VendorDataAccessLevel
  annual_spend?: number | null
  service_type?: import('./review-pack').VendorServiceType
  processes_personal_data?: boolean
}

export type UpdateVendorInput = Partial<CreateVendorInput>

// ─── Form state (re-exported from common for convenience) ─────────────────────

export type { FormState as VendorFormState } from '@/types/common'
