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
  /** Soft refresh window in days. NULL = no refresh tracking. */
  requirement_refresh_after_days: number | null
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
  missing:       { label: 'Missing',       color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
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
  /** True when the doc is still approved/valid but is past its soft refresh window. */
  isStale: boolean
  /** Days since the doc was last verified (only meaningful when isStale). */
  staleDays: number | null
} {
  let status: EvidenceStatus = row.evidence_status

  // Auto-mark Expired if past expiry date AND was approved
  if (status === 'approved' && row.expiry_date) {
    const exp = new Date(row.expiry_date)
    if (exp < new Date()) status = 'expired'
  }

  // Compute stale: approved doc whose age exceeds the requirement's refresh window
  let isStale = false
  let staleDays: number | null = null
  if (
    status === 'approved' &&
    row.requirement_refresh_after_days != null &&
    row.last_verified_at
  ) {
    const verifiedAt = new Date(row.last_verified_at).getTime()
    const ageMs = Date.now() - verifiedAt
    const ageDays = Math.floor(ageMs / 86_400_000)
    if (ageDays > row.requirement_refresh_after_days) {
      isStale = true
      staleDays = ageDays
    }
  }

  return {
    status,
    ...STATUS_MAP[status],
    showExpiry: status === 'approved' || status === 'expired',
    isStale,
    staleDays,
  }
}
