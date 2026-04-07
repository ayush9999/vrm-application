import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
import type {
  VendorAssessment,
  VendorAssessmentRow,
  AssessmentFramework,
  AssessmentFrameworkItem,
  AssessmentItem,
  AssessmentItemEvidence,
  AssessmentFinding,
  AssessmentMitigation,
  AssessmentReview,
  AssessmentReport,
  AssessmentDetail,
  AssessmentStatus,
  AssessmentItemStatus,
  AssessmentRiskLevel,
  AssessmentPeriodType,
} from '@/types/assessment'

// ─── Frameworks ───────────────────────────────────────────────────────────────

/** List frameworks available to an org (org's own + all standard/global), optionally filtered by kind */
export async function getFrameworks(
  orgId: string,
  kind?: 'compliance_standard' | 'vendor_risk_framework',
): Promise<AssessmentFramework[]> {
  const supabase = createServerClient()
  let query = supabase
    .from('assessment_frameworks')
    .select('*')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('is_active', true)
    .order('name')
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AssessmentFramework[]
}

/** List framework items for a given framework, ordered by sort_order */
export async function getFrameworkItems(frameworkId: string): Promise<AssessmentFrameworkItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assessment_framework_items')
    .select('*')
    .eq('framework_id', frameworkId)
    .is('deleted_at', null)
    .not('code', 'is', null)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as AssessmentFrameworkItem[]
}

/** Get frameworks explicitly selected for an assessment (from assessment_framework_selections) */
export async function getAssessmentFrameworks(assessmentId: string): Promise<AssessmentFramework[]> {
  const supabase = createServerClient()

  const { data: rows } = await supabase
    .from('assessment_framework_selections')
    .select('framework_id')
    .eq('assessment_id', assessmentId)

  const frameworkIds = (rows ?? []).map((r: { framework_id: string }) => r.framework_id)
  if (frameworkIds.length === 0) return []

  const { data } = await supabase
    .from('assessment_frameworks')
    .select('*')
    .in('id', frameworkIds)
    .is('deleted_at', null)
  return (data ?? []) as AssessmentFramework[]
}

/** Get distinct frameworks across ALL assessments for a vendor (for vendor overview/compliance) */
export async function getVendorAssessmentFrameworks(
  orgId: string,
  vendorId: string,
): Promise<AssessmentFramework[]> {
  const supabase = createServerClient()

  const { data: assessments } = await supabase
    .from('vendor_assessments')
    .select('id')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)

  const assessmentIds = (assessments ?? []).map((a: { id: string }) => a.id)
  if (assessmentIds.length === 0) return []

  const { data: fwRows } = await supabase
    .from('assessment_framework_selections')
    .select('framework_id')
    .in('assessment_id', assessmentIds)

  const frameworkIds = [...new Set((fwRows ?? []).map((r: { framework_id: string }) => r.framework_id))]
  if (frameworkIds.length === 0) return []

  const { data } = await supabase
    .from('assessment_frameworks')
    .select('*')
    .in('id', frameworkIds)
    .is('deleted_at', null)
  return (data ?? []) as AssessmentFramework[]
}

/** Return the onboarding assessment ID for a vendor, or null if none exists */
export async function getVendorOnboardingAssessmentId(
  orgId: string,
  vendorId: string,
): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('vendor_assessments')
    .select('id')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .eq('is_onboarding', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Remove all active items from a specific framework within an assessment */
export async function removeFrameworkFromAssessment(
  orgId: string,
  assessmentId: string,
  frameworkId: string,
): Promise<void> {
  const supabase = createServerClient()

  // Soft-delete by joining through the FK relationship — avoids .in(id, [...N ids]) URL overflow.
  // First fetch the assessment_items that link to this framework's items.
  const { data: toDelete } = await supabase
    .from('assessment_items')
    .select('id, fw:assessment_framework_items!framework_item_id(framework_id)')
    .eq('assessment_id', assessmentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .not('framework_item_id', 'is', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idsToDelete = (toDelete ?? []).filter((r: any) => r.fw?.framework_id === frameworkId).map((r: any) => r.id)

  if (idsToDelete.length === 0) return

  const now = new Date().toISOString()
  // Delete in chunks of 200 to stay within URL limits
  for (let i = 0; i < idsToDelete.length; i += 200) {
    await supabase
      .from('assessment_items')
      .update({ deleted_at: now })
      .in('id', idsToDelete.slice(i, i + 200))
  }

  // Also remove the explicit framework selection record
  await removeAssessmentFrameworkSelection(assessmentId, frameworkId)
}

// ─── Assessments list ─────────────────────────────────────────────────────────

export interface GetAssessmentsOptions {
  vendorId?: string
  status?: AssessmentStatus
}

const ASSESSMENT_SELECT = `
  *,
  vendor:vendors!vendor_assessments_vendor_id_fkey(id, name, vendor_code),
  framework_selections:assessment_framework_selections(
    framework_id,
    source,
    framework:assessment_frameworks!framework_id(id, name, framework_type)
  ),
  assigned_to:users!vendor_assessments_assigned_to_user_id_fkey(name, email),
  created_by:users!vendor_assessments_created_by_user_id_fkey(name, email)
` as const

/** Map raw Supabase row (with nested framework_selections) to VendorAssessment */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAssessmentRow(row: any): VendorAssessment {
  const { framework_selections, ...rest } = row
  return {
    ...rest,
    frameworks: (framework_selections ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => s.framework)
      .filter(Boolean),
  } as VendorAssessment
}

/** List assessments for an org with optional filters */
export async function getAssessments(
  orgId: string,
  opts: GetAssessmentsOptions = {},
): Promise<VendorAssessment[]> {
  const supabase = createServerClient()
  let query = supabase
    .from('vendor_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (opts.vendorId) query = query.eq('vendor_id', opts.vendorId)
  if (opts.status) query = query.eq('status', opts.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapAssessmentRow)
}

/** Fetch a single assessment by ID */
export async function getAssessmentById(
  orgId: string,
  assessmentId: string,
): Promise<VendorAssessment | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendor_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('org_id', orgId)
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .single()
  if (error) return null
  return mapAssessmentRow(data)
}

// ─── Assessment detail (all related data) ─────────────────────────────────────

export async function getAssessmentDetail(
  orgId: string,
  assessmentId: string,
): Promise<AssessmentDetail | null> {
  const assessment = await getAssessmentById(orgId, assessmentId)
  if (!assessment) return null

  const supabase = createServerClient()

  const [itemsRes, findingsRes, reviewsRes, reportsRes] = await Promise.all([
    supabase
      .from('assessment_items')
      .select('*')
      .eq('assessment_id', assessmentId)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('assessment_findings')
      .select('*, mitigations:assessment_mitigations(*)')
      .eq('assessment_id', assessmentId)
      .is('deleted_at', null)
      .order('created_at'),
    supabase
      .from('assessment_reviews')
      .select('*')
      .eq('assessment_id', assessmentId)
      .is('deleted_at', null)
      .order('created_at'),
    supabase
      .from('assessment_reports')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('version', { ascending: false }),
  ])

  if (itemsRes.error) throw new Error(itemsRes.error.message)
  if (findingsRes.error) throw new Error(findingsRes.error.message)
  if (reviewsRes.error) throw new Error(reviewsRes.error.message)
  if (reportsRes.error) throw new Error(reportsRes.error.message)

  // Enrich items: join to assessment_framework_items via FK to get framework_id + mapped_standard_refs.
  // We fetch items again with the join rather than using .in(id, [...N ids]) which overflows URL limits.
  type RawItemWithJoin = AssessmentItem & {
    fw: { framework_id: string; mapped_standard_refs: import('@/types/assessment').MappedStandardRef[] | null } | null
  }
  const { data: enrichedRows } = await supabase
    .from('assessment_items')
    .select('*, fw:assessment_framework_items!framework_item_id(framework_id, mapped_standard_refs)')
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)
    .order('sort_order')

  const items: AssessmentItem[] = ((enrichedRows ?? []) as RawItemWithJoin[]).map(item => ({
    ...item,
    fw: undefined,
    mapped_standard_refs: item.fw?.mapped_standard_refs ?? null,
    framework_id: item.fw?.framework_id ?? null,
  }))

  return {
    assessment,
    items,
    findings: (findingsRes.data ?? []) as unknown as AssessmentFinding[],
    reviews: (reviewsRes.data ?? []) as AssessmentReview[],
    reports: (reportsRes.data ?? []) as AssessmentReport[],
  }
}

// ─── Create assessment ────────────────────────────────────────────────────────

export interface CreateAssessmentInput {
  orgId: string
  vendorId: string
  title: string
  isOnboarding?: boolean
  description?: string | null
  periodType?: AssessmentPeriodType | null
  periodStart?: string | null
  periodEnd?: string | null
  assignedToUserId?: string | null
  createdByUserId?: string | null
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<VendorAssessmentRow> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vendor_assessments')
    .insert({
      org_id: input.orgId,
      vendor_id: input.vendorId,
      is_onboarding: input.isOnboarding ?? false,
      assessment_type: 'risk_assessment',
      title: input.title,
      description: input.description ?? null,
      period_type: input.periodType ?? null,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      status: 'draft',
      assigned_to_user_id: input.assignedToUserId ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logActivity({
    orgId: input.orgId,
    vendorId: input.vendorId,
    actorUserId: input.createdByUserId ?? null,
    entityType: 'vendor_assessment',
    entityId: data.id,
    action: 'assessment_created',
    title: input.title,
  })

  return data as VendorAssessmentRow
}

/** Record a framework selection on an assessment. Silently ignores duplicate. */
export async function addAssessmentFrameworkSelection(
  assessmentId: string,
  frameworkId: string,
  source: 'onboarding' | 'manual',
  addedByUserId: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('assessment_framework_selections')
    .insert({ assessment_id: assessmentId, framework_id: frameworkId, source, added_by_user_id: addedByUserId })
  if (error && error.code !== '23505') throw new Error(error.message)
  // 23505 = unique_violation — duplicate framework on same assessment, silently ignore
}

/** Remove a framework selection from an assessment record */
async function removeAssessmentFrameworkSelection(
  assessmentId: string,
  frameworkId: string,
): Promise<void> {
  const supabase = createServerClient()
  await supabase
    .from('assessment_framework_selections')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('framework_id', frameworkId)
}

// ─── Instantiate framework items into assessment items ────────────────────────

export async function instantiateFrameworkItems(
  orgId: string,
  assessmentId: string,
  frameworkId: string,
  createdByUserId: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const items = await getFrameworkItems(frameworkId)
  if (items.length === 0) return

  // Deduplicate against controls already added to this assessment.
  // All queries use .eq('assessment_id') — never .in(id, [...N ids]) — to avoid URL overflow.
  const { data: existing } = await supabase
    .from('assessment_items')
    .select('framework_item_id, title')
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)

  const existingFrameworkItemIds = new Set(
    (existing ?? []).map((r: { framework_item_id: string | null }) => r.framework_item_id).filter(Boolean) as string[]
  )
  const existingTitles = new Set(
    (existing ?? []).map((r: { title: string }) => r.title?.toLowerCase().trim()).filter(Boolean) as string[]
  )

  // Get universal_control_ids already covered — use a join instead of .in(id, [...]) to avoid overflow
  const { data: coveredRows } = await supabase
    .from('assessment_items')
    .select('fw:assessment_framework_items!framework_item_id(universal_control_id)')
    .eq('assessment_id', assessmentId)
    .is('deleted_at', null)
    .not('framework_item_id', 'is', null)

  const coveredUcIds = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (coveredRows ?? []).map((r: any) => r.fw?.universal_control_id).filter(Boolean)
  )

  const rows = items
    .filter(item => {
      // Skip if this exact framework item template is already instantiated
      if (existingFrameworkItemIds.has(item.id)) return false
      // Skip if this universal control is already covered (cross-framework dedup)
      if (item.universal_control_id && coveredUcIds.has(item.universal_control_id)) return false
      // Safety net: skip if exact same title already exists in this assessment
      if (existingTitles.has(item.title.toLowerCase().trim())) return false
      return true
    })
    .map((item, idx) => ({
      org_id: orgId,
      assessment_id: assessmentId,
      framework_item_id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      item_type: item.item_type,
      required: item.required,
      weight: item.weight,
      status: 'not_started' as AssessmentItemStatus,
      expected_document_type_id: item.expected_document_type_id,
      sort_order: item.sort_order ?? idx,
      created_by_user_id: createdByUserId,
    }))

  if (rows.length === 0) return
  const { error } = await supabase.from('assessment_items').insert(rows)
  if (error) throw new Error(error.message)
}

// ─── Update assessment status / fields ────────────────────────────────────────

export interface UpdateAssessmentInput {
  title?: string
  description?: string | null
  status?: AssessmentStatus
  overall_score?: number | null
  risk_level?: AssessmentRiskLevel | null
  final_summary?: string | null
  final_recommendation?: string | null
  submitted_at?: string | null
  completed_at?: string | null
  human_notes?: string | null
}

export async function updateAssessment(
  orgId: string,
  assessmentId: string,
  input: UpdateAssessmentInput,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('vendor_assessments')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

// ─── Update assessment item ───────────────────────────────────────────────────

export interface UpdateAssessmentItemInput {
  status?: AssessmentItemStatus
  score?: number | null
  rationale?: string | null
  reviewer_notes?: string | null
  human_notes?: string | null
}

export async function updateAssessmentItem(
  orgId: string,
  itemId: string,
  input: UpdateAssessmentItemInput,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('assessment_items')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteAssessment(
  orgId: string,
  assessmentId: string,
  deletedByUserId: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('vendor_assessments')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', assessmentId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  await logActivity({
    orgId,
    actorUserId: deletedByUserId,
    entityType: 'vendor_assessment',
    entityId: assessmentId,
    action: 'assessment_deleted',
    title: 'Assessment deleted',
  })
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function addItemEvidence(
  orgId: string,
  assessmentItemId: string,
  evidenceType: AssessmentItemEvidence['evidence_type'],
  evidenceEntityId: string | null,
  summary: string | null,
  createdByUserId: string | null,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('assessment_item_evidence').insert({
    org_id: orgId,
    assessment_item_id: assessmentItemId,
    evidence_type: evidenceType,
    evidence_entity_id: evidenceEntityId,
    summary,
    created_by_user_id: createdByUserId,
  })
  if (error) throw new Error(error.message)
}

// ─── Findings ─────────────────────────────────────────────────────────────────

export interface CreateFindingInput {
  orgId: string
  assessmentId: string
  assessmentItemId?: string | null
  title: string
  description?: string | null
  severity: 'low' | 'medium' | 'high'
  riskDomain?: string | null
  riskCategory?: string | null
  createdByUserId?: string | null
}

export async function createFinding(input: CreateFindingInput): Promise<AssessmentFinding> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assessment_findings')
    .insert({
      org_id: input.orgId,
      assessment_id: input.assessmentId,
      assessment_item_id: input.assessmentItemId ?? null,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      status: 'open',
      risk_domain: input.riskDomain ?? null,
      risk_category: input.riskCategory ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssessmentFinding
}

export async function updateFindingStatus(
  orgId: string,
  findingId: string,
  status: AssessmentFinding['status'],
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('assessment_findings')
    .update({ status })
    .eq('id', findingId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
}

// ─── Mitigations ──────────────────────────────────────────────────────────────

export interface CreateMitigationInput {
  orgId: string
  findingId: string
  assessmentId: string
  action: string
  ownerUserId?: string | null
  dueAt?: string | null
  notes?: string | null
  createdByUserId?: string | null
}

export async function createMitigation(
  input: CreateMitigationInput,
): Promise<AssessmentMitigation> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assessment_mitigations')
    .insert({
      org_id: input.orgId,
      finding_id: input.findingId,
      assessment_id: input.assessmentId,
      action: input.action,
      owner_user_id: input.ownerUserId ?? null,
      due_at: input.dueAt ?? null,
      status: 'open',
      notes: input.notes ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssessmentMitigation
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function createReview(
  orgId: string,
  assessmentId: string,
  reviewType: 'ai' | 'human',
  reviewerUserId: string | null,
  createdByUserId: string | null,
): Promise<AssessmentReview> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assessment_reviews')
    .insert({
      org_id: orgId,
      assessment_id: assessmentId,
      review_type: reviewType,
      status: 'pending',
      reviewer_user_id: reviewerUserId,
      created_by_user_id: createdByUserId,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssessmentReview
}

export async function completeReview(
  orgId: string,
  reviewId: string,
  summary: string,
): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('assessment_reviews')
    .update({
      status: 'completed',
      review_summary: summary,
      completed_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}

// ─── Utility: compute item progress summary ───────────────────────────────────

export function computeItemProgress(items: AssessmentItem[]) {
  const live = items.filter((i) => i.deleted_at === null)
  const total = live.length
  const done = live.filter((i) =>
    ['satisfactory', 'needs_attention', 'high_risk', 'mitigated', 'not_applicable'].includes(i.status),
  ).length
  const flagged = live.filter((i) =>
    ['needs_attention', 'high_risk'].includes(i.status),
  ).length
  const not_started = live.filter((i) => i.status === 'not_started').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, flagged, not_started, pct }
}
