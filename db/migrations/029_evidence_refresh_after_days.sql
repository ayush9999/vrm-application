-- ─────────────────────────────────────────────────────────────────────────────
-- 029_evidence_refresh_after_days.sql
--
-- Add `refresh_after_days` to evidence_requirements so admins can mark
-- individual documents as needing periodic refresh (separate from hard
-- expiry). When set, an approved doc whose age exceeds the window is
-- treated as "stale" in the UI and can be re-requested without waiting
-- for the next scheduled pack review.
--
-- NULL = no refresh tracking (default, preserves existing behaviour).
-- Positive integer = doc should be re-uploaded after N days.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE evidence_requirements
  ADD COLUMN IF NOT EXISTS refresh_after_days integer
  CHECK (refresh_after_days IS NULL OR refresh_after_days > 0);

COMMENT ON COLUMN evidence_requirements.refresh_after_days IS
  'Soft refresh window in days. When set, an approved evidence document is flagged stale once (now - approved_at) exceeds this value. Distinct from hard expiry (expiry_applies + valid_until on the document).';
