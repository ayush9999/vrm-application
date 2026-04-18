export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'detected' | 'investigating' | 'contained' | 'resolved' | 'closed'
export type IncidentType = 'data_breach' | 'service_outage' | 'compliance_violation' | 'security_incident' | 'quality_defect' | 'financial_issue' | 'contractual_breach' | 'other'
export type IncidentImpactScope = 'none' | 'limited' | 'moderate' | 'significant' | 'critical'
export type IncidentRootCause = 'human_error' | 'system_failure' | 'third_party' | 'malicious_actor' | 'process_gap' | 'unknown' | 'other'

export interface VendorIncident {
  id: string
  org_id: string
  vendor_id: string
  incident_date: string
  severity: IncidentSeverity
  status: IncidentStatus
  description: string
  notes: string | null
  // Classification
  incident_type: IncidentType | null
  impact_scope: IncidentImpactScope | null
  records_affected: number | null
  users_affected: number | null
  business_functions: string | null
  data_types_involved: string | null
  // Response timeline
  detected_at: string | null
  reported_by_vendor_at: string | null
  contained_at: string | null
  resolved_at: string | null
  closed_at: string | null
  // Root cause
  root_cause: IncidentRootCause | null
  root_cause_detail: string | null
  corrective_action: string | null
  corrective_verified: boolean
  corrective_verified_at: string | null
  // Regulatory
  is_reportable: boolean
  reporting_deadline: string | null
  reported_to_regulator: boolean
  reported_to_regulator_at: string | null
  regulator_reference: string | null
  applicable_regulation: string | null
  // SLA
  sla_notification_hours: number | null
  sla_breached: boolean
  // Links
  created_remediation_id: string | null
  triggered_review_id: string | null
  // Meta
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface CreateIncidentInput {
  incident_date: string
  severity: IncidentSeverity
  status?: IncidentStatus
  description: string
  notes?: string | null
  incident_type?: IncidentType | string | null
  impact_scope?: IncidentImpactScope | string | null
  records_affected?: number | null
  users_affected?: number | null
  data_types_involved?: string | null
  detected_at?: string | null
  reported_by_vendor_at?: string | null
  root_cause?: IncidentRootCause | string | null
  root_cause_detail?: string | null
  sla_notification_hours?: number | null
  is_reportable?: boolean
  applicable_regulation?: string | null
  reporting_deadline?: string | null
}

export interface UpdateIncidentInput extends Partial<CreateIncidentInput> {
  contained_at?: string | null
  resolved_at?: string | null
  closed_at?: string | null
  corrective_action?: string | null
  corrective_verified?: boolean
  reported_to_regulator?: boolean
  reported_to_regulator_at?: string | null
  regulator_reference?: string | null
}

export interface IncidentEvidence {
  id: string
  incident_id: string
  file_name: string
  file_key: string | null
  file_url: string | null
  description: string | null
  uploaded_by_user_id: string | null
  uploaded_at: string
}

export interface IncidentCommunication {
  id: string
  incident_id: string
  direction: 'internal' | 'to_vendor' | 'from_vendor' | 'to_regulator'
  subject: string | null
  body: string
  sent_by_user_id: string | null
  sent_by_name?: string | null
  created_at: string
}
