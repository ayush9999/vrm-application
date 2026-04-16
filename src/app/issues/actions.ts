'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { createIssue, updateIssue, addIssueNote, addIssueEvidence, reviewIssueEvidence, deleteIssueEvidence, findDuplicateIssues, promoteEvidenceToVendorDocument } from '@/lib/db/issues'
import { uploadDocumentFile } from '@/lib/db/documents'
import type { IssueFormState } from '@/types/issue'
import type { IssueStatus, IssueSeverity, IssueDisposition, IssueSource, IssueType } from '@/types/issue'

// ─── Create issue ───────────────────────────────────────────────────────────

export async function createIssueAction(
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  const title = (formData.get('title') as string)?.trim() ?? ''
  const vendorId = (formData.get('vendor_id') as string)?.trim() ?? ''
  const description = (formData.get('description') as string)?.trim() || null
  const severity = (formData.get('severity') as IssueSeverity) || 'medium'
  const source = (formData.get('source') as IssueSource) || 'manual'
  const type = formData.get('type') as IssueType | null
  const ownerUserId = (formData.get('owner_user_id') as string)?.trim() || null
  const dueDate = (formData.get('due_date') as string)?.trim() || null
  const remediationPlan = (formData.get('remediation_plan') as string)?.trim() || null

  if (!title) return { message: 'Title is required.' }
  if (!vendorId) return { message: 'Vendor is required.' }
  if (!type) return { message: 'Category is required — please pick one.' }

  try {
    const issue = await createIssue({
      orgId: user.orgId,
      vendorId,
      title,
      description,
      severity,
      source,
      type,
      ownerUserId,
      dueDate,
      remediationPlan,
      createdByUserId: user.userId,
    })

    revalidatePath('/issues')
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true, issueId: issue.id }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to create issue.' }
  }
}

// ─── Update issue ───────────────────────────────────────────────────────────

export async function updateIssueAction(
  issueId: string,
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const severity = formData.get('severity') as IssueSeverity | null
  const status = formData.get('status') as IssueStatus | null
  const disposition = formData.get('disposition') as IssueDisposition | null
  const ownerUserId = (formData.get('owner_user_id') as string)?.trim() || null
  const dueDate = (formData.get('due_date') as string)?.trim() || null
  const remediationPlan = (formData.get('remediation_plan') as string)?.trim()
  const resolutionNotes = (formData.get('resolution_notes') as string)?.trim()
  const acceptedReason = (formData.get('accepted_reason') as string)?.trim()

  try {
    await updateIssue(user.orgId, issueId, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(severity && { severity }),
      ...(status && { status }),
      ...(disposition && { disposition }),
      ownerUserId,
      dueDate,
      ...(remediationPlan !== undefined && { remediationPlan }),
      ...(resolutionNotes !== undefined && { resolutionNotes }),
      ...(acceptedReason !== undefined && { acceptedReason }),
    }, user.userId)

    revalidatePath(`/issues/${issueId}`)
    revalidatePath('/issues')
    return { success: true, message: 'Updated.' }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to update issue.' }
  }
}

// ─── Add note ───────────────────────────────────────────────────────────────

export async function addIssueNoteAction(
  issueId: string,
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  const note = (formData.get('note') as string)?.trim() ?? ''
  if (!note) return { message: 'Note is required.' }

  try {
    await addIssueNote(issueId, user.userId, note)
    revalidatePath(`/issues/${issueId}`)
    return { success: true }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to add note.' }
  }
}

// ─── Quick status change ────────────────────────────────────────────────────

export async function changeIssueStatusAction(
  issueId: string,
  status: IssueStatus,
): Promise<void> {
  const user = await requireCurrentUser()
  await updateIssue(user.orgId, issueId, { status }, user.userId)
  revalidatePath(`/issues/${issueId}`)
  revalidatePath('/issues')
}

// ─── Evidence upload ──────────────────────────────────────────────────────

export async function uploadEvidenceAction(
  issueId: string,
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  let fileName = (formData.get('file_name') as string)?.trim() ?? ''
  const fileUrl = (formData.get('file_url') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null
  const saveAsVendorDoc = formData.get('save_as_vendor_doc') === '1'
  const docTypeId = (formData.get('doc_type_id') as string)?.trim() || null
  const vendorId = (formData.get('vendor_id') as string)?.trim() || null

  // Handle actual file upload
  const file = formData.get('file') as File | null
  const hasRealFile = file && file.size > 0
  let fileKey: string | null = null

  if (hasRealFile) {
    if (!fileName) fileName = file.name
  }

  if (!fileName) return { message: 'Evidence name or file is required.' }
  if (saveAsVendorDoc && !docTypeId) return { message: 'Document type is required when saving as vendor document.' }

  try {
    // Upload file to Supabase Storage if provided
    if (hasRealFile && vendorId) {
      fileKey = await uploadDocumentFile(user.orgId, vendorId, file)
    }

    const evidence = await addIssueEvidence(issueId, fileName, fileUrl, notes, user.userId, fileKey)

    // Optionally promote to vendor document at upload time
    if (saveAsVendorDoc && docTypeId && vendorId) {
      await promoteEvidenceToVendorDocument(user.orgId, vendorId, evidence.id, docTypeId, user.userId)
    }

    revalidatePath(`/issues/${issueId}`)
    if (vendorId) revalidatePath(`/vendors/${vendorId}`)
    return { success: true, message: saveAsVendorDoc ? 'Evidence uploaded and saved as vendor document.' : 'Evidence uploaded.' }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to upload evidence.' }
  }
}

// ─── Evidence review ──────────────────────────────────────────────────────

export async function reviewEvidenceAction(
  evidenceId: string,
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  const reviewStatus = formData.get('review_status') as 'accepted' | 'rejected'
  const reviewNotes = (formData.get('review_notes') as string)?.trim() || null
  const issueId = (formData.get('issue_id') as string)?.trim() ?? ''

  if (!reviewStatus) return { message: 'Review decision is required.' }

  try {
    await reviewIssueEvidence(evidenceId, reviewStatus, reviewNotes, user.userId)
    revalidatePath(`/issues/${issueId}`)
    return { success: true, message: `Evidence ${reviewStatus}.` }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to review evidence.' }
  }
}

// ─── Evidence delete ──────────────────────────────────────────────────────

export async function deleteEvidenceAction(
  evidenceId: string,
  issueId: string,
): Promise<void> {
  const user = await requireCurrentUser()
  await deleteIssueEvidence(evidenceId, user.userId)
  revalidatePath(`/issues/${issueId}`)
}

// ─── Promote evidence to vendor document ─────────────────────────────────

export async function promoteEvidenceAction(
  evidenceId: string,
  issueId: string,
  vendorId: string,
  _prev: IssueFormState,
  formData: FormData,
): Promise<IssueFormState> {
  const user = await requireCurrentUser()
  const docTypeId = (formData.get('doc_type_id') as string)?.trim() ?? ''

  if (!docTypeId) return { message: 'Document type is required.' }

  try {
    await promoteEvidenceToVendorDocument(user.orgId, vendorId, evidenceId, docTypeId, user.userId)
    revalidatePath(`/issues/${issueId}`)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true, message: 'Evidence promoted to vendor document.' }
  } catch (err: any) {
    return { message: err.message ?? 'Failed to promote evidence.' }
  }
}

// ─── Duplicate check ──────────────────────────────────────────────────────

export async function checkDuplicateIssuesAction(
  vendorId: string,
  controlId: string,
): Promise<{ id: string; title: string; status: string; severity: string }[]> {
  const user = await requireCurrentUser()
  const dupes = await findDuplicateIssues(user.orgId, vendorId, controlId)
  return dupes.map(d => ({ id: d.id, title: d.title, status: d.status, severity: d.severity }))
}
