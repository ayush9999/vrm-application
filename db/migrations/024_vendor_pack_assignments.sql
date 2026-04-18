-- ============================================================
-- Migration 024: Vendor pack assignments (source of truth)
-- ============================================================
-- Separates "which packs are assigned to a vendor" (configuration)
-- from "actual review instances" (execution in vendor_review_packs).
--
-- vendor_pack_assignments = permanent, editable list
-- vendor_review_packs = individual review instances created from assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_pack_assignments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id           uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  review_pack_id      uuid        NOT NULL REFERENCES review_packs(id) ON DELETE CASCADE,
  assigned_by_user_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  removed_at          timestamptz,  -- soft-remove: NULL = active, set = removed
  CONSTRAINT ux_vendor_pack_assignments UNIQUE (vendor_id, review_pack_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_pack_assignments_vendor
  ON vendor_pack_assignments(vendor_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_pack_assignments_org
  ON vendor_pack_assignments(org_id);

ALTER TABLE vendor_pack_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vpa_tenant ON vendor_pack_assignments;
CREATE POLICY vpa_tenant ON vendor_pack_assignments FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Backfill: create assignments from existing vendor_review_packs
-- (every vendor_review_pack implies the pack was assigned)
INSERT INTO vendor_pack_assignments (org_id, vendor_id, review_pack_id, assigned_at)
SELECT DISTINCT vrp.org_id, vrp.vendor_id, vrp.review_pack_id, MIN(vrp.created_at)
FROM vendor_review_packs vrp
WHERE vrp.deleted_at IS NULL
GROUP BY vrp.org_id, vrp.vendor_id, vrp.review_pack_id
ON CONFLICT (vendor_id, review_pack_id) DO NOTHING;

-- ============================================================
-- End of migration 024
-- ============================================================
