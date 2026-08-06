-- ================================================================
-- STAGING POST-INSTALL VERIFICATION
-- ================================================================
-- Target  : tqooyiyqsidbemzlcsfp (staging) ONLY
-- Returns : A result table with every check, status and detail.
--           RAISEs EXCEPTION if any check FAILs.
-- Safety  : Wrapped in BEGIN...ROLLBACK. No DROP/CREATE of schemas
--           or roles. No migration re-run.
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
  IF _c = 19 THEN
    INSERT INTO _vr VALUES (1,'1a: total tables','PASS','19 tables in public schema');
  ELSE
    INSERT INTO _vr VALUES (1,'1a: total tables','FAIL','expected 19, found '||_c);
  END IF;

  SELECT count(*) INTO _c FROM pg_tables
  WHERE schemaname='public' AND tablename != 'schema_migrations';
  IF _c = 18 THEN
    INSERT INTO _vr VALUES (1,'1b: app tables','PASS','18 application tables');
  ELSE
    INSERT INTO _vr VALUES (1,'1b: app tables','FAIL','expected 18, found '||_c);
  END IF;
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

  IF _off=0 AND _on=18 THEN
    INSERT INTO _vr VALUES (2,'2: RLS enabled','PASS','18/18 tables RLS enabled');
  ELSE
    INSERT INTO _vr VALUES (2,'2: RLS enabled','FAIL',format('on=%s off=%s',_on,_off));
  END IF;
END $$;

-- ================================================================
-- 3. POLICY INVENTORY
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_policies WHERE schemaname='public';
  IF _c=5 THEN
    INSERT INTO _vr VALUES (3,'3: policy count','PASS','5 policies');
  ELSE
    INSERT INTO _vr VALUES (3,'3: policy count','FAIL','expected 5, found '||_c);
  END IF;
END $$;

DO $$
DECLARE _pols TEXT[] := ARRAY[
  'guides_select_published','experiences_select_published',
  'destinations_select_published','users_select_own','users_update_own_name_avatar'];
  _p TEXT; _ok BOOLEAN;
BEGIN
  FOREACH _p IN ARRAY _pols LOOP
    SELECT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname=_p) INTO _ok;
    IF _ok THEN
      INSERT INTO _vr VALUES (3,'3: policy '||_p,'PASS','present');
    ELSE
      INSERT INTO _vr VALUES (3,'3: policy '||_p,'FAIL','missing');
    END IF;
  END LOOP;
END $$;

-- ================================================================
-- 4. SCHEMA_MIGRATIONS STRUCTURE
-- ================================================================
DO $$ DECLARE
  _col RECORD; _ok BOOLEAN := true; _t TEXT; _n TEXT;
  _pk_n INT; _pk_cols INT; _v_att SMALLINT; _bad INT;
BEGIN
  FOR _col IN SELECT * FROM (VALUES
    ('version','text','NO'),('name','text','NO'),
    ('applied_at','timestamp with time zone','NO'),('checksum','text','YES')
  ) AS t(cn, ct, nl) LOOP
    SELECT c.data_type, c.is_nullable INTO _t, _n
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name='schema_migrations' AND c.column_name=_col.cn;
    IF NOT FOUND THEN
      INSERT INTO _vr VALUES (4,'4: column '||_col.cn,'FAIL','missing');
      _ok := false;
    ELSIF _t!=_col.ct THEN
      INSERT INTO _vr VALUES (4,'4: '||_col.cn||' type','FAIL','expected '||_col.ct||', got '||_t);
      _ok := false;
    ELSIF _n!=_col.nl THEN
      INSERT INTO _vr VALUES (4,'4: '||_col.cn||' nullable','FAIL','expected '||_col.nl||', got '||_n);
      _ok := false;
    END IF;
  END LOOP;
  IF _ok THEN
    INSERT INTO _vr VALUES (4,'4: columns','PASS','version TEXT NOT NULL PK, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL, checksum TEXT');
  END IF;

  SELECT count(*) INTO _bad FROM information_schema.columns
  WHERE table_schema='public' AND table_name='schema_migrations'
    AND column_name NOT IN ('version','name','applied_at','checksum');
  IF _bad>0 THEN
    INSERT INTO _vr VALUES (4,'4: extra columns','FAIL',_bad||' unexpected columns');
  END IF;

  SELECT count(*) INTO _pk_n FROM pg_constraint
  WHERE conrelid='public.schema_migrations'::regclass AND contype='p';
  SELECT array_length(conkey,1) INTO _pk_cols FROM pg_constraint
  WHERE conrelid='public.schema_migrations'::regclass AND contype='p';
  SELECT attnum::smallint INTO _v_att FROM pg_attribute
  WHERE attrelid='public.schema_migrations'::regclass AND attname='version';

  IF _pk_n!=1 THEN
    INSERT INTO _vr VALUES (4,'4: PK count','FAIL','expected 1, found '||_pk_n);
  ELSIF _pk_cols!=1 THEN
    INSERT INTO _vr VALUES (4,'4: PK columns','FAIL','expected 1, found '||_pk_cols);
  ELSIF NOT EXISTS(SELECT 1 FROM pg_constraint
    WHERE conrelid='public.schema_migrations'::regclass AND contype='p'
      AND conkey=ARRAY[_v_att]::smallint[]) THEN
    INSERT INTO _vr VALUES (4,'4: PK column','FAIL','PK column is not (version)');
  ELSE
    INSERT INTO _vr VALUES (4,'4: PK','PASS','exactly (version)');
  END IF;

  SELECT count(*) INTO _bad FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='schema_migrations'
    AND grantee IN ('anon','authenticated','PUBLIC','service_role');
  IF _bad>0 THEN
    INSERT INTO _vr VALUES (4,'4: table grants','FAIL',_bad||' runtime-role table grants');
  ELSE
    INSERT INTO _vr VALUES (4,'4: table grants','PASS','zero runtime-role table grants');
  END IF;

  SELECT count(*) INTO _bad FROM information_schema.role_column_grants
  WHERE table_schema='public' AND table_name='schema_migrations'
    AND grantee IN ('anon','authenticated','PUBLIC','service_role');
  IF _bad>0 THEN
    INSERT INTO _vr VALUES (4,'4: column grants','FAIL',_bad||' runtime-role column grants');
  ELSE
    INSERT INTO _vr VALUES (4,'4: column grants','PASS','zero runtime-role column grants');
  END IF;
END $$;

-- ================================================================
-- 5. SCHEMA_MIGRATIONS HISTORY
-- ================================================================
DO $$
DECLARE _r RECORD; _e TEXT := '5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED';
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='0000') THEN
    INSERT INTO _vr VALUES (5,'5a: 0000','FAIL','not recorded');
  ELSE
    INSERT INTO _vr VALUES (5,'5a: 0000','PASS','recorded');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='003b') THEN
    INSERT INTO _vr VALUES (5,'5b: 003b','FAIL','not recorded');
  ELSE
    INSERT INTO _vr VALUES (5,'5b: 003b','PASS','recorded');
    SELECT checksum INTO _r FROM public.schema_migrations WHERE version='003b';
    IF _r.checksum = _e THEN
      INSERT INTO _vr VALUES (5,'5c: 003b checksum','PASS','matches canonical '||_e);
    ELSE
      INSERT INTO _vr VALUES (5,'5c: 003b checksum','FAIL','stored='||coalesce(_r.checksum,'NULL')||' expected='||_e);
    END IF;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version='004') THEN
    INSERT INTO _vr VALUES (5,'5d: 004','FAIL','not recorded');
  ELSE
    INSERT INTO _vr VALUES (5,'5d: 004','PASS','recorded');
  END IF;
END $$;

-- ================================================================
-- 6. FUNCTION OWNERSHIP
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace=n.oid JOIN pg_roles r ON p.proowner=r.oid
  WHERE n.nspname='public' AND p.prokind='f' AND r.rolname!='postgres';
  IF _c>0 THEN
    INSERT INTO _vr VALUES (6,'6: function ownership','FAIL',_c||' not owned by postgres');
  ELSE
    INSERT INTO _vr VALUES (6,'6: function ownership','PASS','all public functions owned by postgres');
  END IF;
END $$;

-- ================================================================
-- 7. EXECUTE GRANTS
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee='service_role'
    AND routine_name NOT IN ('claim_webhook_event','credit_referral_reward','credit_ambassador_commission');
  IF _c>0 THEN
    INSERT INTO _vr VALUES (7,'7a: service_role EXECUTE','FAIL',_c||' unexpected grants');
  ELSE
    INSERT INTO _vr VALUES (7,'7a: service_role EXECUTE','PASS','only 3 approved RPCs');
  END IF;

  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee IN ('PUBLIC','anon','authenticated');
  IF _c>0 THEN
    INSERT INTO _vr VALUES (7,'7b: client EXECUTE','FAIL',_c||' grants to PUBLIC/anon/authenticated');
  ELSE
    INSERT INTO _vr VALUES (7,'7b: client EXECUTE','PASS','zero grants to PUBLIC/anon/authenticated');
  END IF;

  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public'
    AND routine_name IN ('record_account_status_change','reject_terms_acceptance_update_delete')
    AND grantee NOT IN ('postgres');
  IF _c>0 THEN
    INSERT INTO _vr VALUES (7,'7c: trigger EXECUTE','FAIL',_c||' non-owner grants on trigger functions');
  ELSE
    INSERT INTO _vr VALUES (7,'7c: trigger EXECUTE','PASS','no non-owner grants on trigger functions');
  END IF;
END $$;

-- ================================================================
-- 8. DEFAULT ACLs
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='r' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=arwd/%postgres%';
  IF _c>=1 THEN
    INSERT INTO _vr VALUES (8,'8a: table defaults','PASS','service_role=arwd');
  ELSE
    INSERT INTO _vr VALUES (8,'8a: table defaults','FAIL','expected service_role=arwd');
  END IF;

  SELECT count(*) INTO _c FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE d.defaclobjtype='S' AND r.rolname='postgres'
    AND d.defaclnamespace='public'::regnamespace
    AND d.defaclacl::text LIKE '%service_role=rU/%postgres%';
  IF _c>=1 THEN
    INSERT INTO _vr VALUES (8,'8b: sequence defaults','PASS','service_role=rU');
  ELSE
    INSERT INTO _vr VALUES (8,'8b: sequence defaults','FAIL','expected service_role=rU');
  END IF;
END $$;

-- ================================================================
-- 9. ACCOUNT_STATUS_AUDIT
-- ================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='SELECT')
    AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name='account_status_audit' AND table_schema='public'
      AND grantee='service_role' AND privilege_type='INSERT') THEN
    INSERT INTO _vr VALUES (9,'9: audit table grants','PASS','service_role SELECT only');
  ELSE
    INSERT INTO _vr VALUES (9,'9: audit table grants','FAIL','unexpected grants on account_status_audit');
  END IF;
END $$;

-- ================================================================
-- 10. SEED ROW COUNTS
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM public.users;
  INSERT INTO _vr VALUES (10,'10a: users',CASE WHEN _c>=3 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=3 expected)');

  SELECT count(*) INTO _c FROM public.guides;
  INSERT INTO _vr VALUES (10,'10b: guides',CASE WHEN _c>=3 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=3 expected)');

  SELECT count(*) INTO _c FROM public.experiences WHERE is_published=true;
  INSERT INTO _vr VALUES (10,'10c: published experiences',CASE WHEN _c>=2 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=2 expected)');

  SELECT count(*) INTO _c FROM public.destinations WHERE is_published=true;
  INSERT INTO _vr VALUES (10,'10d: published destinations',CASE WHEN _c>=2 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=2 expected)');

  SELECT count(*) INTO _c FROM public.destination_charities;
  INSERT INTO _vr VALUES (10,'10e: destination_charities',CASE WHEN _c>=2 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=2 expected)');

  SELECT count(*) INTO _c FROM public.claims_registry
  WHERE approval_status='approved' AND publication_status='published';
  INSERT INTO _vr VALUES (10,'10f: published claims',CASE WHEN _c>=2 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=2 expected)');

  SELECT count(*) INTO _c FROM public.testimonials
  WHERE consent_status='granted' AND approval_status='approved' AND is_published=true;
  INSERT INTO _vr VALUES (10,'10g: published testimonials',CASE WHEN _c>=2 THEN 'PASS' ELSE 'FAIL' END,_c||' rows (>=2 expected)');

  SELECT count(*) INTO _c FROM public.posts;
  INSERT INTO _vr VALUES (10,'10h: posts','PASS',_c||' rows (0 or 1 acceptable)');
END $$;

-- ================================================================
-- 11. APPLICATION ACCESS CHECKS
-- ================================================================
DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.guides WHERE status='published'; RESET ROLE;
  IF _c>=2 THEN
    INSERT INTO _vr VALUES (11,'11a: anon guides SELECT','PASS',_c||' published guides');
  ELSE
    INSERT INTO _vr VALUES (11,'11a: anon guides SELECT','FAIL',_c||' rows');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11a: anon guides SELECT','FAIL',SQLERRM);
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE anon; SELECT count(*) INTO _c FROM public.experiences; RESET ROLE;
  IF _c>=2 THEN
    INSERT INTO _vr VALUES (11,'11b: anon experiences SELECT','PASS',_c||' rows via RLS');
  ELSE
    INSERT INTO _vr VALUES (11,'11b: anon experiences SELECT','FAIL',_c||' rows');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11b: anon experiences SELECT','FAIL',SQLERRM);
END $$;

DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.guide_applications; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11c: anon guide_apps','FAIL','should be denied');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11c: anon guide_apps','PASS','correctly denied');
END $$;

DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.account_status_audit; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11d: anon audit table','FAIL','should be denied');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11d: anon audit table','PASS','correctly denied');
END $$;

DO $$ BEGIN
  SET ROLE anon; PERFORM count(*) FROM public.platform_config; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11e: anon platform_config','FAIL','should be denied');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11e: anon platform_config','PASS','correctly denied');
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE service_role; SELECT count(*) INTO _c FROM public.platform_config; RESET ROLE;
  IF _c=1 THEN
    INSERT INTO _vr VALUES (11,'11f: service_role config','PASS','1 row');
  ELSE
    INSERT INTO _vr VALUES (11,'11f: service_role config','FAIL',_c||' rows');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11f: service_role config','FAIL',SQLERRM);
END $$;

DO $$ DECLARE _c INT; BEGIN
  SET ROLE service_role; SELECT count(*) INTO _c FROM public.account_status_audit; RESET ROLE;
  INSERT INTO _vr VALUES (11,'11g: service_role audit','PASS',_c||' rows');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO _vr VALUES (11,'11g: service_role audit','FAIL',SQLERRM);
END $$;

-- ================================================================
-- FINAL: output table, abort on failure, rollback
-- ================================================================
-- Display the results table (this is what Supabase SQL Editor shows)
SELECT section, check_name, status, detail FROM _vr ORDER BY section, check_name;

-- Abort if any check failed
DO $$ DECLARE _f INT;
BEGIN
  SELECT count(*) INTO _f FROM _vr WHERE status='FAIL';
  IF _f > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % check(s) did not pass. See result table above for details.', _f;
  END IF;
END $$;

ROLLBACK;
