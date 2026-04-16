import { createServerClient } from '@/lib/supabase/server'
import type { EvidenceStatus } from '@/types/review-pack'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EvidenceRow {
  /** vendor_documents row id (the instance for this vendor) */
  id: string
  vendor_id: string
  evidence_requirement_id: string | null
  evidence_status: EvidenceStatus
  expiry_date: string | null
  current_version_id: string | null
  last_verified_at: string | null
  verified_by_user_id: string | null
  verification_notes: string | null
  // joined evidence requirement
  requirement_name: string | null
  requirement_description: string | null
  requirement_required: boolean
  requirement_expiry_applies: boolean
  // joined review pack (parent of requirement)
  pack_id: string | null
  pack_name: string | null
  pack_code: string | null
  // joined current version (latest file)
  file_name: string | null
  file_key: string | null
  uploaded_at: string | null
}

export interface EvidenceVersion {
  id: string
  file_name: string | null
  file_key: string
  uploaded_at: string
  uploaded_by_user_id: string | null
  uploaded_by_name?: string | null
}

export interface EvidenceByPack {
  pack_id: string | null
  pack_name: string | null
  pack_code: string | null
  rows: EvidenceRow[]
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Fetch all evidence rows for a vendor, grouped by review pack. */
export async function getVendorEvidenceGrouped(vendorId: string): Promise<EvidenceByPack[]> {
  const supabase = await createServerClient()

  // Fetch vendor_documents with joined requirement + pack
  const { data, error } = await supabase
    .from('vendor_documents')
    .select(`
      id, vendor_id, evidence_requirement_id, evidence_status, expiry_date,
      current_version_id, last_verified_at, verified_by_user_id, verification_notes,
      evidence_requirements (
        id, name, description, required, expiry_applies,
        review_packs ( id, name, code )
      )
    `)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  type Row = {
    id: string
    vendor_id: string
    evidence_requirement_id: string | null
    evidence_status: EvidenceStatus
    expiry_date: string | null
    current_version_id: string | null
    last_verified_at: string | null
    verified_by_user_id: string | null
    verification_notes: string | null
    evidence_requirements: {
      id: string
      name: string
      description: string | null
      required: boolean
      expiry_applies: boolean
      review_packs: { id: string; name: string; code: string | null } | null
    } | null
  }

  const rows = (data ?? []) as unknown as Row[]

  // Fetch all current versions in one query (only for rows that have a version)
  const versionIds = rows.map((r) => r.current_version_id).filter((v): v is string => !!v)
  const versionMap = new Map<string, { file_name: string | null; file_key: string; uploaded_at: string }>()
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from('vendor_document_versions')
      .select('id, file_name, file_key, uploaded_at')
      .in('id', versionIds)
    for (const v of (versions ?? []) as Array<{ id: string; file_name: string | null; file_key: string; uploaded_at: string }>) {
      versionMap.set(v.id, { file_name: v.file_name, file_key: v.file_key, uploaded_at: v.uploaded_at })
    }
  }

  const flat: EvidenceRow[] = rows.map((r) => {
    const v = r.current_version_id ? versionMap.get(r.current_version_id) : null
    return {
      id: r.id,
      vendor_id: r.vendor_id,
      evidence_requirement_id: r.evidence_requirement_id,
      evidence_status: r.evidence_status,
      expiry_date: r.expiry_date,
      current_version_id: r.current_version_id,
      last_verified_at: r.last_verified_at,
      verified_by_user_id: r.verified_by_user_id,
      verification_notes: r.verification_notes,
      requirement_name: r.evidence_requirements?.name ?? null,
      requirement_description: r.evidence_requirements?.description ?? null,
      requirement_required: r.evidence_requirements?.required ?? false,
      requirement_expiry_applies: r.evidence_requirements?.expiry_applies ?? false,
      pack_id: r.evidence_requirements?.review_packs?.id ?? null,
      pack_name: r.evidence_requirements?.review_packs?.name ?? null,
      pack_code: r.evidence_requirements?.review_packs?.code ?? null,
      file_name: v?.file_name ?? null,
      file_key: v?.file_key ?? null,
      uploaded_at: v?.uploaded_at ?? null,
    }
  })

  // Group by pack
  const groups = new Map<string, EvidenceByPack>()
  for (const row of flat) {
    const key = row.pack_id ?? '__unlinked__'
    if (!groups.has(key)) {
      groups.set(key, {
        pack_id: row.pack_id,
        pack_name: row.pack_name ?? 'Unlinked Evidence',
        pack_code: row.pack_code,
        rows: [],
      })
    }
    groups.get(key)!.rows.push(row)
  }

  return Array.from(groups.values()).sort((a, b) =>
    (a.pack_name ?? '').localeCompare(b.pack_name ?? ''),
  )
}

/** Get version history (all uploads) for a single evidence row. */
export async function getEvidenceVersions(vendorDocumentId: string): Promise<EvidenceVersion[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_document_versions')
    .select(`
      id, file_name, file_key, uploaded_at, uploaded_by_user_id,
      users:users!vendor_document_versions_uploaded_by_user_id_fkey ( name )
    `)
    .eq('vendor_document_id', vendorDocumentId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)

  type Row = {
    id: string
    file_name: string | null
    file_key: string
    uploaded_at: string
    uploaded_by_user_id: string | null
    users: { name: string | null } | null
  }

  return (data ?? []).map((r) => {
    const row = r as unknown as Row
    return {
      id: row.id,
      file_name: row.file_name,
      file_key: row.file_key,
      uploaded_at: row.uploaded_at,
      uploaded_by_user_id: row.uploaded_by_user_id,
      uploaded_by_name: row.users?.name ?? null,
    }
  })
}

// ─── Status helpers ─────────────────────────────────────────────────────────

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

  const map: Record<EvidenceStatus, { label: string; color: string; bg: string }> = {
    missing:       { label: 'Missing',       color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    uploaded:      { label: 'Uploaded',      color: '#0284c7', bg: 'rgba(14,165,233,0.1)' },
    under_review:  { label: 'Under Review',  color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
    approved:      { label: 'Approved',      color: '#059669', bg: 'rgba(5,150,105,0.1)' },
    rejected:      { label: 'Rejected',      color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
    expired:       { label: 'Expired',       color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
    waived:        { label: 'Waived',        color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
  }

  return {
    status,
    ...map[status],
    showExpiry: status === 'approved' || status === 'expired',
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function setEvidenceStatus(
  evidenceId: string,
  status: EvidenceStatus,
  reviewerComment: string | null,
  reviewedByUserId: string,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_documents')
    .update({
      evidence_status: status,
      verification_notes: reviewerComment,
      last_verified_at: new Date().toISOString(),
      verified_by_user_id: reviewedByUserId,
    })
    .eq('id', evidenceId)
  if (error) throw new Error(error.message)
}

export async function setEvidenceExpiry(
  evidenceId: string,
  expiryDate: string | null,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_documents')
    .update({ expiry_date: expiryDate })
    .eq('id', evidenceId)
  if (error) throw new Error(error.message)
}
