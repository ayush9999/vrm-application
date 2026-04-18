-- ============================================================
-- Migration 025: Incidents overhaul
-- ============================================================
-- Adds: incident types, response timeline, root cause,
-- corrective action, 5-stage status workflow, regulatory
-- reporting, SLA tracking, evidence linking, recurrence.
-- ============================================================

-- ─── 1. Incident type enum ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM (
    'data_breach', 'service_outage', 'compliance_violation',
    'security_incident', 'quality_defect', 'financial_issue',
    'contractual_breach', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Incident impact scope enum ──────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE incident_impact_scope AS ENUM (
    'none', 'limited', 'moderate', 'significant', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Incident root cause enum ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE incident_root_cause AS ENUM (
    'human_error', 'system_failure', 'third_party',
    'malicious_actor', 'process_gap', 'unknown', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. Replace old 2-state status with 5-stage workflow ────────────────────

-- Drop old constraint
ALTER TABLE vendor_incidents DROP CONSTRAINT IF EXISTS vendor_incidents_status_check;

-- Update old enum values to new workflow values
UPDATE vendor_incidents SET status = 'detected' WHERE status = 'open';
UPDATE vendor_incidents SET status = 'closed' WHERE status = 'resolved';

-- Drop old type if it exists and recreate
DO $$ BEGIN
  ALTER TABLE vendor_incidents ALTER COLUMN status TYPE text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP TYPE IF EXISTS incident_status CASCADE;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM (
    'detected', 'investigating', 'contained', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE vendor_incidents
  ALTER COLUMN status TYPE incident_status USING status::incident_status;

ALTER TABLE vendor_incidents
  ALTER COLUMN status SET DEFAULT 'detected';

-- ─── 5. Add new columns to vendor_incidents ─────────────────────────────────

ALTER TABLE vendor_incidents
  ADD COLUMN IF NOT EXISTS incident_type          incident_type DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS impact_scope            incident_impact_scope DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS records_affected         int,
  ADD COLUMN IF NOT EXISTS users_affected           int,
  ADD COLUMN IF NOT EXISTS business_functions       text,           -- free text: "payments, onboarding"
  ADD COLUMN IF NOT EXISTS data_types_involved      text,           -- "personal_data, financial"
  -- Response timeline
  ADD COLUMN IF NOT EXISTS detected_at              timestamptz,
  ADD COLUMN IF NOT EXISTS reported_by_vendor_at    timestamptz,
  ADD COLUMN IF NOT EXISTS contained_at             timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at              timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at                timestamptz,
  -- Root cause + corrective action
  ADD COLUMN IF NOT EXISTS root_cause               incident_root_cause,
  ADD COLUMN IF NOT EXISTS root_cause_detail        text,
  ADD COLUMN IF NOT EXISTS corrective_action        text,
  ADD COLUMN IF NOT EXISTS corrective_verified      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrective_verified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS corrective_verified_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Regulatory reporting
  ADD COLUMN IF NOT EXISTS is_reportable            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reporting_deadline        timestamptz,
  ADD COLUMN IF NOT EXISTS reported_to_regulator     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reported_to_regulator_at  timestamptz,
  ADD COLUMN IF NOT EXISTS regulator_reference       text,
  ADD COLUMN IF NOT EXISTS applicable_regulation     text,          -- "GDPR", "HIPAA", "DPDP Act"
  -- SLA tracking
  ADD COLUMN IF NOT EXISTS sla_notification_hours    int,            -- contracted SLA in hours
  ADD COLUMN IF NOT EXISTS sla_breached              boolean DEFAULT false,
  -- Linking
  ADD COLUMN IF NOT EXISTS created_remediation_id    uuid REFERENCES issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triggered_review_id       uuid REFERENCES vendor_review_packs(id) ON DELETE SET NULL;

-- ─── 6. Incident evidence (file attachments) ────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id           uuid NOT NULL REFERENCES vendor_incidents(id) ON DELETE CASCADE,
  file_name             text NOT NULL,
  file_key              text,
  file_url              text,
  description           text,
  uploaded_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_incident_evidence_incident ON incident_evidence(incident_id);

ALTER TABLE incident_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ie2_tenant ON incident_evidence;
CREATE POLICY ie2_tenant ON incident_evidence FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- ─── 7. Incident communication log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incident_communications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id           uuid NOT NULL REFERENCES vendor_incidents(id) ON DELETE CASCADE,
  direction             text NOT NULL DEFAULT 'internal',   -- 'internal' | 'to_vendor' | 'from_vendor' | 'to_regulator'
  subject               text,
  body                  text NOT NULL,
  sent_by_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_incident_communications_incident ON incident_communications(incident_id);

ALTER TABLE incident_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ic2_tenant ON incident_communications;
CREATE POLICY ic2_tenant ON incident_communications FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
-- End of migration 025
-- ============================================================
