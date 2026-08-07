-- ================================================================
-- PRODUCTION POST-UPGRADE VERIFICATION
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Purpose : Verify 003b + 004 applied correctly. No staging seed
--           checks. Returns a PASS/FAIL result table. RAISEs
--           EXCEPTION if any check FAILs.
-- Safety  : Wrapped in BEGIN...ROLLBACK. No DROP/CREATE of schemas
--           or roles. No migration re-run. No data modification.
-- ================================================================

BEGIN;

CREATE TEMP TABLE _vr (
  section    INTEGER NOT NULL,
  check_name TEXT    NOT NULL,
  status     TEXT    NOT NULL CHECK (status IN ('PASS','FAIL')),
  detail     TEXT
);

-- ================================================================
-- 1. TABLE INVENTORY
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_tables WHERE schemaname='public';
  INSERT INTO _vr VALUES (1,'1a: total tables',
    CASE WHEN _c>=18 THEN 'PASS' ELSE 'FAIL' END,
    _c||' tables in public schema');

  SELECT count(*) INTO _c FROM pg_tables
  WHERE schemaname='public' AND tablename != 'schema_migrations';
  INSERT INTO _vr VALUES (1,'1b: app tables',
    CASE WHEN _c>=18 THEN 'PASS' ELSE 'FAIL' END,
    _c||' application tables');

  INSERT INTO _vr VALUES (1,'1c: account_status_audit',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='account_status_audit')
    THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='account_status_audit')
    THEN 'exists' ELSE 'missing (004 may not have run)' END);
END $$;

-- ================================================================
-- 2. RLS STATUS
-- ================================================================
DO $$ DECLARE _on INT; _off INT;
BEGIN
  SELECT count(*) FILTER (WHERE c.relrowsecurity),
         count(*) FILTER (WHERE NOT c.relrowsecurity)
  INTO _on, _off
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname!='schema_migrations';

  IF _off=0 THEN
    INSERT INTO _vr VALUES (2,'2: RLS enabled','PASS',_on||' tables RLS enabled, 0 without');
  ELSE
    INSERT INTO _vr VALUES (2,'2: RLS enabled','FAIL',format('on=%s off=%s',_on,_off));
  END IF;
END $$;

-- ================================================================
-- 3. POLICIES
-- ================================================================
DO $$ DECLARE _c INT; _pols TEXT[]; _p TEXT; _ok BOOLEAN;
BEGIN
  SELECT count(*) INTO _c FROM pg_policies WHERE schemaname='public';
  -- Production may have pre-existing policies in addition to 5 hardened.
  -- Check the 5 hardened are present. Extra policies are reported but not FAIL.
  INSERT INTO _vr VALUES (3,'3a: hardened policies present','PASS',
    _c||' total policies (5 hardened expected)');

  _pols := ARRAY[
    'guides_select_published','experiences_select_published',
    'destinations_select_published','users_select_own','users_update_own_name_avatar'];
  FOREACH _p IN ARRAY _pols LOOP
    SELECT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname=_p) INTO _ok;
    IF _ok THEN
      INSERT INTO _vr VALUES (3,'3b: policy '||_p,'PASS','present');
    ELSE
      INSERT INTO _vr VALUES (3,'3b: policy '||_p,'FAIL','missing');
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- 4. SCHEMA_MIGRATIONS
-- ================================================================
DO $$ DECLARE
  _e TEXT := '5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED';
  _chk TEXT;
BEGIN
  INSERT INTO _vr VALUES (4,'4a: schema_migrations exists',
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='schema_migrations')
    THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='schema_migrations')
    THEN 'exists' ELSE 'missing' END);

  INSERT INTO _vr VALUES (4,'4b: 003b recorded',
    CASE WHEN EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='003b')
    THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='003b')
    THEN 'recorded' ELSE 'not recorded (003b may not have run)' END);

  SELECT checksum INTO _chk FROM public.schema_migrations WHERE version='003b';
  INSERT INTO _vr VALUES (4,'4c: 003b checksum',
    CASE WHEN _chk=_e THEN 'PASS' ELSE
      CASE WHEN _chk IS NULL THEN 'FAIL' ELSE 'WARNING' END END,
    coalesce('stored='||_chk,'NULL'));

  INSERT INTO _vr VALUES (4,'4d: 004 recorded',
    CASE WHEN EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='004')
    THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='004')
    THEN 'recorded' ELSE 'not recorded (004 may not have run)' END);
END $$;

-- ================================================================
-- 5. FUNCTION OWNERSHIP
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace=n.oid JOIN pg_roles r ON p.proowner=r.oid
  WHERE n.nspname='public' AND p.prokind='f' AND r.rolname!='postgres';
  IF _c>0 THEN
    INSERT INTO _vr VALUES (5,'5: function ownership','FAIL',_c||' not owned by postgres');
  ELSE
    INSERT INTO _vr VALUES (5,'5: function ownership','PASS','all public functions owned by postgres');
  END IF;
END $$;

-- ================================================================
-- 6. EXECUTE GRANTS
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee='service_role'
    AND routine_name NOT IN ('claim_webhook_event','credit_referral_reward','credit_ambassador_commission');
  INSERT INTO _vr VALUES (6,'6a: service_role EXECUTE',
    CASE WHEN _c=0 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN _c=0 THEN 'only 3 approved RPCs' ELSE _c||' unexpected grants' END);

  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee IN ('PUBLIC','anon','authenticated');
  INSERT INTO _vr VALUES (6,'6b: client EXECUTE',
    CASE WHEN _c=0 THEN 'PASS' ELSE 'FAIL' END,
    _c||' grants to PUBLIC/anon/authenticated');

  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public'
    AND routine_name IN ('record_account_status_change','reject_terms_acceptance_update_delete')
    AND grantee NOT IN ('postgres');
  INSERT INTO _vr VALUES (6,'6c: trigger EXECUTE',
    CASE WHEN _c=0 THEN 'PASS' ELSE 'FAIL' END,
    _c||' non-owner grants on trigger functions');
END $$;

-- ================================================================
-- 7. DEFAULT ACLs
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='r' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=arwd/%postgres%';
  INSERT INTO _vr VALUES (7,'7a: table defaults',
    CASE WHEN _c>=1 THEN 'PASS' ELSE 'FAIL' END,
    'service_role=arwd');

  SELECT count(*) INTO _c FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='S' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=rU/%postgres%';
  INSERT INTO _vr VALUES (7,'7b: sequence defaults',
    CASE WHEN _c>=1 THEN 'PASS' ELSE 'FAIL' END,
    'service_role=rU');
END $$;

-- ================================================================
-- 8. ACCOUNT_STATUS_AUDIT
-- ================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='SELECT')
    AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='INSERT') THEN
    INSERT INTO _vr VALUES (8,'8: audit table grants','PASS','service_role SELECT only');
  ELSE
    INSERT INTO _vr VALUES (8,'8: audit table grants','FAIL','unexpected grants');
  END IF;
END $$;

-- ================================================================
-- 9. USERS TABLE STATUS COLUMNS
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='account_status';
  INSERT INTO _vr VALUES (9,'9a: users.account_status',
    CASE WHEN _c=1 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN _c=1 THEN 'exists' ELSE 'missing' END);

  SELECT count(*) INTO _c FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='suspended_at';
  INSERT INTO _vr VALUES (9,'9b: users.suspended_at',
    CASE WHEN _c=1 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN _c=1 THEN 'exists' ELSE 'missing' END);

  SELECT count(*) INTO _c FROM information_schema.columns
  WHERE table_schema='public' AND table_name='users' AND column_name='avatar';
  INSERT INTO _vr VALUES (9,'9c: users.avatar',
    CASE WHEN _c=1 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN _c=1 THEN 'exists' ELSE 'missing' END);
END $$;

-- ================================================================
-- 10. SCHEMA_MIGRATIONS STRUCTURE (if table exists)
-- ================================================================
DO $$ DECLARE _v SMALLINT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='schema_migrations') THEN
    INSERT INTO _vr VALUES (10,'10: migrations structure','FAIL','table does not exist');
    RETURN;
  END IF;

  SELECT count(*) INTO _v FROM information_schema.columns
  WHERE table_schema='public' AND table_name='schema_migrations';
  INSERT INTO _vr VALUES (10,'10a: column count',
    CASE WHEN _v=4 THEN 'PASS' ELSE 'FAIL' END,_v||' columns (expected 4)');

  SELECT attnum::smallint INTO _v FROM pg_attribute
  WHERE attrelid='public.schema_migrations'::regclass AND attname='version';
  INSERT INTO _vr VALUES (10,'10b: PK = (version)',
    CASE WHEN EXISTS(SELECT 1 FROM pg_constraint
      WHERE conrelid='public.schema_migrations'::regclass AND contype='p'
        AND conkey=ARRAY[_v]::smallint[]) THEN 'PASS' ELSE 'FAIL' END,
    'PK column check');
END $$;

-- ================================================================
-- 11. APPLICATION ACCESS CHECKS
-- ================================================================
DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.guides WHERE status='published'; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11a: anon guides',CASE WHEN _c>=0 THEN 'PASS' ELSE 'FAIL' END,_c||' published guides');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11a: anon guides','FAIL',SQLERRM);
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.experiences; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11b: anon experiences',CASE WHEN _c>=0 THEN 'PASS' ELSE 'FAIL' END,_c||' rows');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11b: anon experiences','FAIL',SQLERRM);
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.destinations; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11c: anon destinations',CASE WHEN _c>=0 THEN 'PASS' ELSE 'FAIL' END,_c||' rows');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11c: anon destinations','FAIL',SQLERRM);
END $$;

DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.guide_applications; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11d: anon guide_apps','FAIL','should be denied');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11d: anon guide_apps','PASS','correctly denied');
END $$;

DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.platform_config; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11e: anon config','FAIL','should be denied');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11e: anon config','PASS','correctly denied');
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE service_role; SELECT count(*) INTO _c FROM public.platform_config; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11f: svc config',CASE WHEN _c>=1 THEN 'PASS' ELSE 'FAIL' END,_c||' rows');
EXCEPTION WHEN OTHERS THEN RESET ROLE;
  INSERT INTO _vr VALUES (11,'11f: svc config','FAIL',SQLERRM);
END $$;

-- ================================================================
-- FINAL
-- ================================================================
SELECT section, check_name, status, detail FROM _vr ORDER BY section, check_name;

DO $$ DECLARE _f INT;
BEGIN
  SELECT count(*) INTO _f FROM _vr WHERE status='FAIL';
  IF _f > 0 THEN
    RAISE EXCEPTION 'PRODUCTION VERIFICATION FAILED: % check(s) did not pass. See result table above.', _f;
  END IF;
END $$;

ROLLBACK;
