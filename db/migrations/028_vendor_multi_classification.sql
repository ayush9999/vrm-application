-- ─────────────────────────────────────────────────────────────────────────────
-- 028_vendor_multi_classification.sql
--
-- Replace single-value classification fields on `vendors` with arrays so that
-- a vendor can belong to multiple categories / service types / data access
-- levels simultaneously (e.g. a SaaS vendor that is ALSO a contractor).
--
-- Destructive: drops the old single-value columns. Any existing values are
-- not migrated — the UI will show the defaults until an editor re-selects.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old single-value columns
ALTER TABLE vendors DROP COLUMN IF EXISTS service_type;
ALTER TABLE vendors DROP COLUMN IF EXISTS data_access_level;
ALTER TABLE vendors DROP COLUMN IF EXISTS category_id;

-- Add the new array columns
ALTER TABLE vendors
  ADD COLUMN service_types        vendor_service_type[]       NOT NULL DEFAULT ARRAY['other']::vendor_service_type[],
  ADD COLUMN data_access_levels   vendor_data_access_level[]  NOT NULL DEFAULT ARRAY['none']::vendor_data_access_level[],
  ADD COLUMN category_ids         uuid[]                      NOT NULL DEFAULT ARRAY[]::uuid[];

-- GIN indexes for overlap-style lookups (matchReviewPacks does ANY/overlap queries)
CREATE INDEX IF NOT EXISTS idx_vendors_service_types       ON vendors USING GIN (service_types);
CREATE INDEX IF NOT EXISTS idx_vendors_data_access_levels  ON vendors USING GIN (data_access_levels);
CREATE INDEX IF NOT EXISTS idx_vendors_category_ids        ON vendors USING GIN (category_ids);
