-- ============================================================
-- Migration 023: Review types (onboarding / scheduled / on_demand)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE review_type AS ENUM ('onboarding', 'scheduled', 'on_demand');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_review_packs
  ADD COLUMN IF NOT EXISTS review_type review_type NOT NULL DEFAULT 'onboarding';

-- Backfill: any existing packs without explicit type get 'onboarding'
-- (the default handles this automatically)

-- ============================================================
-- End of migration 023
-- ============================================================
