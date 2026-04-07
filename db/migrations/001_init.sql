-- ============================================================
-- Vendor Management SaaS — Full PostgreSQL DDL (Fresh Create)
-- Document model:
--   - Standard docs: global (org_id NULL)
--   - Custom docs: org-specific (org_id NOT NULL)
--   - Standard docs appear automatically based on category via category_document_templates
-- ============================================================

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2) Enums
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE org_role AS ENUM ('site_admin','vendor_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_status') THEN
    CREATE TYPE vendor_status AS ENUM ('active','under_review','suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_processing_status') THEN
    CREATE TYPE ai_processing_status AS ENUM ('queued','processing','done','failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_decision') THEN
    CREATE TYPE verification_decision AS ENUM ('verified','rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_review_outcome') THEN
    CREATE TYPE vendor_review_outcome AS ENUM ('verified','issues_found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
    CREATE TYPE dispute_status AS ENUM ('open','under_review','resolved','rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
    CREATE TYPE assessment_type AS ENUM ('due_diligence','risk_assessment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE assessment_status AS ENUM ('draft','in_review','submitted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_frequency') THEN
    CREATE TYPE review_frequency AS ENUM ('annual','semiannual','quarterly');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_severity') THEN
    CREATE TYPE finding_severity AS ENUM ('low','medium','high');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_status') THEN
    CREATE TYPE finding_status AS ENUM ('open','mitigated','accepted','closed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mitigation_status') THEN
    CREATE TYPE mitigation_status AS ENUM ('open','in_progress','done','blocked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
    CREATE TYPE alert_type AS ENUM (
      'doc_expiring',
      'doc_expired',
      'missing_required_doc',
      'vendor_review_due',
      'assessment_due',
      'dispute_created',
      'dispute_overdue',
      'news_signal',
      'incident_created'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
    CREATE TYPE alert_status AS ENUM ('new','acknowledged','resolved','ignored','awaiting','blocked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
    CREATE TYPE alert_severity AS ENUM ('low','medium','high');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
    CREATE TYPE incident_severity AS ENUM ('low','medium','high','critical');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
    CREATE TYPE incident_status AS ENUM ('open','resolved');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'news_event_status') THEN
    CREATE TYPE news_event_status AS ENUM ('new','ignored','under_review');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'digest_frequency') THEN
    CREATE TYPE digest_frequency AS ENUM ('weekly','daily');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_source_type') THEN
    CREATE TYPE document_source_type AS ENUM ('standard','custom');
  END IF;
END $$;

-- ============================================================
-- 3) Trigger helper
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ============================================================
-- 4) Core tables
-- ============================================================

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  user_id uuid NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  role org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_org_memberships_org_user UNIQUE (org_id, user_id)
);

CREATE TABLE vendor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- ============================================================
-- Document model
-- ============================================================

CREATE TABLE document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  code text,
  name text NOT NULL,
  description text,
  source_type document_source_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,

  CONSTRAINT ck_document_types_source_scope CHECK (
    (source_type = 'standard' AND org_id IS NULL) OR
    (source_type = 'custom' AND org_id IS NOT NULL)
  )
);

CREATE TABLE category_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES vendor_categories(id) DEFERRABLE INITIALLY IMMEDIATE,
  doc_type_id uuid NOT NULL REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,

  is_required boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ux_category_doc_templates_category_doctype UNIQUE (category_id, doc_type_id)
);

-- ============================================================
-- Vendors
-- ============================================================

CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_code text,
  name text NOT NULL,
  legal_name text,

  category_id uuid REFERENCES vendor_categories(id) DEFERRABLE INITIALLY IMMEDIATE,

  is_critical boolean NOT NULL DEFAULT false,
  criticality_tier int CHECK (criticality_tier BETWEEN 1 AND 5),
  status vendor_status NOT NULL DEFAULT 'active',

  internal_owner_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  website_url text,
  primary_email text,
  phone text,
  country_code char(2),

  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,

  is_blocklisted boolean NOT NULL DEFAULT false,
  blocklist_reason text,
  blocklisted_at timestamptz,
  blocklisted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE vendor_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  from_status vendor_status,
  to_status vendor_status,

  changed_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text,

  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

-- ============================================================
-- Vendor documents
-- ============================================================

CREATE TABLE vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,
  doc_type_id uuid NOT NULL REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,

  expiry_date date,

  last_verified_at timestamptz,
  verified_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  verification_notes text,

  current_version_id uuid,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ux_vendor_documents_vendor_doctype UNIQUE (vendor_id, doc_type_id)
);

CREATE TABLE vendor_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_document_id uuid NOT NULL REFERENCES vendor_documents(id) DEFERRABLE INITIALLY IMMEDIATE,

  file_key text NOT NULL,
  file_name text,
  mime_type text,

  uploaded_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),

  ai_status ai_processing_status NOT NULL DEFAULT 'queued',
  ai_summary text,
  ai_extracted_json jsonb,
  ai_flags jsonb,
  ai_processed_at timestamptz,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

ALTER TABLE vendor_documents
  ADD CONSTRAINT fk_vendor_documents_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES vendor_document_versions(id)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE vendor_document_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_document_version_id uuid NOT NULL REFERENCES vendor_document_versions(id) DEFERRABLE INITIALLY IMMEDIATE,

  verified_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  decision verification_decision,
  notes text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

-- ============================================================
-- Reviews / disputes / assessments
-- ============================================================

CREATE TABLE vendor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  assigned_to_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  reviewed_by_user_id uuid NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  reviewed_at timestamptz NOT NULL DEFAULT now(),
  outcome vendor_review_outcome,
  notes text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE vendor_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_document_id uuid REFERENCES vendor_documents(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_document_version_id uuid REFERENCES vendor_document_versions(id) DEFERRABLE INITIALLY IMMEDIATE,

  title text NOT NULL,
  description text,

  status dispute_status NOT NULL DEFAULT 'open',
  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  assigned_to_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE assessment_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE vendor_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  assessment_type assessment_type NOT NULL,
  framework_id uuid REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,

  frequency review_frequency,
  period_start date,
  period_end date,

  status assessment_status NOT NULL DEFAULT 'draft',

  assigned_to_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  ai_status ai_processing_status NOT NULL DEFAULT 'queued',
  ai_summary text,
  ai_extracted_json jsonb,
  ai_processed_at timestamptz,

  reviewed_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  reviewed_at timestamptz,
  human_notes text,

  report_file_key text,
  report_url text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,

  doc_type_id uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,

  title text NOT NULL,
  description text,

  severity finding_severity NOT NULL DEFAULT 'low',
  status finding_status NOT NULL DEFAULT 'open',

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessment_mitigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  finding_id uuid NOT NULL REFERENCES assessment_findings(id) DEFERRABLE INITIALLY IMMEDIATE,

  action text NOT NULL,
  owner_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  due_at date,
  status mitigation_status NOT NULL DEFAULT 'open',
  notes text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Alerts / activity / incidents / news
-- ============================================================

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'low',
  status alert_status NOT NULL DEFAULT 'new',

  title text NOT NULL,
  description text,

  related_entity_type text,
  related_entity_id uuid,

  acted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  acted_at timestamptz,
  action_notes text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,

  vendor_id uuid REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,
  actor_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  title text,
  description text,

  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  metadata_json jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vendor_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  incident_date date NOT NULL,
  severity incident_severity NOT NULL DEFAULT 'low',
  status incident_status NOT NULL DEFAULT 'open',

  description text NOT NULL,
  notes text,

  ai_status ai_processing_status NOT NULL DEFAULT 'queued',
  ai_summary text,
  ai_extracted_json jsonb,
  ai_processed_at timestamptz,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vendor_news_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  enabled boolean NOT NULL DEFAULT false,
  keywords text,
  frequency digest_frequency NOT NULL DEFAULT 'weekly',

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ux_vendor_news_settings_vendor UNIQUE (vendor_id)
);

CREATE TABLE vendor_news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,

  detected_at timestamptz NOT NULL DEFAULT now(),
  source text,
  title text NOT NULL,
  url text,
  matched_keyword text,

  status news_event_status NOT NULL DEFAULT 'new',
  reviewed_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  review_notes text,

  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5) updated_at triggers
-- ============================================================

CREATE TRIGGER trg_vendor_categories_updated_at
BEFORE UPDATE ON vendor_categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_document_types_updated_at
BEFORE UPDATE ON document_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON vendors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendor_documents_updated_at
BEFORE UPDATE ON vendor_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendor_disputes_updated_at
BEFORE UPDATE ON vendor_disputes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assessment_frameworks_updated_at
BEFORE UPDATE ON assessment_frameworks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendor_assessments_updated_at
BEFORE UPDATE ON vendor_assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assessment_findings_updated_at
BEFORE UPDATE ON assessment_findings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assessment_mitigations_updated_at
BEFORE UPDATE ON assessment_mitigations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_alerts_updated_at
BEFORE UPDATE ON alerts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendor_incidents_updated_at
BEFORE UPDATE ON vendor_incidents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vendor_news_settings_updated_at
BEFORE UPDATE ON vendor_news_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6) Indexes
-- ============================================================

CREATE UNIQUE INDEX ux_vendor_categories_org_name_active
  ON vendor_categories (org_id, lower(name))
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_document_types_standard_name_active
  ON document_types (lower(name))
  WHERE source_type = 'standard' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_document_types_custom_org_name_active
  ON document_types (org_id, lower(name))
  WHERE source_type = 'custom' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_assessment_frameworks_org_name_active
  ON assessment_frameworks (org_id, lower(name))
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_vendors_org_name_active
  ON vendors (org_id, lower(name))
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_vendors_org_vendor_code_active
  ON vendors (org_id, vendor_code)
  WHERE archived_at IS NULL AND deleted_at IS NULL AND vendor_code IS NOT NULL;

CREATE INDEX ix_vendors_org_status
  ON vendors (org_id, status)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_vendors_org_category
  ON vendors (org_id, category_id)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_vendors_org_critical
  ON vendors (org_id, is_critical)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_vendors_org_owner
  ON vendors (org_id, internal_owner_user_id)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_vendors_org_review_due
  ON vendors (org_id, next_review_due_at)
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_category_doc_templates_category
  ON category_document_templates (category_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_category_doc_templates_doctype
  ON category_document_templates (doc_type_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_documents_org_vendor
  ON vendor_documents (org_id, vendor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_documents_org_expiry
  ON vendor_documents (org_id, expiry_date)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_doc_versions_doc_uploadedat
  ON vendor_document_versions (vendor_document_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_doc_verifs_version_verifiedat
  ON vendor_document_verifications (vendor_document_version_id, verified_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_reviews_org_vendor_reviewedat
  ON vendor_reviews (org_id, vendor_id, reviewed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_disputes_org_vendor_status
  ON vendor_disputes (org_id, vendor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_assessments_org_vendor_period
  ON vendor_assessments (org_id, vendor_id, period_start, period_end)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_assessment_findings_assessment_status
  ON assessment_findings (assessment_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_alerts_org_status_created
  ON alerts (org_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_alerts_org_vendor
  ON alerts (org_id, vendor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_activity_log_org_createdat
  ON activity_log (org_id, created_at DESC);

CREATE INDEX ix_activity_log_org_vendor_createdat
  ON activity_log (org_id, vendor_id, created_at DESC);

CREATE INDEX ix_vendor_incidents_org_vendor_date
  ON vendor_incidents (org_id, vendor_id, incident_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_news_events_org_vendor_detectedat
  ON vendor_news_events (org_id, vendor_id, detected_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_news_events_org_status
  ON vendor_news_events (org_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_users_org_id
  ON users (org_id);

CREATE INDEX ix_org_memberships_org_id
  ON org_memberships (org_id);

CREATE INDEX ix_vendor_status_history_org_id
  ON vendor_status_history (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_document_versions_org_id
  ON vendor_document_versions (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_document_verifications_org_id
  ON vendor_document_verifications (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_assessment_findings_org_id
  ON assessment_findings (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_assessment_mitigations_org_id
  ON assessment_mitigations (org_id)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_vendor_news_settings_org_enabled
  ON vendor_news_settings (org_id, enabled)
  WHERE deleted_at IS NULL;

-- ============================================================
-- End
-- ============================================================

-- Dummy organisation =========================================

insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Organization');

-- adding standard category to organisation ==========================

insert into vendor_categories (org_id, name)
values
('00000000-0000-0000-0000-000000000001', 'IT Vendor'),
('00000000-0000-0000-0000-000000000001', 'Logistics'),
('00000000-0000-0000-0000-000000000001', 'Contractor'),
('00000000-0000-0000-0000-000000000001', 'Consultant');

insert into document_types (org_id, name, source_type, is_active)
values
(null, 'NDA', 'standard', true),
(null, 'Contract', 'standard', true),
(null, 'Insurance', 'standard', true),
(null, 'ISO Certificate', 'standard', true),
(null, 'GST Certificate', 'standard', true);