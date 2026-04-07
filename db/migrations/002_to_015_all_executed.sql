-- ============================================================
-- Migrations 002–015 (all executed)
-- Base schema: 001_init.sql
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 002: Expand incident severity
-- ────────────────────────────────────────────────────────────

ALTER TYPE incident_severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE incident_severity ADD VALUE IF NOT EXISTS 'critical';


-- ────────────────────────────────────────────────────────────
-- 003: Risk Assessment Module
-- ────────────────────────────────────────────────────────────

-- Enums

ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'pending_ai_review';
ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'pending_human_review';
ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE assessment_status ADD VALUE IF NOT EXISTS 'archived';

DO $$ BEGIN CREATE TYPE assessment_item_status AS ENUM ('not_started','in_progress','satisfactory','needs_attention','high_risk','mitigated','not_applicable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_item_type AS ENUM ('manual_check','document_check','incident_review','dispute_review','news_review','profile_check','compliance_check','questionnaire','reviewer_judgment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_evidence_type AS ENUM ('vendor_document','vendor_document_version','incident','dispute','news_event','vendor_profile','prior_assessment','manual_note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_review_type AS ENUM ('ai','human'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_review_status AS ENUM ('pending','in_progress','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_period_type AS ENUM ('annual','semiannual','quarterly','monthly','ad_hoc'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assessment_risk_level AS ENUM ('critical','high','medium','low','informational'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE framework_type AS ENUM ('due_diligence','risk_assessment','compliance','security','financial','esg','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE framework_scoring_method AS ENUM ('binary','weighted','percentage','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend assessment_frameworks

ALTER TABLE assessment_frameworks ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE assessment_frameworks
  ADD COLUMN IF NOT EXISTS code           text,
  ADD COLUMN IF NOT EXISTS framework_type framework_type,
  ADD COLUMN IF NOT EXISTS version        text,
  ADD COLUMN IF NOT EXISTS source_type    document_source_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS metadata_json  jsonb;

DO $$ BEGIN
  ALTER TABLE assessment_frameworks
    ADD CONSTRAINT ck_assessment_frameworks_source_scope CHECK (
      (source_type = 'standard' AND org_id IS NULL) OR
      (source_type = 'custom'   AND org_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS ux_assessment_frameworks_org_name_active;

-- assessment_framework_items

CREATE TABLE IF NOT EXISTS assessment_framework_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id              uuid NOT NULL REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,
  org_id                    uuid REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  title                     text NOT NULL,
  description               text,
  category                  text,
  item_type                 assessment_item_type NOT NULL DEFAULT 'manual_check',
  required                  boolean NOT NULL DEFAULT false,
  weight                    numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  scoring_method            framework_scoring_method NOT NULL DEFAULT 'binary',
  expected_document_type_id uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,
  metadata_json             jsonb,
  sort_order                int NOT NULL DEFAULT 0,
  created_by_user_id        uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at                timestamptz,
  deleted_by_user_id        uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Extend vendor_assessments

ALTER TABLE vendor_assessments
  ADD COLUMN IF NOT EXISTS title                    text,
  ADD COLUMN IF NOT EXISTS description              text,
  ADD COLUMN IF NOT EXISTS period_type              assessment_period_type,
  ADD COLUMN IF NOT EXISTS overall_score            numeric(5,2) CHECK (overall_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS risk_level               assessment_risk_level,
  ADD COLUMN IF NOT EXISTS submitted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at             timestamptz,
  ADD COLUMN IF NOT EXISTS report_generated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS share_token              text,
  ADD COLUMN IF NOT EXISTS share_token_expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS final_summary            text,
  ADD COLUMN IF NOT EXISTS final_recommendation     text;

-- assessment_items

CREATE TABLE IF NOT EXISTS assessment_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id             uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  framework_item_id         uuid REFERENCES assessment_framework_items(id) DEFERRABLE INITIALLY IMMEDIATE,
  title                     text NOT NULL,
  description               text,
  category                  text,
  item_type                 assessment_item_type NOT NULL DEFAULT 'manual_check',
  required                  boolean NOT NULL DEFAULT false,
  weight                    numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  status                    assessment_item_status NOT NULL DEFAULT 'not_started',
  score                     numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  rationale                 text,
  reviewer_notes            text,
  ai_notes                  text,
  human_notes               text,
  expected_document_type_id uuid REFERENCES document_types(id) DEFERRABLE INITIALLY IMMEDIATE,
  metadata_json             jsonb,
  sort_order                int NOT NULL DEFAULT 0,
  created_by_user_id        uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at                timestamptz,
  deleted_by_user_id        uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- assessment_item_evidence

CREATE TABLE IF NOT EXISTS assessment_item_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_item_id  uuid NOT NULL REFERENCES assessment_items(id) DEFERRABLE INITIALLY IMMEDIATE,
  evidence_type       assessment_evidence_type NOT NULL,
  evidence_entity_id  uuid,
  summary             text,
  metadata_json       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by_user_id  uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE
);

-- Extend assessment_findings & mitigations

ALTER TABLE assessment_findings
  ADD COLUMN IF NOT EXISTS assessment_item_id uuid REFERENCES assessment_items(id) DEFERRABLE INITIALLY IMMEDIATE,
  ADD COLUMN IF NOT EXISTS risk_domain        text,
  ADD COLUMN IF NOT EXISTS risk_category      text;

ALTER TABLE assessment_mitigations
  ADD COLUMN IF NOT EXISTS assessment_id    uuid REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- assessment_reviews

CREATE TABLE IF NOT EXISTS assessment_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id       uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  review_type         assessment_review_type NOT NULL,
  status              assessment_review_status NOT NULL DEFAULT 'pending',
  reviewer_user_id    uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  review_summary      text,
  detailed_findings   jsonb,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_by_user_id  uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  deleted_at          timestamptz,
  deleted_by_user_id  uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- assessment_reports

CREATE TABLE IF NOT EXISTS assessment_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) DEFERRABLE INITIALLY IMMEDIATE,
  assessment_id         uuid NOT NULL REFERENCES vendor_assessments(id) DEFERRABLE INITIALLY IMMEDIATE,
  framework_id          uuid REFERENCES assessment_frameworks(id) DEFERRABLE INITIALLY IMMEDIATE,
  report_type           text NOT NULL DEFAULT 'full',
  version               int NOT NULL DEFAULT 1,
  generated_by_user_id  uuid REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE,
  storage_path          text,
  content_json          jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Triggers

DROP TRIGGER IF EXISTS trg_assessment_framework_items_updated_at ON assessment_framework_items;
CREATE TRIGGER trg_assessment_framework_items_updated_at BEFORE UPDATE ON assessment_framework_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_items_updated_at ON assessment_items;
CREATE TRIGGER trg_assessment_items_updated_at BEFORE UPDATE ON assessment_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_assessment_reviews_updated_at ON assessment_reviews;
CREATE TRIGGER trg_assessment_reviews_updated_at BEFORE UPDATE ON assessment_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes (003)

CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_frameworks_standard_name_active ON assessment_frameworks (lower(name)) WHERE source_type = 'standard' AND archived_at IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_frameworks_custom_org_name_active ON assessment_frameworks (org_id, lower(name)) WHERE source_type = 'custom' AND archived_at IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_frameworks_code ON assessment_frameworks (lower(code)) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_framework_items_framework ON assessment_framework_items (framework_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_framework_items_framework_sort ON assessment_framework_items (framework_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_framework_items_category ON assessment_framework_items (framework_id, category) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_assessments_share_token ON vendor_assessments (share_token) WHERE share_token IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vendor_assessments_org_status ON vendor_assessments (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vendor_assessments_org_risk_level ON vendor_assessments (org_id, risk_level) WHERE risk_level IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vendor_assessments_vendor_status ON vendor_assessments (vendor_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment ON assessment_items (assessment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment_sort ON assessment_items (assessment_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_items_assessment_status ON assessment_items (assessment_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_items_framework_item ON assessment_items (framework_item_id) WHERE framework_item_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_items_org ON assessment_items (org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_evidence_assessment_item ON assessment_item_evidence (assessment_item_id);
CREATE INDEX IF NOT EXISTS ix_evidence_org_type ON assessment_item_evidence (org_id, evidence_type);
CREATE INDEX IF NOT EXISTS ix_evidence_entity ON assessment_item_evidence (evidence_entity_id) WHERE evidence_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_findings_assessment_item ON assessment_findings (assessment_item_id) WHERE assessment_item_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_findings_risk_domain ON assessment_findings (assessment_id, risk_domain) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_mitigations_assessment ON assessment_mitigations (assessment_id) WHERE assessment_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_reviews_assessment ON assessment_reviews (assessment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_reviews_type ON assessment_reviews (assessment_id, review_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_reviews_reviewer ON assessment_reviews (reviewer_user_id) WHERE reviewer_user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_reviews_org_status ON assessment_reviews (org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assessment_reports_assessment ON assessment_reports (assessment_id);
CREATE INDEX IF NOT EXISTS ix_assessment_reports_org_type ON assessment_reports (org_id, report_type);


-- ────────────────────────────────────────────────────────────
-- 004: Org Framework Selections
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_framework_selections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  is_primary   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, framework_id)
);

CREATE INDEX IF NOT EXISTS idx_org_framework_selections_org_id ON org_framework_selections(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_framework_selections_primary ON org_framework_selections(org_id) WHERE is_primary = true;


-- ────────────────────────────────────────────────────────────
-- 005: Framework Category Applicability
-- ────────────────────────────────────────────────────────────

ALTER TABLE org_framework_selections
  ADD COLUMN IF NOT EXISTS applicable_category_ids uuid[] DEFAULT NULL;


-- ────────────────────────────────────────────────────────────
-- 006: Framework Kind + Vendor Framework Selections
-- ────────────────────────────────────────────────────────────

ALTER TABLE assessment_frameworks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'compliance_standard'
  CHECK (kind IN ('compliance_standard', 'vendor_risk_framework'));

ALTER TABLE assessment_framework_items
  ADD COLUMN IF NOT EXISTS mapped_standard_refs jsonb DEFAULT NULL;

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

CREATE INDEX IF NOT EXISTS ix_category_framework_suggestions_category ON category_framework_suggestions(category_id);

CREATE TABLE IF NOT EXISTS vendor_framework_selections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id        uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  framework_id     uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  added_by_user_id uuid        REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_framework_selections_vendor ON vendor_framework_selections(vendor_id);
CREATE INDEX IF NOT EXISTS ix_vendor_framework_selections_org ON vendor_framework_selections(org_id);

INSERT INTO vendor_framework_selections (org_id, vendor_id, framework_id, added_by_user_id)
SELECT DISTINCT v.org_id, v.id, cfs.framework_id, NULL::uuid
FROM vendors v
JOIN category_framework_suggestions cfs ON cfs.category_id = v.category_id AND (cfs.org_id = v.org_id OR cfs.org_id IS NULL)
WHERE v.deleted_at IS NULL AND v.category_id IS NOT NULL
ON CONFLICT (vendor_id, framework_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 007: Global Library Schema
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_categories_code ON vendor_categories (lower(code)) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_assessment_framework_items_code ON assessment_framework_items (code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_framework_suggestions_global ON category_framework_suggestions (category_id, framework_id) WHERE org_id IS NULL;


-- ────────────────────────────────────────────────────────────
-- 008: Universal Controls Layer
-- ────────────────────────────────────────────────────────────

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_universal_controls_code ON universal_controls (code) WHERE deleted_at IS NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_compliance_framework_clauses_code ON compliance_framework_clauses (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_compliance_framework_clauses_framework ON compliance_framework_clauses (framework_id);

CREATE TABLE IF NOT EXISTS universal_control_clause_mappings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_control_id uuid        NOT NULL REFERENCES universal_controls(id) ON DELETE CASCADE,
  clause_id            uuid        NOT NULL REFERENCES compliance_framework_clauses(id) ON DELETE CASCADE,
  mapping_strength     text,
  mapping_method       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(universal_control_id, clause_id)
);

CREATE INDEX IF NOT EXISTS ix_uccm_universal_control ON universal_control_clause_mappings (universal_control_id);
CREATE INDEX IF NOT EXISTS ix_uccm_clause ON universal_control_clause_mappings (clause_id);

CREATE TABLE IF NOT EXISTS universal_control_framework_mappings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_control_id uuid        NOT NULL REFERENCES universal_controls(id) ON DELETE CASCADE,
  framework_id         uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  mapping_strength     text,
  mapping_method       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(universal_control_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_ucfm_universal_control ON universal_control_framework_mappings (universal_control_id);

ALTER TABLE assessment_framework_items
  ADD COLUMN IF NOT EXISTS universal_control_id uuid REFERENCES universal_controls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_afi_universal_control ON assessment_framework_items (universal_control_id) WHERE universal_control_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 009: Assessment Items Dedup Constraint
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uix_assessment_items_no_dup ON assessment_items (assessment_id, framework_item_id) WHERE framework_item_id IS NOT NULL AND deleted_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 010: Assessment Framework Selections
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_framework_selections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    uuid        NOT NULL REFERENCES vendor_assessments(id) ON DELETE CASCADE,
  framework_id     uuid        NOT NULL REFERENCES assessment_frameworks(id) ON DELETE CASCADE,
  source           text        NOT NULL DEFAULT 'manual' CHECK (source IN ('onboarding', 'manual')),
  added_by_user_id uuid        REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assessment_id, framework_id)
);

CREATE INDEX IF NOT EXISTS ix_afs_assessment ON assessment_framework_selections(assessment_id);
CREATE INDEX IF NOT EXISTS ix_afs_framework ON assessment_framework_selections(framework_id);

ALTER TABLE vendor_assessments ADD COLUMN IF NOT EXISTS is_onboarding boolean NOT NULL DEFAULT false;
ALTER TABLE vendor_assessments DROP COLUMN IF EXISTS framework_id;
DROP TABLE IF EXISTS vendor_framework_selections;


-- ────────────────────────────────────────────────────────────
-- 012: Issues & Remediation
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issues (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id             uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assessment_id         uuid        REFERENCES vendor_assessments(id) ON DELETE SET NULL,
  title                 text        NOT NULL,
  description           text,
  severity              text        NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
  status                text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  disposition           text        DEFAULT 'remediate' CHECK (disposition IN ('remediate','accepted_risk')),
  source                text        NOT NULL DEFAULT 'manual' CHECK (source IN ('assessment','manual','monitoring')),
  type                  text        NOT NULL DEFAULT 'general' CHECK (type IN ('control_level','grouped','general')),
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

CREATE INDEX IF NOT EXISTS ix_issues_org ON issues(org_id);
CREATE INDEX IF NOT EXISTS ix_issues_vendor ON issues(vendor_id);
CREATE INDEX IF NOT EXISTS ix_issues_status ON issues(org_id, status);
CREATE INDEX IF NOT EXISTS ix_issues_owner ON issues(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_issues_due ON issues(due_date) WHERE due_date IS NOT NULL AND status IN ('open','in_progress');

CREATE TABLE IF NOT EXISTS issue_controls (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id              uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  assessment_item_id    uuid        REFERENCES assessment_items(id) ON DELETE SET NULL,
  assessment_finding_id uuid        REFERENCES assessment_findings(id) ON DELETE SET NULL,
  framework_item_id     uuid        REFERENCES assessment_framework_items(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
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
  review_status         text        NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','accepted','rejected')),
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
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id              uuid        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  assessment_finding_id uuid        NOT NULL REFERENCES assessment_findings(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issue_id, assessment_finding_id)
);

CREATE INDEX IF NOT EXISTS ix_issue_findings_issue ON issue_findings(issue_id);


-- ────────────────────────────────────────────────────────────
-- 013: Auto-generated assessment codes
-- ────────────────────────────────────────────────────────────

ALTER TABLE vendor_assessments ADD COLUMN IF NOT EXISTS assessment_code text;

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_assessments_code ON vendor_assessments(assessment_code) WHERE assessment_code IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 014 + 015: Issue statuses (blocked + deferred)
-- ────────────────────────────────────────────────────────────

ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN ('open','in_progress','blocked','deferred','resolved','closed'));
