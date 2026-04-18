'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { createPlaceholderDocumentVersion, createDocumentType, updateVendorDocumentMeta, deleteDocumentVersion, deleteVendorDocument, uploadDocumentFile, getDocumentSignedUrl } from '@/lib/db/documents'
import { createIncident, updateIncident, deleteIncident } from '@/lib/db/incidents'
import { logActivity } from '@/lib/db/activity-log'
import { createServerClient } from '@/lib/supabase/server'
import type { FormState } from '@/types/common'
import type { IncidentSeverity, IncidentStatus } from '@/types/incident'

// ─── Upload document (placeholder) ────────────────────────────────────────────

export async function uploadDocumentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const docTypeId = formData.get('doc_type_id') as string
  const expiryDate = (formData.get('expiry_date') as string) || null

  if (!docTypeId) return { message: 'Missing document type.' }

  try {
    const user = await requireCurrentUser()

    // Try to get the actual file from the form
    const file = formData.get('file') as File | null
    const hasRealFile = file && file.size > 0

    let fileKey: string | undefined
    let fileName: string | null = (formData.get('file_name') as string)?.trim() || null

    if (hasRealFile) {
      fileKey = await uploadDocumentFile(user.orgId, vendorId, file)
      fileName = file.name // use original filename
    }

    await createPlaceholderDocumentVersion(
      user.orgId,
      vendorId,
      docTypeId,
      fileName,
      expiryDate,
      user.userId,
      fileKey,
    )
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_document',
      entityId: vendorId,
      action: 'document_uploaded',
      title: `Document added${fileName ? ` — "${fileName}"` : ''}`,
      metadata: { doc_type_id: docTypeId, stored: hasRealFile },
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Upload failed.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Add custom document ───────────────────────────────────────────────────────

const customDocSchema = z.object({
  custom_doc_name: z.string().min(1, 'Document name is required'),
  custom_doc_category: z.string().optional().transform((v) => v?.trim() || null),
  file_name: z.string().optional().transform((v) => v?.trim() || null),
  expiry_date: z.string().optional().transform((v) => v || null),
})

export async function addCustomDocumentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = customDocSchema.safeParse({
    custom_doc_name: formData.get('custom_doc_name'),
    custom_doc_category: formData.get('custom_doc_category'),
    file_name: formData.get('file_name'),
    expiry_date: formData.get('expiry_date'),
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  try {
    const user = await requireCurrentUser()

    const file = formData.get('file') as File | null
    const hasRealFile = file && file.size > 0

    let fileKey: string | undefined
    let fileName = parsed.data.file_name

    if (hasRealFile) {
      const docTypeForPath = await createDocumentType(user.orgId, parsed.data.custom_doc_name, parsed.data.custom_doc_category)
      fileKey = await uploadDocumentFile(user.orgId, vendorId, file)
      fileName = file.name
      await createPlaceholderDocumentVersion(user.orgId, vendorId, docTypeForPath.id, fileName, parsed.data.expiry_date, user.userId, fileKey)
      await logActivity({ orgId: user.orgId, vendorId, actorUserId: user.userId, entityType: 'vendor_document', entityId: vendorId, action: 'custom_document_added', title: `Custom document "${parsed.data.custom_doc_name}" added` })
    } else {
      const docType = await createDocumentType(user.orgId, parsed.data.custom_doc_name, parsed.data.custom_doc_category)
      await createPlaceholderDocumentVersion(user.orgId, vendorId, docType.id, fileName, parsed.data.expiry_date, user.userId)
      await logActivity({ orgId: user.orgId, vendorId, actorUserId: user.userId, entityType: 'vendor_document', entityId: vendorId, action: 'custom_document_added', title: `Custom document "${parsed.data.custom_doc_name}" added` })
    }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to add custom document.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Update document metadata ──────────────────────────────────────────────────

export async function updateDocumentMetaAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const vendorDocId = formData.get('vendor_doc_id') as string
  const expiryDate = (formData.get('expiry_date') as string) || null
  const verificationNotes = (formData.get('verification_notes') as string) || null

  if (!vendorDocId) return { message: 'Missing document id.' }

  try {
    const user = await requireCurrentUser()
    await updateVendorDocumentMeta(user.orgId, vendorDocId, {
      expiry_date: expiryDate,
      verification_notes: verificationNotes,
    })
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_document',
      entityId: vendorDocId,
      action: 'document_updated',
      title: 'Document metadata updated',
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Update failed.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Create incident ───────────────────────────────────────────────────────────

const incidentSchema = z.object({
  incident_date: z.string().min(1, 'Date is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['detected', 'investigating', 'contained', 'resolved', 'closed']).default('detected'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional().transform((v) => v?.trim() || null),
  incident_type: z.string().optional().transform((v) => v?.trim() || null),
  impact_scope: z.string().optional().transform((v) => v?.trim() || null),
  records_affected: z.preprocess((v) => (v === '' || v === null ? null : Number(v)), z.number().nullable().optional()),
  users_affected: z.preprocess((v) => (v === '' || v === null ? null : Number(v)), z.number().nullable().optional()),
  data_types_involved: z.string().optional().transform((v) => v?.trim() || null),
  detected_at: z.string().optional().transform((v) => v?.trim() || null),
  reported_by_vendor_at: z.string().optional().transform((v) => v?.trim() || null),
  root_cause: z.string().optional().transform((v) => v?.trim() || null),
  root_cause_detail: z.string().optional().transform((v) => v?.trim() || null),
  sla_notification_hours: z.preprocess((v) => (v === '' || v === null ? null : Number(v)), z.number().nullable().optional()),
  is_reportable: z.preprocess((v) => v === 'true', z.boolean().optional()),
  applicable_regulation: z.string().optional().transform((v) => v?.trim() || null),
  reporting_deadline: z.string().optional().transform((v) => v?.trim() || null),
})

export async function createIncidentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw: Record<string, unknown> = {}
  for (const key of ['incident_date', 'severity', 'status', 'description', 'notes', 'incident_type', 'impact_scope', 'records_affected', 'users_affected', 'data_types_involved', 'detected_at', 'reported_by_vendor_at', 'root_cause', 'root_cause_detail', 'sla_notification_hours', 'is_reportable', 'applicable_regulation', 'reporting_deadline']) {
    raw[key] = formData.get(key)
  }
  const parsed = incidentSchema.safeParse(raw)
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  try {
    const user = await requireCurrentUser()
    const incident = await createIncident(user.orgId, vendorId, parsed.data, user.userId)
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'incident',
      entityId: incident.id,
      action: 'incident_created',
      title: `Incident raised: "${incident.description.slice(0, 60)}${incident.description.length > 60 ? '…' : ''}"`,
      metadata: { severity: incident.severity, incident_date: incident.incident_date, incident_type: incident.incident_type },
    })

    // Auto-create remediation for critical/high incidents
    if (incident.severity === 'critical' || incident.severity === 'high') {
      try {
        const { createIssue } = await import('@/lib/db/issues')
        const issue = await createIssue({
          orgId: user.orgId,
          vendorId,
          title: `Incident: ${incident.description.slice(0, 80)}`,
          description: `Auto-created from ${incident.severity} severity incident on ${incident.incident_date}.${incident.incident_type ? ` Type: ${incident.incident_type.replace(/_/g, ' ')}.` : ''}`,
          severity: incident.severity,
          source: 'monitoring',
          type: 'general',
          createdByUserId: user.userId,
        })

        // Link remediation back to the incident
        const supabase = await createServerClient()
        await supabase
          .from('vendor_incidents')
          .update({ created_remediation_id: issue.id })
          .eq('id', incident.id)
      } catch {
        // Non-critical — don't fail incident creation on remediation failure
      }
    }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create incident.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  revalidatePath('/issues')
  return { success: true }
}

// ─── Update incident ───────────────────────────────────────────────────────────

const updateIncidentSchema = z.object({
  incident_id: z.string().uuid(),
  incident_date: z.string().min(1, 'Date is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['detected', 'investigating', 'contained', 'resolved', 'closed']),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional().transform((v) => v?.trim() || null),
})

export async function updateIncidentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateIncidentSchema.safeParse({
    incident_id: formData.get('incident_id'),
    incident_date: formData.get('incident_date'),
    severity: formData.get('severity'),
    status: formData.get('status'),
    description: formData.get('description'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const { incident_id, ...fields } = parsed.data

  try {
    const user = await requireCurrentUser()
    await updateIncident(user.orgId, incident_id, {
      incident_date: fields.incident_date,
      severity: fields.severity as IncidentSeverity,
      status: fields.status as IncidentStatus,
      description: fields.description,
      notes: fields.notes,
    })
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'incident',
      entityId: incident_id,
      action: 'incident_updated',
      title: `Incident updated (status: ${fields.status})`,
      metadata: { severity: fields.severity, status: fields.status },
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update incident.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Delete incident ───────────────────────────────────────────────────────────

export async function deleteIncidentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const incidentId = formData.get('incident_id') as string
  if (!incidentId) return { message: 'Missing incident id.' }

  try {
    const user = await requireCurrentUser()
    await deleteIncident(user.orgId, incidentId, user.userId)
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'incident',
      entityId: incidentId,
      action: 'incident_deleted',
      title: 'Incident deleted',
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete incident.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Delete document file (standard) ──────────────────────────────────────────

export async function deleteDocumentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const vendorDocId = formData.get('vendor_doc_id') as string
  if (!vendorDocId) return { message: 'Missing document id.' }

  try {
    const user = await requireCurrentUser()
    await deleteDocumentVersion(user.orgId, vendorDocId, user.userId)
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_document',
      entityId: vendorDocId,
      action: 'document_deleted',
      title: 'Document file deleted',
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete document.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Delete custom document entirely ──────────────────────────────────────────

export async function deleteCustomDocumentAction(
  vendorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const vendorDocId = formData.get('vendor_doc_id') as string
  if (!vendorDocId) return { message: 'Missing document id.' }

  try {
    const user = await requireCurrentUser()
    await deleteVendorDocument(user.orgId, vendorDocId, user.userId)
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_document',
      entityId: vendorDocId,
      action: 'custom_document_deleted',
      title: 'Custom document deleted',
    })
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to delete document.' }
  }

  revalidatePath(`/vendors/${vendorId}`)
  return { success: true }
}

// ─── Get signed download URL ───────────────────────────────────────────────────

/**
 * Generate a 1-hour signed URL for a stored document.
 * Can be called from client components to get a temporary download/view link.
 */
export async function getDocumentDownloadUrlAction(
  fileKey: string,
): Promise<{ url?: string; message?: string }> {
  try {
    await requireCurrentUser()
    const url = await getDocumentSignedUrl(fileKey)
    return { url }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Could not generate download link.' }
  }
}
