-- ================================================================
-- 006: GUIDES AGENCY PRICE COLUMN-LEVEL SELECT PRIVILEGES
-- ================================================================
-- Purpose : Grant SELECT on guides.agency_price to anon and
--           authenticated so the agency-price comparison feature
--           renders on public guide cards.
-- Context : 003b narrowed column grants to a fixed allowlist.
--           agency_price was added later (005) and therefore
--           not included in the original grants.
-- Safety  : Column-level SELECT only. No INSERT/UPDATE/DELETE.
--           No policy changes. No PUBLIC grants. Transactional.
-- ================================================================

BEGIN;

-- ── Preflight ─────────────────────────────────────────────────────
DO $$
DECLARE
  _dtype TEXT;
  _rls   BOOLEAN;
  _pol   BOOLEAN;
BEGIN
  -- Column must exist with numeric-compatible type
  SELECT data_type INTO _dtype
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'guides'
    AND column_name = 'agency_price';

  IF NOT FOUND THEN
    RAISE EXCEPTION '006 ABORT: guides.agency_price does not exist. Run 005 first.';
  END IF;

  IF _dtype NOT IN ('integer', 'numeric', 'bigint', 'smallint', 'real', 'double precision') THEN
    RAISE EXCEPTION '006 ABORT: guides.agency_price has type % (expected numeric).', _dtype;
  END IF;

  -- RLS must be enabled on guides
  SELECT relrowsecurity INTO _rls
  FROM pg_class WHERE relname = 'guides' AND relnamespace = 'public'::regnamespace;

  IF NOT _rls THEN
    RAISE EXCEPTION '006 ABORT: RLS is not enabled on public.guides.';
  END IF;

  -- Hardened policy must exist
  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guides'
      AND policyname = 'guides_select_published'
  ) INTO _pol;

  IF NOT _pol THEN
    RAISE EXCEPTION '006 ABORT: hardened policy guides_select_published not found. Run 003b first.';
  END IF;

  RAISE NOTICE '006 preflight: agency_price exists (%), RLS enabled, guides_select_published present.', _dtype;
END $$;

-- ── Grant column-level SELECT ────────────────────────────────────
GRANT SELECT (agency_price) ON public.guides TO anon;
GRANT SELECT (agency_price) ON public.guides TO authenticated;

-- Belt-and-braces: ensure no write privileges leaked
REVOKE INSERT (agency_price), UPDATE (agency_price) ON public.guides FROM anon;
REVOKE INSERT (agency_price), UPDATE (agency_price) ON public.guides FROM authenticated;
REVOKE INSERT (agency_price), UPDATE (agency_price) ON public.guides FROM PUBLIC;

-- ── Post-verification ────────────────────────────────────────────
DO $$
DECLARE
  _ok BOOLEAN := true;
  _bad TEXT;
BEGIN
  -- anon: SELECT yes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_column_grants
    WHERE grantee = 'anon' AND table_name = 'guides' AND table_schema = 'public'
      AND column_name = 'agency_price' AND privilege_type = 'SELECT'
  ) THEN
    RAISE WARNING '006 VERIFY: anon missing SELECT on guides.agency_price';
    _ok := false;
  END IF;

  -- authenticated: SELECT yes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_column_grants
    WHERE grantee = 'authenticated' AND table_name = 'guides' AND table_schema = 'public'
      AND column_name = 'agency_price' AND privilege_type = 'SELECT'
  ) THEN
    RAISE WARNING '006 VERIFY: authenticated missing SELECT on guides.agency_price';
    _ok := false;
  END IF;

  -- No INSERT granted to anon/authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.role_column_grants
    WHERE grantee IN ('anon', 'authenticated') AND table_name = 'guides' AND table_schema = 'public'
      AND column_name = 'agency_price' AND privilege_type = 'INSERT'
  ) THEN
    RAISE WARNING '006 VERIFY: INSERT on agency_price leaked to anon/authenticated';
    _ok := false;
  END IF;

  -- No UPDATE granted to anon/authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.role_column_grants
    WHERE grantee IN ('anon', 'authenticated') AND table_name = 'guides' AND table_schema = 'public'
      AND column_name = 'agency_price' AND privilege_type = 'UPDATE'
  ) THEN
    RAISE WARNING '006 VERIFY: UPDATE on agency_price leaked to anon/authenticated';
    _ok := false;
  END IF;

  IF _ok THEN
    RAISE NOTICE '006 VERIFIED: anon + authenticated have SELECT on guides.agency_price. No write privileges.';
  ELSE
    RAISE EXCEPTION '006 VERIFY FAILED: one or more privilege checks did not pass.';
  END IF;
END $$;

COMMIT;
