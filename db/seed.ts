  /**
   * VRM Master Seed Script
   *
   * Imports the Global VRM Master Library from:
   *   vrm_library/global_vrm_master_library_v1.json
   *
   * Usage:  npx tsx db/seed.ts
   * Needs:  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
   *
   * Safe to re-run: all operations are idempotent (upsert / update-in-place).
   * Existing assessment_items FK references are preserved — items are updated
   * in-place by code key, never deleted and re-inserted.
   *
   * Import order:
   *   1. compliance_frameworks  → assessment_frameworks (kind=compliance_standard)
   *   2. vendor_risk_frameworks → assessment_frameworks (kind=vendor_risk_framework)
   *   3. evidence_types         → document_types
   *   4. vendor_categories      → vendor_categories (global, org_id=null)
   *   5. controls + framework_controls → assessment_framework_items
   *      (one row per framework×control pair, mapped_standard_refs populated inline)
   *   6. category_framework_suggestions → category_framework_suggestions
   */

  import { createClient } from '@supabase/supabase-js'
  import { readFileSync } from 'fs'
  import { resolve } from 'path'

  // ─── Load .env.local ───────────────────────────────────────────────────────────

  function loadEnvLocal() {
    try {
      const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (key && !(key in process.env)) process.env[key] = val
      }
    } catch { /* rely on existing env vars */ }
  }
  loadEnvLocal()

  // ─── Supabase client ───────────────────────────────────────────────────────────

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // ─── Load library JSON ─────────────────────────────────────────────────────────

  const LIBRARY_PATH = resolve(process.cwd(), 'vrm_library/global_vrm_master_library_v1.json')

  interface ComplianceFramework {
    key: string; name: string; category: string; subcategory: string
    jurisdiction: string | null; industry: string | null; status: string; description: string
  }
  interface VendorCategory {
    key: string; name: string; group: string; subcategory: string; status: string; description: string
  }
  interface VendorRiskFramework {
    key: string; name: string; purpose: string; status: string; primary_domain_keys: string[]
  }
  interface ControlDomain {
    key: string; name: string; description: string; status: string
  }
  interface Control {
    key: string; name: string; domain_key: string; description: string
    evidence_type_keys: string[]; control_type: string; criticality: string; status: string; tags: string[]
  }
  interface EvidenceType {
    key: string; name: string; category: string; description: string; status: string
  }
  interface FrameworkControl {
    framework_key: string; control_key: string; required: boolean; display_order: number; domain_key: string
  }
  interface ControlComplianceMapping {
    control_key: string; compliance_framework_key: string; mapping_strength: string; mapping_basis: string
    // Enriched fields present for ISO 27001, NIST SP 800-53, SOC 2, HIPAA, PCI DSS, GDPR
    reference?: string; reference_name?: string; reference_type?: string
    framework_version?: string; mapping_method?: string
  }
  interface CategoryFrameworkSuggestion {
    vendor_category_key: string; framework_key: string; priority: number
  }
  interface ControlEvidenceMapping {
    control_key: string; evidence_type_key: string; required: boolean
  }
  interface UniversalControl {
    key: string; name: string; domain_key: string; family_key: string
    family_name: string; description: string; status: string
  }
  interface ControlUniversalMapping {
    control_key: string; universal_control_key: string
    mapping_strength: string; mapping_basis: string
  }
  interface ComplianceFrameworkClause {
    key: string; compliance_framework_key: string; framework_name: string
    framework_version: string; reference: string; reference_name: string
    reference_type: string; status: string
  }
  interface UniversalControlClauseMapping {
    universal_control_key: string; clause_key: string
    compliance_framework_key: string; mapping_strength: string; mapping_method: string
  }
  interface UniversalControlFrameworkMapping {
    universal_control_key: string; compliance_framework_key: string
    mapping_strength: string; mapping_method: string
  }
  interface Library {
    manifest: { version: string; library_name: string; counts: Record<string, number> }
    compliance_frameworks: ComplianceFramework[]
    vendor_categories: VendorCategory[]
    vendor_risk_frameworks: VendorRiskFramework[]
    control_domains: ControlDomain[]
    controls: Control[]
    evidence_types: EvidenceType[]
    framework_controls: FrameworkControl[]
    control_compliance_mappings: ControlComplianceMapping[]
    category_framework_suggestions: CategoryFrameworkSuggestion[]
    control_evidence_mappings: ControlEvidenceMapping[]
    universal_controls: UniversalControl[]
    control_universal_mappings: ControlUniversalMapping[]
    compliance_framework_clauses: ComplianceFrameworkClause[]
    universal_control_clause_mappings: UniversalControlClauseMapping[]
    universal_control_framework_mappings: UniversalControlFrameworkMapping[]
  }

  const library: Library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf-8'))

  // ─── Helpers ───────────────────────────────────────────────────────────────────

  function chunks<T>(arr: T[], size: number): T[][] {
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
    return result
  }

  // Generic insert-or-update by a string key column.
  // Used instead of upsert() because Supabase onConflict requires a named
  // unique constraint — partial unique indexes are not reliably resolved by name.
  async function insertOrUpdateByCode<T extends object & { code: string }>(
    table: string,
    rows: T[],
    updateFields: (keyof T)[],
    chunkSize = 100,
  ): Promise<void> {
    // Fetch existing codes in one query
    const { data: existing, error: fetchErr } = await supabase
      .from(table)
      .select('id, code')
      .in('code', rows.map(r => r.code))
    if (fetchErr) throw new Error(`Fetch ${table}: ${fetchErr.message}`)

    const existingIdByCode = new Map<string, string>(
      (existing ?? []).map((r: { id: string; code: string }) => [r.code, r.id])
    )

    const toInsert = rows.filter(r => !existingIdByCode.has(r.code))
    const toUpdate = rows.filter(r => existingIdByCode.has(r.code))

    // Insert new rows in chunks
    for (const chunk of chunks(toInsert, chunkSize)) {
      const { error } = await supabase.from(table).insert(chunk)
      if (error) throw new Error(`Insert ${table}: ${error.message}`)
    }

    // Update existing rows in chunks
    for (const chunk of chunks(toUpdate, chunkSize)) {
      for (const row of chunk) {
        const id = existingIdByCode.get(row.code)!
        const patch: Partial<T> = {}
        for (const f of updateFields) patch[f] = row[f]
        const { error } = await supabase.from(table).update(patch).eq('id', id)
        if (error) throw new Error(`Update ${table} id=${id}: ${error.message}`)
      }
    }
  }

  // ─── Step 1: Compliance Frameworks ────────────────────────────────────────────

  // Upsert assessment_frameworks rows matching by code first, then name as fallback.
  // Handles rows seeded before the code column existed (code=NULL) and rows that were
  // seeded with a different code value than the canonical library key.
  async function upsertFrameworks(
    kind: string,
    rows: { org_id: null; name: string; description: string; code: string; kind: string; source_type: string }[],
  ): Promise<void> {
    // Deduplicate by code within the batch (library may have duplicate keys)
    const seen = new Set<string>()
    const unique = rows.filter(r => {
      if (seen.has(r.code)) return false
      seen.add(r.code)
      return true
    })

    for (const chunk of chunks(unique, 200)) {
      const { error } = await supabase
        .from('assessment_frameworks')
        .upsert(chunk, { onConflict: 'code', ignoreDuplicates: false })
      if (error) throw new Error(`Upsert assessment_frameworks (${kind}): ${error.message}`)
    }
  }

  async function seedComplianceFrameworks(): Promise<Map<string, string>> {
    console.log('\n📋 Seeding compliance frameworks...')

    const rows = library.compliance_frameworks.map(cf => ({
      org_id: null,
      name: cf.name,
      description: cf.description || cf.name,
      code: cf.key,
      kind: 'compliance_standard',
      source_type: 'standard',
    }))

    await upsertFrameworks('compliance_standard', rows)

    // Build key → id map
    const { data } = await supabase
      .from('assessment_frameworks')
      .select('id, code')
      .eq('kind', 'compliance_standard')
      .is('org_id', null)
      .is('deleted_at', null)

    const map = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; code: string }[]) {
      if (row.code) map.set(row.code, row.id)
    }

    console.log(`   ✓ ${map.size} compliance frameworks`)
    return map
  }

  // ─── Step 2: Vendor Risk Frameworks ───────────────────────────────────────────

  async function seedVendorRiskFrameworks(): Promise<Map<string, string>> {
    console.log('\n🔧 Seeding vendor risk frameworks...')

    const rows = library.vendor_risk_frameworks.map(vrf => ({
      org_id: null,
      name: vrf.name,
      description: vrf.purpose,
      code: vrf.key,
      kind: 'vendor_risk_framework',
      source_type: 'standard',
    }))

    await upsertFrameworks('vendor_risk_framework', rows)

    const { data } = await supabase
      .from('assessment_frameworks')
      .select('id, code')
      .eq('kind', 'vendor_risk_framework')
      .is('org_id', null)
      .is('deleted_at', null)

    const map = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; code: string }[]) {
      if (row.code) map.set(row.code, row.id)
    }

    console.log(`   ✓ ${map.size} vendor risk frameworks`)
    return map
  }

  // ─── Step 3: Evidence Types → Document Types ──────────────────────────────────

  async function seedEvidenceTypes(): Promise<Map<string, string>> {
    console.log('\n📄 Seeding evidence types → document types...')

    const rows = library.evidence_types.map(et => ({
      org_id: null,
      name: et.name,
      description: et.description,
      source_type: 'standard',
    }))

    // Insert-if-not-exists by name (document_types has a partial unique index on
    // lower(name) where source_type='standard', not a simple column constraint —
    // so onConflict by column name is not reliable; safe manual approach instead)
    const { data: existingDt } = await supabase
      .from('document_types')
      .select('name')
      .is('org_id', null)
      .is('deleted_at', null)
    const existingNames = new Set(
      (existingDt ?? []).map((r: { name: string }) => r.name.toLowerCase())
    )
    const toInsert = rows.filter(r => !existingNames.has(r.name.toLowerCase()))
    for (const chunk of chunks(toInsert, 200)) {
      const { error } = await supabase.from('document_types').insert(chunk)
      if (error) throw new Error(`Insert document_types: ${error.message}`)
    }

    // Build evidence_type key → document_type id map (by name matching)
    const { data: allDocTypes } = await supabase
      .from('document_types')
      .select('id, name')
      .is('org_id', null)
      .is('deleted_at', null)

    const nameToId = new Map<string, string>()
    for (const dt of (allDocTypes ?? []) as { id: string; name: string }[]) {
      nameToId.set(dt.name.toLowerCase(), dt.id)
    }

    // Map evidence_type key → doc_type id via name lookup
    const map = new Map<string, string>()
    for (const et of library.evidence_types) {
      const id = nameToId.get(et.name.toLowerCase())
      if (id) map.set(et.key, id)
    }

    console.log(`   ✓ ${map.size} evidence types mapped to document types`)
    return map
  }

  // ─── Step 4: Vendor Categories ────────────────────────────────────────────────

  async function seedVendorCategories(): Promise<Map<string, string>> {
    console.log('\n🏷  Seeding vendor categories...')

    const rows = library.vendor_categories.map(vc => ({
      org_id: null,
      name: vc.name,
      description: vc.description,
      code: vc.key,
      is_active: true,
    }))

    await insertOrUpdateByCode('vendor_categories', rows, ['name', 'description', 'is_active'])

    const { data } = await supabase
      .from('vendor_categories')
      .select('id, code')
      .is('org_id', null)
      .is('deleted_at', null)

    const map = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; code: string | null }[]) {
      if (row.code) map.set(row.code, row.id)
    }

    console.log(`   ✓ ${map.size} vendor categories`)
    return map
  }

  // ─── Step 5: Controls + Framework Controls → assessment_framework_items ───────

  async function seedFrameworkItems(
    vrfIdByKey: Map<string, string>,
    cfIdByKey: Map<string, string>,
    docTypeIdByEvidenceKey: Map<string, string>,
    ucIdByKey: Map<string, string>,
  ): Promise<void> {
    console.log('\n⚙️  Seeding framework controls (assessment_framework_items)...')

    // Build lookup maps
    const controlByKey = new Map<string, Control>()
    for (const c of library.controls) controlByKey.set(c.key, c)

    const domainByKey = new Map<string, ControlDomain>()
    for (const d of library.control_domains) domainByKey.set(d.key, d)

    // Build compliance mappings: control_key → [{standard_id, standard_name, ref, ref_name?}]
    // For the 6 enriched frameworks (ISO 27001, NIST SP 800-53, SOC 2, HIPAA, PCI DSS, GDPR),
    // m.reference holds the exact clause ref (e.g. "5.2", "CC1.1"). For all other frameworks
    // we fall back to compliance_framework_key as the ref.
    const complianceRefsByControlKey = new Map<
      string,
      { standard_id: string; standard_name: string; ref: string; ref_name?: string }[]
    >()
    for (const m of library.control_compliance_mappings) {
      const standardId = cfIdByKey.get(m.compliance_framework_key)
      if (!standardId) continue

      const cf = library.compliance_frameworks.find(f => f.key === m.compliance_framework_key)
      if (!cf) continue

      const existing = complianceRefsByControlKey.get(m.control_key) ?? []
      existing.push({
        standard_id: standardId,
        standard_name: cf.name,
        ref: m.reference ?? m.compliance_framework_key,
        ...(m.reference_name ? { ref_name: m.reference_name } : {}),
      })
      complianceRefsByControlKey.set(m.control_key, existing)
    }

    // Build evidence mappings: control_key → first required doc_type_id
    const primaryEvidenceByControlKey = new Map<string, string>()
    // Group by control_key, required first
    const evidenceByControl = new Map<string, ControlEvidenceMapping[]>()
    for (const em of library.control_evidence_mappings) {
      const arr = evidenceByControl.get(em.control_key) ?? []
      arr.push(em)
      evidenceByControl.set(em.control_key, arr)
    }
    for (const [controlKey, mappings] of evidenceByControl) {
      const required = mappings.filter(m => m.required)
      const candidates = required.length > 0 ? required : mappings
      for (const m of candidates) {
        const docTypeId = docTypeIdByEvidenceKey.get(m.evidence_type_key)
        if (docTypeId) {
          primaryEvidenceByControlKey.set(controlKey, docTypeId)
          break
        }
      }
    }

    // Build control_key → universal_control_id map
    const ucIdByControlKey = new Map<string, string>()
    for (const m of library.control_universal_mappings) {
      const ucId = ucIdByKey.get(m.universal_control_key)
      if (ucId) ucIdByControlKey.set(m.control_key, ucId)
    }

    // Build all rows in memory first
    type ItemRow = {
      code: string; framework_id: string; org_id: null
      title: string; description: string; category: string
      item_type: string; required: boolean; weight: number
      sort_order: number; expected_document_type_id: string | null
      mapped_standard_refs: unknown[] | null
      universal_control_id: string | null
    }
    const allRows: ItemRow[] = []
    for (const fc of library.framework_controls) {
      const frameworkId = vrfIdByKey.get(fc.framework_key)
      if (!frameworkId) continue
      const control = controlByKey.get(fc.control_key)
      if (!control) continue
      const domain = domainByKey.get(fc.domain_key ?? control.domain_key)
      const mappedRefs = complianceRefsByControlKey.get(fc.control_key) ?? null
      const expectedDocTypeId = primaryEvidenceByControlKey.get(fc.control_key) ?? null
      allRows.push({
        code: `${fc.framework_key}::${fc.control_key}`,
        framework_id: frameworkId,
        org_id: null,
        title: control.name,
        description: control.description,
        category: domain?.name ?? fc.domain_key,
        item_type: expectedDocTypeId ? 'document_check' : 'manual_check',
        required: fc.required,
        weight: control.criticality === 'critical' ? 2.0 : control.criticality === 'high' ? 1.5 : 1.0,
        sort_order: fc.display_order,
        expected_document_type_id: expectedDocTypeId,
        mapped_standard_refs: mappedRefs && mappedRefs.length > 0 ? mappedRefs : null,
        universal_control_id: ucIdByControlKey.get(fc.control_key) ?? null,
      })
    }

    // Deduplicate by code (library JSON may have duplicate framework_key::control_key pairs)
    const seenCodes = new Set<string>()
    const uniqueRows = allRows.filter(r => {
      if (seenCodes.has(r.code)) return false
      seenCodes.add(r.code)
      return true
    })
    const dupeCount = allRows.length - uniqueRows.length
    if (dupeCount > 0) console.log(`   ⚠️  ${dupeCount} duplicate codes in library JSON skipped`)

    // Upsert on code — inserts new rows, updates existing ones in-place.
    // This preserves IDs so existing FK references from assessment_items are not broken.
    let total = 0
    for (const chunk of chunks(uniqueRows, 200)) {
      const { error } = await supabase
        .from('assessment_framework_items')
        .upsert(chunk, { onConflict: 'code', ignoreDuplicates: false })
      if (error) throw new Error(`Upsert assessment_framework_items: ${error.message}`)
      total += chunk.length
      process.stdout.write(`\r   upserting... ${total}/${uniqueRows.length}`)
    }
    if (uniqueRows.length > 0) console.log()

    console.log(`   ✓ ${uniqueRows.length} framework items upserted`)
  }

  // ─── Step 6: Category Framework Suggestions ───────────────────────────────────

  async function seedCategoryFrameworkSuggestions(
    categoryIdByKey: Map<string, string>,
    vrfIdByKey: Map<string, string>,
  ): Promise<void> {
    console.log('\n🗂  Seeding category → framework suggestions...')

    const rows: { org_id: null; category_id: string; framework_id: string; display_order: number }[] = []

    for (const s of library.category_framework_suggestions) {
      const categoryId = categoryIdByKey.get(s.vendor_category_key)
      const frameworkId = vrfIdByKey.get(s.framework_key)
      if (!categoryId || !frameworkId) continue
      rows.push({ org_id: null, category_id: categoryId, framework_id: frameworkId, display_order: s.priority })
    }

    // Replace all global suggestions on every run — this is the authoritative source.
    // org-level suggestions (org_id IS NOT NULL) are user-created and left untouched.
    const { error: delError } = await supabase
      .from('category_framework_suggestions')
      .delete()
      .is('org_id', null)
    if (delError) throw new Error(`Delete category_framework_suggestions: ${delError.message}`)

    for (const chunk of chunks(rows, 200)) {
      const { error } = await supabase.from('category_framework_suggestions').insert(chunk)
      if (error) throw new Error(`Insert category_framework_suggestions: ${error.message}`)
    }

    console.log(`   ✓ ${rows.length} category → framework suggestions (replaced)`)
  }

  // ─── Step 7: Universal Controls ───────────────────────────────────────────────

  async function seedUniversalControls(): Promise<Map<string, string>> {
    console.log('\n🔗 Seeding universal controls...')

    const rows = library.universal_controls.map(uc => ({
      org_id: null,
      code: uc.key,
      name: uc.name,
      domain_key: uc.domain_key,
      family_key: uc.family_key,
      family_name: uc.family_name,
      description: uc.description,
      status: uc.status,
    }))

    await insertOrUpdateByCode('universal_controls', rows, ['name', 'domain_key', 'family_key', 'family_name', 'description', 'status'])

    const { data } = await supabase
      .from('universal_controls')
      .select('id, code')
      .is('org_id', null)
      .is('deleted_at', null)

    const map = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; code: string }[]) {
      if (row.code) map.set(row.code, row.id)
    }

    console.log(`   ✓ ${map.size} universal controls`)
    return map
  }

  // ─── Step 8: Compliance Framework Clauses ─────────────────────────────────────

  async function seedComplianceFrameworkClauses(
    cfIdByKey: Map<string, string>,
  ): Promise<Map<string, string>> {
    console.log('\n📌 Seeding compliance framework clauses...')

    const rows = library.compliance_framework_clauses
      .filter(c => cfIdByKey.has(c.compliance_framework_key))
      .map(c => ({
        code: c.key,
        framework_id: cfIdByKey.get(c.compliance_framework_key)!,
        reference: c.reference,
        reference_name: c.reference_name,
        reference_type: c.reference_type,
        status: c.status,
      }))

    await insertOrUpdateByCode('compliance_framework_clauses', rows, ['framework_id', 'reference', 'reference_name', 'reference_type', 'status'])

    const { data } = await supabase
      .from('compliance_framework_clauses')
      .select('id, code')
      .is('deleted_at', null)

    const map = new Map<string, string>()
    for (const row of (data ?? []) as { id: string; code: string }[]) {
      if (row.code) map.set(row.code, row.id)
    }

    console.log(`   ✓ ${map.size} compliance framework clauses`)
    return map
  }

  // ─── Step 9: Universal Control → Clause Mappings ──────────────────────────────

  async function seedUniversalControlClauseMappings(
    ucIdByKey: Map<string, string>,
    clauseIdByKey: Map<string, string>,
  ): Promise<void> {
    console.log('\n🔀 Seeding universal control → clause mappings...')

    // Fetch existing pairs to avoid duplicates (table has UNIQUE(universal_control_id, clause_id))
    const { data: existing } = await supabase
      .from('universal_control_clause_mappings')
      .select('universal_control_id, clause_id')

    const existingPairs = new Set(
      (existing ?? []).map((r: { universal_control_id: string; clause_id: string }) =>
        `${r.universal_control_id}::${r.clause_id}`
      )
    )

    const rows = []
    for (const m of library.universal_control_clause_mappings) {
      const ucId = ucIdByKey.get(m.universal_control_key)
      const clauseId = clauseIdByKey.get(m.clause_key)
      if (!ucId || !clauseId) continue
      if (existingPairs.has(`${ucId}::${clauseId}`)) continue
      rows.push({ universal_control_id: ucId, clause_id: clauseId, mapping_strength: m.mapping_strength, mapping_method: m.mapping_method })
    }

    for (const chunk of chunks(rows, 200)) {
      const { error } = await supabase.from('universal_control_clause_mappings').insert(chunk)
      if (error) throw new Error(`Insert universal_control_clause_mappings: ${error.message}`)
    }

    console.log(`   ✓ ${rows.length} new mappings inserted (${library.universal_control_clause_mappings.length} total in library)`)
  }

  // ─── Step 10: Universal Control → Framework Mappings (fallback) ───────────────

  async function seedUniversalControlFrameworkMappings(
    ucIdByKey: Map<string, string>,
    cfIdByKey: Map<string, string>,
  ): Promise<void> {
    console.log('\n🔀 Seeding universal control → framework mappings (fallback)...')

    const { data: existing } = await supabase
      .from('universal_control_framework_mappings')
      .select('universal_control_id, framework_id')

    const existingPairs = new Set(
      (existing ?? []).map((r: { universal_control_id: string; framework_id: string }) =>
        `${r.universal_control_id}::${r.framework_id}`
      )
    )

    const rows = []
    for (const m of library.universal_control_framework_mappings) {
      const ucId = ucIdByKey.get(m.universal_control_key)
      const fwId = cfIdByKey.get(m.compliance_framework_key)
      if (!ucId || !fwId) continue
      if (existingPairs.has(`${ucId}::${fwId}`)) continue
      rows.push({ universal_control_id: ucId, framework_id: fwId, mapping_strength: m.mapping_strength, mapping_method: m.mapping_method })
    }

    for (const chunk of chunks(rows, 200)) {
      const { error } = await supabase.from('universal_control_framework_mappings').insert(chunk)
      if (error) throw new Error(`Insert universal_control_framework_mappings: ${error.message}`)
    }

    console.log(`   ✓ ${rows.length} new mappings inserted (${library.universal_control_framework_mappings.length} total in library)`)
  }

  // ─── Main ──────────────────────────────────────────────────────────────────────

  async function main() {
    console.log('🌱 VRM Global Library Import')
    console.log(`   Library: ${library.manifest.library_name} v${library.manifest.version}`)
    console.log(`   Counts: ${JSON.stringify(library.manifest.counts)}`)
    console.log('───────────────────────────────────────────────────────────')

    try {
      const cfIdByKey    = await seedComplianceFrameworks()
      const vrfIdByKey   = await seedVendorRiskFrameworks()
      const etIdByKey    = await seedEvidenceTypes()
      const catIdByKey   = await seedVendorCategories()
      const ucIdByKey    = await seedUniversalControls()

      await seedFrameworkItems(vrfIdByKey, cfIdByKey, etIdByKey, ucIdByKey)
      await seedCategoryFrameworkSuggestions(catIdByKey, vrfIdByKey)

      const clauseIdByKey = await seedComplianceFrameworkClauses(cfIdByKey)
      await seedUniversalControlClauseMappings(ucIdByKey, clauseIdByKey)
      await seedUniversalControlFrameworkMappings(ucIdByKey, cfIdByKey)

      console.log('\n✅ Import complete!\n')
    } catch (err) {
      console.error('\n❌ Import failed:', err)
      process.exit(1)
    }
  }

  main()
