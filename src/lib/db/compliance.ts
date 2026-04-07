import { createServerClient } from '@/lib/supabase/server'
import type { ComplianceData } from '@/types/vendor'
import type { AssessmentItemType, AssessmentFramework, MappedStandardRef } from '@/types/assessment'
import { getFrameworkItems, getVendorAssessmentFrameworks } from '@/lib/db/assessments'

/**
 * Compute compliance score for a vendor.
 *
 * Rules:
 *   - Requires a category (returns null score if none)
 *   - Required docs = category_required_documents WHERE is_required = true
 *   - Complete = vendor_documents has current_version_id AND file_key doesn't start with 'placeholder:' AND not expired
 *   - Partial = placeholder version exists (half credit for scoring purposes → rounds down)
 *   - Score = floor(complete_count / required_total * 100)
 */
export async function computeComplianceScore(
  orgId: string,
  vendorId: string,
  categoryId: string | null,
): Promise<ComplianceData> {
  if (!categoryId) {
    return { score: null, required_total: 0, required_complete: 0 }
  }

  const supabase = createServerClient()

  // Fetch required doc type IDs for this category
  const { data: reqDocs } = await supabase
    .from('category_document_templates')
    .select('doc_type_id')
    .eq('category_id', categoryId)
    .eq('is_required', true)
    .is('deleted_at', null)

  const requiredDocTypeIds = (reqDocs ?? []).map(
    (r: { doc_type_id: string }) => r.doc_type_id,
  )
  const required_total = requiredDocTypeIds.length

  if (required_total === 0) {
    return { score: 100, required_total: 0, required_complete: 0 }
  }

  // Fetch vendor_documents for those doc types
  const { data: vendorDocs } = await supabase
    .from('vendor_documents')
    .select('doc_type_id, current_version_id, expiry_date')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .in('doc_type_id', requiredDocTypeIds)
    .is('deleted_at', null)

  if (!vendorDocs || vendorDocs.length === 0) {
    return { score: 0, required_total, required_complete: 0 }
  }

  // Fetch current versions to check file_key
  const versionIds = (
    vendorDocs as { doc_type_id: string; current_version_id: string | null; expiry_date: string | null }[]
  )
    .map((d) => d.current_version_id)
    .filter((id): id is string => id !== null)

  const versionMap = new Map<string, { file_key: string; file_name: string | null }>()
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from('vendor_document_versions')
      .select('id, file_key, file_name')
      .in('id', versionIds)
      .is('deleted_at', null)
    for (const v of versions ?? []) {
      versionMap.set(
        (v as { id: string; file_key: string; file_name: string | null }).id,
        v as { file_key: string; file_name: string | null },
      )
    }
  }

  let required_complete = 0
  const today = new Date()

  for (const doc of vendorDocs as {
    doc_type_id: string
    current_version_id: string | null
    expiry_date: string | null
  }[]) {
    if (!doc.current_version_id) continue
    const version = versionMap.get(doc.current_version_id)
    if (!version) continue
    if (version.file_key.startsWith('placeholder:') && !version.file_name) continue // no file selected yet
    if (doc.expiry_date && new Date(doc.expiry_date) < today) continue // expired
    required_complete++
  }

  const score = Math.floor((required_complete / required_total) * 100)
  return { score, required_total, required_complete }
}

// ─── Framework readiness ───────────────────────────────────────────────────────

/**
 * ControlStatus values:
 * - satisfied:       Explicitly confirmed by an assessor review
 * - evidence_present: Document uploaded & not expired, but not yet reviewed by assessor
 * - missing:         No document uploaded for a document_check control
 * - expired:         Document exists but past its expiry date
 * - needs_assessment: Control type cannot be auto-evaluated (manual_check, reviewer_judgment, etc.)
 */
export type ControlStatus = 'satisfied' | 'evidence_present' | 'missing' | 'needs_assessment' | 'expired'

export interface ControlReadinessItem {
  framework_item_id: string
  title: string
  category: string | null
  item_type: AssessmentItemType
  required: boolean
  expected_document_type_id: string | null
  doc_type_name: string | null
  vendor_doc_id: string | null
  mapped_standard_refs: MappedStandardRef[] | null
  status: ControlStatus
  /** Assessment that reviewed this control (if any) */
  assessment_id: string | null
  assessment_title: string | null
  /** True when the linked assessment is still open (draft/in_review/pending_*) */
  assessment_is_active: boolean
}

export interface FrameworkReadiness {
  framework_id: string
  framework_name: string
  total: number
  satisfied: number
  evidence_present: number
  missing: number
  expired: number
  needs_assessment: number
  /** Score 0-100: satisfied / (total - needs_assessment). Null if all are needs_assessment. */
  score: number | null
  items: ControlReadinessItem[]
}

/**
 * For each VRF in vendor_framework_selections for this vendor, evaluate control
 * completion against the vendor's uploaded documents.
 *
 * vendor_framework_selections is the source of truth — populated at vendor creation
 * from category_framework_suggestions, and editable by users thereafter.
 *
 * Auto-evaluable: item_type='document_check' with expected_document_type_id
 * Needs assessment: all other item types (manual_check, reviewer_judgment, etc.)
 */
export async function getVendorComplianceReadiness(
  orgId: string,
  vendorId: string,
): Promise<FrameworkReadiness[]> {
  // Frameworks now live on assessments — derive from all non-deleted assessments for this vendor
  const frameworks: AssessmentFramework[] = await getVendorAssessmentFrameworks(orgId, vendorId)
  if (frameworks.length === 0) return []

  const selections = frameworks.map((fw) => ({
    framework_id: fw.id,
    framework: fw,
  }))

  const supabase = createServerClient()

  // Get vendor documents for this vendor (all of them)
  const { data: vendorDocs } = await supabase
    .from('vendor_documents')
    .select('id, doc_type_id, expiry_date, current_version_id')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)

  const vendorDocList = (vendorDocs ?? []) as {
    id: string
    doc_type_id: string
    expiry_date: string | null
    current_version_id: string | null
  }[]

  // Fetch current versions
  const versionIds = vendorDocList
    .map((d) => d.current_version_id)
    .filter((id): id is string => id !== null)

  const versionMap = new Map<string, { file_key: string; file_name: string | null }>()
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from('vendor_document_versions')
      .select('id, file_key, file_name')
      .in('id', versionIds)
      .is('deleted_at', null)
    for (const v of (versions ?? []) as { id: string; file_key: string; file_name: string | null }[]) {
      versionMap.set(v.id, v)
    }
  }

  // Build doc status map: doc_type_id → { uploaded, expired } and doc_type_id → vendor_doc_id
  const docStatusByTypeId = new Map<string, { uploaded: boolean; expired: boolean }>()
  const vendorDocIdByTypeId = new Map<string, string>()
  const today = new Date()
  for (const doc of vendorDocList) {
    vendorDocIdByTypeId.set(doc.doc_type_id, doc.id)
    const version = doc.current_version_id ? versionMap.get(doc.current_version_id) ?? null : null
    if (!version) {
      docStatusByTypeId.set(doc.doc_type_id, { uploaded: false, expired: false })
      continue
    }
    const isPlaceholder = version.file_key.startsWith('placeholder:') && !version.file_name
    if (isPlaceholder) {
      docStatusByTypeId.set(doc.doc_type_id, { uploaded: false, expired: false })
      continue
    }
    const isExpired = !!doc.expiry_date && new Date(doc.expiry_date) < today
    docStatusByTypeId.set(doc.doc_type_id, { uploaded: !isExpired, expired: isExpired })
  }

  // ── Assessment item statuses ── bridge: satisfactory item → satisfied control ─
  // Priority for "best" item per framework_item_id:
  //   satisfactory(3) > in_progress/needs_attention/high_risk/mitigated(2) > not_started(1) > not_applicable(0)
  // For equal priority prefer an active (open) assessment over a completed one.
  const ACTIVE_ASSESSMENT_STATUSES = new Set([
    'draft', 'in_review', 'pending_ai_review', 'pending_human_review',
  ])
  const ITEM_PRIORITY: Record<string, number> = {
    satisfactory: 3, in_progress: 2, needs_attention: 2,
    high_risk: 2, mitigated: 2, not_started: 1, not_applicable: 0,
  }

  type AssessmentItemInfo = {
    item_status: string
    assessment_id: string
    assessment_title: string | null
    assessment_is_active: boolean
  }
  const bestByFrameworkItemId = new Map<string, AssessmentItemInfo>()

  const { data: assessmentRows } = await supabase
    .from('vendor_assessments')
    .select('id, status, title')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)

  const assessmentInfoById = new Map<string, { status: string; title: string | null }>()
  for (const a of (assessmentRows ?? []) as { id: string; status: string; title: string | null }[]) {
    assessmentInfoById.set(a.id, { status: a.status, title: a.title })
  }

  const assessmentIds = [...assessmentInfoById.keys()]
  if (assessmentIds.length > 0) {
    const { data: aiRows } = await supabase
      .from('assessment_items')
      .select('framework_item_id, status, assessment_id')
      .in('assessment_id', assessmentIds)
      .is('deleted_at', null)
      .not('framework_item_id', 'is', null)

    for (const row of (aiRows ?? []) as { framework_item_id: string; status: string; assessment_id: string }[]) {
      const aInfo = assessmentInfoById.get(row.assessment_id)
      if (!aInfo) continue
      const isActive = ACTIVE_ASSESSMENT_STATUSES.has(aInfo.status)
      const priority = ITEM_PRIORITY[row.status] ?? 0
      const existing = bestByFrameworkItemId.get(row.framework_item_id)
      if (!existing) {
        bestByFrameworkItemId.set(row.framework_item_id, {
          item_status: row.status, assessment_id: row.assessment_id,
          assessment_title: aInfo.title, assessment_is_active: isActive,
        })
        continue
      }
      const existingPriority = ITEM_PRIORITY[existing.item_status] ?? 0
      if (priority > existingPriority || (priority === existingPriority && isActive && !existing.assessment_is_active)) {
        bestByFrameworkItemId.set(row.framework_item_id, {
          item_status: row.status, assessment_id: row.assessment_id,
          assessment_title: aInfo.title, assessment_is_active: isActive,
        })
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Collect all unique doc_type_ids referenced by framework items (for name lookup)
  const allItems = await Promise.all(selections.map((s) => getFrameworkItems(s.framework_id)))
  const allDocTypeIds = new Set<string>()
  for (const items of allItems) {
    for (const item of items) {
      if (item.expected_document_type_id) allDocTypeIds.add(item.expected_document_type_id)
    }
  }

  // Fetch doc type names
  const docTypeNameById = new Map<string, string>()
  if (allDocTypeIds.size > 0) {
    const { data: dtRows } = await supabase
      .from('document_types')
      .select('id, name')
      .in('id', [...allDocTypeIds])
    for (const dt of (dtRows ?? []) as { id: string; name: string }[]) {
      docTypeNameById.set(dt.id, dt.name)
    }
  }

  // Build per-framework readiness
  const result: FrameworkReadiness[] = []

  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i]
    const items = allItems[i]

    const readinessItems: ControlReadinessItem[] = items.map((item) => {
      const isDocCheck = item.item_type === 'document_check' && !!item.expected_document_type_id

      let status: ControlStatus = 'needs_assessment'
      if (isDocCheck) {
        const docSt = docStatusByTypeId.get(item.expected_document_type_id!)
        if (!docSt) {
          status = 'missing'
        } else if (docSt.expired) {
          status = 'expired'
        } else if (docSt.uploaded) {
          // Document present but not yet reviewed — evidence_present, NOT satisfied.
          // Only an explicit assessor review can mark a control as satisfied.
          status = 'evidence_present'
        } else {
          status = 'missing'
        }
      }

      // Bridge: assessor marked this control satisfactory → promote to satisfied
      const assessItem = bestByFrameworkItemId.get(item.id)
      if (assessItem?.item_status === 'satisfactory') {
        status = 'satisfied'
      }

      return {
        framework_item_id: item.id,
        title: item.title,
        category: item.category,
        item_type: item.item_type,
        required: item.required,
        expected_document_type_id: item.expected_document_type_id,
        doc_type_name: item.expected_document_type_id
          ? (docTypeNameById.get(item.expected_document_type_id) ?? null)
          : null,
        vendor_doc_id: item.expected_document_type_id
          ? (vendorDocIdByTypeId.get(item.expected_document_type_id) ?? null)
          : null,
        mapped_standard_refs: item.mapped_standard_refs ?? null,
        status,
        assessment_id: assessItem?.assessment_id ?? null,
        assessment_title: assessItem?.assessment_title ?? null,
        assessment_is_active: assessItem?.assessment_is_active ?? false,
      }
    })

    const total = readinessItems.length
    const satisfied       = readinessItems.filter((i) => i.status === 'satisfied').length
    const evidence_present = readinessItems.filter((i) => i.status === 'evidence_present').length
    const missing         = readinessItems.filter((i) => i.status === 'missing').length
    const expired         = readinessItems.filter((i) => i.status === 'expired').length
    const needs_assessment = readinessItems.filter((i) => i.status === 'needs_assessment').length
    // evaluable = controls that can be scored (excludes needs_assessment)
    const evaluable = total - needs_assessment
    // Hybrid scoring: satisfied=100%, evidence_present=50%, missing/expired=0%
    // evidence_present gets partial credit — document is there but not yet reviewer-confirmed
    const score = evaluable > 0 ? Math.floor(((satisfied + evidence_present * 0.5) / evaluable) * 100) : null

    result.push({
      framework_id: sel.framework_id,
      framework_name: sel.framework.name,
      total,
      satisfied,
      evidence_present,
      missing,
      expired,
      needs_assessment,
      score,
      items: readinessItems,
    })
  }

  return result
}
