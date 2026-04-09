import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { AssessmentFramework } from '@/types/assessment'

// ─── Seed data ─────────────────────────────────────────────────────────────────

const STANDARD_DOC_TYPES = [
  'NDA',
  'Contract',
  'Insurance',
  'ISO Certificate',
  'GST Certificate',
]

const DEFAULT_CATEGORIES = ['IT Vendor', 'Logistics', 'Contractor', 'Consultant']

/** Category → document mappings (document name → is_required) */
const CATEGORY_DOC_MAP: Record<string, Record<string, boolean>> = {
  'IT Vendor': { NDA: true, Contract: true, Insurance: true, 'ISO Certificate': false },
  Logistics: { Contract: true, Insurance: true },
  Contractor: { NDA: true, Contract: true },
  Consultant: { NDA: true, Contract: true, 'GST Certificate': false },
}

// ─── Queries ───────────────────────────────────────────────────────────────────

export interface OrgUser {
  id: string
  name: string | null
  email: string | null
}

/** Fetch all users belonging to an org, ordered by name then email */
export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('org_id', orgId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgUser[]
}

/**
 * Idempotently seeds:
 *  1. Standard document types for the org
 *  2. Default vendor categories
 *  3. category_required_documents links
 */
export async function initOrgDefaults(orgId: string): Promise<void> {
  // Uses service client because this runs during signup before any user
  // session exists, AND because once RLS is enabled the cookie-aware client
  // would be unable to insert org-scoped seed rows for an org the user
  // doesn't yet belong to (race vs. the membership insert).
  const supabase = createServiceClient()

  // ── 1. Standard document types ──────────────────────────────────────────────
  const { data: existingDocTypes } = await supabase
    .from('document_types')
    .select('name')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const existingDocNames = new Set(
    (existingDocTypes ?? []).map((d: { name: string }) => d.name.toLowerCase()),
  )
  const docTypesToInsert = STANDARD_DOC_TYPES.filter(
    (n) => !existingDocNames.has(n.toLowerCase()),
  ).map((name) => ({ org_id: orgId, name, source_type: 'custom' as const }))

  if (docTypesToInsert.length > 0) {
    const { error } = await supabase.from('document_types').insert(docTypesToInsert)
    if (error) throw new Error(error.message)
  }

  // Re-fetch all doc types for this org to build the name→id map
  const { data: allDocTypes } = await supabase
    .from('document_types')
    .select('id, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const docTypeIdByName: Record<string, string> = {}
  for (const dt of allDocTypes ?? []) {
    docTypeIdByName[(dt as { id: string; name: string }).name] = (
      dt as { id: string; name: string }
    ).id
  }

  // ── 2. Default vendor categories ─────────────────────────────────────────────
  const { data: existingCats } = await supabase
    .from('vendor_categories')
    .select('name')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const existingCatNames = new Set(
    (existingCats ?? []).map((c: { name: string }) => c.name.toLowerCase()),
  )
  const catsToInsert = DEFAULT_CATEGORIES.filter(
    (n) => !existingCatNames.has(n.toLowerCase()),
  ).map((name) => ({ org_id: orgId, name }))

  if (catsToInsert.length > 0) {
    const { error } = await supabase.from('vendor_categories').insert(catsToInsert)
    if (error) throw new Error(error.message)
  }

  // Re-fetch all categories for name→id map
  const { data: allCats } = await supabase
    .from('vendor_categories')
    .select('id, name')
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const catIdByName: Record<string, string> = {}
  for (const c of allCats ?? []) {
    catIdByName[(c as { id: string; name: string }).name] = (
      c as { id: string; name: string }
    ).id
  }

  // ── 3. category_document_templates links ─────────────────────────────────────
  const reqDocRows: {
    category_id: string
    doc_type_id: string
    is_required: boolean
  }[] = []

  for (const [catName, docMap] of Object.entries(CATEGORY_DOC_MAP)) {
    const categoryId = catIdByName[catName]
    if (!categoryId) continue
    for (const [docName, isRequired] of Object.entries(docMap)) {
      const docTypeId = docTypeIdByName[docName]
      if (!docTypeId) continue
      reqDocRows.push({ category_id: categoryId, doc_type_id: docTypeId, is_required: isRequired })
    }
  }

  if (reqDocRows.length > 0) {
    // UNIQUE constraint: (category_id, doc_type_id) — use ignoreDuplicates
    const { error } = await supabase
      .from('category_document_templates')
      .upsert(reqDocRows, { onConflict: 'category_id,doc_type_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
}

// ─── Framework selections ──────────────────────────────────────────────────────

export interface OrgFrameworkSelection {
  framework_id: string
  framework: AssessmentFramework
}

/**
 * Returns all compliance standard selections for an org, with framework details joined.
 */
export async function getOrgFrameworkSelections(
  orgId: string,
): Promise<OrgFrameworkSelection[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('org_framework_selections')
    .select('framework_id')
    .eq('org_id', orgId)

  if (error) throw new Error(error.message)

  const selections = (data ?? []) as { framework_id: string }[]
  if (selections.length === 0) return []

  const frameworkIds = selections.map((s) => s.framework_id)
  const { data: frameworks, error: fwErr } = await supabase
    .from('assessment_frameworks')
    .select('*')
    .in('id', frameworkIds)
    .is('deleted_at', null)
  if (fwErr) throw new Error(fwErr.message)

  const frameworkById = new Map(
    ((frameworks ?? []) as AssessmentFramework[]).map((f) => [f.id, f]),
  )

  return selections
    .filter((s) => frameworkById.has(s.framework_id))
    .map((s) => ({
      framework_id: s.framework_id,
      framework: frameworkById.get(s.framework_id)!,
    }))
}

/**
 * Replaces the org's compliance standard selections atomically.
 */
export async function saveOrgFrameworkSelections(
  orgId: string,
  frameworkIds: string[],
): Promise<void> {
  const supabase = await createServerClient()

  const { error: delErr } = await supabase
    .from('org_framework_selections')
    .delete()
    .eq('org_id', orgId)
  if (delErr) throw new Error(delErr.message)

  if (frameworkIds.length === 0) return

  const rows = frameworkIds.map((frameworkId) => ({
    org_id: orgId,
    framework_id: frameworkId,
    is_primary: false,
  }))

  const { error: insErr } = await supabase.from('org_framework_selections').insert(rows)
  if (insErr) throw new Error(insErr.message)
}
