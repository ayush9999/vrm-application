import { randomBytes } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type PortalLinkStatus = 'active' | 'submitted' | 'expired' | 'revoked'

export interface VendorPortalLink {
  id: string
  org_id: string
  vendor_id: string
  vendor_review_pack_id: string
  token: string
  recipient_email: string | null
  expires_at: string
  status: PortalLinkStatus
  created_by_user_id: string | null
  created_at: string
  submitted_at: string | null
  revoked_at: string | null
  last_accessed_at: string | null
  access_count: number
}

/** Create a new portal link with a fresh token + expiry. */
export async function createPortalLink(params: {
  orgId: string
  vendorId: string
  vendorReviewPackId: string
  createdByUserId: string
  recipientEmail?: string | null
  expiryDays?: number
}): Promise<VendorPortalLink> {
  const supabase = await createServerClient()
  const token = randomBytes(24).toString('hex')
  const days = params.expiryDays ?? 14
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('vendor_portal_links')
    .insert({
      org_id: params.orgId,
      vendor_id: params.vendorId,
      vendor_review_pack_id: params.vendorReviewPackId,
      token,
      recipient_email: params.recipientEmail ?? null,
      expires_at: expiresAt,
      created_by_user_id: params.createdByUserId,
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as VendorPortalLink
}

/** List all portal links for a vendor review pack (org-side view). */
export async function listPortalLinks(
  vendorReviewPackId: string,
): Promise<VendorPortalLink[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_portal_links')
    .select('*')
    .eq('vendor_review_pack_id', vendorReviewPackId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VendorPortalLink[]
}

/** Revoke a portal link (admin-side). */
export async function revokePortalLink(linkId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_portal_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', linkId)
  if (error) throw new Error(error.message)
}

// ─── PUBLIC SIDE — uses service client (no auth) ─────────────────────────────

/** Resolve a token → link + pack + items. Service client (no RLS). */
export async function getPortalContextByToken(token: string) {
  const service = createServiceClient()

  const { data: link, error } = await service
    .from('vendor_portal_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!link) return null

  // Status checks
  let status = (link as VendorPortalLink).status
  const expired = new Date((link as VendorPortalLink).expires_at) < new Date()
  if (expired && status === 'active') status = 'expired'

  // Always update last_accessed + access_count, even for expired/revoked
  // so admin can see vendor tried to use it.
  await service
    .from('vendor_portal_links')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: ((link as { access_count: number }).access_count ?? 0) + 1,
    })
    .eq('id', (link as VendorPortalLink).id)

  if (status !== 'active') {
    return { link: link as VendorPortalLink, status, vendor: null, pack: null, items: [], evidence: [] }
  }

  // Fetch the vendor + pack + items + evidence
  const [vendorRes, packRes, itemsRes, evidenceRes] = await Promise.all([
    service
      .from('vendors')
      .select('id, name, vendor_code')
      .eq('id', (link as VendorPortalLink).vendor_id)
      .maybeSingle(),
    service
      .from('vendor_review_packs')
      .select(`
        id, status,
        review_packs!inner ( id, name, code, description )
      `)
      .eq('id', (link as VendorPortalLink).vendor_review_pack_id)
      .maybeSingle(),
    service
      .from('vendor_review_items')
      .select(`
        id, decision, reviewer_comment,
        review_requirements!inner (
          id, name, description, required, linked_evidence_requirement_id
        )
      `)
      .eq('vendor_review_pack_id', (link as VendorPortalLink).vendor_review_pack_id)
      .order('created_at'),
    service
      .from('vendor_documents')
      .select(`
        id, evidence_status, evidence_requirement_id,
        evidence_requirements ( id, name, required, expiry_applies, review_pack_id ),
        current_version_id
      `)
      .eq('vendor_id', (link as VendorPortalLink).vendor_id)
      .not('evidence_requirement_id', 'is', null),
  ])

  // Filter evidence to only those belonging to this pack
  const packId = (packRes.data as { review_packs: { id: string } } | null)?.review_packs?.id
  const filteredEvidence = (evidenceRes.data ?? []).filter((e) => {
    const req = (e as { evidence_requirements: { review_pack_id: string } | null }).evidence_requirements
    return req?.review_pack_id === packId
  })

  return {
    link: link as VendorPortalLink,
    status,
    vendor: vendorRes.data as { id: string; name: string; vendor_code: string | null } | null,
    pack: packRes.data as { id: string; status: string; review_packs: { id: string; name: string; code: string | null; description: string | null } } | null,
    items: itemsRes.data ?? [],
    evidence: filteredEvidence,
  }
}

/**
 * Vendor (via portal) submits a review item response: a self-attested
 * decision + comment. Stored as a submission AND copied into vendor_review_items
 * with a marker so internal users can see it came from the portal.
 */
export async function submitPortalReviewResponse(params: {
  token: string
  reviewItemId: string
  selfDecision: 'pass' | 'fail' | 'na'  // limited subset for vendor self-attestation
  comment: string | null
}): Promise<{ success: boolean; message?: string }> {
  const service = createServiceClient()

  // Validate token
  const { data: link } = await service
    .from('vendor_portal_links')
    .select('id, org_id, vendor_id, vendor_review_pack_id, status, expires_at')
    .eq('token', params.token)
    .maybeSingle()
  if (!link) return { success: false, message: 'Invalid token' }
  const linkRow = link as { id: string; org_id: string; vendor_id: string; vendor_review_pack_id: string; status: string; expires_at: string }
  if (linkRow.status !== 'active') return { success: false, message: 'Link no longer active' }
  if (new Date(linkRow.expires_at) < new Date()) return { success: false, message: 'Link expired' }

  // Verify the review item belongs to this pack
  const { data: item } = await service
    .from('vendor_review_items')
    .select('id, vendor_review_pack_id')
    .eq('id', params.reviewItemId)
    .maybeSingle()
  if (!item || (item as { vendor_review_pack_id: string }).vendor_review_pack_id !== linkRow.vendor_review_pack_id) {
    return { success: false, message: 'Invalid review item for this link' }
  }

  // Store the submission
  await service.from('vendor_portal_submissions').insert({
    org_id: linkRow.org_id,
    vendor_portal_link_id: linkRow.id,
    vendor_review_item_id: params.reviewItemId,
    submission_type: 'review_response',
    payload: { self_decision: params.selfDecision, comment: params.comment },
  })

  // Update the review item: store the comment as a vendor-attested response.
  // Keep decision='not_started' so internal user must finalize. Append to comment.
  const vendorPrefix = `[Vendor self-attested ${params.selfDecision.toUpperCase()}]`
  const fullComment = params.comment
    ? `${vendorPrefix} ${params.comment}`
    : vendorPrefix
  await service
    .from('vendor_review_items')
    .update({ reviewer_comment: fullComment })
    .eq('id', params.reviewItemId)

  return { success: true }
}

/**
 * Vendor (via portal) uploads evidence file for a specific evidence_requirement.
 */
export async function submitPortalEvidenceUpload(params: {
  token: string
  evidenceId: string                   // vendor_documents.id
  fileKey: string                      // path in storage
  fileName: string
  mimeType: string | null
}): Promise<{ success: boolean; message?: string }> {
  const service = createServiceClient()

  // Validate token
  const { data: link } = await service
    .from('vendor_portal_links')
    .select('id, org_id, vendor_id, vendor_review_pack_id, status, expires_at')
    .eq('token', params.token)
    .maybeSingle()
  if (!link) return { success: false, message: 'Invalid token' }
  const linkRow = link as { id: string; org_id: string; vendor_id: string; vendor_review_pack_id: string; status: string; expires_at: string }
  if (linkRow.status !== 'active') return { success: false, message: 'Link no longer active' }
  if (new Date(linkRow.expires_at) < new Date()) return { success: false, message: 'Link expired' }

  // Verify the evidence row belongs to this vendor + pack
  const { data: ev } = await service
    .from('vendor_documents')
    .select(`
      id, vendor_id, evidence_requirement_id,
      evidence_requirements ( review_pack_id )
    `)
    .eq('id', params.evidenceId)
    .maybeSingle()
  type EvRow = { vendor_id: string; evidence_requirements: { review_pack_id: string } | null }
  const evRow = ev as EvRow | null
  if (!evRow || evRow.vendor_id !== linkRow.vendor_id) return { success: false, message: 'Invalid evidence' }
  if (evRow.evidence_requirements?.review_pack_id !== linkRow.vendor_review_pack_id) {
    return { success: false, message: 'Evidence does not belong to this pack' }
  }

  // Insert version
  const { data: version, error: vErr } = await service
    .from('vendor_document_versions')
    .insert({
      org_id: linkRow.org_id,
      vendor_document_id: params.evidenceId,
      file_key: params.fileKey,
      file_name: params.fileName,
      mime_type: params.mimeType,
    })
    .select('id')
    .single()
  if (vErr) return { success: false, message: vErr.message }

  // Update evidence row → status uploaded, current version
  await service
    .from('vendor_documents')
    .update({
      current_version_id: (version as { id: string }).id,
      evidence_status: 'uploaded',
    })
    .eq('id', params.evidenceId)

  // Log submission
  await service.from('vendor_portal_submissions').insert({
    org_id: linkRow.org_id,
    vendor_portal_link_id: linkRow.id,
    vendor_document_id: params.evidenceId,
    submission_type: 'evidence_upload',
    payload: { file_name: params.fileName, mime_type: params.mimeType },
  })

  return { success: true }
}

/** Vendor clicks "Submit" on the portal — finalizes the link. */
export async function finalizePortalSubmission(token: string): Promise<{ success: boolean; message?: string }> {
  const service = createServiceClient()
  const { data: link } = await service
    .from('vendor_portal_links')
    .select('id, status, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!link) return { success: false, message: 'Invalid token' }
  const row = link as { id: string; status: string; expires_at: string }
  if (row.status !== 'active') return { success: false, message: 'Link no longer active' }
  if (new Date(row.expires_at) < new Date()) return { success: false, message: 'Link expired' }

  await service
    .from('vendor_portal_links')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', row.id)
  return { success: true }
}
