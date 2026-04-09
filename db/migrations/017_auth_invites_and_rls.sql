-- ============================================================
-- Migration 017: Auth, Org Invites, and Row-Level Security
-- ============================================================
--
-- Adds:
--   1. org_invites table — pending email invites with token
--   2. user_org_ids() helper function — returns the calling user's org_ids,
--      bypassing RLS via SECURITY DEFINER (avoids policy recursion)
--   3. RLS enabled on every tenant table
--   4. RLS policies for SELECT/INSERT/UPDATE/DELETE based on org membership
--   5. Storage policies for the vendor-documents bucket
--
-- Notes:
--   - The service role bypasses RLS entirely. Server actions that legitimately
--     need cross-org access (signup, invite acceptance, seed scripts) use
--     createServiceClient() in app code.
--   - Tables with nullable org_id (vendor_categories, document_types,
--     assessment_frameworks, assessment_framework_items,
--     category_framework_suggestions, universal_controls) treat NULL as
--     a global/library row visible to everyone.
--   - Issue child tables (issue_controls, issue_evidence, issue_activity,
--     issue_findings) are gated through their parent issues.org_id.
-- ============================================================

-- ─── 0. Table-level grants ───────────────────────────────────────────────────
-- RLS controls row-level access, but the role needs table-level GRANTs first.

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Also apply to future tables created in this schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- ─── 1. org_invites table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_invites (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                   text        NOT NULL,
  role                    org_role    NOT NULL,
  token                   text        NOT NULL UNIQUE,
  expires_at              timestamptz NOT NULL,
  invited_by_user_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  accepted_at             timestamptz,
  accepted_by_user_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  revoked_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_org_invites_org      ON org_invites(org_id);
CREATE INDEX IF NOT EXISTS ix_org_invites_email    ON org_invites(lower(email));
CREATE INDEX IF NOT EXISTS ix_org_invites_token    ON org_invites(token);

-- ─── 2. Helper function ──────────────────────────────────────────────────────
-- Returns all org_ids the calling auth user is a member of.
-- SECURITY DEFINER lets it read org_memberships without recursive RLS checks.

CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = auth.uid()
      AND org_id = target_org_id
      AND role = 'site_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.user_org_ids()           TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_is_org_admin(uuid)  TO authenticated, anon;

-- ─── 3. Enable RLS on all tenant tables ──────────────────────────────────────

ALTER TABLE organizations                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites                         ENABLE ROW LEVEL SECURITY;

ALTER TABLE vendor_categories                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_document_templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_status_history               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_document_versions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_document_verifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_reviews                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_disputes                     ENABLE ROW LEVEL SECURITY;

ALTER TABLE assessment_frameworks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_framework_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_framework_selections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_assessments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_items                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_item_evidence            ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_findings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_mitigations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_reviews                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_reports                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_framework_selections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_framework_suggestions      ENABLE ROW LEVEL SECURITY;

ALTER TABLE alerts                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_incidents                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_news_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_news_events                  ENABLE ROW LEVEL SECURITY;

ALTER TABLE universal_controls                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_framework_clauses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_control_clause_mappings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_control_framework_mappings ENABLE ROW LEVEL SECURITY;

ALTER TABLE issues                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_controls                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_evidence                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_activity                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_findings                      ENABLE ROW LEVEL SECURITY;

-- ─── 4. Policies — organizations / users / memberships / invites ─────────────

DROP POLICY IF EXISTS org_select ON organizations;
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS org_update ON organizations;
CREATE POLICY org_update ON organizations FOR UPDATE
  USING (user_is_org_admin(id))
  WITH CHECK (user_is_org_admin(id));

-- users: self-row OR same-org rows visible; insert/update of self only
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (id = auth.uid() OR org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- org_memberships: own row + rows for orgs you're in
DROP POLICY IF EXISTS memberships_select ON org_memberships;
CREATE POLICY memberships_select ON org_memberships FOR SELECT
  USING (user_id = auth.uid() OR org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS memberships_admin_write ON org_memberships;
CREATE POLICY memberships_admin_write ON org_memberships FOR ALL
  USING (user_is_org_admin(org_id))
  WITH CHECK (user_is_org_admin(org_id));

-- org_invites: visible to org members; mutable only by site_admin
DROP POLICY IF EXISTS invites_select ON org_invites;
CREATE POLICY invites_select ON org_invites FOR SELECT
  USING (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS invites_admin_write ON org_invites;
CREATE POLICY invites_admin_write ON org_invites FOR ALL
  USING (user_is_org_admin(org_id))
  WITH CHECK (user_is_org_admin(org_id));

-- ─── 5. Hybrid (nullable org_id) tables ──────────────────────────────────────
-- NULL org_id = global library row, visible to everyone.
-- Writes: only allowed to authenticated users on their own org's rows.

-- vendor_categories
DROP POLICY IF EXISTS vc_select ON vendor_categories;
CREATE POLICY vc_select ON vendor_categories FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS vc_write ON vendor_categories;
CREATE POLICY vc_write ON vendor_categories FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- document_types
DROP POLICY IF EXISTS dt_select ON document_types;
CREATE POLICY dt_select ON document_types FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS dt_write ON document_types;
CREATE POLICY dt_write ON document_types FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- assessment_frameworks
DROP POLICY IF EXISTS af_select ON assessment_frameworks;
CREATE POLICY af_select ON assessment_frameworks FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS af_write ON assessment_frameworks;
CREATE POLICY af_write ON assessment_frameworks FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- assessment_framework_items (org_id nullable, mirrors framework scope)
DROP POLICY IF EXISTS afi_select ON assessment_framework_items;
CREATE POLICY afi_select ON assessment_framework_items FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS afi_write ON assessment_framework_items;
CREATE POLICY afi_write ON assessment_framework_items FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- category_framework_suggestions
DROP POLICY IF EXISTS cfs_select ON category_framework_suggestions;
CREATE POLICY cfs_select ON category_framework_suggestions FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS cfs_write ON category_framework_suggestions;
CREATE POLICY cfs_write ON category_framework_suggestions FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- universal_controls
DROP POLICY IF EXISTS uc_select ON universal_controls;
CREATE POLICY uc_select ON universal_controls FOR SELECT
  USING (org_id IS NULL OR org_id IN (SELECT user_org_ids()));
DROP POLICY IF EXISTS uc_write ON universal_controls;
CREATE POLICY uc_write ON universal_controls FOR ALL
  USING (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

-- compliance_framework_clauses (no org_id; gated through framework)
DROP POLICY IF EXISTS cfc_select ON compliance_framework_clauses;
CREATE POLICY cfc_select ON compliance_framework_clauses FOR SELECT
  USING (
    framework_id IN (
      SELECT id FROM assessment_frameworks
      WHERE org_id IS NULL OR org_id IN (SELECT user_org_ids())
    )
  );
DROP POLICY IF EXISTS cfc_write ON compliance_framework_clauses;
CREATE POLICY cfc_write ON compliance_framework_clauses FOR ALL
  USING (
    framework_id IN (
      SELECT id FROM assessment_frameworks WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    framework_id IN (
      SELECT id FROM assessment_frameworks WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- universal_control_clause_mappings — gated through parent universal_controls
DROP POLICY IF EXISTS uccm_select ON universal_control_clause_mappings;
CREATE POLICY uccm_select ON universal_control_clause_mappings FOR SELECT
  USING (
    universal_control_id IN (
      SELECT id FROM universal_controls
      WHERE org_id IS NULL OR org_id IN (SELECT user_org_ids())
    )
  );
DROP POLICY IF EXISTS uccm_write ON universal_control_clause_mappings;
CREATE POLICY uccm_write ON universal_control_clause_mappings FOR ALL
  USING (
    universal_control_id IN (
      SELECT id FROM universal_controls WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    universal_control_id IN (
      SELECT id FROM universal_controls WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- universal_control_framework_mappings — gated through parent universal_controls
DROP POLICY IF EXISTS ucfm_select ON universal_control_framework_mappings;
CREATE POLICY ucfm_select ON universal_control_framework_mappings FOR SELECT
  USING (
    universal_control_id IN (
      SELECT id FROM universal_controls
      WHERE org_id IS NULL OR org_id IN (SELECT user_org_ids())
    )
  );
DROP POLICY IF EXISTS ucfm_write ON universal_control_framework_mappings;
CREATE POLICY ucfm_write ON universal_control_framework_mappings FOR ALL
  USING (
    universal_control_id IN (
      SELECT id FROM universal_controls WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    universal_control_id IN (
      SELECT id FROM universal_controls WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- category_document_templates — gated through parent vendor_categories
DROP POLICY IF EXISTS cdt_select ON category_document_templates;
CREATE POLICY cdt_select ON category_document_templates FOR SELECT
  USING (
    category_id IN (
      SELECT id FROM vendor_categories
      WHERE org_id IS NULL OR org_id IN (SELECT user_org_ids())
    )
  );
DROP POLICY IF EXISTS cdt_write ON category_document_templates;
CREATE POLICY cdt_write ON category_document_templates FOR ALL
  USING (
    category_id IN (
      SELECT id FROM vendor_categories WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    category_id IN (
      SELECT id FROM vendor_categories WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- ─── 6. Strict tenant tables (org_id NOT NULL) ───────────────────────────────
-- Macro: SELECT/INSERT/UPDATE/DELETE all gated on org_id IN user_org_ids()

DO $$
DECLARE
  t text;
  strict_tables text[] := ARRAY[
    'vendors',
    'vendor_status_history',
    'vendor_documents',
    'vendor_document_versions',
    'vendor_document_verifications',
    'vendor_reviews',
    'vendor_disputes',
    'vendor_assessments',
    'assessment_items',
    'assessment_item_evidence',
    'assessment_findings',
    'assessment_mitigations',
    'assessment_reviews',
    'assessment_reports',
    'org_framework_selections',
    'alerts',
    'activity_log',
    'vendor_incidents',
    'vendor_news_settings',
    'vendor_news_events',
    'issues'
  ];
BEGIN
  FOREACH t IN ARRAY strict_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_all ON %I FOR ALL '
      'USING (org_id IN (SELECT user_org_ids())) '
      'WITH CHECK (org_id IN (SELECT user_org_ids()))',
      t, t
    );
  END LOOP;
END $$;

-- ─── 7. Joined-through-parent tables ─────────────────────────────────────────

-- assessment_framework_selections — gated through parent vendor_assessments
DROP POLICY IF EXISTS afs_tenant ON assessment_framework_selections;
CREATE POLICY afs_tenant ON assessment_framework_selections FOR ALL
  USING (
    assessment_id IN (
      SELECT id FROM vendor_assessments WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    assessment_id IN (
      SELECT id FROM vendor_assessments WHERE org_id IN (SELECT user_org_ids())
    )
  );

-- issue_controls — gated through parent issues
DROP POLICY IF EXISTS ic_tenant ON issue_controls;
CREATE POLICY ic_tenant ON issue_controls FOR ALL
  USING (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())))
  WITH CHECK (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())));

-- issue_evidence — gated through parent issues
DROP POLICY IF EXISTS ie_tenant ON issue_evidence;
CREATE POLICY ie_tenant ON issue_evidence FOR ALL
  USING (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())))
  WITH CHECK (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())));

-- issue_activity — gated through parent issues
DROP POLICY IF EXISTS ia_tenant ON issue_activity;
CREATE POLICY ia_tenant ON issue_activity FOR ALL
  USING (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())))
  WITH CHECK (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())));

-- issue_findings — gated through parent issues
DROP POLICY IF EXISTS if_tenant ON issue_findings;
CREATE POLICY if_tenant ON issue_findings FOR ALL
  USING (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())))
  WITH CHECK (issue_id IN (SELECT id FROM issues WHERE org_id IN (SELECT user_org_ids())));

-- ─── 8. Storage policies for vendor-documents bucket ─────────────────────────
-- File path format used by app: {orgId}/{vendorId}/{uuid}.{ext}
-- We gate on the first path segment (orgId).

-- Make the bucket private (no public reads). Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "vendor_docs_select_own_org"  ON storage.objects;
DROP POLICY IF EXISTS "vendor_docs_insert_own_org"  ON storage.objects;
DROP POLICY IF EXISTS "vendor_docs_update_own_org"  ON storage.objects;
DROP POLICY IF EXISTS "vendor_docs_delete_own_org"  ON storage.objects;

CREATE POLICY "vendor_docs_select_own_org"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "vendor_docs_insert_own_org"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "vendor_docs_update_own_org"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  )
  WITH CHECK (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

CREATE POLICY "vendor_docs_delete_own_org"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT user_org_ids())
  );

-- ============================================================
-- End of migration 017
-- ============================================================
