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
  assessmentId?: string
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
  const sb = await createServerClient()
  let q = sb
    .from('issues')
    .select(`
      *,
      vendors!inner(name),
      users!issues_owner_user_id_fkey(name),
      vendor_assessments(title, assessment_code)
    `)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (opts.vendorId) q = q.eq('vendor_id', opts.vendorId)
  if (opts.assessmentId) q = q.eq('assessment_id', opts.assessmentId)
  if (opts.severity) q = q.eq('severity', opts.severity)
  if (opts.source) q = q.eq('source', opts.source)
  if (opts.ownerUserId) q = q.eq('owner_user_id', opts.ownerUserId)

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
    q = q.in('status', statuses)
  }

  if (opts.overdue) {
    q = q.lt('due_date', new Date().toISOString().split('T')[0])
      .in('status', ['open', 'in_progress', 'blocked'])
  }

  if (opts.search) {
    q = q.or(`title.ilike.%${opts.search}%,description.ilike.%${opts.search}%`)
  }

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    ...row,
    vendor_name: row.vendors?.name ?? null,
    owner_name: row.users?.name ?? null,
    assessment_title: row.vendor_assessments?.title ?? null,
    assessment_code: row.vendor_assessments?.assessment_code ?? null,
    vendors: undefined,
    users: undefined,
    vendor_assessments: undefined,
  }))
}

// ─── Get single issue with relations ────────────────────────────────────────

export async function getIssueById(
  orgId: string,
  issueId: string,
): Promise<Issue | null> {
  const sb = await createServerClient()

  const { data: issue, error } = await sb
    .from('issues')
    .select(`
      *,
      vendors!inner(name),
      users!issues_owner_user_id_fkey(name),
      vendor_assessments(title, assessment_code)
    `)
    .eq('id', issueId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!issue) return null

  // Fetch relations in parallel
  const [controlsRes, evidenceRes, findingsRes, activityRes] = await Promise.all([
    sb.from('issue_controls')
      .select(`
        *,
        assessment_items(title, status),
        assessment_framework_items(title, framework_id, assessment_frameworks(name))
      `)
      .eq('issue_id', issueId),
    sb.from('issue_evidence')
      .select('*')
      .eq('issue_id', issueId)
      .order('uploaded_at', { ascending: false }),
    sb.from('issue_findings')
      .select(`
        *,
        assessment_findings(title, severity)
      `)
      .eq('issue_id', issueId),
    sb.from('issue_activity')
      .select(`
        *,
        users(name)
      `)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false }),
  ])

  return {
    ...issue,
    vendor_name: issue.vendors?.name ?? null,
    owner_name: issue.users?.name ?? null,
    assessment_title: issue.vendor_assessments?.title ?? null,
    assessment_code: issue.vendor_assessments?.assessment_code ?? null,
    vendors: undefined,
    users: undefined,
    vendor_assessments: undefined,
    controls: (controlsRes.data ?? []).map((c: any) => ({
      ...c,
      control_title: c.assessment_items?.title ?? c.assessment_framework_items?.title ?? null,
      control_status: c.assessment_items?.status ?? null,
      framework_name: c.assessment_framework_items?.assessment_frameworks?.name ?? null,
      assessment_items: undefined,
      assessment_framework_items: undefined,
    })),
    evidence: evidenceRes.data ?? [],
    findings: (findingsRes.data ?? []).map((f: any) => ({
      ...f,
      finding_title: f.assessment_findings?.title ?? null,
      finding_severity: f.assessment_findings?.severity ?? null,
      assessment_findings: undefined,
    })),
    activity: (activityRes.data ?? []).map((a: any) => ({
      ...a,
      user_name: a.users?.name ?? null,
      users: undefined,
    })),
  }
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
  assessmentId?: string | null
  ownerUserId?: string | null
  dueDate?: string | null
  remediationPlan?: string | null
  createdByUserId?: string | null
  // optional linked items
  controlIds?: string[]  // assessment_item ids
  findingIds?: string[]  // assessment_finding ids
  frameworkItemIds?: string[] // framework_item ids
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
      assessment_id: input.assessmentId ?? null,
      owner_user_id: input.ownerUserId ?? null,
      due_date: input.dueDate ?? null,
      remediation_plan: input.remediationPlan ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single()

  if (error) throw error

  // Link controls (with corresponding framework_item_id when available)
  if (input.controlIds?.length) {
    const rows = input.controlIds.map((controlId, idx) => ({
      issue_id: data.id,
      assessment_item_id: controlId,
      framework_item_id: input.frameworkItemIds?.[idx] ?? null,
    }))
    await sb.from('issue_controls').insert(rows)
  }

  // Link findings if provided
  if (input.findingIds?.length) {
    const rows = input.findingIds.map(findingId => ({
      issue_id: data.id,
      assessment_finding_id: findingId,
    }))
    await sb.from('issue_findings').insert(rows)
  }

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

  // Propagate resolution to linked assessment controls + log vendor activity
  if (input.status && current && input.status !== current.status) {
    if (input.status === 'resolved' || input.status === 'closed') {
      await propagateResolutionToControls(issueId)
      if (current.vendor_id) {
        await logActivity({
          orgId,
          vendorId: current.vendor_id,
          actorUserId: userId,
          entityType: 'issue',
          entityId: issueId,
          action: input.status === 'resolved' ? 'issue_resolved' : 'issue_closed',
          title: `Issue ${input.status}`,
          description: `Linked assessment controls updated to mitigated`,
        })
      }
    }
  }
}

// ─── Propagate issue resolution to assessment controls ──────────────────────

async function propagateResolutionToControls(issueId: string): Promise<void> {
  const sb = await createServerClient()

  const { data: controls } = await sb
    .from('issue_controls')
    .select('assessment_item_id')
    .eq('issue_id', issueId)
    .not('assessment_item_id', 'is', null)

  if (!controls?.length) return

  const itemIds = controls.map(c => c.assessment_item_id).filter(Boolean)
  if (itemIds.length === 0) return

  // Only update flagged items — don't overwrite already-satisfactory controls
  await sb
    .from('assessment_items')
    .update({ status: 'mitigated', updated_at: new Date().toISOString() })
    .in('id', itemIds)
    .in('status', ['needs_attention', 'high_risk'])
}

// ─── Check duplicate open issues ────────────────────────────────────────────

export async function findDuplicateIssues(
  orgId: string,
  vendorId: string,
  controlId: string,
): Promise<Issue[]> {
  const sb = await createServerClient()
  const { data } = await sb
    .from('issue_controls')
    .select(`
      issues!inner(
        id, title, status, severity, created_at,
        vendors!inner(name)
      )
    `)
    .eq('assessment_item_id', controlId)
    .in('issues.status', ['open', 'in_progress', 'blocked', 'deferred'])
    .eq('issues.org_id', orgId)
    .eq('issues.vendor_id', vendorId)
    .is('issues.deleted_at', null)

  return (data ?? []).map((row: any) => row.issues)
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
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('issues')
    .select('status, severity, due_date')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress', 'blocked', 'deferred', 'resolved'])

  if (error) throw error
  const issues = data ?? []
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
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('issues')
    .select('status, due_date')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress', 'blocked', 'deferred'])

  if (error) throw error
  const issues = data ?? []
  const today = new Date().toISOString().split('T')[0]

  return {
    open: issues.length,
    overdue: issues.filter(i => i.due_date && i.due_date < today).length,
  }
}

// ─── Get linked issues for assessment findings ────────────────────────────

export interface FindingIssueLink {
  finding_id: string
  issue_id: string
  issue_title: string
  issue_status: string
}

export async function getAssessmentFindingIssueLinks(
  findingIds: string[],
): Promise<FindingIssueLink[]> {
  if (findingIds.length === 0) return []
  const sb = await createServerClient()

  const { data, error } = await sb
    .from('issue_findings')
    .select(`
      assessment_finding_id,
      issue_id,
      issues!inner(id, title, status, deleted_at)
    `)
    .in('assessment_finding_id', findingIds)
    .is('issues.deleted_at', null)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    finding_id: row.assessment_finding_id,
    issue_id: row.issues.id,
    issue_title: row.issues.title,
    issue_status: row.issues.status,
  }))
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

          // Propagate to linked assessment controls
          await propagateResolutionToControls(ev.issue_id)

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
              description: 'All evidence accepted — issue and linked controls updated',
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
