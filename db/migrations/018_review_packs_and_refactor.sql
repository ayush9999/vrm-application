-- ============================================================
-- Migration 018: Review Pack Architecture Refactor
-- ============================================================
--
-- This migration:
--   A. Drops all old assessment/framework/compliance tables (test data only)
--   B. Creates the Review Pack model (review_packs, evidence_requirements,
--      review_requirements, vendor_review_packs, vendor_review_items)
--   C. Extends vendors with approval + classification columns
--   D. Extends vendor_documents with evidence linking
--   E. Extends issues with remediation columns
--   F. Drops issue_controls and issue_findings (orphaned by assessment drop)
--   G. Updates RLS policies for new tables
-- ============================================================

-- ─── A. Drop old assessment tables ───────────────────────────────────────────
-- Wrapped in a DO block with exception handling so partial-state databases
-- (where some tables are already gone) don't fail the migration.

DO $$
DECLARE
  t text;
  drop_tables text[] := ARRAY[
    'issue_findings', 'issue_controls',
    'assessment_framework_selections',
    'assessment_reviews', 'assessment_reports',
    'assessment_item_evidence', 'assessment_items',
    'assessment_mitigations', 'assessment_findings',
    'universal_control_clause_mappings',
    'universal_control_framework_mappings',
    'assessment_framework_items',
    'compliance_framework_clauses',
    'vendor_assessments',
    'category_framework_suggestions',
    'org_framework_selections',
    'assessment_frameworks',
    'universal_controls'
  ];
  drop_types text[] := ARRAY[
    'assessment_type', 'assessment_status', 'assessment_risk_level',
    'assessment_period_type', 'assessment_item_type', 'assessment_item_status',
    'assessment_evidence_type', 'assessment_review_type', 'assessment_review_status',
    'finding_severity', 'finding_status', 'mitigation_status',
    'framework_type', 'framework_scoring_method', 'review_frequency'
  ];
BEGIN
  -- Drop FK and column on issues if they exist (issues table stays)
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'issues') THEN
    BEGIN
      EXECUTE 'ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_assessment_id_fkey';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER TABLE issues DROP COLUMN IF EXISTS assessment_id';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Drop tables (with CASCADE, swallow any errors)
  FOREACH t IN ARRAY drop_tables LOOP
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop table %: %', t, SQLERRM;
    END;
  END LOOP;

  -- Drop function and sequence
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS set_assessment_code() CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP SEQUENCE IF EXISTS assessment_code_seq';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Drop enums
  FOREACH t IN ARRAY drop_types LOOP
    BEGIN
      EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', t);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not drop type %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─── B. New enums ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE vendor_data_access_level AS ENUM (
    'none', 'internal_only', 'personal_data', 'sensitive_personal_data', 'financial_data'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_service_type AS ENUM (
    'saas', 'contractor', 'supplier', 'logistics', 'professional_services', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_approval_status AS ENUM (
    'draft', 'waiting_on_vendor', 'in_internal_review', 'approved',
    'approved_with_exception', 'blocked', 'suspended', 'offboarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_pack_cadence AS ENUM (
    'annual', 'biannual', 'on_incident', 'on_renewal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_item_decision AS ENUM (
    'not_started', 'pass', 'fail', 'na', 'needs_follow_up', 'exception_approved'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vendor_review_pack_status AS ENUM (
    'not_started', 'in_progress', 'submitted', 'approved',
    'approved_with_exception', 'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evidence_status AS ENUM (
    'missing', 'uploaded', 'under_review', 'approved', 'rejected', 'expired', 'waived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── C. Extend vendors table ─────────────────────────────────────────────────

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS data_access_level    vendor_data_access_level NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS annual_spend         decimal(14,2),
  ADD COLUMN IF NOT EXISTS service_type         vendor_service_type NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS processes_personal_data boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status      vendor_approval_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at          timestamptz,
  ADD COLUMN IF NOT EXISTS exception_reason     text;

-- ─── D. Extend vendor_documents (Evidence) ───────────────────────────────────

ALTER TABLE vendor_documents
  ADD COLUMN IF NOT EXISTS evidence_requirement_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_status         evidence_status NOT NULL DEFAULT 'missing';

-- FK added after evidence_requirements table is created (below)

-- ─── E. Extend issues (Remediation) ──────────────────────────────────────────

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS root_cause                     text,
  ADD COLUMN IF NOT EXISTS source_review_requirement_id   uuid,
  ADD COLUMN IF NOT EXISTS source_vendor_review_pack_id   uuid,
  ADD COLUMN IF NOT EXISTS closure_evidence_url           text,
  ADD COLUMN IF NOT EXISTS verified_by_user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at                    timestamptz;

-- Update status check constraint to include new remediation statuses
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check
  CHECK (status IN (
    'open', 'in_progress', 'blocked', 'deferred',
    'waiting_on_vendor', 'waiting_internal_review',
    'resolved', 'verified', 'closed'
  ));

-- ─── F. Review Packs model ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_packs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  code                text,
  description         text,
  applicability_rules jsonb       NOT NULL DEFAULT '{}',
  review_cadence      review_pack_cadence NOT NULL DEFAULT 'annual',
  compliance_mappings jsonb       DEFAULT '[]',
  source_type         document_source_type NOT NULL DEFAULT 'custom',
  is_active           boolean     NOT NULL DEFAULT true,
  created_by_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT ck_review_packs_source_scope CHECK (
    (source_type = 'standard' AND org_id IS NULL) OR
    (source_type = 'custom' AND org_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_review_packs_code ON review_packs(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_review_packs_org ON review_packs(org_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS evidence_requirements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  review_pack_id      uuid        NOT NULL REFERENCES review_packs(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  code                text,
  description         text,
  required            boolean     NOT NULL DEFAULT true,
  accepted_formats    text,
  expiry_applies      boolean     NOT NULL DEFAULT false,
  reupload_cadence    text,
  sort_order          int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS ix_evidence_requirements_pack ON evidence_requirements(review_pack_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS review_requirements (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  review_pack_id              uuid        NOT NULL REFERENCES review_packs(id) ON DELETE CASCADE,
  name                        text        NOT NULL,
  code                        text,
  description                 text,
  required                    boolean     NOT NULL DEFAULT true,
  linked_evidence_requirement_id uuid     REFERENCES evidence_requirements(id) ON DELETE SET NULL,
  compliance_references       jsonb       DEFAULT '[]',
  creates_remediation_on_fail boolean     NOT NULL DEFAULT false,
  sort_order                  int         NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE INDEX IF NOT EXISTS ix_review_requirements_pack ON review_requirements(review_pack_id) WHERE deleted_at IS NULL;

-- Now add the FK from vendor_documents to evidence_requirements
DO $$ BEGIN
  ALTER TABLE vendor_documents
    ADD CONSTRAINT fk_vendor_documents_evidence_req
    FOREIGN KEY (evidence_requirement_id) REFERENCES evidence_requirements(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add FKs from issues to new tables
DO $$ BEGIN
  ALTER TABLE issues
    ADD CONSTRAINT fk_issues_review_req
    FOREIGN KEY (source_review_requirement_id) REFERENCES review_requirements(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── G. Vendor Review Packs (instances) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_review_packs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id           uuid        NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  review_pack_id      uuid        NOT NULL REFERENCES review_packs(id) ON DELETE CASCADE,
  status              vendor_review_pack_status NOT NULL DEFAULT 'not_started',
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  due_at              timestamptz,
  completed_at        timestamptz,
  reviewer_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  approver_user_id    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT ux_vendor_review_packs_vendor_pack UNIQUE (vendor_id, review_pack_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_review_packs_vendor ON vendor_review_packs(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_vendor_review_packs_org ON vendor_review_packs(org_id) WHERE deleted_at IS NULL;

-- Now add FK from issues to vendor_review_packs
DO $$ BEGIN
  ALTER TABLE issues
    ADD CONSTRAINT fk_issues_vendor_review_pack
    FOREIGN KEY (source_vendor_review_pack_id) REFERENCES vendor_review_packs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_review_items (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_review_pack_id     uuid        NOT NULL REFERENCES vendor_review_packs(id) ON DELETE CASCADE,
  review_requirement_id     uuid        NOT NULL REFERENCES review_requirements(id) ON DELETE CASCADE,
  decision                  review_item_decision NOT NULL DEFAULT 'not_started',
  reviewer_comment          text,
  linked_evidence_id        uuid        REFERENCES vendor_documents(id) ON DELETE SET NULL,
  created_remediation_id    uuid        REFERENCES issues(id) ON DELETE SET NULL,
  decided_at                timestamptz,
  decided_by_user_id        uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_vendor_review_items_pack_req UNIQUE (vendor_review_pack_id, review_requirement_id)
);

CREATE INDEX IF NOT EXISTS ix_vendor_review_items_pack ON vendor_review_items(vendor_review_pack_id);

-- ─── H. Updated_at triggers for new tables ───────────────────────────────────

DROP TRIGGER IF EXISTS trg_review_packs_updated_at ON review_packs;
CREATE TRIGGER trg_review_packs_updated_at
  BEFORE UPDATE ON review_packs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_review_packs_updated_at ON vendor_review_packs;
CREATE TRIGGER trg_vendor_review_packs_updated_at
  BEFORE UPDATE ON vendor_review_packs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_review_items_updated_at ON vendor_review_items;
CREATE TRIGGER trg_vendor_review_items_updated_at
  BEFORE UPDATE ON vendor_review_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── I. RLS for new tables ───────────────────────────────────────────────────

ALTER TABLE review_packs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_requirements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requirements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_review_packs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_review_items    ENABLE ROW LEVEL SECURITY;

-- review_packs: hybrid (NULL org_id = standard library packs)
CREATE POLICY rp_select ON review_packs FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
CREATE POLICY rp_write ON review_packs FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- evidence_requirements: hybrid (follows review_pack scope)
CREATE POLICY er_select ON evidence_requirements FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
CREATE POLICY er_write ON evidence_requirements FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- review_requirements: hybrid
CREATE POLICY rr_select ON review_requirements FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
CREATE POLICY rr_write ON review_requirements FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- vendor_review_packs: strict tenant
CREATE POLICY vrp_tenant ON vendor_review_packs FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- vendor_review_items: strict tenant
CREATE POLICY vri_tenant ON vendor_review_items FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- Grant access to new tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- (Triggers on dropped tables were removed automatically by DROP TABLE CASCADE)

-- ============================================================
-- End of migration 018
-- ============================================================
