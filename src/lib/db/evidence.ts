import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import type { EvidenceStatus } from '@/types/review-pack'
import type { EvidenceRow, EvidenceByPack, EvidenceVersion } from '@/lib/evidence-ui'

// Re-export types for back-compat (callers that previously imported from here keep working)
export type { EvidenceRow, EvidenceByPack, EvidenceVersion } from '@/lib/evidence-ui'
export { computeEvidenceUiStatus } from '@/lib/evidence-ui'

// ─── Queries ────────────────────────────────────────────────────────────────

/** Fetch all evidence rows for a vendor, grouped by review pack. */
export async function getVendorEvidenceGrouped(vendorId: string): Promise<EvidenceByPack[]> {
  type DocRow = {
    id: string
    vendor_id: string
    evidence_requirement_id: string | null
    evidence_status: EvidenceStatus
    expiry_date: string | null
    current_version_id: string | null
    last_verified_at: string | null
    verified_by_user_id: string | null
    verification_notes: string | null
    req_id: string | null
    req_name: string | null
    req_description: string | null
    req_required: boolean | null
    req_expiry_applies: boolean | null
    pack_id: string | null
    pack_name: string | null
    pack_code: string | null
  }

  const rows = await sql<DocRow[]>`
    SELECT
      vd.id, vd.vendor_id, vd.evidence_requirement_id, vd.evidence_status,
      vd.expiry_date, vd.current_version_id, vd.last_verified_at,
      vd.verified_by_user_id, vd.verification_notes,
      er.id AS req_id, er.name AS req_name, er.description AS req_description,
      er.required AS req_required, er.expiry_applies AS req_expiry_applies,
      rp.id AS pack_id, rp.name AS pack_name, rp.code AS pack_code
    FROM vendor_documents vd
    LEFT JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id
    LEFT JOIN review_packs rp ON rp.id = er.review_pack_id
    WHERE vd.vendor_id = ${vendorId}
      AND vd.deleted_at IS NULL
  `

  // Fetch all current versions in one query (only for rows that have a version)
  const versionIds = rows.map((r) => r.current_version_id).filter((v): v is string => !!v)
  const versionMap = new Map<string, { file_name: string | null; file_key: string; uploaded_at: string }>()
  if (versionIds.length > 0) {
    const versions = await sql<{ id: string; file_name: string | null; file_key: string; uploaded_at: string }[]>`
      SELECT id, file_name, file_key, uploaded_at
      FROM vendor_document_versions
      WHERE id = ANY(${versionIds})
    `
    for (const v of versions) {
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
      requirement_name: r.req_name ?? null,
      requirement_description: r.req_description ?? null,
      requirement_required: r.req_required ?? false,
      requirement_expiry_applies: r.req_expiry_applies ?? false,
      pack_id: r.pack_id ?? null,
      pack_name: r.pack_name ?? null,
      pack_code: r.pack_code ?? null,
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
  const rows = await sql`
    SELECT vdv.id, vdv.file_name, vdv.file_key, vdv.uploaded_at,
      vdv.uploaded_by_user_id, u.name AS uploaded_by_name
    FROM vendor_document_versions vdv
    LEFT JOIN users u ON u.id = vdv.uploaded_by_user_id
    WHERE vdv.vendor_document_id = ${vendorDocumentId}
      AND vdv.deleted_at IS NULL
    ORDER BY vdv.uploaded_at DESC
  `
  return rows as EvidenceVersion[]
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
