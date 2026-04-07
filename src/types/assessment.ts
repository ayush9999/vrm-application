// ─── Enums (mirror 001_init.sql + 003_risk_assessment_module.sql) ─────────────

export type AssessmentStatus =
  | 'draft'
  | 'in_review'
  | 'pending_ai_review'
  | 'pending_human_review'
  | 'submitted'
  | 'completed'
  | 'archived'

export type AssessmentItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'satisfactory'
  | 'needs_attention'
  | 'high_risk'
  | 'mitigated'
  | 'not_applicable'

export type AssessmentItemType =
  | 'manual_check'
  | 'document_check'
  | 'incident_review'
  | 'dispute_review'
  | 'news_review'
  | 'profile_check'
  | 'compliance_check'
  | 'questionnaire'
  | 'reviewer_judgment'

export type AssessmentEvidenceType =
  | 'vendor_document'
  | 'vendor_document_version'
  | 'incident'
  | 'dispute'
  | 'news_event'
  | 'vendor_profile'
  | 'prior_assessment'
  | 'manual_note'

export type AssessmentReviewType = 'ai' | 'human'

export type AssessmentReviewStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type AssessmentPeriodType = 'annual' | 'semiannual' | 'quarterly' | 'monthly' | 'ad_hoc'

export type AssessmentRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'informational'

export type FrameworkType =
  | 'due_diligence'
  | 'risk_assessment'
  | 'compliance'
  | 'security'
  | 'financial'
  | 'esg'
  | 'custom'

export type FrameworkScoringMethod = 'binary' | 'weighted' | 'percentage' | 'manual'

export type DocumentSourceType = 'standard' | 'custom'

// ─── Assessment Framework ──────────────────────────────────────────────────────

export interface AssessmentFramework {
  id: string
  org_id: string | null           // null = global / standard framework
  name: string
  description: string | null
  code: string | null
  kind: 'compliance_standard' | 'vendor_risk_framework'
  framework_type: FrameworkType | null
  version: string | null
  source_type: DocumentSourceType
  is_active: boolean
  metadata_json: Record<string, unknown> | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  deleted_at: string | null
}

// ─── Framework Item (template control / question) ─────────────────────────────

export interface MappedStandardRef {
  standard_id: string
  /** Clause/article/control ref (e.g. "5.2", "CC1.1", "45 CFR 164.308(a)(4)").
   *  Falls back to compliance_framework_key for long-tail frameworks without exact refs. */
  ref: string
  standard_name: string
  /** Human-readable name of the clause/article (e.g. "Information security policy"). Optional — present only for enriched frameworks. */
  ref_name?: string
}

export interface AssessmentFrameworkItem {
  id: string
  framework_id: string
  org_id: string | null
  title: string
  description: string | null
  category: string | null
  item_type: AssessmentItemType
  required: boolean
  weight: number
  scoring_method: FrameworkScoringMethod
  expected_document_type_id: string | null
  mapped_standard_refs: MappedStandardRef[] | null
  metadata_json: Record<string, unknown> | null
  sort_order: number
  universal_control_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ─── Vendor Assessment (parent assessment record) ─────────────────────────────

export interface VendorAssessmentRow {
  id: string
  org_id: string
  vendor_id: string
  is_onboarding: boolean
  assessment_type: 'due_diligence' | 'risk_assessment'
  title: string | null
  description: string | null
  period_type: AssessmentPeriodType | null
  period_start: string | null
  period_end: string | null
  status: AssessmentStatus
  overall_score: number | null
  risk_level: AssessmentRiskLevel | null
  assigned_to_user_id: string | null
  ai_status: 'queued' | 'processing' | 'done' | 'failed'
  ai_summary: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  human_notes: string | null
  submitted_at: string | null
  completed_at: string | null
  report_generated_at: string | null
  share_token: string | null
  share_token_expires_at: string | null
  final_summary: string | null
  final_recommendation: string | null
  report_file_key: string | null
  report_url: string | null
  assessment_code: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** Assessment row with joined relations */
export interface VendorAssessment extends VendorAssessmentRow {
  vendor: { id: string; name: string; vendor_code: string | null } | null
  /** All frameworks explicitly selected for this assessment */
  frameworks: { id: string; name: string; framework_type: FrameworkType | null }[]
  assigned_to: { name: string | null; email: string | null } | null
  created_by: { name: string | null; email: string | null } | null
  _item_counts?: {
    total: number
    not_started: number
    completed: number
    flagged: number   // needs_attention | high_risk
  }
}

// ─── Assessment Item (instantiated per assessment) ─────────────────────────────

export interface AssessmentItem {
  id: string
  org_id: string
  assessment_id: string
  framework_item_id: string | null
  title: string
  description: string | null
  category: string | null
  item_type: AssessmentItemType
  required: boolean
  weight: number
  status: AssessmentItemStatus
  score: number | null
  rationale: string | null
  reviewer_notes: string | null
  ai_notes: string | null
  human_notes: string | null
  expected_document_type_id: string | null
  mapped_standard_refs: MappedStandardRef[] | null
  framework_id: string | null   // enriched at query time from assessment_framework_items
  metadata_json: Record<string, unknown> | null
  sort_order: number
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joined
  evidence?: AssessmentItemEvidence[]
  findings?: AssessmentFinding[]
}

// ─── Assessment Item Evidence ──────────────────────────────────────────────────

export interface AssessmentItemEvidence {
  id: string
  org_id: string
  assessment_item_id: string
  evidence_type: AssessmentEvidenceType
  evidence_entity_id: string | null
  summary: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
  created_by_user_id: string | null
}

// ─── Assessment Finding ────────────────────────────────────────────────────────

export interface AssessmentFinding {
  id: string
  org_id: string
  assessment_id: string
  assessment_item_id: string | null
  doc_type_id: string | null
  title: string
  description: string | null
  severity: 'low' | 'medium' | 'high'
  status: 'open' | 'mitigated' | 'accepted' | 'closed'
  risk_domain: string | null
  risk_category: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joined
  mitigations?: AssessmentMitigation[]
}

// ─── Assessment Mitigation ─────────────────────────────────────────────────────

export interface AssessmentMitigation {
  id: string
  org_id: string
  finding_id: string
  assessment_id: string | null
  action: string
  owner_user_id: string | null
  due_at: string | null
  status: 'open' | 'in_progress' | 'done' | 'blocked'
  notes: string | null
  resolution_notes: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ─── Assessment Review ────────────────────────────────────────────────────────

export interface AssessmentReview {
  id: string
  org_id: string
  assessment_id: string
  review_type: AssessmentReviewType
  status: AssessmentReviewStatus
  reviewer_user_id: string | null
  review_summary: string | null
  detailed_findings: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ─── Assessment Report ────────────────────────────────────────────────────────

export interface AssessmentReport {
  id: string
  org_id: string
  assessment_id: string
  framework_id: string | null
  report_type: string
  version: number
  generated_by_user_id: string | null
  storage_path: string | null
  content_json: Record<string, unknown> | null
  created_at: string
}

// ─── Aggregated view for assessment detail page ───────────────────────────────

export interface AssessmentDetail {
  assessment: VendorAssessment
  items: AssessmentItem[]
  findings: AssessmentFinding[]
  reviews: AssessmentReview[]
  reports: AssessmentReport[]
}

// ─── Form state ───────────────────────────────────────────────────────────────

export type AssessmentFormState = {
  message?: string
  errors?: Partial<Record<string, string[]>>
  assessmentId?: string
  success?: boolean
}
