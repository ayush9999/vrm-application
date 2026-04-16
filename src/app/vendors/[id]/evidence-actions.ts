'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { setEvidenceStatus, setEvidenceExpiry } from '@/lib/db/evidence'
import { uploadDocumentFile } from '@/lib/db/documents'
import { logActivity } from '@/lib/db/activity-log'
import { createServerClient } from '@/lib/supabase/server'
import type { EvidenceStatus } from '@/types/review-pack'

/**
 * Upload a new file for an evidence requirement.
 * Creates a vendor_document_versions row, updates current_version_id, and
 * sets status to 'uploaded' (so reviewer can then approve/reject).
 */
export async function uploadEvidenceFileAction(
  vendorId: string,
  evidenceId: string,
  formData: FormData,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    const file = formData.get('file') as File | null
    const expiryDate = (formData.get('expiry_date') as string)?.trim() || null
    if (!file || file.size === 0) return { message: 'File is required' }

    const supabase = await createServerClient()

    // Upload to storage
    const fileKey = await uploadDocumentFile(user.orgId, vendorId, file)

    // Create new version row
    const { data: version, error: vErr } = await supabase
      .from('vendor_document_versions')
      .insert({
        org_id: user.orgId,
        vendor_document_id: evidenceId,
        file_key: fileKey,
        file_name: file.name,
        mime_type: file.type || null,
        uploaded_by_user_id: user.userId,
      })
      .select('id')
      .single()
    if (vErr) throw new Error(vErr.message)

    // Update vendor_documents: current_version_id, status, expiry
    const update: Record<string, unknown> = {
      current_version_id: version.id,
      evidence_status: 'uploaded' as EvidenceStatus,
    }
    // Only set expiry on upload if requirement supports it AND user provided one
    if (expiryDate) update.expiry_date = expiryDate

    const { error: uErr } = await supabase
      .from('vendor_documents')
      .update(update)
      .eq('id', evidenceId)
    if (uErr) throw new Error(uErr.message)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'evidence',
      entityId: evidenceId,
      action: 'evidence_uploaded',
      title: `Evidence uploaded: ${file.name}`,
    })

    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Upload failed' }
  }
}

/**
 * Reviewer sets a status decision on a piece of evidence (Approve / Reject /
 * Under Review / Waive).
 */
export async function setEvidenceStatusAction(
  vendorId: string,
  evidenceId: string,
  status: EvidenceStatus,
  comment: string | null,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    await setEvidenceStatus(evidenceId, status, comment, user.userId)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'evidence',
      entityId: evidenceId,
      action: `evidence_${status}`,
      title: `Evidence marked as ${status.replace(/_/g, ' ')}`,
    })

    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update status' }
  }
}

/**
 * "Request from Vendor" — for now just logs an activity entry.
 * Once Vendor Portal + Notifications are built, this will trigger an email.
 */
export async function requestEvidenceFromVendorAction(
  vendorId: string,
  evidenceId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'evidence',
      entityId: evidenceId,
      action: 'evidence_requested',
      title: `Evidence requested from vendor`,
    })
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to request' }
  }
}

/**
 * Update expiry date on an evidence row directly (separate from upload).
 */
export async function setEvidenceExpiryAction(
  vendorId: string,
  evidenceId: string,
  expiryDate: string | null,
): Promise<{ message?: string; success?: boolean }> {
  try {
    await requireCurrentUser()
    await setEvidenceExpiry(evidenceId, expiryDate)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to set expiry' }
  }
}
