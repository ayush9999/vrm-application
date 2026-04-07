-- ============================================================
-- VRM Seed Data Reset
-- Run this ONCE in Supabase SQL editor, then run: npx tsx db/seed.ts
-- ============================================================

-- 1. Add missing columns that the seed depends on
ALTER TABLE vendor_categories     ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE assessment_frameworks ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE document_types        ADD COLUMN IF NOT EXISTS code text;

CREATE UNIQUE INDEX IF NOT EXISTS uix_vendor_categories_code     ON vendor_categories(code);
CREATE UNIQUE INDEX IF NOT EXISTS uix_assessment_frameworks_code ON assessment_frameworks(code);
CREATE UNIQUE INDEX IF NOT EXISTS uix_document_types_code        ON document_types(code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uix_framework_items_code') THEN
    ALTER TABLE assessment_framework_items ADD CONSTRAINT uix_framework_items_code UNIQUE (code);
  END IF;
END $$;

-- 2. Wipe category suggestions (no user data here)
DELETE FROM category_framework_suggestions WHERE org_id IS NULL;

-- 3. Wipe assessment_items referencing global framework items
DELETE FROM assessment_items
WHERE framework_item_id IN (
  SELECT id FROM assessment_framework_items WHERE org_id IS NULL
);

-- 4. Wipe global framework items
DELETE FROM assessment_framework_items WHERE org_id IS NULL;

-- 5. Wipe global frameworks (standards + VRFs) — clear FK refs first
DELETE FROM assessment_framework_selections
WHERE framework_id IN (SELECT id FROM assessment_frameworks WHERE org_id IS NULL);

DELETE FROM org_framework_selections
WHERE framework_id IN (SELECT id FROM assessment_frameworks WHERE org_id IS NULL);

DELETE FROM assessment_frameworks WHERE org_id IS NULL;

-- 6. Wipe universal controls
DELETE FROM universal_controls;

-- NOTE: vendor_categories and document_types are NOT deleted
-- (vendor_documents and vendors reference them).
-- The seed will upsert them by code — new rows added, existing rows updated.

-- Done — run: npx tsx db/seed.ts
