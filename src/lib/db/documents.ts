import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import type {
  VendorDocument,
  VendorDocumentVersion,
  SuggestedDocument,
  CustomDocument,
  DocumentHistoryEntry,
  VendorDocumentsData,
  AssessmentDocRequest,
  DocStatus,
} from '@/types/document'

// ─── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'vendor-documents'

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (used as file_key in vendor_document_versions).
 * Path format: {orgId}/{vendorId}/{uuid}.{ext}
 *
 * Requires a Supabase Storage bucket named 'vendor-documents'.
 */
export async function uploadDocumentFile(
  orgId: string,
  vendorId: string,
  file: File,
): Promise<string> {
  const supabase = await createServerClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${orgId}/${vendorId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return path
}

/**
 * Generate a signed URL for a stored document (valid for 1 hour).
 * Only works for real storage paths (not placeholder: keys).
 */
export async function getDocumentSignedUrl(fileKey: string): Promise<string> {
  if (fileKey.startsWith('placeholder:')) {
    throw new Error('This document was recorded by filename only — no file is stored. Re-upload to enable download.')
  }
  const supabase = await createServerClient()
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(fileKey, 3600)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not generate download link')
  return data.signedUrl
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteDocumentFile(fileKey: string): Promise<void> {
  if (fileKey.startsWith('placeholder:')) return
  const supabase = await createServerClient()
  await supabase.storage.from(STORAGE_BUCKET).remove([fileKey])
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeStatus(
  doc: VendorDocument | null,
  version: VendorDocumentVersion | null,
): DocStatus {
  if (!doc || !version) return 'missing'
  // A placeholder with no file_name = truly pending (user hasn't selected a file yet)
  if (version.file_key.startsWith('placeholder:') && !version.file_name) return 'pending'
  if (doc.expiry_date && new Date(doc.expiry_date) < new Date()) return 'expired'
  return 'uploaded'
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns all suggested (category-required) docs, custom docs, and version history
 * for a vendor. Called in the vendor detail server component.
 */
export async function getVendorDocumentsData(
  orgId: string,
  vendorId: string,
  categoryId: string | null,
): Promise<VendorDocumentsData> {
  // ── 1. Get required docs for category ──────────────────────────────────────
  type RequiredDocRow = {
    id: string
    is_required: boolean
    doc_type_id: string
    doc_type_name: string
  }

  let requiredDocs: RequiredDocRow[] = []
  if (categoryId) {
    requiredDocs = await sql<RequiredDocRow[]>`
      SELECT cdt.id, cdt.is_required, cdt.doc_type_id, dt.name AS doc_type_name
      FROM category_document_templates cdt
      LEFT JOIN document_types dt ON dt.id = cdt.doc_type_id
      WHERE cdt.category_id = ${categoryId}
        AND cdt.deleted_at IS NULL
    `
  }

  // ── 2. Get all vendor_documents for this vendor ─────────────────────────────
  const vendorDocList = await sql<VendorDocument[]>`
    SELECT *
    FROM vendor_documents
    WHERE org_id = ${orgId}
      AND vendor_id = ${vendorId}
      AND deleted_at IS NULL
  `
  const vendorDocByDocTypeId = new Map(vendorDocList.map((d) => [d.doc_type_id, d]))

  // ── 3. Fetch current versions for all vendor_docs that have them ────────────
  const versionIds = vendorDocList
    .map((d) => d.current_version_id)
    .filter((id): id is string => id !== null)

  const versionMap = new Map<string, VendorDocumentVersion>()
  if (versionIds.length > 0) {
    const versions = await sql<VendorDocumentVersion[]>`
      SELECT *
      FROM vendor_document_versions
      WHERE id = ANY(${versionIds})
        AND deleted_at IS NULL
    `
    for (const v of versions) {
      versionMap.set(v.id, v)
    }
  }

  // ── 4. Fetch document_types for custom docs ─────────────────────────────────
  const categoryDocTypeIds = new Set(requiredDocs.map((r) => r.doc_type_id))
  const frameworkDocTypeIds = new Set<string>()
  const checkedDocTypeIds = new Set([...categoryDocTypeIds, ...frameworkDocTypeIds])
  const customVendorDocs = vendorDocList.filter(
    (d) => !checkedDocTypeIds.has(d.doc_type_id),
  )
  const customDocTypeIds = customVendorDocs.map((d) => d.doc_type_id)

  const customDocTypeMap = new Map<string, { name: string; description: string | null }>()
  if (customDocTypeIds.length > 0) {
    const dtRows = await sql<{ id: string; name: string; description: string | null }[]>`
      SELECT id, name, description
      FROM document_types
      WHERE id = ANY(${customDocTypeIds})
    `
    for (const row of dtRows) {
      customDocTypeMap.set(row.id, { name: row.name, description: row.description })
    }
  }

  // ── 5. Build suggested docs list ────────────────────────────────────────────
  const suggested: SuggestedDocument[] = requiredDocs.map((req) => {
    const vendorDoc = vendorDocByDocTypeId.get(req.doc_type_id) ?? null
    const version =
      vendorDoc?.current_version_id ? (versionMap.get(vendorDoc.current_version_id) ?? null) : null
    return {
      required_doc_id: req.id,
      is_required: req.is_required,
      doc_type_id: req.doc_type_id,
      doc_type_name: req.doc_type_name ?? '',
      vendor_doc_id: vendorDoc?.id ?? null,
      current_version_id: vendorDoc?.current_version_id ?? null,
      expiry_date: vendorDoc?.expiry_date ?? null,
      last_verified_at: vendorDoc?.last_verified_at ?? null,
      verification_notes: vendorDoc?.verification_notes ?? null,
      current_file_name: version?.file_name ?? null,
      current_file_key: version?.file_key ?? null,
      status: computeStatus(vendorDoc, version),
    }
  })

  // ── 6. Build custom docs list ────────────────────────────────────────────────
  const custom: CustomDocument[] = customVendorDocs.map((vd) => {
    const version =
      vd.current_version_id ? (versionMap.get(vd.current_version_id) ?? null) : null
    return {
      vendor_doc_id: vd.id,
      doc_type_id: vd.doc_type_id,
      doc_type_name: customDocTypeMap.get(vd.doc_type_id)?.name ?? 'Unknown',
      category: customDocTypeMap.get(vd.doc_type_id)?.description ?? null,
      current_version_id: vd.current_version_id,
      expiry_date: vd.expiry_date,
      last_verified_at: vd.last_verified_at,
      current_file_name: version?.file_name ?? null,
      current_file_key: version?.file_key ?? null,
      status: computeStatus(vd, version),
    }
  })

  // ── 7. Build version history ─────────────────────────────────────────────────
  const vendorDocIds = vendorDocList.map((d) => d.id)
  let history: DocumentHistoryEntry[] = []

  if (vendorDocIds.length > 0) {
    // Get doc_type names for vendor docs
    const vendorDocDocTypeIds = [...new Set(vendorDocList.map((d) => d.doc_type_id))]

    // Run both queries in parallel
    const [dtHistRows, allVersions] = await Promise.all([
      sql<{ id: string; name: string }[]>`
        SELECT id, name
        FROM document_types
        WHERE id = ANY(${vendorDocDocTypeIds})
      `,
      sql<{
        id: string
        vendor_document_id: string
        file_key: string
        file_name: string | null
        uploaded_at: string
        ai_status: string
      }[]>`
        SELECT id, vendor_document_id, file_key, file_name, uploaded_at, ai_status
        FROM vendor_document_versions
        WHERE vendor_document_id = ANY(${vendorDocIds})
          AND deleted_at IS NULL
        ORDER BY uploaded_at DESC
      `,
    ])

    const docTypeNameById = new Map(dtHistRows.map((dt) => [dt.id, dt.name]))
    const vendorDocDocTypeMap = new Map(vendorDocList.map((d) => [d.id, d.doc_type_id]))

    history = allVersions.map((v) => {
      const docTypeId = vendorDocDocTypeMap.get(v.vendor_document_id) ?? ''
      return {
        version_id: v.id,
        vendor_document_id: v.vendor_document_id,
        doc_type_name: docTypeNameById.get(docTypeId) ?? 'Unknown',
        file_key: v.file_key,
        file_name: v.file_name,
        uploaded_at: v.uploaded_at,
        ai_status: v.ai_status as import('@/types/document').AiProcessingStatus,
      }
    })
  }

  return { suggested, custom, history }
}

// ─── Assessment cross-reference ────────────────────────────────────────────────

export interface VendorDocStatus {
  status: DocStatus
  file_name: string | null
  expiry_date: string | null
  vendor_doc_id: string
  doc_type_name: string
}

/**
 * Returns a Map of doc_type_id → VendorDocStatus for a vendor.
 * Used in the assessment items step to show whether each requested document
 * has already been uploaded in the vendor module.
 */
export async function getVendorDocStatusMap(
  orgId: string,
  vendorId: string,
): Promise<Map<string, VendorDocStatus>> {
  const supabase = await createServerClient()

  // 1. Fetch all vendor_documents for this vendor
  const { data: docs, error: docsErr } = await supabase
    .from('vendor_documents')
    .select('id, doc_type_id, expiry_date, current_version_id')
    .eq('org_id', orgId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)

  if (docsErr) throw new Error(docsErr.message)
  const docList = (docs ?? []) as {
    id: string
    doc_type_id: string
    expiry_date: string | null
    current_version_id: string | null
  }[]

  if (docList.length === 0) return new Map()

  // 2. Fetch doc type names
  const docTypeIds = [...new Set(docList.map(d => d.doc_type_id))]
  const { data: dtRows } = await supabase
    .from('document_types')
    .select('id, name')
    .in('id', docTypeIds)
  const docTypeNameById = new Map(
    ((dtRows ?? []) as { id: string; name: string }[]).map(d => [d.id, d.name])
  )

  // 3. Fetch current versions
  const versionIds = docList.map(d => d.current_version_id).filter((id): id is string => id !== null)
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

  // 4. Build result map
  const result = new Map<string, VendorDocStatus>()
  for (const doc of docList) {
    const version = doc.current_version_id ? versionMap.get(doc.current_version_id) ?? null : null
    let status: DocStatus = 'missing'
    if (version) {
      if (version.file_key.startsWith('placeholder:') && !version.file_name) {
        status = 'pending'
      } else if (doc.expiry_date && new Date(doc.expiry_date) < new Date()) {
        status = 'expired'
      } else {
        status = 'uploaded'
      }
    }
    result.set(doc.doc_type_id, {
      status,
      file_name: version?.file_name ?? null,
      expiry_date: doc.expiry_date,
      vendor_doc_id: doc.id,
      doc_type_name: docTypeNameById.get(doc.doc_type_id) ?? '',
    })
  }
  return result
}

/**
 * Returns document types requested by active assessments for this vendor,
 * cross-referenced with vendor_documents upload status.
 * Used in the vendor Documents tab to surface assessment-requested docs.
 */
export async function getAssessmentDocRequestsForVendor(
  _orgId: string,
  _vendorId: string,
): Promise<AssessmentDocRequest[]> {
  // vendor_assessments table removed — return empty until Reviews replaces this
  return []
}

/** Fetch document types for the org (for custom doc creation) */
export async function getOrgDocumentTypes(orgId: string) {
  const supabase = await createServerClient()
  // Include both org-specific (custom) and global (standard, org_id IS NULL) document types
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string }[]
}

/**
 * Get document types relevant to a specific vendor — based on vendor's category.
 * Returns category-suggested doc types + any org-custom doc types.
 */
export async function getVendorDocumentTypes(orgId: string, vendorId: string) {
  const supabase = await createServerClient()

  // Get vendor's category_ids (multi-select)
  const { data: vendor } = await supabase
    .from('vendors')
    .select('category_ids')
    .eq('id', vendorId)
    .eq('org_id', orgId)
    .single()

  const categoryIds = ((vendor?.category_ids ?? []) as string[])

  // Get doc types from category_document_templates for ANY of the vendor's categories
  let categoryDocTypes: { id: string; name: string }[] = []
  if (categoryIds.length > 0) {
    const { data } = await supabase
      .from('category_document_templates')
      .select('doc_type_id, document_types(id, name)')
      .in('category_id', categoryIds)
      .is('deleted_at', null)
    const seen = new Set<string>()
    categoryDocTypes = []
    for (const r of (data ?? []) as { document_types: { id: string; name: string } | { id: string; name: string }[] | null }[]) {
      const dt = Array.isArray(r.document_types) ? r.document_types[0] : r.document_types
      if (dt && !seen.has(dt.id)) {
        seen.add(dt.id)
        categoryDocTypes.push(dt)
      }
    }
  }

  // If no category templates exist, fall back to all standard doc types
  if (categoryDocTypes.length === 0) {
    const { data: allStandard } = await supabase
      .from('document_types')
      .select('id, name')
      .is('org_id', null)
      .is('deleted_at', null)
      .order('name')
    categoryDocTypes = (allStandard ?? []) as { id: string; name: string }[]
  }

  // Also include any org-custom doc types (user-created)
  const { data: customTypes } = await supabase
    .from('document_types')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('source_type', 'custom')
    .is('deleted_at', null)
    .order('name')

  // Merge and deduplicate
  const seen = new Set<string>()
  const result: { id: string; name: string }[] = []
  for (const dt of [...categoryDocTypes, ...(customTypes ?? [])]) {
    if (!seen.has(dt.id)) {
      seen.add(dt.id)
      result.push(dt)
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

/** Get or create a custom document type for the org (prevents duplicate key errors on re-add) */
export async function createDocumentType(orgId: string, name: string, category?: string | null) {
  const supabase = await createServerClient()

  // Return existing active doc type if the name is already taken
  const { data: existing } = await supabase
    .from('document_types')
    .select('id, name')
    .eq('org_id', orgId)
    .ilike('name', name)
    .is('deleted_at', null)
    .maybeSingle()
  if (existing) return existing as { id: string; name: string }

  const { data, error } = await supabase
    .from('document_types')
    .insert({ org_id: orgId, name, source_type: 'custom', description: category ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string }
}

/**
 * Upsert a vendor_documents row and create a placeholder version.
 * Returns the vendor_documents row id.
 */
export async function createPlaceholderDocumentVersion(
  orgId: string,
  vendorId: string,
  docTypeId: string,
  fileName: string | null,
  expiryDate: string | null,
  userId: string | null,
  /** If provided, used as the file_key directly (real storage path). Otherwise a placeholder is generated. */
  fileKey?: string,
): Promise<string> {
  const supabase = await createServerClient()

  // Upsert vendor_documents (slot row)
  const { data: docRow, error: docErr } = await supabase
    .from('vendor_documents')
    .upsert(
      { org_id: orgId, vendor_id: vendorId, doc_type_id: docTypeId },
      { onConflict: 'vendor_id,doc_type_id' },
    )
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  const vendorDocId = (docRow as { id: string }).id

  // Use provided real file key, or generate a placeholder
  const resolvedFileKey = fileKey ?? `placeholder:${crypto.randomUUID()}`

  // Insert version
  const { data: versionRow, error: vErr } = await supabase
    .from('vendor_document_versions')
    .insert({
      org_id: orgId,
      vendor_document_id: vendorDocId,
      file_key: resolvedFileKey,
      file_name: fileName,
      uploaded_by_user_id: userId,
      ai_status: 'queued',
    })
    .select()
    .single()
  if (vErr) throw new Error(vErr.message)

  const versionId = (versionRow as { id: string }).id

  // Update expiry + current_version_id
  const { error: updErr } = await supabase
    .from('vendor_documents')
    .update({
      current_version_id: versionId,
      expiry_date: expiryDate || null,
    })
    .eq('id', vendorDocId)
  if (updErr) throw new Error(updErr.message)

  return vendorDocId
}

/**
 * Soft-deletes the current version of a vendor document and clears current_version_id.
 * Status will revert to 'missing'.
 */
export async function deleteDocumentVersion(
  orgId: string,
  vendorDocId: string,
  actorUserId: string | null,
): Promise<void> {
  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { data: docRow } = await supabase
    .from('vendor_documents')
    .select('current_version_id')
    .eq('id', vendorDocId)
    .eq('org_id', orgId)
    .single()

  const currentVersionId = (docRow as { current_version_id: string | null } | null)?.current_version_id

  if (currentVersionId) {
    await supabase
      .from('vendor_document_versions')
      .update({ deleted_at: now, deleted_by_user_id: actorUserId })
      .eq('id', currentVersionId)
      .eq('org_id', orgId)
  }

  const { error } = await supabase
    .from('vendor_documents')
    .update({ current_version_id: null })
    .eq('id', vendorDocId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}

/**
 * Soft-deletes a custom vendor_documents row (and its current version).
 * The document disappears entirely from the custom docs list.
 */
export async function deleteVendorDocument(
  orgId: string,
  vendorDocId: string,
  actorUserId: string | null,
): Promise<void> {
  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { data: docRow } = await supabase
    .from('vendor_documents')
    .select('current_version_id')
    .eq('id', vendorDocId)
    .eq('org_id', orgId)
    .single()

  const currentVersionId = (docRow as { current_version_id: string | null } | null)?.current_version_id

  if (currentVersionId) {
    await supabase
      .from('vendor_document_versions')
      .update({ deleted_at: now, deleted_by_user_id: actorUserId })
      .eq('id', currentVersionId)
      .eq('org_id', orgId)
  }

  const { error } = await supabase
    .from('vendor_documents')
    .update({ deleted_at: now, deleted_by_user_id: actorUserId })
    .eq('id', vendorDocId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}

/** Update metadata on an existing vendor_documents row */
export async function updateVendorDocumentMeta(
  orgId: string,
  vendorDocId: string,
  fields: { expiry_date?: string | null; verification_notes?: string | null; last_verified_at?: string | null },
) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_documents')
    .update(fields)
    .eq('id', vendorDocId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}
