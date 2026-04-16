/**
 * Pure helpers + types for the Evidence model. Safe to import from client
 * components (no cookies / next/headers usage).
 */

import type { EvidenceStatus } from '@/types/review-pack'

export interface EvidenceRow {
  id: string
  vendor_id: string
  evidence_requirement_id: string | null
  evidence_status: EvidenceStatus
  expiry_date: string | null
  current_version_id: string | null
  last_verified_at: string | null
  verified_by_user_id: string | null
  verification_notes: string | null
  requirement_name: string | null
  requirement_description: string | null
  requirement_required: boolean
  requirement_expiry_applies: boolean
  pack_id: string | null
  pack_name: string | null
  pack_code: string | null
  file_name: string | null
  file_key: string | null
  uploaded_at: string | null
}

export interface EvidenceByPack {
  pack_id: string | null
  pack_name: string | null
  pack_code: string | null
  rows: EvidenceRow[]
}

export interface EvidenceVersion {
  id: string
  file_name: string | null
  file_key: string
  uploaded_at: string
  uploaded_by_user_id: string | null
  uploaded_by_name?: string | null
}

const STATUS_MAP: Record<EvidenceStatus, { label: string; color: string; bg: string }> = {
  missing:       { label: 'Missing',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  uploaded:      { label: 'Uploaded',      color: '#0284c7', bg: 'rgba(14,165,233,0.1)' },
  under_review:  { label: 'Under Review',  color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  approved:      { label: 'Approved',      color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  rejected:      { label: 'Rejected',      color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  expired:       { label: 'Expired',       color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  waived:        { label: 'Waived',        color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
}

export function computeEvidenceUiStatus(row: EvidenceRow): {
  status: EvidenceStatus
  label: string
  color: string
  bg: string
  showExpiry: boolean
} {
  let status: EvidenceStatus = row.evidence_status

  // Auto-mark Expired if past expiry date AND was approved
  if (status === 'approved' && row.expiry_date) {
    const exp = new Date(row.expiry_date)
    if (exp < new Date()) status = 'expired'
  }

  return {
    status,
    ...STATUS_MAP[status],
    showExpiry: status === 'approved' || status === 'expired',
  }
}
