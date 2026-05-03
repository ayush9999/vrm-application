-- 030_evidence_requests.sql
-- Adds first-class "evidence request" entities — outbound asks to a vendor
-- for a subset of their evidence requirements, with lifecycle tracking.
--
-- Differs from vendor_portal_links (which scope to a whole pack): an
-- evidence_request scopes to N specific vendor_documents rows, with per-item
-- reply tracking, due dates, and message context preserved as audit trail.

-- ─── evidence_requests ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE evidence_request_status AS ENUM (
    'sent',
    'partially_replied',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS evidence_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  vendor_id           uuid NOT NULL REFERENCES vendors(id)        ON DELETE CASCADE,
  created_by_user_id  uuid          REFERENCES users(id)          ON DELETE SET NULL,

  -- Authoring
  message             text,
  due_date            date,
  recipient_emails    text[]    NOT NULL DEFAULT '{}',

  -- Portal access
  token               text      NOT NULL UNIQUE,
  expires_at          timestamptz NOT NULL,

  -- Lifecycle
  status              evidence_request_status NOT NULL DEFAULT 'sent',
  sent_at             timestamptz NOT NULL DEFAULT now(),
  first_opened_at     timestamptz,
  last_accessed_at    timestamptz,
  access_count        integer    NOT NULL DEFAULT 0,
  completed_at        timestamptz,
  cancelled_at        timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_evidence_requests_vendor
  ON evidence_requests (vendor_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_requests_org_status
  ON evidence_requests (org_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_requests_token
  ON evidence_requests (token);

-- ─── evidence_request_items ──────────────────────────────────────────────────
-- Each request has N items. Same vendor_document can appear in multiple
-- historical requests (re-asking for an updated upload), so the unique
-- constraint is only within a single request.

DO $$ BEGIN
  CREATE TYPE evidence_request_item_status AS ENUM (
    'pending',
    'replied'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS evidence_request_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_request_id uuid NOT NULL REFERENCES evidence_requests(id) ON DELETE CASCADE,
  vendor_document_id  uuid NOT NULL REFERENCES vendor_documents(id)  ON DELETE CASCADE,
  status              evidence_request_item_status NOT NULL DEFAULT 'pending',
  replied_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (evidence_request_id, vendor_document_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_request_items_request
  ON evidence_request_items (evidence_request_id);

CREATE INDEX IF NOT EXISTS idx_evidence_request_items_doc_pending
  ON evidence_request_items (vendor_document_id)
  WHERE status = 'pending';

-- ─── RLS + grants ────────────────────────────────────────────────────────────
-- Tenant-scope on evidence_requests via org_id; evidence_request_items inherits
-- via the parent request's org_id.

ALTER TABLE evidence_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_requests_tenant ON evidence_requests;
CREATE POLICY evidence_requests_tenant ON evidence_requests FOR ALL
  USING      (org_id IN (SELECT user_org_ids()))
  WITH CHECK (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS evidence_request_items_tenant ON evidence_request_items;
CREATE POLICY evidence_request_items_tenant ON evidence_request_items FOR ALL
  USING (
    evidence_request_id IN (
      SELECT id FROM evidence_requests WHERE org_id IN (SELECT user_org_ids())
    )
  )
  WITH CHECK (
    evidence_request_id IN (
      SELECT id FROM evidence_requests WHERE org_id IN (SELECT user_org_ids())
    )
  );

GRANT ALL ON evidence_requests      TO authenticated;
GRANT ALL ON evidence_request_items TO authenticated;
