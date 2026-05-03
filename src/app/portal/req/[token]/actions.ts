'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { markRequestItemReplied } from '@/lib/db/evidence-requests'

const STORAGE_BUCKET = 'vendor-documents'

/**
 * Vendor (via request-scoped portal) uploads a file for one item in the request.
 * Verifies the item belongs to the request, uploads the file, creates a version
 * row, marks the vendor_document as 'uploaded', and flips the request item to 'replied'.
 */
export async function uploadRequestEvidenceAction(
  token: string,
  vendorDocumentId: string,
  formData: FormData,
): Promise<{ success: boolean; message?: string }> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { success: false, message: 'File is required' }
    if (file.size > 10 * 1024 * 1024) return { success: false, message: 'File too large (max 10MB)' }

    const service = createServiceClient()

    // Look up the request via token + verify the item belongs to it
    const { data: req } = await service
      .from('evidence_requests')
      .select('id, org_id, vendor_id, status, expires_at')
      .eq('token', token)
      .maybeSingle()
    if (!req) return { success: false, message: 'Invalid token' }
    const reqRow = req as { id: string; org_id: string; vendor_id: string; status: string; expires_at: string }
    if (reqRow.status === 'cancelled') return { success: false, message: 'Request was cancelled' }
    if (new Date(reqRow.expires_at) < new Date()) return { success: false, message: 'Request expired' }

    const { data: item } = await service
      .from('evidence_request_items')
      .select('id, vendor_document_id')
      .eq('evidence_request_id', reqRow.id)
      .eq('vendor_document_id', vendorDocumentId)
      .maybeSingle()
    if (!item) return { success: false, message: 'Item not part of this request' }

    // Storage upload
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${reqRow.org_id}/${reqRow.vendor_id}/request-${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await service.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadErr) return { success: false, message: uploadErr.message }

    // Insert version row
    const { data: version, error: vErr } = await service
      .from('vendor_document_versions')
      .insert({
        org_id: reqRow.org_id,
        vendor_document_id: vendorDocumentId,
        file_key: path,
        file_name: file.name,
        mime_type: file.type || null,
      })
      .select('id')
      .single()
    if (vErr) return { success: false, message: vErr.message }

    // Update vendor_documents → mark uploaded
    await service
      .from('vendor_documents')
      .update({
        current_version_id: (version as { id: string }).id,
        evidence_status: 'uploaded',
      })
      .eq('id', vendorDocumentId)

    // Flip the request item to replied + recompute aggregate request status
    await markRequestItemReplied({ requestId: reqRow.id, vendorDocumentId })

    return { success: true }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Upload failed' }
  }
}
