// ─── Issues & Remediation types (mirror 012_issues_and_remediation.sql) ──────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'deferred' | 'resolved' | 'closed'

export type IssueDisposition = 'remediate' | 'accepted_risk'

export type IssueSource = 'assessment' | 'manual' | 'monitoring'

export type IssueType = 'control_level' | 'grouped' | 'general'

export type EvidenceReviewStatus = 'pending' | 'accepted' | 'rejected'

// ─── Core Issue ─────────────────────────────────────────────────────────────

export interface Issue {
  id: string
  org_id: string
  vendor_id: string
  assessment_id: string | null
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
  // joined
  vendor_name?: string
  owner_name?: string
  assessment_title?: string
  assessment_code?: string
  controls?: IssueControl[]
  evidence?: IssueEvidence[]
  findings?: IssueFinding[]
  activity?: IssueActivity[]
  _counts?: {
    controls: number
    evidence: number
    findings: number
  }
}

// ─── Issue Controls (many-to-many) ──────────────────────────────────────────

export interface IssueControl {
  id: string
  issue_id: string
  assessment_item_id: string | null
  assessment_finding_id: string | null
  framework_item_id: string | null
  created_at: string
  // joined
  control_title?: string
  control_status?: string
  framework_name?: string
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

// ─── Issue Findings (finding → issue mapping) ───────────────────────────────

export interface IssueFinding {
  id: string
  issue_id: string
  assessment_finding_id: string
  created_at: string
  // joined
  finding_title?: string
  finding_severity?: string
}

// ─── Form state ─────────────────────────────────────────────────────────────

export type IssueFormState = {
  message?: string
  errors?: Partial<Record<string, string[]>>
  issueId?: string
  success?: boolean
}
