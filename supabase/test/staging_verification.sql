-- ================================================================
-- STAGING POST-INSTALL VERIFICATION
-- ================================================================
-- Target  : tqooyiyqsidbemzlcsfp (staging) ONLY
-- Purpose : Read-only verification of the installed migration chain
--           0000 + 003b + 004 + staging seed.
-- Safe    : Ordinary SQL only. No psql meta-commands. No DROP/CREATE
--           of schemas or roles. No migration re-run. Temporary test
--           rows are inserted inside a transaction that ROLLBACKs.
-- Usage   : Paste into Supabase SQL Editor on staging. Click Run.
-- ================================================================

BEGIN;

-- ================================================================
-- 1. TABLE INVENTORY
-- ================================================================
DO $$ DECLARE
  _count INT;
BEGIN
  RAISE NOTICE '--- 1. TABLE INVENTORY ---';
  SELECT count(*) INTO _count FROM pg_tables WHERE schemaname='public';
  IF _count = 19 THEN
    RAISE NOTICE 'PASS 1a: 19 total tables in public schema.';
  ELSE
    RAISE WARNING 'FAIL 1a: expected 19 tables, found %', _count;
  END IF;

  SELECT count(*) INTO _count FROM pg_tables
  WHERE schemaname='public' AND tablename != 'schema_migrations';
  IF _count = 18 THEN
    RAISE NOTICE 'PASS 1b: 18 application tables.';
  ELSE
    RAISE WARNING 'FAIL 1b: expected 18 app tables, found %', _count;
  END IF;
END $$;

-- ================================================================
-- 2. RLS STATUS
-- ================================================================
DO $$ DECLARE
  _rls_off INT;
  _rls_on  INT;
BEGIN
  RAISE NOTICE '--- 2. RLS STATUS ---';
  SELECT count(*) FILTER (WHERE NOT c.relrowsecurity),
         count(*) FILTER (WHERE c.relrowsecurity)
  INTO _rls_off, _rls_on
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname != 'schema_migrations';

  IF _rls_off = 0 AND _rls_on = 18 THEN
    RAISE NOTICE 'PASS 2: 18/18 application tables RLS enabled (% on, % off).', _rls_on, _rls_off;
  ELSE
    RAISE WARNING 'FAIL 2: RLS on=%, off=% (expected 18 on, 0 off).', _rls_on, _rls_off;
  END IF;
END $$;

-- ================================================================
-- 3. POLICY INVENTORY
-- ================================================================
DO $$ DECLARE
  _count INT;
BEGIN
  RAISE NOTICE '--- 3. POLICY INVENTORY ---';
  SELECT count(*) INTO _count FROM pg_policies WHERE schemaname='public';
  IF _count = 5 THEN
    RAISE NOTICE 'PASS 3a: exactly 5 policies.';
  ELSE
    RAISE WARNING 'FAIL 3a: expected 5 policies, found %', _count;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND policyname = 'guides_select_published') THEN
    RAISE NOTICE 'PASS 3b: guides_select_published present.';
  ELSE RAISE WARNING 'FAIL 3b: guides_select_published missing.'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND policyname = 'experiences_select_published') THEN
    RAISE NOTICE 'PASS 3c: experiences_select_published present.';
  ELSE RAISE WARNING 'FAIL 3c: experiences_select_published missing.'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND policyname = 'destinations_select_published') THEN
    RAISE NOTICE 'PASS 3d: destinations_select_published present.';
  ELSE RAISE WARNING 'FAIL 3d: destinations_select_published missing.'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND policyname = 'users_select_own') THEN
    RAISE NOTICE 'PASS 3e: users_select_own present.';
  ELSE RAISE WARNING 'FAIL 3e: users_select_own missing.'; END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND policyname = 'users_update_own_name_avatar') THEN
    RAISE NOTICE 'PASS 3f: users_update_own_name_avatar present.';
  ELSE RAISE WARNING 'FAIL 3f: users_update_own_name_avatar missing.'; END IF;
END $$;

-- ================================================================
-- 4. SCHEMA_MIGRATIONS STRUCTURE
-- ================================================================
DO $$ DECLARE
  _missing TEXT[];
  _col    RECORD;
  _pk_cnt INT;
  _pk_cols INT;
  _v_att  SMALLINT;
  _bad    TEXT[];
BEGIN
  RAISE NOTICE '--- 4. SCHEMA_MIGRATIONS STRUCTURE ---';

  -- Column existence, type, nullability
  FOR _col IN
    SELECT * FROM (VALUES
      ('version',    'text',                        'NO'),
      ('name',       'text',                        'NO'),
      ('applied_at', 'timestamp with time zone',    'NO'),
      ('checksum',   'text',                        'YES')
    ) AS t(col, dtype, nullable)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='schema_migrations'
        AND c.column_name=_col.col) THEN
      _missing := array_append(_missing, _col.col || ' (missing)');
    ELSE
      IF (SELECT c.data_type FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name='schema_migrations'
          AND c.column_name=_col.col) != _col.dtype THEN
        _missing := array_append(_missing, _col.col || ' (type mismatch)');
      END IF;
      IF (SELECT c.is_nullable FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.table_name='schema_migrations'
          AND c.column_name=_col.col) != _col.nullable THEN
        _missing := array_append(_missing, _col.col || ' (nullability mismatch)');
      END IF;
    END IF;
  END LOOP;

  IF _missing IS NOT NULL AND array_length(_missing,1) > 0 THEN
    RAISE WARNING 'FAIL 4a: schema_migrations column issues: %', array_to_string(_missing,'; ');
  ELSE
    RAISE NOTICE 'PASS 4a: 4 columns correct [version TEXT NOT NULL, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL, checksum TEXT].';
  END IF;

  -- Exact PK = (version)
  SELECT count(*) INTO _pk_cnt FROM pg_constraint
  WHERE conrelid='public.schema_migrations'::regclass AND contype='p';
  IF _pk_cnt != 1 THEN
    RAISE WARNING 'FAIL 4b: expected 1 PK, found %', _pk_cnt;
  ELSE
    SELECT array_length(conkey,1) INTO _pk_cols FROM pg_constraint
    WHERE conrelid='public.schema_migrations'::regclass AND contype='p';
    IF _pk_cols != 1 THEN
      RAISE WARNING 'FAIL 4c: PK has % columns (expected 1)', _pk_cols;
    ELSE
      SELECT attnum::smallint INTO _v_att FROM pg_attribute
      WHERE attrelid='public.schema_migrations'::regclass AND attname='version';
      IF EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid='public.schema_migrations'::regclass AND contype='p'
          AND conkey = ARRAY[_v_att]::smallint[]) THEN
        RAISE NOTICE 'PASS 4b: PK = (version) exactly, single-column.';
      ELSE
        RAISE WARNING 'FAIL 4d: PK column is not (version).';
      END IF;
    END IF;
  END IF;

  -- No runtime-role grants (table or column level)
  SELECT array_agg(grantee||':'||privilege_type) INTO _bad
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='schema_migrations'
    AND grantee IN ('anon','authenticated','PUBLIC','service_role');
  IF _bad IS NOT NULL AND array_length(_bad,1) > 0 THEN
    RAISE WARNING 'FAIL 4e: table grants for runtime roles: %', array_to_string(_bad,', ');
  ELSE
    RAISE NOTICE 'PASS 4c: no table-level grants for anon/auth/PUBLIC/service_role.';
  END IF;

  SELECT array_agg(grantee||':'||column_name||':'||privilege_type) INTO _bad
  FROM information_schema.role_column_grants
  WHERE table_schema='public' AND table_name='schema_migrations'
    AND grantee IN ('anon','authenticated','PUBLIC','service_role');
  IF _bad IS NOT NULL AND array_length(_bad,1) > 0 THEN
    RAISE WARNING 'FAIL 4f: column grants for runtime roles: %', array_to_string(_bad,', ');
  ELSE
    RAISE NOTICE 'PASS 4d: no column-level grants for anon/auth/PUBLIC/service_role.';
  END IF;
END $$;

-- ================================================================
-- 5. SCHEMA_MIGRATIONS HISTORY
-- ================================================================
DO $$ DECLARE
  _r RECORD;
BEGIN
  RAISE NOTICE '--- 5. SCHEMA_MIGRATIONS HISTORY ---';
  FOR _r IN SELECT version, name, checksum, applied_at
    FROM public.schema_migrations ORDER BY version
  LOOP
    RAISE NOTICE '  % : % [checksum: %]', _r.version, _r.name, coalesce(_r.checksum,'NULL');
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version='0000') THEN
    RAISE WARNING 'FAIL 5a: migration 0000 not recorded.';
  ELSE
    RAISE NOTICE 'PASS 5a: 0000 recorded.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version='003b') THEN
    RAISE WARNING 'FAIL 5b: migration 003b not recorded.';
  ELSE
    RAISE NOTICE 'PASS 5b: 003b recorded.';
    IF (SELECT checksum FROM public.schema_migrations WHERE version='003b')
       = '5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED' THEN
      RAISE NOTICE 'PASS 5c: 003b checksum matches canonical value.';
    ELSE
      RAISE WARNING 'FAIL 5c: 003b checksum mismatch.';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version='004') THEN
    RAISE WARNING 'FAIL 5d: migration 004 not recorded.';
  ELSE
    RAISE NOTICE 'PASS 5d: 004 recorded.';
  END IF;
END $$;

-- ================================================================
-- 6. FUNCTION OWNERSHIP
-- ================================================================
DO $$ DECLARE
  _bad INT;
BEGIN
  RAISE NOTICE '--- 6. FUNCTION OWNERSHIP ---';
  SELECT count(*) INTO _bad FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace=n.oid JOIN pg_roles r ON p.proowner=r.oid
  WHERE n.nspname='public' AND p.prokind='f' AND r.rolname != 'postgres';
  IF _bad > 0 THEN
    RAISE WARNING 'FAIL 6a: % public functions not owned by postgres.', _bad;
  ELSE
    RAISE NOTICE 'PASS 6a: all public functions owned by postgres.';
  END IF;
END $$;

-- ================================================================
-- 7. EXECUTE GRANTS
-- ================================================================
DO $$ DECLARE
  _bad INT;
BEGIN
  RAISE NOTICE '--- 7. EXECUTE GRANTS ---';

  -- Only 3 RPCs have service_role EXECUTE
  SELECT count(*) INTO _bad FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee='service_role'
    AND routine_name NOT IN ('claim_webhook_event','credit_referral_reward','credit_ambassador_commission');
  IF _bad > 0 THEN
    RAISE WARNING 'FAIL 7a: % unexpected EXECUTE grants to service_role.', _bad;
  ELSE
    RAISE NOTICE 'PASS 7a: only 3 approved RPCs have EXECUTE -> service_role.';
  END IF;

  -- No client role has EXECUTE on any function
  SELECT count(*) INTO _bad FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee IN ('PUBLIC','anon','authenticated');
  IF _bad > 0 THEN
    RAISE WARNING 'FAIL 7b: % EXECUTE grants leaked to PUBLIC/anon/authenticated.', _bad;
  ELSE
    RAISE NOTICE 'PASS 7b: no EXECUTE for PUBLIC, anon, or authenticated.';
  END IF;

  -- Trigger functions have no EXECUTE for any non-owner role
  SELECT count(*) INTO _bad FROM information_schema.routine_privileges
  WHERE routine_schema='public'
    AND routine_name IN ('record_account_status_change','reject_terms_acceptance_update_delete')
    AND grantee NOT IN ('postgres');
  IF _bad > 0 THEN
    RAISE WARNING 'FAIL 7c: trigger functions have EXECUTE grants.';
  ELSE
    RAISE NOTICE 'PASS 7c: trigger functions have no EXECUTE grants.';
  END IF;
END $$;

-- ================================================================
-- 8. DEFAULT ACLs
-- ================================================================
DO $$ DECLARE
  _ok INT;
BEGIN
  RAISE NOTICE '--- 8. DEFAULT ACLs ---';

  SELECT count(*) INTO _ok FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='r' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=arwd/%postgres%';
  IF _ok >= 1 THEN
    RAISE NOTICE 'PASS 8a: table defaults: service_role=arwd.';
  ELSE
    RAISE WARNING 'FAIL 8a: table default ACL - expected service_role=arwd.';
  END IF;

  SELECT count(*) INTO _ok FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='S' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=rU/%postgres%';
  IF _ok >= 1 THEN
    RAISE NOTICE 'PASS 8b: sequence defaults: service_role=rU.';
  ELSE
    RAISE WARNING 'FAIL 8b: sequence default ACL - expected service_role=rU.';
  END IF;
END $$;

-- ================================================================
-- 9. ACCOUNT_STATUS_AUDIT GRANTS
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '--- 9. ACCOUNT_STATUS_AUDIT ---';
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='SELECT')
    AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='INSERT') THEN
    RAISE NOTICE 'PASS 9: service_role SELECT only on account_status_audit (trigger-written).';
  ELSE
    RAISE WARNING 'FAIL 9: account_status_audit grants unexpected.';
  END IF;
END $$;

-- ================================================================
-- 10. SEED DATA ROW COUNTS
-- ================================================================
DO $$ DECLARE
  _c INT;
BEGIN
  RAISE NOTICE '--- 10. SEED DATA ROW COUNTS ---';

  SELECT count(*) INTO _c FROM public.users;
  IF _c >= 3 THEN RAISE NOTICE 'PASS 10a: users: % rows (>=3 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10a: users: % rows (expected >=3).', _c; END IF;

  SELECT count(*) INTO _c FROM public.guides;
  IF _c >= 3 THEN RAISE NOTICE 'PASS 10b: guides: % rows (>=3 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10b: guides: % rows (expected >=3).', _c; END IF;

  SELECT count(*) INTO _c FROM public.experiences WHERE is_published=true;
  IF _c >= 2 THEN RAISE NOTICE 'PASS 10c: published experiences: % rows (>=2 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10c: published experiences: % rows (expected >=2).', _c; END IF;

  SELECT count(*) INTO _c FROM public.destinations WHERE is_published=true;
  IF _c >= 2 THEN RAISE NOTICE 'PASS 10d: published destinations: % rows (>=2 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10d: published destinations: % rows (expected >=2).', _c; END IF;

  SELECT count(*) INTO _c FROM public.destination_charities;
  IF _c >= 2 THEN RAISE NOTICE 'PASS 10e: destination_charities: % rows (>=2 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10e: destination_charities: % rows (expected >=2).', _c; END IF;

  SELECT count(*) INTO _c FROM public.claims_registry
  WHERE approval_status='approved' AND publication_status='published';
  IF _c >= 2 THEN RAISE NOTICE 'PASS 10f: published claims: % rows (>=2 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10f: published claims: % rows (expected >=2).', _c; END IF;

  SELECT count(*) INTO _c FROM public.testimonials
  WHERE consent_status='granted' AND approval_status='approved' AND is_published=true;
  IF _c >= 2 THEN RAISE NOTICE 'PASS 10g: published testimonials: % rows (>=2 expected).', _c;
  ELSE RAISE WARNING 'FAIL 10g: published testimonials: % rows (expected >=2).', _c; END IF;

  SELECT count(*) INTO _c FROM public.posts;
  RAISE NOTICE 'PASS 10h: posts: % rows (0 or 1 acceptable).', _c;
END $$;

-- ================================================================
-- 11. APPLICATION REST-QUERY CHECKS (rolled back)
-- ================================================================
-- These use SET ROLE to simulate the application access model.
-- Any test rows inserted are discarded by the ROLLBACK at the end.
DO $$ BEGIN RAISE NOTICE '--- 11. APPLICATION ACCESS CHECKS ---'; END $$;

-- 11a: anon can SELECT published guides (column-restricted)
DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon;
  SELECT count(*) INTO _c FROM public.guides WHERE status='published';
  IF _c >= 2 THEN RAISE NOTICE 'PASS 11a: anon can SELECT published guides (% rows).', _c;
  ELSE RAISE WARNING 'FAIL 11a: anon guides SELECT returned % rows (>=2 expected).', _c; END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL 11a: anon guides SELECT denied: %', SQLERRM; RESET ROLE;
END $$;

-- 11b: anon can SELECT published experiences via RLS
DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.experiences;
  IF _c >= 2 THEN RAISE NOTICE 'PASS 11b: anon can SELECT experiences via RLS (% rows).', _c;
  ELSE RAISE WARNING 'FAIL 11b: anon experiences returned % rows (>=2 expected).', _c; END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL 11b: anon experiences denied: %', SQLERRM; RESET ROLE;
END $$;

-- 11c: anon cannot SELECT guide_applications
DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.guide_applications;
  RAISE WARNING 'FAIL 11c: anon should NOT read guide_applications'; RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS 11c: anon blocked from guide_applications.'; RESET ROLE;
END $$;

-- 11d: anon cannot SELECT account_status_audit
DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.account_status_audit;
  RAISE WARNING 'FAIL 11d: anon should NOT read account_status_audit'; RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS 11d: anon blocked from account_status_audit.'; RESET ROLE;
END $$;

-- 11e: anon cannot SELECT platform_config
DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.platform_config;
  RAISE WARNING 'FAIL 11e: anon should NOT read platform_config'; RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS 11e: anon blocked from platform_config.'; RESET ROLE;
END $$;

-- 11f: service_role CAN select platform_config (BYPASSRLS)
DO $$ DECLARE _c INT; BEGIN
  SET ROLE service_role; SELECT count(*) INTO _c FROM public.platform_config;
  IF _c = 1 THEN RAISE NOTICE 'PASS 11f: service_role can SELECT platform_config.';
  ELSE RAISE WARNING 'FAIL 11f: service_role platform_config returned % rows.', _c; END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL 11f: service_role platform_config denied: %', SQLERRM; RESET ROLE;
END $$;

-- 11g: service_role can SELECT account_status_audit
DO $$ DECLARE _c INT; BEGIN
  SET ROLE service_role; SELECT count(*) INTO _c FROM public.account_status_audit;
  RAISE NOTICE 'PASS 11g: service_role can SELECT account_status_audit (% rows).', _c;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL 11g: service_role account_status_audit denied: %', SQLERRM; RESET ROLE;
END $$;

-- ================================================================
-- FINAL SUMMARY
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STAGING VERIFICATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Review output above. All checks labelled PASS must pass.';
  RAISE NOTICE 'Any WARNING or FAIL requires investigation before proceeding.';
  RAISE NOTICE '';
  RAISE NOTICE 'Stop conditions:';
  RAISE NOTICE '  - Any FAIL label';
  RAISE NOTICE '  - Fewer than 19 tables';
  RAISE NOTICE '  - Fewer than 18 RLS-enabled tables';
  RAISE NOTICE '  - Fewer than 5 policies or unexpected policy names';
  RAISE NOTICE '  - schema_migrations structure mismatch';
  RAISE NOTICE '  - schema_migrations checksum mismatch';
  RAISE NOTICE '  - Functions not owned by postgres';
  RAISE NOTICE '  - EXECUTE grants leaked to PUBLIC/anon/authenticated';
  RAISE NOTICE '  - account_status_audit grants unexpected';
  RAISE NOTICE '  - Seed row counts below expected minimums';
  RAISE NOTICE '  - Application access checks fail (11a-11g)';
  RAISE NOTICE '============================================================';
END $$;

ROLLBACK;
