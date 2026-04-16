// ─── Issues & Remediation types (migration 012 + 018 extensions) ────────────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type IssueStatus =
  | 'open' | 'in_progress' | 'blocked' | 'deferred'
  | 'waiting_on_vendor' | 'waiting_internal_review'
  | 'resolved' | 'verified' | 'closed'

export type IssueDisposition = 'remediate' | 'accepted_risk'

export type IssueSource = 'review' | 'manual' | 'monitoring'

export type IssueType = 'control_level' | 'grouped' | 'general'

export type EvidenceReviewStatus = 'pending' | 'accepted' | 'rejected'

// ─── Core Issue (Remediation) ───────────────────────────────────────────────

export interface Issue {
  id: string
  org_id: string
  vendor_id: string
  title: string
  description: string | null
  severity: IssueSeverity
  status: IssueStatus
  disposition: IssueDisposition
  source: IssueSource
  type: IssueType
  owner_user_id: string | null
  due_date: string | null
  remediation_plan: string | null
  resolution_notes: string | null
  accepted_reason: string | null
  accepted_by_user_id: string | null
  accepted_at: string | null
  resolved_at: string | null
  closed_at: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Remediation extensions (migration 018)
  root_cause: string | null
  source_review_requirement_id: string | null
  source_vendor_review_pack_id: string | null
  closure_evidence_url: string | null
  verified_by_user_id: string | null
  verified_at: string | null
  // joined
  vendor_name?: string
  owner_name?: string
  evidence?: IssueEvidence[]
  activity?: IssueActivity[]
  _counts?: {
    evidence: number
  }
}

// ─── Issue Evidence ─────────────────────────────────────────────────────────

export interface IssueEvidence {
  id: string
  issue_id: string
  vendor_document_id: string | null
  file_name: string
  file_key: string | null
  file_url: string | null
  notes: string | null
  review_status: EvidenceReviewStatus
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  uploaded_by_user_id: string | null
  uploaded_at: string
}

// ─── Issue Activity ─────────────────────────────────────────────────────────

export interface IssueActivity {
  id: string
  issue_id: string
  user_id: string | null
  action: string
  old_value: string | null
  new_value: string | null
  note: string | null
  created_at: string
  // joined
  user_name?: string
}

// ─── Form state ─────────────────────────────────────────────────────────────

export type IssueFormState = {
  message?: string
  errors?: Partial<Record<string, string[]>>
  issueId?: string
  success?: boolean
}
