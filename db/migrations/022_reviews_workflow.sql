-- ============================================================
-- Migration 022: Reviews workflow — approvals, exceptions,
--   comments, cadence extensions, lock state
-- ============================================================

-- ─── 1. Extend cadence enum with quarterly ──────────────────────────────────

ALTER TYPE review_pack_cadence ADD VALUE IF NOT EXISTS 'quarterly';

-- ─── 2. Extend vendor_review_pack_status with upcoming + locked ─────────────

ALTER TYPE vendor_review_pack_status ADD VALUE IF NOT EXISTS 'upcoming';
ALTER TYPE vendor_review_pack_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE vendor_review_pack_status ADD VALUE IF NOT EXISTS 'sent_back';
ALTER TYPE vendor_review_pack_status ADD VALUE IF NOT EXISTS 'locked';

-- ─── 3. Add lock/prefill columns to vendor_review_packs ─────────────────────

ALTER TABLE vendor_review_packs
  ADD COLUMN IF NOT EXISTS locked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopen_reason    text,
  ADD COLUMN IF NOT EXISTS reopened_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prefilled_from_id uuid REFERENCES vendor_review_packs(id) ON DELETE SET NULL;

-- ─── 4. Review approvals table ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE review_approval_decision AS ENUM (
    'submitted', 'approved', 'approved_with_exception', 'sent_back'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS review_approvals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_review_pack_id   uuid NOT NULL REFERENCES vendor_review_packs(id) ON DELETE CASCADE,
  level                   int NOT NULL DEFAULT 1,  -- 1=reviewer submits, 2=approver decides, 3=senior sign-off
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision                review_approval_decision NOT NULL,
  comment                 text,
  decided_at              timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_review_approvals_pack ON review_approvals(vendor_review_pack_id);

-- ─── 5. Review exceptions table ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE review_exception_status AS ENUM (
    'active', 'expired', 'renewed', 'escalated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS review_exceptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id               uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_review_item_id   uuid NOT NULL REFERENCES vendor_review_items(id) ON DELETE CASCADE,
  vendor_review_pack_id   uuid NOT NULL REFERENCES vendor_review_packs(id) ON DELETE CASCADE,
  reason                  text NOT NULL,
  expiry_date             date NOT NULL,
  owner_user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requires_countersign    boolean NOT NULL DEFAULT true,
  countersigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  countersigned_at        timestamptz,
  status                  review_exception_status NOT NULL DEFAULT 'active',
  created_by_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_review_exceptions_vendor ON review_exceptions(vendor_id);
CREATE INDEX IF NOT EXISTS ix_review_exceptions_item ON review_exceptions(vendor_review_item_id);
CREATE INDEX IF NOT EXISTS ix_review_exceptions_status ON review_exceptions(status, expiry_date);

-- ─── 6. Review item comments (threaded) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_item_comments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_review_item_id   uuid NOT NULL REFERENCES vendor_review_items(id) ON DELETE CASCADE,
  parent_comment_id       uuid REFERENCES review_item_comments(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                    text NOT NULL,
  mentions                jsonb DEFAULT '[]',    -- [{user_id, name}]
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_review_item_comments_item ON review_item_comments(vendor_review_item_id);
CREATE INDEX IF NOT EXISTS ix_review_item_comments_parent ON review_item_comments(parent_comment_id);

-- ─── 7. Triggers ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_review_exceptions_updated_at ON review_exceptions;
CREATE TRIGGER trg_review_exceptions_updated_at
  BEFORE UPDATE ON review_exceptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_review_item_comments_updated_at ON review_item_comments;
CREATE TRIGGER trg_review_item_comments_updated_at
  BEFORE UPDATE ON review_item_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 8. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE review_approvals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_exceptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_item_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ra_tenant ON review_approvals;
CREATE POLICY ra_tenant ON review_approvals FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS re_tenant ON review_exceptions;
CREATE POLICY re_tenant ON review_exceptions FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS ric_tenant ON review_item_comments;
CREATE POLICY ric_tenant ON review_item_comments FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
-- End of migration 022
-- ============================================================
