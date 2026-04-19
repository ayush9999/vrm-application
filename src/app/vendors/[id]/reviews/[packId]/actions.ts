'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireCurrentUser } from '@/lib/current-user'
import { updateReviewItemDecision } from '@/lib/db/review-packs'
import { createIssue } from '@/lib/db/issues'
import { createPortalLink, listPortalLinks, revokePortalLink } from '@/lib/db/vendor-portal'
import { logActivity } from '@/lib/db/activity-log'
import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import type { ReviewItemDecision } from '@/types/review-pack'
import type { VendorPortalLink } from '@/lib/db/vendor-portal'

// ─── PDF export data types ────────────────────────────────────────────────

export interface ReviewExportData {
  vendorName: string
  vendorCode: string | null
  packName: string
  packCode: string | null
  packDescription: string | null
  status: string
  reviewType: string
  completedAt: string | null
  readinessPct: number
  totalItems: number
  passedCount: number
  failedCount: number
  items: Array<{
    name: string
    description: string | null
    decision: string
    comment: string | null
    complianceRefs: Array<{ standard: string; reference: string }>
  }>
  approvals: Array<{
    level: number
    decision: string
    comment: string | null
    decidedAt: string
    userName: string
  }>
}

export async function setReviewItemDecisionAction(
  vendorId: string,
  packId: string,
  itemId: string,
  decision: ReviewItemDecision,
  comment: string | null,
): Promise<{ message?: string; success?: boolean; remediationId?: string }> {
  try {
    const user = await requireCurrentUser()

    // Verify the parent pack is in a reviewable state
    const supabaseCheck = await createServerClient()
    const { data: packRow } = await supabaseCheck
      .from('vendor_review_packs')
      .select('status')
      .eq('id', packId)
      .maybeSingle()
    if (!packRow) return { message: 'Review pack not found' }
    const reviewableStatuses = ['in_progress', 'sent_back']
    if (!reviewableStatuses.includes((packRow as { status: string }).status)) {
      return { message: 'Cannot modify decisions — review is not in progress' }
    }

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

// ─── Exception management ──────────────────────────────────────────────────

export async function createExceptionAction(
  vendorId: string,
  packId: string,
  itemId: string,
  input: {
    reason: string
    expiryDate: string
    ownerUserId: string
    requiresCountersign: boolean
  },
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const { createException } = await import('@/lib/db/review-exceptions')

    await createException({
      orgId: user.orgId,
      vendorId,
      vendorReviewItemId: itemId,
      vendorReviewPackId: packId,
      reason: input.reason,
      expiryDate: input.expiryDate,
      ownerUserId: input.ownerUserId,
      requiresCountersign: input.requiresCountersign,
      createdByUserId: user.userId,
    })

    // Also set the decision on the review item
    await updateReviewItemDecision(itemId, 'exception_approved', `Exception: ${input.reason}`, user.userId)

    const { logActivity } = await import('@/lib/db/activity-log')
    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'review_exception',
      entityId: itemId,
      action: 'exception_created',
      title: `Exception approved: ${input.reason.substring(0, 80)}`,
      metadata: { expiry_date: input.expiryDate, owner_user_id: input.ownerUserId },
    })

    revalidatePath(`/vendors/${vendorId}/reviews/${packId}`)
    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to create exception' }
  }
}

// ─── Comments ──────────────────────────────────────────────────────────────

export async function addReviewCommentAction(
  vendorId: string,
  packId: string,
  itemId: string,
  body: string,
  parentCommentId?: string | null,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    const { addReviewItemComment } = await import('@/lib/db/review-comments')
    await addReviewItemComment({
      orgId: user.orgId,
      reviewItemId: itemId,
      parentCommentId: parentCommentId ?? null,
      userId: user.userId,
      body,
    })
    revalidatePath(`/vendors/${vendorId}/reviews/${packId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to add comment' }
  }
}

export async function getReviewCommentsAction(
  itemId: string,
): Promise<{ comments?: import('@/lib/db/review-comments').ReviewComment[]; message?: string }> {
  try {
    await requireCurrentUser()
    const { getReviewItemComments } = await import('@/lib/db/review-comments')
    const comments = await getReviewItemComments(itemId)
    return { comments }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to load comments' }
  }
}

// ─── Export review as CSV ───────────────────────────────────────────────────

export async function exportReviewCsvAction(
  vendorId: string,
  packId: string,
): Promise<{ csv?: string; fileName?: string; message?: string }> {
  try {
    await requireCurrentUser()
    const supabase = await createServerClient()

    const { data: vrp } = await supabase
      .from('vendor_review_packs')
      .select(`
        id, status, completed_at,
        review_packs!inner ( name, code ),
        vendors!inner ( name, vendor_code )
      `)
      .eq('id', packId)
      .eq('vendor_id', vendorId)
      .maybeSingle()

    if (!vrp) return { message: 'Not found' }

    const { getVendorReviewItems } = await import('@/lib/db/review-packs')
    const items = await getVendorReviewItems(packId)

    const raw = vrp as unknown as {
      status: string; completed_at: string | null
      review_packs: { name: string; code: string | null } | { name: string; code: string | null }[]
      vendors: { name: string; vendor_code: string | null } | { name: string; vendor_code: string | null }[]
    }
    const rp = Array.isArray(raw.review_packs) ? raw.review_packs[0] : raw.review_packs
    const v = Array.isArray(raw.vendors) ? raw.vendors[0] : raw.vendors

    const esc = (s: unknown) => {
      if (s === null || s === undefined) return ''
      const str = String(s)
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    const lines = [
      `# Vendor: ${v?.name} (${v?.vendor_code ?? ''})`,
      `# Pack: ${rp?.name} (${rp?.code ?? ''})`,
      `# Status: ${raw.status}`,
      `# Completed: ${raw.completed_at ?? 'N/A'}`,
      `# Exported: ${new Date().toISOString()}`,
      '',
      'Requirement,Decision,Reviewer Comment,Compliance References,Created Remediation',
    ]

    for (const item of items) {
      const refs = item.compliance_references?.map((r) => `${r.standard} ${r.reference}`).join('; ') ?? ''
      lines.push([esc(item.requirement_name), esc(item.decision), esc(item.reviewer_comment), esc(refs), esc(item.created_remediation_id ? 'Yes' : '')].join(','))
    }

    const packName = (rp?.code ?? 'review').replace(/[^a-zA-Z0-9]/g, '-')
    return { csv: lines.join('\n'), fileName: `${v?.vendor_code ?? 'vendor'}-${packName}-${new Date().toISOString().split('T')[0]}.csv` }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to export' }
  }
}

// ─── Export review data for PDF generation ────────────────────────────────

export async function exportReviewPdfDataAction(
  vendorId: string,
  packId: string,
): Promise<{ data?: ReviewExportData; message?: string }> {
  try {
    await requireCurrentUser()

    // Fetch pack + vendor info + items + approvals in parallel
    const [vrpRows, items, approvalRows] = await Promise.all([
      sql<Array<{
        status: string; completed_at: string | null; review_type: string
        vendor_name: string; vendor_code: string | null
        pack_name: string; pack_code: string | null; pack_description: string | null
      }>>`
        SELECT vrp.status, vrp.completed_at, vrp.review_type,
          v.name AS vendor_name, v.vendor_code,
          rp.name AS pack_name, rp.code AS pack_code, rp.description AS pack_description
        FROM vendor_review_packs vrp
        JOIN vendors v ON v.id = vrp.vendor_id
        JOIN review_packs rp ON rp.id = vrp.review_pack_id
        WHERE vrp.id = ${packId} AND vrp.vendor_id = ${vendorId}
        LIMIT 1
      `,
      import('@/lib/db/review-packs').then((m) => m.getVendorReviewItems(packId)),
      sql<Array<{
        level: number; decision: string; comment: string | null; decided_at: string
        user_name: string | null; user_email: string | null
      }>>`
        SELECT ra.level, ra.decision, ra.comment, ra.decided_at,
          u.name AS user_name, u.email AS user_email
        FROM review_approvals ra
        JOIN users u ON u.id = ra.user_id
        WHERE ra.vendor_review_pack_id = ${packId}
        ORDER BY ra.decided_at
      `,
    ])

    const vrp = vrpRows[0]
    if (!vrp) return { message: 'Not found' }

    const applicable = items.filter((i) => i.decision !== 'na').length
    const passed = items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length

    return {
      data: {
        vendorName: vrp.vendor_name,
        vendorCode: vrp.vendor_code,
        packName: vrp.pack_name,
        packCode: vrp.pack_code,
        packDescription: vrp.pack_description,
        status: vrp.status,
        reviewType: vrp.review_type,
        completedAt: vrp.completed_at,
        readinessPct: applicable > 0 ? Math.round((passed / applicable) * 100) : 0,
        totalItems: items.length,
        passedCount: passed,
        failedCount: items.filter((i) => i.decision === 'fail').length,
        items: items.map((i) => ({
          name: i.requirement_name ?? 'Unknown',
          description: i.requirement_description ?? null,
          decision: i.decision,
          comment: i.reviewer_comment ?? null,
          complianceRefs: i.compliance_references ?? [],
        })),
        approvals: approvalRows.map((a) => ({
          level: a.level,
          decision: a.decision,
          comment: a.comment,
          decidedAt: a.decided_at,
          userName: a.user_name ?? a.user_email ?? 'Unknown',
        })),
      },
    }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to load export data' }
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
