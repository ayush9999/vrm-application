-- ============================================================
-- Vendor Management SaaS — Consolidated Migration
-- Run this entire file in Supabase SQL editor for a fresh setup,
-- or run only the section(s) you haven't applied yet.
--
-- Sections:
--   001  Core schema (tables, enums, triggers, indexes, seed data)
--   002  Expand incident_severity enum
--   003  Risk Assessment Module
--   004  Org Framework Selections
--   006  Framework Kind + Vendor Framework Selections
--        (005 applicable_category_ids was superseded and never run — skip it)
-- ============================================================


-- ============================================================
-- 001 — Core schema
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

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  user_id uuid NOT NULL REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  role org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_org_memberships_org_user UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS vendor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
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

CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
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

CREATE TABLE IF NOT EXISTS category_document_templates (
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

CREATE TABLE IF NOT EXISTS vendors (
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

CREATE TABLE IF NOT EXISTS vendor_status_history (
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

CREATE TABLE IF NOT EXISTS vendor_documents (
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

CREATE TABLE IF NOT EXISTS vendor_document_versions (
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

DO $$ BEGIN
  ALTER TABLE vendor_documents
    ADD CONSTRAINT fk_vendor_documents_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES vendor_document_versions(id)
    DEFERRABLE INITIALLY IMMEDIATE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_document_verifications (
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

CREATE TABLE IF NOT EXISTS vendor_reviews (
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

CREATE TABLE IF NOT EXISTS vendor_disputes (
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

CREATE TABLE IF NOT EXISTS assessment_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  code text,
  framework_type framework_type,
  version text,
  source_type document_source_type NOT NULL DEFAULT 'custom',
  metadata_json jsonb,
  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT ck_assessment_frameworks_source_scope CHECK (
    (source_type = 'standard' AND org_id IS NULL) OR
    (source_type = 'custom'   AND org_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS vendor_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_type assessment_type NOT NULL,
  framework_id uuid REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,
  frequency review_frequency,
  period_start date,
  period_end date,
  title text,
  description text,
  period_type assessment_period_type,
  overall_score numeric(5,2) CHECK (overall_score BETWEEN 0 AND 100),
  risk_level assessment_risk_level,
  status assessment_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  completed_at timestamptz,
  report_generated_at timestamptz,
  share_token text,
  share_token_expires_at timestamptz,
  final_summary text,
  final_recommendation text,
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

CREATE TABLE IF NOT EXISTS assessment_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  doc_type_id uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_item_id uuid,
  risk_domain text,
  risk_category text,
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

CREATE TABLE IF NOT EXISTS assessment_mitigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  finding_id uuid NOT NULL REFERENCES assessment_findings(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id uuid,
  action text NOT NULL,
  owner_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  due_at date,
  status mitigation_status NOT NULL DEFAULT 'open',
  notes text,
  resolution_notes text,
  created_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Alerts / activity / incidents / news
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
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

CREATE TABLE IF NOT EXISTS activity_log (
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

CREATE TABLE IF NOT EXISTS vendor_incidents (
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

CREATE TABLE IF NOT EXISTS vendor_news_settings (
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

CREATE TABLE IF NOT EXISTS vendor_news_events (
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
-- Assessment framework items (003)
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_framework_items (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id                uuid NOT NULL REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,
  org_id                      uuid REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  title                       text NOT NULL,
  description                 text,
  category                    text,
  item_type                   assessment_item_type NOT NULL DEFAULT 'manual_check',
  required                    boolean NOT NULL DEFAULT false,
  weight                      numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  scoring_method              framework_scoring_method NOT NULL DEFAULT 'binary',
  expected_document_type_id   uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,
  metadata_json               jsonb,
  sort_order                  int NOT NULL DEFAULT 0,
  created_by_user_id          uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at                  timestamptz,
  deleted_by_user_id          uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_items (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id               uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  framework_item_id           uuid REFERENCES assessment_framework_items(id) DEFERRABLE INITIALLY IMMEDIATE,
  title                       text NOT NULL,
  description                 text,
  category                    text,
  item_type                   assessment_item_type NOT NULL DEFAULT 'manual_check',
  required                    boolean NOT NULL DEFAULT false,
  weight                      numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  status                      assessment_item_status NOT NULL DEFAULT 'not_started',
  score                       numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  rationale                   text,
  reviewer_notes              text,
  ai_notes                    text,
  human_notes                 text,
  expected_document_type_id   uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,
  metadata_json               jsonb,
  sort_order                  int NOT NULL DEFAULT 0,
  created_by_user_id          uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at                  timestamptz,
  deleted_by_user_id          uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_item_evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_item_id    uuid NOT NULL REFERENCES assessment_items(id) DEFERRABLE INITIALLY IMMEDIATE,
  evidence_type         assessment_evidence_type NOT NULL,
  evidence_entity_id    uuid,
  summary               text,
  metadata_json         jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE IF NOT EXISTS assessment_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id         uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  review_type           assessment_review_type NOT NULL,
  status                assessment_review_status NOT NULL DEFAULT 'pending',
  reviewer_user_id      uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  review_summary        text,
  detailed_findings     jsonb,
  started_at            timestamptz,
  completed_at          timestamptz,
  created_by_user_id    uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at            timestamptz,
  deleted_by_user_id    uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id           uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  framework_id            uuid REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,
  report_type             text NOT NULL DEFAULT 'full',
  version                 int NOT NULL DEFAULT 1,
  generated_by_user_id    uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  storage_path            text,
  content_json            jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 004 — Org Framework Selections
-- ============================================================

CREATE TABLE IF NOT EXISTS org_framework_selections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  is_primary   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, framework_id)
);

-- ============================================================
-- 5) updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendor_categories_updated_at ON vendor_categories;
CREATE TRIGGER trg_vendor_categories_updated_at
BEFORE UPDATE ON vendor_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_document_types_updated_at ON document_types;
CREATE TRIGGER trg_document_types_updated_at
BEFORE UPDATE ON document_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_documents_updated_at ON vendor_documents;
CREATE TRIGGER trg_vendor_documents_updated_at
BEFORE UPDATE ON vendor_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_disputes_updated_at ON vendor_disputes;
CREATE TRIGGER trg_vendor_disputes_updated_at
BEFORE UPDATE ON vendor_disputes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_frameworks_updated_at ON assessment_frameworks;
CREATE TRIGGER trg_assessment_frameworks_updated_at
BEFORE UPDATE ON assessment_frameworks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_assessments_updated_at ON vendor_assessments;
CREATE TRIGGER trg_vendor_assessments_updated_at
BEFORE UPDATE ON vendor_assessments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_findings_updated_at ON assessment_findings;
CREATE TRIGGER trg_assessment_findings_updated_at
BEFORE UPDATE ON assessment_findings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_mitigations_updated_at ON assessment_mitigations;
CREATE TRIGGER trg_assessment_mitigations_updated_at
BEFORE UPDATE ON assessment_mitigations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON alerts;
CREATE TRIGGER trg_alerts_updated_at
BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_incidents_updated_at ON vendor_incidents;
CREATE TRIGGER trg_vendor_incidents_updated_at
BEFORE UPDATE ON vendor_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_news_settings_updated_at ON vendor_news_settings;
CREATE TRIGGER trg_vendor_news_settings_updated_at
BEFORE UPDATE ON vendor_news_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_framework_items_updated_at ON assessment_framework_items;
CREATE TRIGGER trg_assessment_framework_items_updated_at
BEFORE UPDATE ON assessment_framework_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_items_updated_at ON assessment_items;
CREATE TRIGGER trg_assessment_items_updated_at
BEFORE UPDATE ON assessment_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_reviews_updated_at ON assessment_reviews;
CREATE TRIGGER trg_assessment_reviews_updated_at
BEFORE UPDATE ON assessment_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6) Indexes
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_categories_org_name_active
  ON vendor_categories (org_id, lower(name))
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_types_standard_name_active
  ON document_types (lower(name))
  WHERE source_type = 'standard' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_types_custom_org_name_active
  ON document_types (org_id, lower(name))
  WHERE source_type = 'custom' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_org_name_active
  ON vendors (org_id, lower(name))
  WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendors_org_vendor_code_active
  ON vendors (org_id, vendor_code)
  WHERE archived_at IS NULL AND deleted_at IS NULL AND vendor_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_org_status
  ON vendors (org_id, status) WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_org_category
  ON vendors (org_id, category_id) WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_org_critical
  ON vendors (org_id, is_critical) WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_org_owner
  ON vendors (org_id, internal_owner_user_id) WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendors_org_review_due
  ON vendors (org_id, next_review_due_at) WHERE archived_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_category_doc_templates_category
  ON category_document_templates (category_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_category_doc_templates_doctype
  ON category_document_templates (doc_type_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_documents_org_vendor
  ON vendor_documents (org_id, vendor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_documents_org_expiry
  ON vendor_documents (org_id, expiry_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_doc_versions_doc_uploadedat
  ON vendor_document_versions (vendor_document_id, uploaded_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_doc_verifs_version_verifiedat
  ON vendor_document_verifications (vendor_document_version_id, verified_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_reviews_org_vendor_reviewedat
  ON vendor_reviews (org_id, vendor_id, reviewed_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_disputes_org_vendor_status
  ON vendor_disputes (org_id, vendor_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_assessments_org_vendor_period
  ON vendor_assessments (org_id, vendor_id, period_start, period_end) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_findings_assessment_status
  ON assessment_findings (assessment_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_alerts_org_status_created
  ON alerts (org_id, status, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_alerts_org_vendor
  ON alerts (org_id, vendor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_activity_log_org_createdat
  ON activity_log (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_activity_log_org_vendor_createdat
  ON activity_log (org_id, vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_vendor_incidents_org_vendor_date
  ON vendor_incidents (org_id, vendor_id, incident_date DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_news_events_org_vendor_detectedat
  ON vendor_news_events (org_id, vendor_id, detected_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_news_events_org_status
  ON vendor_news_events (org_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_users_org_id ON users (org_id);
CREATE INDEX IF NOT EXISTS ix_org_memberships_org_id ON org_memberships (org_id);

CREATE INDEX IF NOT EXISTS ix_vendor_status_history_org_id
  ON vendor_status_history (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_document_versions_org_id
  ON vendor_document_versions (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_document_verifications_org_id
  ON vendor_document_verifications (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_findings_org_id
  ON assessment_findings (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_mitigations_org_id
  ON assessment_mitigations (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_news_settings_org_enabled
  ON vendor_news_settings (org_id, enabled) WHERE deleted_at IS NULL;

-- Assessment framework uniqueness is enforced by code (uix_assessment_frameworks_code)
-- The old name-based unique index was dropped in favour of code-based deduplication.

CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_frameworks_custom_org_name_active
  ON assessment_frameworks (org_id, lower(name))
  WHERE source_type = 'custom' AND archived_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_frameworks_code
  ON assessment_frameworks (lower(code))
  WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_framework_items_framework
  ON assessment_framework_items (framework_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_framework_items_framework_sort
  ON assessment_framework_items (framework_id, sort_order) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_framework_items_category
  ON assessment_framework_items (framework_id, category) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_assessments_share_token
  ON vendor_assessments (share_token)
  WHERE share_token IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_assessments_org_status
  ON vendor_assessments (org_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_assessments_org_risk_level
  ON vendor_assessments (org_id, risk_level)
  WHERE risk_level IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_vendor_assessments_vendor_status
  ON vendor_assessments (vendor_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment
  ON assessment_items (assessment_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment_sort
  ON assessment_items (assessment_id, sort_order) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment_status
  ON assessment_items (assessment_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_items_framework_item
  ON assessment_items (framework_item_id)
  WHERE framework_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_items_org
  ON assessment_items (org_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_evidence_assessment_item
  ON assessment_item_evidence (assessment_item_id);

CREATE INDEX IF NOT EXISTS ix_evidence_org_type
  ON assessment_item_evidence (org_id, evidence_type);

CREATE INDEX IF NOT EXISTS ix_evidence_entity
  ON assessment_item_evidence (evidence_entity_id)
  WHERE evidence_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_findings_assessment_item
  ON assessment_findings (assessment_item_id)
  WHERE assessment_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_findings_risk_domain
  ON assessment_findings (assessment_id, risk_domain) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_mitigations_assessment
  ON assessment_mitigations (assessment_id)
  WHERE assessment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_reviews_assessment
  ON assessment_reviews (assessment_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_reviews_type
  ON assessment_reviews (assessment_id, review_type) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_reviews_reviewer
  ON assessment_reviews (reviewer_user_id)
  WHERE reviewer_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_reviews_org_status
  ON assessment_reviews (org_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_assessment_reports_assessment
  ON assessment_reports (assessment_id);

CREATE INDEX IF NOT EXISTS ix_assessment_reports_org_type
  ON assessment_reports (org_id, report_type);

CREATE INDEX IF NOT EXISTS idx_org_framework_selections_org_id
  ON org_framework_selections(org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_framework_selections_primary
  ON org_framework_selections(org_id)
  WHERE is_primary = true;

-- ============================================================
-- 006 — Framework Kind + Vendor Framework Selections
-- ============================================================

-- 1. kind discriminator on assessment_frameworks
ALTER TABLE assessment_frameworks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'compliance_standard'
  CHECK (kind IN ('compliance_standard', 'vendor_risk_framework'));

UPDATE assessment_frameworks SET kind = 'compliance_standard' WHERE org_id IS NULL;

-- 2. Compliance mapping refs on framework controls
ALTER TABLE assessment_framework_items
  ADD COLUMN IF NOT EXISTS mapped_standard_refs jsonb DEFAULT NULL;

-- 3. Category → VRF suggestions
CREATE TABLE IF NOT EXISTS category_framework_suggestions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  category_id    uuid        NOT NULL REFERENCES vendor_categories(id) ON DELETE CASCADE,
  framework_id   uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  is_default     boolean     NOT NULL DEFAULT true,
  display_order  int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, category_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_category_framework_suggestions_category
  ON category_framework_suggestions(category_id);

-- 4. Per-vendor framework selections
CREATE TABLE IF NOT EXISTS vendor_framework_selections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id        uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  framework_id     uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  added_by_user_id uuid        REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_framework_selections_vendor
  ON vendor_framework_selections(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_framework_selections_org
  ON vendor_framework_selections(org_id);

-- Backfill: auto-assign VRFs to existing vendors that pre-date auto-assignment
INSERT INTO vendor_framework_selections (org_id, vendor_id, framework_id, added_by_user_id)
SELECT DISTINCT
  v.org_id,
  v.id            AS vendor_id,
  cfs.framework_id,
  NULL::uuid      AS added_by_user_id
FROM vendors v
JOIN category_framework_suggestions cfs
  ON cfs.category_id = v.category_id
  AND (cfs.org_id = v.org_id OR cfs.org_id IS NULL)
WHERE v.deleted_at IS NULL
  AND v.category_id IS NOT NULL
ON CONFLICT (vendor_id, framework_id) DO NOTHING;

-- ============================================================
-- 007 — Global VRM Library Schema Support
-- ============================================================

-- 1. Allow global vendor categories (org_id = null)
ALTER TABLE vendor_categories ALTER COLUMN org_id DROP NOT NULL;

-- 2. Add code column to vendor_categories for library key storage
ALTER TABLE vendor_categories ADD COLUMN IF NOT EXISTS code text;

-- 3. Add code column to assessment_framework_items for control_key storage
ALTER TABLE assessment_framework_items ADD COLUMN IF NOT EXISTS code text;

-- Indexes
CREATE INDEX IF NOT EXISTS ix_vendor_categories_code
  ON vendor_categories(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_framework_items_code
  ON assessment_framework_items(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_frameworks_code
  ON assessment_frameworks(code) WHERE code IS NOT NULL;

-- ============================================================
-- 7) Seed data
-- ============================================================

INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Organization')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_categories (org_id, name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'IT Vendor'),
  ('00000000-0000-0000-0000-000000000001', 'Logistics'),
  ('00000000-0000-0000-0000-000000000001', 'Contractor'),
  ('00000000-0000-0000-0000-000000000001', 'Consultant')
ON CONFLICT DO NOTHING;

INSERT INTO document_types (org_id, name, source_type, is_active)
VALUES
  (null, 'NDA', 'standard', true),
  (null, 'Contract', 'standard', true),
  (null, 'Insurance', 'standard', true),
  (null, 'ISO Certificate', 'standard', true),
  (null, 'GST Certificate', 'standard', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration 008: Universal Controls Normalization Layer
-- ============================================================

CREATE TABLE IF NOT EXISTS universal_controls (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL,
  name        text        NOT NULL,
  domain_key  text,
  family_key  text,
  family_name text,
  description text,
  status      text        NOT NULL DEFAULT 'active',
  org_id      uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_universal_controls_code
  ON universal_controls (code)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS compliance_framework_clauses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL,
  framework_id   uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  reference      text        NOT NULL,
  reference_name text,
  reference_type text,
  status         text        NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_compliance_framework_clauses_code
  ON compliance_framework_clauses (code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_compliance_framework_clauses_framework
  ON compliance_framework_clauses (framework_id);

CREATE TABLE IF NOT EXISTS universal_control_clause_mappings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_control_id uuid        NOT NULL REFERENCES universal_controls(id) ON DELETE CASCADE,
  clause_id            uuid        NOT NULL REFERENCES compliance_framework_clauses(id) ON DELETE CASCADE,
  mapping_strength     text,
  mapping_method       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(universal_control_id, clause_id)
);

CREATE INDEX IF NOT EXISTS ix_uccm_universal_control
  ON universal_control_clause_mappings (universal_control_id);

CREATE INDEX IF NOT EXISTS ix_uccm_clause
  ON universal_control_clause_mappings (clause_id);

CREATE TABLE IF NOT EXISTS universal_control_framework_mappings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_control_id uuid        NOT NULL REFERENCES universal_controls(id) ON DELETE CASCADE,
  framework_id         uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  mapping_strength     text,
  mapping_method       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(universal_control_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_ucfm_universal_control
  ON universal_control_framework_mappings (universal_control_id);

ALTER TABLE assessment_framework_items
  ADD COLUMN IF NOT EXISTS universal_control_id uuid
  REFERENCES universal_controls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_afi_universal_control
  ON assessment_framework_items (universal_control_id)
  WHERE universal_control_id IS NOT NULL;

-- ============================================================
-- Migration 009: Prevent duplicate assessment items
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uix_assessment_items_no_dup
  ON assessment_items (assessment_id, framework_item_id)
  WHERE framework_item_id IS NOT NULL
    AND deleted_at IS NULL;

-- ============================================================
-- Migration 010: Assessment Framework Selections
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_framework_selections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    uuid        NOT NULL REFERENCES vendor_assessments(id) ON DELETE CASCADE,
  framework_id     uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  source           text        NOT NULL DEFAULT 'manual'
                              CHECK (source IN ('onboarding', 'manual')),
  added_by_user_id uuid        REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_afs_assessment ON assessment_framework_selections(assessment_id);
CREATE INDEX IF NOT EXISTS ix_afs_framework  ON assessment_framework_selections(framework_id);

ALTER TABLE vendor_assessments ADD COLUMN IF NOT EXISTS is_onboarding boolean NOT NULL DEFAULT false;

ALTER TABLE vendor_assessments DROP COLUMN IF EXISTS framework_id;

DROP TABLE IF EXISTS vendor_framework_selections;

-- ── 011  Add code columns + unique indexes to seed-managed tables ──────────────
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



-- Prevents duplicate framework items from seed re-runs.
-- Safe to run even if constraint already exists (IF NOT EXISTS not supported on
-- ADD CONSTRAINT, so wrap in a DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uix_framework_items_code'
  ) THEN
    ALTER TABLE assessment_framework_items
      ADD CONSTRAINT uix_framework_items_code UNIQUE (code);
  END IF;
END $$;

-- ── 012  Issues & Remediation module ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issues (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id             uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assessment_id         uuid        REFERENCES vendor_assessments(id) ON DELETE SET NULL,
  title                 text        NOT NULL,
  description           text,
  severity              text        NOT NULL DEFAULT 'medium'
                                    CHECK (severity IN ('critical','high','medium','low')),
  status                text        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','in_progress','resolved','closed')),
  disposition           text        DEFAULT 'remediate'
                                    CHECK (disposition IN ('remediate','accepted_risk')),
  source                text        NOT NULL DEFAULT 'manual'
                                    CHECK (source IN ('assessment','manual','monitoring')),
  type                  text        NOT NULL DEFAULT 'general'
                                    CHECK (type IN ('control_level','grouped','general')),
  owner_user_id         uuid        REFERENCES users(id) ON DELETE SET NULL,
  due_date              date,
  remediation_plan      text,
  resolution_notes      text,
  accepted_reason       text,
  accepted_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  accepted_at           timestamptz,
  resolved_at           timestamptz,
  closed_at             timestamptz,
  created_by_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX IF NOT EXISTS ix_issues_org       ON issues(org_id);
CREATE INDEX IF NOT EXISTS ix_issues_vendor    ON issues(vendor_id);
CREATE INDEX IF NOT EXISTS ix_issues_status    ON issues(org_id, status);
CREATE INDEX IF NOT EXISTS ix_issues_owner     ON issues(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_issues_due       ON issues(due_date) WHERE due_date IS NOT NULL AND status IN ('open','in_progress');

CREATE TABLE IF NOT EXISTS issue_controls (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id                uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  assessment_item_id      uuid        REFERENCES assessment_items(id) ON DELETE SET NULL,
  assessment_finding_id   uuid        REFERENCES assessment_findings(id) ON DELETE SET NULL,
  framework_item_id       uuid        REFERENCES assessment_framework_items(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id, assessment_item_id)
);

CREATE INDEX IF NOT EXISTS ix_issue_controls_issue ON issue_controls(issue_id);

CREATE TABLE IF NOT EXISTS issue_evidence (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id              uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  vendor_document_id    uuid        REFERENCES vendor_documents(id) ON DELETE SET NULL,
  file_name             text        NOT NULL,
  file_url              text,
  notes                 text,
  review_status         text        NOT NULL DEFAULT 'pending'
                                    CHECK (review_status IN ('pending','accepted','rejected')),
  reviewed_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  review_notes          text,
  uploaded_by_user_id   uuid        REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_issue_evidence_issue ON issue_evidence(issue_id);

CREATE TABLE IF NOT EXISTS issue_activity (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  old_value   text,
  new_value   text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_issue_activity_issue ON issue_activity(issue_id);

CREATE TABLE IF NOT EXISTS issue_findings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id                uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  assessment_finding_id   uuid        NOT NULL REFERENCES assessment_findings(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id, assessment_finding_id)
);

CREATE INDEX IF NOT EXISTS ix_issue_findings_issue ON issue_findings(issue_id);

-- ============================================================
-- 013 — Auto-generated assessment codes
-- ============================================================

ALTER TABLE vendor_assessments
  ADD COLUMN IF NOT EXISTS assessment_code text;

CREATE SEQUENCE IF NOT EXISTS assessment_code_seq START 1;

UPDATE vendor_assessments
SET assessment_code = 'ASM-' || LPAD(nextval('assessment_code_seq')::text, 4, '0')
WHERE assessment_code IS NULL;

CREATE OR REPLACE FUNCTION set_assessment_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assessment_code IS NULL THEN
    NEW.assessment_code := 'ASM-' || LPAD(nextval('assessment_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_assessment_code ON vendor_assessments;
CREATE TRIGGER trg_set_assessment_code
  BEFORE INSERT ON vendor_assessments
  FOR EACH ROW
  EXECUTE FUNCTION set_assessment_code();

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_assessments_code
  ON vendor_assessments(assessment_code)
  WHERE assessment_code IS NOT NULL;

-- ── 014  Add 'blocked' status to issues ───────────────────────────────────────

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues
  ADD CONSTRAINT issues_status_check
  CHECK (status IN ('open','in_progress','blocked','resolved','closed'));

-- ============================================================
-- 015: Add 'deferred' status to issues
-- ============================================================

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues
  ADD CONSTRAINT issues_status_check
  CHECK (status IN ('open','in_progress','blocked','deferred','resolved','closed'));

-- ============================================================
-- 016: Add file_key column to issue_evidence for Supabase Storage
-- ============================================================

ALTER TABLE issue_evidence
  ADD COLUMN IF NOT EXISTS file_key text;

-- ============================================================
-- End of consolidated migration
-- ============================================================
