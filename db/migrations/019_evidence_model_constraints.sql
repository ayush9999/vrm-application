-- ============================================================
-- Migration 019: Evidence model constraints
-- ============================================================
--
-- The new evidence model uses evidence_requirement_id as the primary
-- linker between vendor_documents rows and the requirements they fulfill.
-- The legacy doc_type_id column becomes optional, and uniqueness is
-- enforced on (vendor_id, evidence_requirement_id) instead.
-- ============================================================

-- Make doc_type_id nullable
ALTER TABLE vendor_documents ALTER COLUMN doc_type_id DROP NOT NULL;

-- Drop the old uniqueness constraint that prevented multiple requirements
-- from sharing a single doc_type
ALTER TABLE vendor_documents DROP CONSTRAINT IF EXISTS ux_vendor_documents_vendor_doctype;

-- New unique index on (vendor_id, evidence_requirement_id) — only enforced
-- when evidence_requirement_id is set (so legacy/manual rows still work)
CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_documents_vendor_evidence_req
  ON vendor_documents (vendor_id, evidence_requirement_id)
  WHERE evidence_requirement_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- End of migration 019
-- ============================================================
