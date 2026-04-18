-- ============================================================
-- Migration 026: Vendor Reviews — parent entity
--
-- Introduces a `vendor_reviews` table that groups multiple
-- review packs into a single review engagement (REV-001, etc.)
-- The lifecycle (submit/approve) moves to this parent level.
-- ============================================================

-- ─── 1. Create review status enum ─────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE vendor_review_status AS ENUM (
    'not_started', 'in_progress', 'submitted', 'approved',
    'approved_with_exception', 'done', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Create vendor_reviews table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id           uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  review_code         text        NOT NULL,
  review_type         review_type NOT NULL DEFAULT 'onboarding',
  status              vendor_review_status NOT NULL DEFAULT 'not_started',
  reviewer_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  approver_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  due_at              timestamptz,
  started_at          timestamptz,
  submitted_at        timestamptz,
  completed_at        timestamptz,
  locked_at           timestamptz,
  locked_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  reopen_reason       text,
  reopened_at         timestamptz,
  reopened_by_user_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- ─── 3. Add vendor_review_id + is_excluded to vendor_review_packs ──────────

ALTER TABLE vendor_review_packs
  ADD COLUMN IF NOT EXISTS vendor_review_id uuid REFERENCES vendor_reviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_vendor_review_packs_review
  ON vendor_review_packs(vendor_review_id) WHERE deleted_at IS NULL;

-- Drop old unique constraint — a pack can now appear in multiple reviews for the same vendor
ALTER TABLE vendor_review_packs DROP CONSTRAINT IF EXISTS ux_vendor_review_packs_vendor_pack;

-- ─── 4. Add vendor_review_id to review_approvals ──────────────────────────

ALTER TABLE review_approvals
  ADD COLUMN IF NOT EXISTS vendor_review_id uuid REFERENCES vendor_reviews(id) ON DELETE CASCADE;

-- ─── 5. Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ix_vendor_reviews_vendor ON vendor_reviews(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vendor_reviews_org ON vendor_reviews(org_id) WHERE deleted_at IS NULL;

-- ─── 6. RLS ───────────────────────────────────────────────────────────────

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vr_tenant ON vendor_reviews;
CREATE POLICY vr_tenant ON vendor_reviews FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- ─── 7. Trigger ───────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_vendor_reviews_updated_at ON vendor_reviews;
CREATE TRIGGER trg_vendor_reviews_updated_at
  BEFORE UPDATE ON vendor_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 8. Grants ────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ─── 9. Backfill: one review per vendor grouping all existing packs ───────

DO $$
DECLARE
  v RECORD;
  new_review_id uuid;
  rev_num int := 0;
BEGIN
  FOR v IN
    SELECT DISTINCT org_id, vendor_id
    FROM vendor_review_packs
    WHERE deleted_at IS NULL
      AND vendor_review_id IS NULL
  LOOP
    rev_num := rev_num + 1;
    new_review_id := gen_random_uuid();

    INSERT INTO vendor_reviews (
      id, org_id, vendor_id, review_code, review_type, status, created_at
    ) VALUES (
      new_review_id,
      v.org_id,
      v.vendor_id,
      'REV-' || LPAD(rev_num::text, 3, '0'),
      'onboarding',
      'not_started',
      now()
    );

    UPDATE vendor_review_packs
    SET vendor_review_id = new_review_id
    WHERE org_id = v.org_id
      AND vendor_id = v.vendor_id
      AND deleted_at IS NULL
      AND vendor_review_id IS NULL;
  END LOOP;
END $$;

-- Backfill review_approvals
UPDATE review_approvals ra
SET vendor_review_id = vrp.vendor_review_id
FROM vendor_review_packs vrp
WHERE vrp.id = ra.vendor_review_pack_id
  AND ra.vendor_review_id IS NULL;
