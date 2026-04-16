-- ============================================================
-- Migration 021: Readiness snapshots for trend chart
-- ============================================================
-- One row per snapshot. Captured automatically on key events
-- (approval status change, vendor review pack completion) and
-- on demand via "Capture snapshot" button on the vendor profile.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_readiness_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id       uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  -- Metrics captured at the moment
  readiness_pct   int         NOT NULL,
  applicable      int         NOT NULL,
  completed       int         NOT NULL,
  risk_band       text        NOT NULL,            -- 'low'|'medium'|'high'|'critical'
  risk_score      int         NOT NULL,
  approval_status vendor_approval_status NOT NULL,
  open_remediations int       NOT NULL DEFAULT 0,
  missing_evidence  int       NOT NULL DEFAULT 0,
  -- Why was this snapshot taken?
  trigger         text        NOT NULL,            -- 'approval_change' | 'manual' | 'pack_completed' | 'cron'
  trigger_user_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vendor_readiness_snapshots_vendor
  ON vendor_readiness_snapshots(vendor_id, created_at);

CREATE INDEX IF NOT EXISTS ix_vendor_readiness_snapshots_org
  ON vendor_readiness_snapshots(org_id, created_at);

ALTER TABLE vendor_readiness_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vrs_tenant ON vendor_readiness_snapshots;
CREATE POLICY vrs_tenant ON vendor_readiness_snapshots FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
-- End of migration 021
-- ============================================================
