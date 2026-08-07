-- ================================================================
-- P4: GUIDES COLUMN RECONCILIATION (production prerequisite)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Purpose : Add email and tagline to guides. Required before
--           003b_rls_privilege_hardening.sql preflight.
-- Types   : email  TEXT (nullable, no default, no index)
--           tagline TEXT (nullable, no default, no index)
--           Verified from 0000_core_schema.sql canonical CREATE
--           TABLE and 003b preflight column requirements.
-- Safety  : ADD COLUMN IF NOT EXISTS. Idempotent. No data impact.
-- ================================================================

BEGIN;

ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='guides'
      AND column_name='email' AND data_type='text') THEN
    RAISE EXCEPTION 'VERIFY FAILED: guides.email not present or wrong type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='guides'
      AND column_name='tagline' AND data_type='text') THEN
    RAISE EXCEPTION 'VERIFY FAILED: guides.tagline not present or wrong type';
  END IF;

  RAISE NOTICE 'P4 VERIFIED: guides.email (TEXT) and guides.tagline (TEXT) added.';
END $$;

COMMIT;
