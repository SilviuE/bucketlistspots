-- ================================================================
-- P3: ADD PUBLICATION COLUMNS (production prerequisite)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Purpose : Add is_published to experiences and destinations.
--           Required before 003b_rls_privilege_hardening.sql.
-- Safety  : ADD COLUMN IF NOT EXISTS. Existing rows default to
--           false (not publicly visible). No RLS changes.
--           Idempotent. No backfill (separate founder task).
-- Commit  : 003a_publication_columns.sql adapted for production.
-- ================================================================

BEGIN;

-- experiences.is_published
ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

-- destinations.is_published
ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

-- Verification
DO $$
DECLARE
  _ok BOOLEAN := true;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='experiences' AND column_name='is_published'
      AND is_nullable='NO' AND data_type='boolean') THEN
    RAISE EXCEPTION 'VERIFY FAILED: experiences.is_published not present or wrong type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='destinations' AND column_name='is_published'
      AND is_nullable='NO' AND data_type='boolean') THEN
    RAISE EXCEPTION 'VERIFY FAILED: destinations.is_published not present or wrong type';
  END IF;

  RAISE NOTICE 'P3 VERIFIED: is_published columns added to experiences and destinations.';
END $$;

COMMIT;
