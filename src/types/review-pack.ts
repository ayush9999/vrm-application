// ─── Review Pack types (mirror migration 018) ──────────────────────────────

// ─── Enums ──────────────────────────────────────────────────────────────────

export type ReviewPackCadence = 'annual' | 'biannual' | 'on_incident' | 'on_renewal'
export type ReviewItemDecision = 'not_started' | 'pass' | 'fail' | 'na' | 'needs_follow_up' | 'exception_approved'
export type VendorReviewPackStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'approved_with_exception' | 'blocked' | 'upcoming' | 'awaiting_approval' | 'sent_back' | 'locked'
export type EvidenceStatus = 'missing' | 'uploaded' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'waived'
export type ReviewType = 'onboarding' | 'scheduled' | 'on_demand'

export type VendorDataAccessLevel = 'none' | 'internal_only' | 'personal_data' | 'sensitive_personal_data' | 'financial_data'
export type VendorServiceType = 'saas' | 'contractor' | 'supplier' | 'logistics' | 'professional_services' | 'other'
export type VendorApprovalStatus = 'draft' | 'waiting_on_vendor' | 'in_internal_review' | 'approved' | 'approved_with_exception' | 'blocked' | 'suspended' | 'offboarded'

// ─── Review Pack (template) ─────────────────────────────────────────────────

export interface ReviewPack {
  id: string
  org_id: string | null
  name: string
  code: string | null
  description: string | null
  applicability_rules: ApplicabilityRules
  review_cadence: ReviewPackCadence
  compliance_mappings: ComplianceMapping[]
  source_type: 'standard' | 'custom'
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ApplicabilityRules {
  always?: boolean
  service_types?: VendorServiceType[]
  min_criticality_tier?: number
  data_access_levels?: VendorDataAccessLevel[]
  processes_personal_data?: boolean
  requires_esg_setting?: boolean
}

export interface ComplianceMapping {
  standard: string
  reference: string
}

// ─── Evidence Requirement (template) ────────────────────────────────────────

export interface EvidenceRequirement {
  id: string
  org_id: string | null
  review_pack_id: string
  name: string
  code: string | null
  description: string | null
  required: boolean
  accepted_formats: string | null
  expiry_applies: boolean
  reupload_cadence: string | null
  sort_order: number
  created_at: string
  deleted_at: string | null
}

// ─── Review Requirement (template) ──────────────────────────────────────────

export interface ReviewRequirement {
  id: string
  org_id: string | null
  review_pack_id: string
  name: string
  code: string | null
  description: string | null
  required: boolean
  linked_evidence_requirement_id: string | null
  compliance_references: ComplianceMapping[]
  creates_remediation_on_fail: boolean
  sort_order: number
  created_at: string
  deleted_at: string | null
}

// ─── Vendor Review Pack (instance) ──────────────────────────────────────────

export interface VendorReviewPack {
  id: string
  org_id: string
  vendor_id: string
  review_pack_id: string
  status: VendorReviewPackStatus
  review_type: ReviewType
  assigned_at: string
  due_at: string | null
  completed_at: string | null
  reviewer_user_id: string | null
  approver_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joined
  review_pack_name?: string
  review_pack_code?: string
  vendor_name?: string
  matched_rule?: string
  item_counts?: {
    total: number
    passed: number
    failed: number
    not_started: number
    na: number
  }
}

// ─── Vendor Review Item (instance of a requirement for a specific vendor) ───

export interface VendorReviewItem {
  id: string
  org_id: string
  vendor_review_pack_id: string
  review_requirement_id: string
  decision: ReviewItemDecision
  reviewer_comment: string | null
  linked_evidence_id: string | null
  linked_evidence_name?: string | null
  linked_evidence_status?: string | null
  created_remediation_id: string | null
  decided_at: string | null
  decided_by_user_id: string | null
  created_at: string
  updated_at: string
  // joined
  requirement_name?: string
  requirement_description?: string
  compliance_references?: ComplianceMapping[]
  linked_evidence_requirement_id?: string | null
  creates_remediation_on_fail?: boolean
  pack_name?: string
}

// ─── Readiness calculation ──────────────────────────────────────────────────

export interface ReadinessScore {
  applicable: number
  completed: number
  percentage: number
}
