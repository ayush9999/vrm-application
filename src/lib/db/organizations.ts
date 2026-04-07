import { createServerClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/db/activity-log'
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
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('org_id', orgId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgUser[]
}

// ─── Core helpers ──────────────────────────────────────────────────────────────

export async function createOrganization(name: string) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string; created_at: string }
}

export async function createDevUser(orgId: string, name: string, email: string) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('users')
    .insert({ org_id: orgId, name, email })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function createOrgMembership(
  orgId: string,
  userId: string,
  role: 'site_admin' | 'vendor_admin',
) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('org_memberships')
    .insert({ org_id: orgId, user_id: userId, role })
  if (error) throw new Error(error.message)
}

/**
 * Idempotently seeds:
 *  1. Standard document types for the org
 *  2. Default vendor categories
 *  3. category_required_documents links
 */
export async function initOrgDefaults(orgId: string): Promise<void> {
  const supabase = createServerClient()

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
  const supabase = createServerClient()

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
  const supabase = createServerClient()

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

/** Full setup: org + user + membership + defaults. Returns { orgId, userId }. */
export async function setupOrganization(
  orgName: string,
  adminName: string,
  adminEmail: string,
): Promise<{ orgId: string; userId: string }> {
  const org = await createOrganization(orgName)
  const user = await createDevUser(org.id, adminName, adminEmail)
  await createOrgMembership(org.id, user.id, 'site_admin')
  await initOrgDefaults(org.id)

  await logActivity({
    orgId: org.id,
    actorUserId: user.id,
    entityType: 'organization',
    entityId: org.id,
    action: 'created',
    title: `Organisation "${org.name}" created`,
  })

  return { orgId: org.id, userId: user.id }
}
