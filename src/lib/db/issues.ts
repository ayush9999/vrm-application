import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import type {
  Issue,
  IssueEvidence,
  IssueStatus,
  IssueSeverity,
  IssueDisposition,
  IssueSource,
  IssueType,
  IssueActivity,
} from '@/types/issue'

// ─── List issues ────────────────────────────────────────────────────────────

export interface GetIssuesOptions {
  vendorId?: string
  status?: IssueStatus | IssueStatus[]
  severity?: IssueSeverity
  source?: IssueSource
  ownerUserId?: string
  overdue?: boolean
  search?: string
}

export async function getIssues(
  orgId: string,
  opts: GetIssuesOptions = {},
): Promise<Issue[]> {
  const conditions: string[] = [
    'i.org_id = $1',
    'i.deleted_at IS NULL',
  ]
  const params: (string | string[] | number | boolean)[] = [orgId]
  let paramIdx = 1

  if (opts.vendorId) {
    paramIdx++
    conditions.push(`i.vendor_id = $${paramIdx}`)
    params.push(opts.vendorId)
  }
  if (opts.severity) {
    paramIdx++
    conditions.push(`i.severity = $${paramIdx}`)
    params.push(opts.severity)
  }
  if (opts.source) {
    paramIdx++
    conditions.push(`i.source = $${paramIdx}`)
    params.push(opts.source)
  }
  if (opts.ownerUserId) {
    paramIdx++
    conditions.push(`i.owner_user_id = $${paramIdx}`)
    params.push(opts.ownerUserId)
  }
  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
    paramIdx++
    conditions.push(`i.status = ANY($${paramIdx})`)
    params.push(statuses)
  }
  if (opts.overdue) {
    paramIdx++
    conditions.push(`i.due_date < $${paramIdx}`)
    params.push(new Date().toISOString().split('T')[0])
    conditions.push(`i.status IN ('open', 'in_progress', 'blocked')`)
  }
  if (opts.search) {
    paramIdx++
    const pattern = `%${opts.search}%`
    conditions.push(`(i.title ILIKE $${paramIdx} OR i.description ILIKE $${paramIdx})`)
    params.push(pattern)
  }

  const where = conditions.join(' AND ')

  const rows = await sql.unsafe(
    `SELECT i.*, v.name AS vendor_name, u.name AS owner_name
     FROM issues i
     INNER JOIN vendors v ON v.id = i.vendor_id
     LEFT JOIN users u ON u.id = i.owner_user_id
     WHERE ${where}
     ORDER BY i.created_at DESC`,
    params,
  )

  return rows as unknown as Issue[]
}

// ─── Get single issue with relations ────────────────────────────────────────

export async function getIssueById(
  orgId: string,
  issueId: string,
): Promise<Issue | null> {
  const [issueRows, evidenceRows, activityRows] = await Promise.all([
    sql`
      SELECT i.*, v.name AS vendor_name, u.name AS owner_name
      FROM issues i
      INNER JOIN vendors v ON v.id = i.vendor_id
      LEFT JOIN users u ON u.id = i.owner_user_id
      WHERE i.id = ${issueId}
        AND i.org_id = ${orgId}
        AND i.deleted_at IS NULL
      LIMIT 1
    `,
    sql`
      SELECT *
      FROM issue_evidence
      WHERE issue_id = ${issueId}
      ORDER BY uploaded_at DESC
    `,
    sql`
      SELECT ia.*, u.name AS user_name
      FROM issue_activity ia
      LEFT JOIN users u ON u.id = ia.user_id
      WHERE ia.issue_id = ${issueId}
      ORDER BY ia.created_at DESC
    `,
  ])

  const issue = issueRows[0]
  if (!issue) return null

  return {
    ...issue,
    evidence: evidenceRows,
    activity: activityRows,
  } as Issue
}

// ─── Create issue ───────────────────────────────────────────────────────────

export interface CreateIssueInput {
  orgId: string
  vendorId: string
  title: string
  description?: string | null
  severity?: IssueSeverity
  source?: IssueSource
  type?: IssueType
  ownerUserId?: string | null
  dueDate?: string | null
  remediationPlan?: string | null
  createdByUserId?: string | null
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  const sb = await createServerClient()

  const { data, error } = await sb
    .from('issues')
    .insert({
      org_id: input.orgId,
      vendor_id: input.vendorId,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity ?? 'medium',
      source: input.source ?? 'manual',
      type: input.type ?? 'general',
      owner_user_id: input.ownerUserId ?? null,
      due_date: input.dueDate ?? null,
      remediation_plan: input.remediationPlan ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single()

  if (error) throw error

  // Log creation
  await logIssueActivity(data.id, input.createdByUserId ?? null, 'created', null, null, null)

  return data as Issue
}

// ─── Update issue ───────────────────────────────────────────────────────────

export interface UpdateIssueInput {
  title?: string
  description?: string | null
  severity?: IssueSeverity
  status?: IssueStatus
  disposition?: IssueDisposition
  ownerUserId?: string | null
  dueDate?: string | null
  remediationPlan?: string | null
  resolutionNotes?: string | null
  acceptedReason?: string | null
  acceptedByUserId?: string | null
}

export async function updateIssue(
  orgId: string,
  issueId: string,
  input: UpdateIssueInput,
  userId: string | null,
): Promise<void> {
  const sb = await createServerClient()

  // Get current state for activity log + vendor_id for propagation
  const { data: current } = await sb
    .from('issues')
    .select('status, severity, disposition, owner_user_id, vendor_id')
    .eq('id', issueId)
    .eq('org_id', orgId)
    .single()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) update.title = input.title
  if (input.description !== undefined) update.description = input.description
  if (input.severity !== undefined) update.severity = input.severity
  if (input.disposition !== undefined) update.disposition = input.disposition
  if (input.ownerUserId !== undefined) update.owner_user_id = input.ownerUserId
  if (input.dueDate !== undefined) update.due_date = input.dueDate
  if (input.remediationPlan !== undefined) update.remediation_plan = input.remediationPlan
  if (input.resolutionNotes !== undefined) update.resolution_notes = input.resolutionNotes

  if (input.status !== undefined) {
    update.status = input.status
    if (input.status === 'resolved') update.resolved_at = new Date().toISOString()
    if (input.status === 'closed') update.closed_at = new Date().toISOString()
    // Reopen / blocked / deferred / in_progress: clear resolved/closed timestamps
    if (input.status === 'open' || input.status === 'blocked' || input.status === 'deferred' || input.status === 'in_progress') {
      update.resolved_at = null
      update.closed_at = null
    }
  }

  if (input.disposition === 'accepted_risk') {
    update.accepted_reason = input.acceptedReason ?? null
    update.accepted_by_user_id = input.acceptedByUserId ?? userId
    update.accepted_at = new Date().toISOString()
  }

  const { error } = await sb
    .from('issues')
    .update(update)
    .eq('id', issueId)
    .eq('org_id', orgId)

  if (error) throw error

  // Log status changes
  if (input.status && current && input.status !== current.status) {
    await logIssueActivity(issueId, userId, 'status_changed', current.status, input.status, null)
  }
  if (input.severity && current && input.severity !== current.severity) {
    await logIssueActivity(issueId, userId, 'severity_changed', current.severity, input.severity, null)
  }
  if (input.disposition && current && input.disposition !== current.disposition) {
    await logIssueActivity(issueId, userId, 'disposition_changed', current.disposition, input.disposition, null)
  }
  if (input.ownerUserId !== undefined && current && input.ownerUserId !== current.owner_user_id) {
    await logIssueActivity(issueId, userId, 'owner_changed', current.owner_user_id, input.ownerUserId, null)
  }

  // Log resolution activity at the vendor level
  if (input.status && current && input.status !== current.status) {
    if (input.status === 'resolved' || input.status === 'closed') {
      if (current.vendor_id) {
        await logActivity({
          orgId,
          vendorId: current.vendor_id,
          actorUserId: userId,
          entityType: 'issue',
          entityId: issueId,
          action: input.status === 'resolved' ? 'issue_resolved' : 'issue_closed',
          title: `Issue ${input.status}`,
        })
      }
    }
  }
}

// ─── Check duplicate open issues ────────────────────────────────────────────

export async function findDuplicateIssues(
  _orgId: string,
  _vendorId: string,
  _controlId: string,
): Promise<Issue[]> {
  // assessment-based duplicate detection removed; will reimplement against review items if needed
  return []
}

// ─── Vendor issue counts (for overview) ─────────────────────────────────────

export interface VendorIssueCounts {
  total: number
  open: number
  in_progress: number
  overdue: number
  critical: number
  high: number
}

export async function getVendorIssueCounts(
  orgId: string,
  vendorId: string,
): Promise<VendorIssueCounts> {
  const issues = await sql<{ status: string; severity: string; due_date: string | null }[]>`
    SELECT status, severity, due_date
    FROM issues
    WHERE org_id = ${orgId}
      AND vendor_id = ${vendorId}
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress', 'blocked', 'deferred', 'resolved')
  `
  const today = new Date().toISOString().split('T')[0]

  return {
    total: issues.length,
    open: issues.filter(i => i.status === 'open').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    overdue: issues.filter(i =>
      (i.status === 'open' || i.status === 'in_progress' || i.status === 'blocked') && i.due_date && i.due_date < today
    ).length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
  }
}

// ─── Org-wide issue counts (for nav badge / dashboard) ──────────────────────

export async function getOrgIssueCounts(orgId: string) {
  const issues = await sql<{ status: string; due_date: string | null }[]>`
    SELECT status, due_date
    FROM issues
    WHERE org_id = ${orgId}
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress', 'blocked', 'deferred')
  `
  const today = new Date().toISOString().split('T')[0]

  return {
    open: issues.length,
    overdue: issues.filter(i => i.due_date && i.due_date < today).length,
  }
}

// ─── Evidence helpers ──────────────────────────────────────────────────────

export async function addIssueEvidence(
  issueId: string,
  fileName: string,
  fileUrl: string | null,
  notes: string | null,
  uploadedByUserId: string | null,
  fileKey?: string | null,
): Promise<IssueEvidence> {
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('issue_evidence')
    .insert({
      issue_id: issueId,
      file_name: fileName,
      file_url: fileUrl,
      file_key: fileKey ?? null,
      notes,
      uploaded_by_user_id: uploadedByUserId,
    })
    .select()
    .single()
  if (error) throw error

  await logIssueActivity(issueId, uploadedByUserId, 'evidence_uploaded', null, fileName, null)

  // Auto-transition: if issue is 'open', move to 'in_progress'
  const { data: issueRow } = await sb
    .from('issues')
    .select('status')
    .eq('id', issueId)
    .single()

  if (issueRow?.status === 'open') {
    await sb.from('issues').update({
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    }).eq('id', issueId)
    await logIssueActivity(issueId, uploadedByUserId, 'status_changed', 'open', 'in_progress', 'Auto: evidence uploaded')
  }

  return data as IssueEvidence
}

export async function reviewIssueEvidence(
  evidenceId: string,
  reviewStatus: 'accepted' | 'rejected',
  reviewNotes: string | null,
  reviewedByUserId: string,
): Promise<void> {
  const sb = await createServerClient()

  // Get evidence to find issue_id for activity log
  const { data: ev } = await sb
    .from('issue_evidence')
    .select('issue_id, file_name')
    .eq('id', evidenceId)
    .single()

  const { error } = await sb
    .from('issue_evidence')
    .update({
      review_status: reviewStatus,
      review_notes: reviewNotes,
      reviewed_by_user_id: reviewedByUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', evidenceId)

  if (error) throw error

  if (ev) {
    await logIssueActivity(
      ev.issue_id,
      reviewedByUserId,
      `evidence_${reviewStatus}`,
      'pending',
      reviewStatus,
      reviewNotes ? `${ev.file_name}: ${reviewNotes}` : ev.file_name,
    )

    // ── Auto-transitions based on evidence review ──

    if (reviewStatus === 'accepted') {
      // Check if ALL evidence for this issue is now accepted
      const { data: allEvidence } = await sb
        .from('issue_evidence')
        .select('review_status')
        .eq('issue_id', ev.issue_id)

      const allAccepted = allEvidence && allEvidence.length > 0
        && allEvidence.every(e => e.review_status === 'accepted')

      if (allAccepted) {
        const { data: issueRow } = await sb
          .from('issues')
          .select('status, org_id, vendor_id')
          .eq('id', ev.issue_id)
          .single()

        if (issueRow && !['resolved', 'closed'].includes(issueRow.status)) {
          // Auto-resolve the issue
          await sb.from('issues').update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', ev.issue_id)

          await logIssueActivity(ev.issue_id, reviewedByUserId, 'status_changed', issueRow.status, 'resolved', 'Auto: all evidence accepted')

          // Log on vendor timeline
          if (issueRow.vendor_id) {
            await logActivity({
              orgId: issueRow.org_id,
              vendorId: issueRow.vendor_id,
              actorUserId: reviewedByUserId,
              entityType: 'issue',
              entityId: ev.issue_id,
              action: 'issue_auto_resolved',
              title: 'Issue auto-resolved',
              description: 'All evidence accepted — issue auto-resolved',
            })
          }
        }
      }
    }

    if (reviewStatus === 'rejected') {
      // If issue was in_progress or auto-resolved, move back to open
      const { data: issueRow } = await sb
        .from('issues')
        .select('status')
        .eq('id', ev.issue_id)
        .single()

      if (issueRow && ['in_progress', 'resolved'].includes(issueRow.status)) {
        await sb.from('issues').update({
          status: 'open',
          resolved_at: null,
          updated_at: new Date().toISOString(),
        }).eq('id', ev.issue_id)

        await logIssueActivity(ev.issue_id, reviewedByUserId, 'status_changed', issueRow.status, 'open', 'Auto: evidence rejected')
      }
    }
  }
}

export async function deleteIssueEvidence(
  evidenceId: string,
  userId: string | null,
): Promise<void> {
  const sb = await createServerClient()

  const { data: ev } = await sb
    .from('issue_evidence')
    .select('issue_id, file_name')
    .eq('id', evidenceId)
    .single()

  const { error } = await sb
    .from('issue_evidence')
    .delete()
    .eq('id', evidenceId)

  if (error) throw error

  if (ev) {
    await logIssueActivity(ev.issue_id, userId, 'evidence_removed', ev.file_name, null, null)
  }
}

// ─── Promote evidence to vendor document ────────────────────────────────────

export async function promoteEvidenceToVendorDocument(
  orgId: string,
  vendorId: string,
  evidenceId: string,
  docTypeId: string,
  userId: string | null,
): Promise<string> {
  const sb = await createServerClient()

  // Get evidence details
  const { data: ev, error: evErr } = await sb
    .from('issue_evidence')
    .select('id, issue_id, file_name, file_url, vendor_document_id')
    .eq('id', evidenceId)
    .single()
  if (evErr || !ev) throw new Error('Evidence not found')
  if (ev.vendor_document_id) throw new Error('Evidence is already linked to a vendor document')

  // Upsert vendor_documents slot
  const { data: docRow, error: docErr } = await sb
    .from('vendor_documents')
    .upsert(
      { org_id: orgId, vendor_id: vendorId, doc_type_id: docTypeId },
      { onConflict: 'vendor_id,doc_type_id' },
    )
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  const vendorDocId = (docRow as { id: string }).id
  const fileKey = ev.file_url ?? `promoted:${ev.id}`

  // Insert version
  const { data: versionRow, error: vErr } = await sb
    .from('vendor_document_versions')
    .insert({
      org_id: orgId,
      vendor_document_id: vendorDocId,
      file_key: fileKey,
      file_name: ev.file_name,
      uploaded_by_user_id: userId,
      ai_status: 'queued',
    })
    .select()
    .single()
  if (vErr) throw new Error(vErr.message)

  const versionId = (versionRow as { id: string }).id

  // Set current version
  await sb.from('vendor_documents').update({ current_version_id: versionId }).eq('id', vendorDocId)

  // Backfill vendor_document_id on the evidence
  await sb.from('issue_evidence').update({ vendor_document_id: vendorDocId }).eq('id', evidenceId)

  // Log
  await logIssueActivity(ev.issue_id, userId, 'evidence_promoted', null, ev.file_name, 'Promoted to vendor document')

  return vendorDocId
}

// ─── Activity log helper ────────────────────────────────────────────────────

async function logIssueActivity(
  issueId: string,
  userId: string | null,
  action: string,
  oldValue: string | null,
  newValue: string | null,
  note: string | null,
) {
  const sb = await createServerClient()
  await sb.from('issue_activity').insert({
    issue_id: issueId,
    user_id: userId,
    action,
    old_value: oldValue,
    new_value: newValue,
    note,
  })
}

// ─── Add activity note ──────────────────────────────────────────────────────

export async function addIssueNote(
  issueId: string,
  userId: string | null,
  note: string,
) {
  await logIssueActivity(issueId, userId, 'note_added', null, null, note)
}
