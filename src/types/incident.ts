export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'resolved'

export interface VendorIncident {
  id: string
  org_id: string
  vendor_id: string
  incident_date: string        // date as ISO string
  severity: IncidentSeverity
  status: IncidentStatus
  description: string
  notes: string | null
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
}

export interface UpdateIncidentInput {
  incident_date?: string
  severity?: IncidentSeverity
  status?: IncidentStatus
  description?: string
  notes?: string | null
}
