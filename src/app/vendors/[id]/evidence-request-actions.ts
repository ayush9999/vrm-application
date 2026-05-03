'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireCurrentUser } from '@/lib/current-user'
import {
  createEvidenceRequest,
  cancelEvidenceRequest as dbCancelEvidenceRequest,
  softDeleteEvidenceRequest as dbSoftDeleteEvidenceRequest,
  type EvidenceRequest,
} from '@/lib/db/evidence-requests'

export async function createEvidenceRequestAction(
  vendorId: string,
  input: {
    vendorDocumentIds: string[]
    message: string | null
    dueDate: string | null
    recipientEmails: string[]
    expiryDays: number
  },
): Promise<{ url?: string; request?: EvidenceRequest; message?: string }> {
  try {
    const user = await requireCurrentUser()
    if (input.vendorDocumentIds.length === 0) {
      return { message: 'Select at least one item to request' }
    }

    const request = await createEvidenceRequest({
      orgId: user.orgId,
      vendorId,
      createdByUserId: user.userId,
      vendorDocumentIds: input.vendorDocumentIds,
      message: input.message?.trim() || null,
      dueDate: input.dueDate?.trim() || null,
      recipientEmails: input.recipientEmails.filter((e) => e.trim().length > 0),
      expiryDays: input.expiryDays,
    })

    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const url = `${proto}://${host}/portal/req/${request.token}`

    revalidatePath(`/vendors/${vendorId}`)
    return { url, request }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Failed to create request' }
  }
}

export async function cancelEvidenceRequestAction(
  vendorId: string,
  requestId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    await requireCurrentUser()
    await dbCancelEvidenceRequest(requestId)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Failed to cancel request' }
  }
}

export async function deleteEvidenceRequestAction(
  vendorId: string,
  requestId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    await requireCurrentUser()
    await dbSoftDeleteEvidenceRequest(requestId)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Failed to delete request' }
  }
}
