import { randomBytes } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type EvidenceRequestStatus = 'sent' | 'partially_replied' | 'completed' | 'cancelled'
export type EvidenceRequestItemStatus = 'pending' | 'replied'

export interface EvidenceRequest {
  id: string
  org_id: string
  vendor_id: string
  created_by_user_id: string | null
  message: string | null
  due_date: string | null
  recipient_emails: string[]
  token: string
  expires_at: string
  status: EvidenceRequestStatus
  sent_at: string
  first_opened_at: string | null
  last_accessed_at: string | null
  access_count: number
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface EvidenceRequestItem {
  id: string
  evidence_request_id: string
  vendor_document_id: string
  status: EvidenceRequestItemStatus
  replied_at: string | null
  created_at: string
}

export interface EvidenceRequestSummary extends EvidenceRequest {
  total_items: number
  replied_items: number
  created_by_name: string | null
}

// ─── Authenticated, org-side queries ─────────────────────────────────────────

/** Create a new evidence request + its items. Returns the request with token. */
export async function createEvidenceRequest(params: {
  orgId: string
  vendorId: string
  createdByUserId: string
  vendorDocumentIds: string[]
  message: string | null
  dueDate: string | null
  recipientEmails: string[]
  expiryDays: number
}): Promise<EvidenceRequest> {
  if (params.vendorDocumentIds.length === 0) {
    throw new Error('At least one item must be selected')
  }

  const supabase = await createServerClient()
  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(
    Date.now() + Math.max(1, params.expiryDays) * 86_400_000,
  ).toISOString()

  const { data: request, error } = await supabase
    .from('evidence_requests')
    .insert({
      org_id: params.orgId,
      vendor_id: params.vendorId,
      created_by_user_id: params.createdByUserId,
      message: params.message,
      due_date: params.dueDate,
      recipient_emails: params.recipientEmails,
      token,
      expires_at: expiresAt,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const reqRow = request as EvidenceRequest

  // Insert items
  const itemRows = params.vendorDocumentIds.map((id) => ({
    evidence_request_id: reqRow.id,
    vendor_document_id: id,
  }))
  const { error: iErr } = await supabase.from('evidence_request_items').insert(itemRows)
  if (iErr) throw new Error(iErr.message)

  return reqRow
}

/** List all requests for a vendor (most recent first), with progress counts. */
export async function listEvidenceRequestsForVendor(
  vendorId: string,
): Promise<EvidenceRequestSummary[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('evidence_requests')
    .select(`
      *,
      evidence_request_items ( id, status ),
      created_by:users!evidence_requests_created_by_user_id_fkey ( id, name, email )
    `)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as unknown as EvidenceRequest & {
      evidence_request_items: { id: string; status: EvidenceRequestItemStatus }[]
      created_by: { id: string; name: string | null; email: string | null } | null
    }
    const items = r.evidence_request_items ?? []
    return {
      ...r,
      total_items: items.length,
      replied_items: items.filter((i) => i.status === 'replied').length,
      created_by_name: r.created_by?.name ?? r.created_by?.email ?? null,
    }
  })
}

/** Cancel an active request. */
export async function cancelEvidenceRequest(requestId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('evidence_requests')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', requestId)
    .in('status', ['sent', 'partially_replied'])
  if (error) throw new Error(error.message)
}

/** Soft-delete a request — hides from list, preserves the row in DB. */
export async function softDeleteEvidenceRequest(requestId: string): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('evidence_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

/** For each vendor_document_id, returns the most recent open request that includes it (or null). */
export async function getActiveRequestByVendorDocument(
  vendorId: string,
): Promise<Map<string, { request_id: string; sent_at: string; status: EvidenceRequestItemStatus; replied_at: string | null }>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('evidence_request_items')
    .select(`
      vendor_document_id, status, replied_at,
      evidence_requests!inner ( id, vendor_id, status, sent_at, deleted_at )
    `)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const map = new Map<string, { request_id: string; sent_at: string; status: EvidenceRequestItemStatus; replied_at: string | null }>()
  for (const row of (data ?? []) as unknown as Array<{
    vendor_document_id: string
    status: EvidenceRequestItemStatus
    replied_at: string | null
    evidence_requests: { id: string; vendor_id: string; status: EvidenceRequestStatus; sent_at: string; deleted_at: string | null }
  }>) {
    const r = row.evidence_requests
    if (r.vendor_id !== vendorId) continue
    if (r.deleted_at) continue
    if (r.status === 'cancelled') continue
    // Latest wins because rows are ordered by created_at desc
    if (!map.has(row.vendor_document_id)) {
      map.set(row.vendor_document_id, {
        request_id: r.id,
        sent_at: r.sent_at,
        status: row.status,
        replied_at: row.replied_at,
      })
    }
  }
  return map
}

// ─── Public-side (portal) queries — service client, no RLS ───────────────────

/**
 * Resolve a request token to its full context: request, vendor, items + their
 * vendor_document/requirement metadata. Bumps access_count and last_accessed_at.
 */
export async function getEvidenceRequestByToken(token: string) {
  const service = createServiceClient()

  const { data: req, error } = await service
    .from('evidence_requests')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!req) return null

  const reqRow = req as EvidenceRequest

  // Compute live status (expiry / cancelled)
  let liveStatus: EvidenceRequestStatus | 'expired' = reqRow.status
  if (new Date(reqRow.expires_at) < new Date() && liveStatus !== 'completed' && liveStatus !== 'cancelled') {
    liveStatus = 'expired'
  }

  // Always log access — even for expired/cancelled — so admin sees vendor tried
  await service
    .from('evidence_requests')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: reqRow.access_count + 1,
      first_opened_at: reqRow.first_opened_at ?? new Date().toISOString(),
    })
    .eq('id', reqRow.id)

  if (liveStatus === 'cancelled' || liveStatus === 'expired' || liveStatus === 'completed') {
    return { request: reqRow, liveStatus, vendor: null, items: [] }
  }

  const [vendorRes, itemsRes] = await Promise.all([
    service
      .from('vendors')
      .select('id, name, vendor_code')
      .eq('id', reqRow.vendor_id)
      .maybeSingle(),
    service
      .from('evidence_request_items')
      .select(`
        id, status, replied_at, vendor_document_id,
        vendor_documents!inner (
          id, evidence_status, evidence_requirement_id,
          evidence_requirements ( id, name, description, required, expiry_applies, accepted_formats, review_pack_id, review_packs ( id, name, code ) )
        )
      `)
      .eq('evidence_request_id', reqRow.id)
      .order('created_at'),
  ])

  return {
    request: reqRow,
    liveStatus,
    vendor: vendorRes.data as { id: string; name: string; vendor_code: string | null } | null,
    items: itemsRes.data ?? [],
  }
}

/** Mark a single item as replied. Bumps the request status if appropriate. */
export async function markRequestItemReplied(params: {
  requestId: string
  vendorDocumentId: string
}): Promise<void> {
  const service = createServiceClient()

  await service
    .from('evidence_request_items')
    .update({ status: 'replied', replied_at: new Date().toISOString() })
    .eq('evidence_request_id', params.requestId)
    .eq('vendor_document_id', params.vendorDocumentId)
    .eq('status', 'pending')

  // Recompute aggregate status
  const { data: items } = await service
    .from('evidence_request_items')
    .select('status')
    .eq('evidence_request_id', params.requestId)

  const all = (items ?? []) as { status: EvidenceRequestItemStatus }[]
  if (all.length === 0) return
  const replied = all.filter((i) => i.status === 'replied').length

  let newStatus: EvidenceRequestStatus
  let completedAt: string | null = null
  if (replied === all.length) {
    newStatus = 'completed'
    completedAt = new Date().toISOString()
  } else if (replied > 0) {
    newStatus = 'partially_replied'
  } else {
    newStatus = 'sent'
  }

  await service
    .from('evidence_requests')
    .update({
      status: newStatus,
      ...(completedAt ? { completed_at: completedAt } : {}),
    })
    .eq('id', params.requestId)
}
