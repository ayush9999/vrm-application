-- ============================================================
-- Migration 020: Track 2 features — Settings, Vendor Portal, Custom Fields
-- ============================================================
--
-- Adds:
--   1. organizations: Company Profile + ESG flag + default review frequency
--   2. org_settings: KV store for Reminder Rules + future settings
--   3. org_default_approvers: per-criticality-tier approver mapping
--   4. org_custom_fields + vendor_custom_field_values: org-defined extra fields on vendors
--   5. vendor_portal_links: token-based public access to a vendor review pack
--   6. vendor_portal_submissions: tracks vendor responses through the portal
-- ============================================================

-- ─── 1. Extend organizations with Company Profile + ESG ──────────────────────

DO $$ BEGIN
  CREATE TYPE company_industry AS ENUM (
    'technology', 'financial_services', 'healthcare', 'retail', 'manufacturing',
    'logistics', 'energy', 'government', 'education', 'professional_services', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE company_type AS ENUM (
    'private', 'public', 'non_profit', 'government', 'sole_proprietor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS company_type            company_type,
  ADD COLUMN IF NOT EXISTS industry                company_industry,
  ADD COLUMN IF NOT EXISTS operating_countries     jsonb DEFAULT '[]',  -- ['US','UK',...]
  ADD COLUMN IF NOT EXISTS default_review_cadence  review_pack_cadence DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS esg_enabled             boolean NOT NULL DEFAULT false;

-- ─── 2. org_settings — generic KV for misc settings (reminder rules, etc.) ───

CREATE TABLE IF NOT EXISTS org_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_org_settings_org_key UNIQUE (org_id, key)
);

CREATE INDEX IF NOT EXISTS ix_org_settings_org ON org_settings(org_id);

-- ─── 3. Default approvers per criticality tier ───────────────────────────────

CREATE TABLE IF NOT EXISTS org_default_approvers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  criticality_tier    int NOT NULL CHECK (criticality_tier BETWEEN 1 AND 5),
  approver_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_org_default_approvers_tier UNIQUE (org_id, criticality_tier)
);

CREATE INDEX IF NOT EXISTS ix_org_default_approvers_org ON org_default_approvers(org_id);

-- ─── 4. Custom fields ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE custom_field_type AS ENUM (
    'text', 'number', 'date', 'boolean', 'select', 'multi_select'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_custom_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'vendor',  -- 'vendor' for now; extensible later
  name        text NOT NULL,
  code        text NOT NULL,                    -- snake_case key for storage
  description text,
  field_type  custom_field_type NOT NULL,
  required    boolean NOT NULL DEFAULT false,
  options     jsonb,                            -- for select/multi_select: ["Low","Medium","High"]
  sort_order  int NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT ux_org_custom_fields_org_code UNIQUE (org_id, entity_type, code)
);

CREATE INDEX IF NOT EXISTS ix_org_custom_fields_org ON org_custom_fields(org_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS vendor_custom_field_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES org_custom_fields(id) ON DELETE CASCADE,
  value           jsonb,                         -- type depends on the field
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_vendor_custom_field_values UNIQUE (vendor_id, custom_field_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_custom_field_values_vendor ON vendor_custom_field_values(vendor_id);

-- ─── 5. Vendor Portal links ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE vendor_portal_link_status AS ENUM (
    'active', 'submitted', 'expired', 'revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_portal_links (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id                uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  vendor_review_pack_id    uuid NOT NULL REFERENCES vendor_review_packs(id) ON DELETE CASCADE,
  token                    text NOT NULL UNIQUE,
  recipient_email          text,                 -- where the link was sent (optional)
  expires_at               timestamptz NOT NULL,
  status                   vendor_portal_link_status NOT NULL DEFAULT 'active',
  created_by_user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  submitted_at             timestamptz,
  revoked_at               timestamptz,
  last_accessed_at         timestamptz,
  access_count             int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_vendor_portal_links_vendor ON vendor_portal_links(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_portal_links_org    ON vendor_portal_links(org_id);
CREATE INDEX IF NOT EXISTS ix_vendor_portal_links_token  ON vendor_portal_links(token);
CREATE INDEX IF NOT EXISTS ix_vendor_portal_links_status ON vendor_portal_links(status, expires_at);

-- ─── 6. Vendor Portal submissions (vendor's responses through the link) ──────

CREATE TABLE IF NOT EXISTS vendor_portal_submissions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_portal_link_id    uuid NOT NULL REFERENCES vendor_portal_links(id) ON DELETE CASCADE,
  vendor_review_item_id    uuid REFERENCES vendor_review_items(id) ON DELETE SET NULL,
  vendor_document_id       uuid REFERENCES vendor_documents(id) ON DELETE SET NULL,
  submission_type          text NOT NULL,          -- 'review_response' | 'evidence_upload'
  payload                  jsonb,                  -- decision, comment, file metadata
  submitted_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vendor_portal_submissions_link ON vendor_portal_submissions(vendor_portal_link_id);
CREATE INDEX IF NOT EXISTS ix_vendor_portal_submissions_org  ON vendor_portal_submissions(org_id);

-- ─── 7. Updated_at triggers + RLS ────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_org_settings_updated_at ON org_settings;
CREATE TRIGGER trg_org_settings_updated_at
  BEFORE UPDATE ON org_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_custom_field_values_updated_at ON vendor_custom_field_values;
CREATE TRIGGER trg_vendor_custom_field_values_updated_at
  BEFORE UPDATE ON vendor_custom_field_values FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE org_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_default_approvers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_custom_fields         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_portal_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_portal_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_settings_tenant ON org_settings FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY org_default_approvers_tenant ON org_default_approvers FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY org_custom_fields_tenant ON org_custom_fields FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY vendor_custom_field_values_tenant ON vendor_custom_field_values FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY vendor_portal_links_tenant ON vendor_portal_links FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

CREATE POLICY vendor_portal_submissions_tenant ON vendor_portal_submissions FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- Grant access to new tables (already covered by ALTER DEFAULT PRIVILEGES from migration 017,
-- but explicit grants are safe and idempotent)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
-- End of migration 020
-- ============================================================
