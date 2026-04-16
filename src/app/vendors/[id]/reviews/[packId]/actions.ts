'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireCurrentUser } from '@/lib/current-user'
import { updateReviewItemDecision } from '@/lib/db/review-packs'
import { createIssue } from '@/lib/db/issues'
import { createPortalLink, listPortalLinks, revokePortalLink } from '@/lib/db/vendor-portal'
import { logActivity } from '@/lib/db/activity-log'
import { createServerClient } from '@/lib/supabase/server'
import type { ReviewItemDecision } from '@/types/review-pack'
import type { VendorPortalLink } from '@/lib/db/vendor-portal'

export async function setReviewItemDecisionAction(
  vendorId: string,
  packId: string,
  itemId: string,
  decision: ReviewItemDecision,
  comment: string | null,
): Promise<{ message?: string; success?: boolean; remediationId?: string }> {
  try {
    const user = await requireCurrentUser()
    await updateReviewItemDecision(itemId, decision, comment, user.userId)

    let remediationId: string | undefined

    // If failed AND requirement has creates_remediation_on_fail = true → create a remediation
    if (decision === 'fail') {
      const supabase = await createServerClient()
      const { data: item } = await supabase
        .from('vendor_review_items')
        .select(`
          id,
          created_remediation_id,
          review_requirements!inner ( id, name, creates_remediation_on_fail ),
          vendor_review_packs!inner ( vendor_id, review_pack_id, review_packs ( name ) )
        `)
        .eq('id', itemId)
        .maybeSingle()

      const itemRow = item as {
        id: string
        created_remediation_id: string | null
        review_requirements: { id: string; name: string; creates_remediation_on_fail: boolean }
        vendor_review_packs: { vendor_id: string; review_pack_id: string; review_packs: { name: string } | null }
      } | null

      if (itemRow && itemRow.review_requirements.creates_remediation_on_fail && !itemRow.created_remediation_id) {
        const packName = itemRow.vendor_review_packs.review_packs?.name ?? 'Review'
        const issue = await createIssue({
          orgId: user.orgId,
          vendorId: itemRow.vendor_review_packs.vendor_id,
          title: `${packName}: ${itemRow.review_requirements.name}`,
          description: comment ?? `Auto-created from failed review item.`,
          severity: 'medium',
          source: 'review',
          type: 'control_level',
          createdByUserId: user.userId,
        })

        // Link the remediation back to the review item
        await supabase
          .from('vendor_review_items')
          .update({
            created_remediation_id: issue.id,
            source_review_requirement_id: itemRow.review_requirements.id,
            source_vendor_review_pack_id: itemRow.vendor_review_packs.review_pack_id,
          })
          .eq('id', itemId)

        // Set source columns on the issue itself
        await supabase
          .from('issues')
          .update({
            source_review_requirement_id: itemRow.review_requirements.id,
            source_vendor_review_pack_id: itemRow.vendor_review_packs.review_pack_id,
          })
          .eq('id', issue.id)

        remediationId = issue.id
      }
    }

    revalidatePath(`/vendors/${vendorId}/reviews/${packId}`)
    revalidatePath(`/vendors/${vendorId}`)
    revalidatePath('/issues')
    return { success: true, remediationId }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to update review item' }
  }
}

// ─── Vendor Portal: create / list / revoke ───────────────────────────────────

export async function createPortalLinkAction(
  vendorId: string,
  vendorReviewPackId: string,
  recipientEmail: string | null,
  expiryDays: number,
): Promise<{ url?: string; link?: VendorPortalLink; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const link = await createPortalLink({
      orgId: user.orgId,
      vendorId,
      vendorReviewPackId,
      createdByUserId: user.userId,
      recipientEmail,
      expiryDays,
    })

    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
    const url = `${proto}://${host}/portal/${link.token}`

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_portal_link',
      entityId: link.id,
      action: 'portal_link_created',
      title: `Portal link created${recipientEmail ? ` for ${recipientEmail}` : ''}`,
    })

    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    return { url, link }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create portal link' }
  }
}

export async function listPortalLinksAction(
  vendorReviewPackId: string,
): Promise<{ links?: VendorPortalLink[]; message?: string }> {
  try {
    await requireCurrentUser()
    const links = await listPortalLinks(vendorReviewPackId)
    return { links }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to list portal links' }
  }
}

export async function revokePortalLinkAction(
  linkId: string,
  vendorId: string,
  vendorReviewPackId: string,
): Promise<{ message?: string; success?: boolean }> {
  try {
    const user = await requireCurrentUser()
    await revokePortalLink(linkId)
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_portal_link',
      entityId: linkId,
      action: 'portal_link_revoked',
      title: 'Portal link revoked',
    })
    revalidatePath(`/vendors/${vendorId}/reviews/${vendorReviewPackId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to revoke link' }
  }
}

/**
 * AI Assist placeholder — returns a fake suggestion.
 * Real implementation will read uploaded evidence files and call an LLM.
 */
export async function aiAssistReviewItemAction(
  _itemId: string,
): Promise<{ suggestion?: ReviewItemDecision; rationale?: string; message?: string }> {
  await requireCurrentUser()
  await new Promise((r) => setTimeout(r, 600))
  return {
    suggestion: 'pass',
    rationale: 'AI Assist is a placeholder. Real implementation will analyze uploaded evidence files and propose a Pass/Fail with citations from the document.',
  }
}
