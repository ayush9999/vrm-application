'use server'

import { createServiceClient } from '@/lib/supabase/service'
import {
  submitPortalReviewResponse,
  submitPortalEvidenceUpload,
  finalizePortalSubmission,
} from '@/lib/db/vendor-portal'

const STORAGE_BUCKET = 'vendor-documents'

/**
 * Vendor (via portal) self-attests a decision on a review item.
 */
export async function portalSubmitReviewResponseAction(
  token: string,
  reviewItemId: string,
  selfDecision: 'pass' | 'fail' | 'na',
  comment: string | null,
): Promise<{ success: boolean; message?: string }> {
  return submitPortalReviewResponse({ token, reviewItemId, selfDecision, comment })
}

/**
 * Vendor (via portal) uploads an evidence file. Service client handles storage.
 */
export async function portalUploadEvidenceAction(
  token: string,
  evidenceId: string,
  formData: FormData,
): Promise<{ success: boolean; message?: string }> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { success: false, message: 'File is required' }
    if (file.size > 10 * 1024 * 1024) return { success: false, message: 'File too large (max 10MB)' }

    const service = createServiceClient()

    // Look up vendor_id + org_id from the evidence row to build the storage path
    const { data: ev } = await service
      .from('vendor_documents')
      .select('vendor_id, org_id')
      .eq('id', evidenceId)
      .maybeSingle()
    if (!ev) return { success: false, message: 'Invalid evidence' }
    const evRow = ev as { vendor_id: string; org_id: string }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${evRow.org_id}/${evRow.vendor_id}/portal-${crypto.randomUUID()}.${ext}`

    const { error: uploadErr } = await service.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadErr) return { success: false, message: uploadErr.message }

    return submitPortalEvidenceUpload({
      token,
      evidenceId,
      fileKey: path,
      fileName: file.name,
      mimeType: file.type || null,
    })
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Upload failed' }
  }
}

/**
 * Vendor finalizes submission — marks the portal link as submitted.
 */
export async function portalFinalizeAction(token: string): Promise<{ success: boolean; message?: string }> {
  return finalizePortalSubmission(token)
}
