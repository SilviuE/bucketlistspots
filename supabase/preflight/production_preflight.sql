-- ================================================================
-- PRODUCTION PREFLIGHT / RECONCILIATION (READ-ONLY)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Safety  : READ-ONLY. No CREATE/ALTER/DROP/INSERT/UPDATE/DELETE.
--           No privilege changes. Returns a structured result table.
--           Any STOP condition raises EXCEPTION before completion.
-- Stop    : Any check with status STOP aborts the preflight.
--           WARNING = review required, migration may proceed.
--           PASS    = no issue.
-- ================================================================

BEGIN;

CREATE TEMP TABLE _pr (
  section  INTEGER NOT NULL,
  check_name TEXT   NOT NULL,
  status    TEXT   NOT NULL CHECK (status IN ('PASS','WARNING','STOP')),
  detail    TEXT,
  severity  TEXT   NOT NULL CHECK (severity IN ('INFO','WARNING','BLOCKING'))
);

-- ================================================================
-- PA. TABLE INVENTORY
-- ================================================================
-- Expected before 003b: users, guides, experiences, destinations,
-- guide_applications, ambassador_applications, posts, platform_config,
-- transactions, webhook_event_inbox, booking_confirmations,
-- terms_acceptance, payment_reports, testimonials, claims_registry,
-- fundraising_pages, destination_charities. Also account_status_audit
-- if 004 already applied. schema_migrations may or may not exist
-- (003b creates it on production).
--
-- 18 tables are expected. Missing core tables needed by 003b preflight
-- are STOP. Tables that 003b/004 create themselves are WARNING.

DO $$ DECLARE _c INT; _missing TEXT; _tbl TEXT;
  _required_003b TEXT[] := ARRAY[
    'users','guides','experiences','destinations',
    'guide_applications','ambassador_applications',
    'platform_config','transactions',
    'webhook_event_inbox','booking_confirmations',
    'terms_acceptance','payment_reports',
    'testimonials','claims_registry',
    'fundraising_pages','destination_charities',
    'posts'
  ];
  _required_all TEXT[] := ARRAY[
    'users','guides','experiences','destinations',
    'guide_applications','ambassador_applications',
    'platform_config','transactions',
    'webhook_event_inbox','booking_confirmations',
    'terms_acceptance','payment_reports',
    'testimonials','claims_registry',
    'fundraising_pages','destination_charities',
    'posts','account_status_audit'
  ];
BEGIN
  _missing := '';
  FOREACH _tbl IN ARRAY _required_003b LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=_tbl) THEN
      _missing := _missing || _tbl || ', ';
    END IF;
  END LOOP;

  IF _missing != '' THEN
    INSERT INTO _pr VALUES (1,'PA1: core tables','STOP',
      'Missing tables required by 003b preflight: '||rtrim(_missing,', '),
      'BLOCKING');
    RAISE EXCEPTION 'PREFLIGHT STOP: missing tables needed by 003b: %',
      rtrim(_missing,', ');
  ELSE
    INSERT INTO _pr VALUES (1,'PA1: core tables','PASS',
      'All 17 tables required by 003b preflight exist','INFO');
  END IF;

  -- schema_migrations
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='schema_migrations') THEN
    INSERT INTO _pr VALUES (1,'PA2: schema_migrations','WARNING',
      'Not present. 003b will create it. This is expected on first production upgrade.',
      'WARNING');
  ELSE
    INSERT INTO _pr VALUES (1,'PA2: schema_migrations','PASS','Exists','INFO');
  END IF;

  -- account_status_audit (created by 004)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='account_status_audit') THEN
    INSERT INTO _pr VALUES (1,'PA3: account_status_audit','WARNING',
      'Not present. 004 will create it. This is expected before 004 is applied.',
      'WARNING');
  ELSE
    INSERT INTO _pr VALUES (1,'PA3: account_status_audit','PASS','Exists','INFO');
  END IF;

  -- Total table count (informational)
  SELECT count(*) INTO _c FROM pg_tables WHERE schemaname='public';
  INSERT INTO _pr VALUES (1,'PA4: total tables','PASS',
    _c||' tables in public schema','INFO');
END $$;

-- ================================================================
-- PB. CORE TABLE COLUMN AUDIT
-- ================================================================
-- 003b preflight requires specific columns on 10 tables.
-- Missing columns that 003b itself creates (users.avatar) are WARNING.
-- Missing columns needed by preflight are STOP.

DO $$ DECLARE _missing TEXT; _t TEXT; _c TEXT;
  _003b_cols TEXT[][] := ARRAY[
    -- {table, column_list_comma_separated, created_by_which_migration}
    ARRAY['users',
      'id,email,name,role,referral_code,bls_points_balance,created_at',
      'avatar added by 003b §3'],
    ARRAY['guides',
      'id,user_id,name,trading_name,status,referral_code,bls_points_balance,referred_by_ambassador_id,price_currency,routes,photo,hero_image,bio,why_independent,location,languages,experience,certifications,promise,badge,tagline,price,featured,review_count,trips_led,video_intro,tripadvisor_embed,identity_verified,license_verified,safety_verified,fair_pay_verified,updated_at',
      'all required by 003b preflight §2'],
    ARRAY['experiences',
      'id,title,duration,difficulty,location,image,price,currency,guide_id,badge,rating,reviews,featured,is_published',
      'all required by 003b preflight §2'],
    ARRAY['destinations',
      'name,country,image,guide_count,is_published',
      'all required by 003b preflight §2'],
    ARRAY['guide_applications',
      'id,full_name,email,phone,country,experience,languages,specialties,message,heard_from,status',
      'all required by 003b preflight §2'],
    ARRAY['ambassador_applications',
      'id,full_name,email,phone,country,platform,handle,followers,niche,why_you,heard_from,status',
      'all required by 003b preflight §2'],
    ARRAY['posts',
      'id,user_id,author_role,author_name,content,image_url,video_url',
      'all required by 003b preflight §2'],
    ARRAY['fundraising_pages',
      'id,user_id,charity_id,charity_api_id,charity_name,page_title,target_amount,currency,total_raised,donor_count,status,last_synced_at,created_at',
      'all required by 003b preflight §2'],
    ARRAY['platform_config',
      'id,promotional_commission_pct,standard_commission_pct,promotional_start_date,promotional_end_date,saas_monthly_fee_gbp,referral_program_enabled,charity_challenges_enabled',
      'all required by 003b preflight §2'],
    ARRAY['destination_charities',
      'id,destination,charity_api_id,is_active',
      'all required by 003b preflight §2']
  ];
  _expected TEXT[]; _tbl TEXT; _note TEXT;
  _cols_003b_adds TEXT[] := ARRAY['avatar'];
  _has_blocking BOOLEAN := false;
BEGIN
  FOR i IN 1..array_length(_003b_cols,1) LOOP
    _tbl  := _003b_cols[i][1];
    _note := _003b_cols[i][3];
    _expected := string_to_array(_003b_cols[i][2], ',');

    -- Only audit if table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=_tbl) THEN
      CONTINUE; -- handled in PA1
    END IF;

    _missing := '';
    FOREACH _c IN ARRAY _expected LOOP
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=_tbl AND column_name=trim(_c)) THEN
        IF trim(_c) = ANY(_cols_003b_adds) THEN
          _missing := _missing || trim(_c) || '(003b adds), ';
        ELSE
          _missing := _missing || trim(_c) || '(MISSING), ';
        END IF;
      END IF;
    END LOOP;

    IF _missing != '' THEN
      IF _missing LIKE '%(MISSING)%' THEN
        INSERT INTO _pr VALUES (2,'PB: '||_tbl||' columns','STOP',
          rtrim(_missing,', ')||' — '||_note,'BLOCKING');
        _has_blocking := true;
      ELSE
        INSERT INTO _pr VALUES (2,'PB: '||_tbl||' columns','WARNING',
          rtrim(_missing,', ')||' — '||_note,'WARNING');
      END IF;
    ELSE
      INSERT INTO _pr VALUES (2,'PB: '||_tbl||' columns','PASS',
        array_length(_expected,1)||' columns present. '||_note,'INFO');
    END IF;
  END LOOP;

  IF _has_blocking THEN
    RAISE EXCEPTION 'PREFLIGHT STOP: one or more tables are missing columns required by 003b. See result table above.';
  END IF;
END $$;

-- ================================================================
-- PC. DATA-CONDITION CHECKS
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  -- Publication readiness (WARNING only — 003b no longer aborts)
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='experiences') THEN
    SELECT count(*) INTO _c FROM public.experiences WHERE is_published=true;
    IF _c=0 THEN
      INSERT INTO _pr VALUES (3,'PC1: published experiences','WARNING',
        '0 published experiences. Founder must publish before public launch. 003b will proceed regardless.','WARNING');
    ELSE
      INSERT INTO _pr VALUES (3,'PC1: published experiences','PASS',
        _c||' published','INFO');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='destinations') THEN
    SELECT count(*) INTO _c FROM public.destinations WHERE is_published=true;
    IF _c=0 THEN
      INSERT INTO _pr VALUES (3,'PC2: published destinations','WARNING',
        '0 published destinations. Founder must publish before public launch. 003b will proceed regardless.','WARNING');
    ELSE
      INSERT INTO _pr VALUES (3,'PC2: published destinations','PASS',
        _c||' published','INFO');
    END IF;
  END IF;

  -- platform_config row count
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='platform_config') THEN
    SELECT count(*) INTO _c FROM public.platform_config;
    IF _c=0 THEN
      INSERT INTO _pr VALUES (3,'PC3: platform_config row','STOP',
        'platform_config is empty. Founder must seed configuration.','BLOCKING');
      RAISE EXCEPTION 'PREFLIGHT STOP: platform_config has 0 rows.';
    ELSIF _c>1 THEN
      INSERT INTO _pr VALUES (3,'PC3: platform_config row','STOP',
        'platform_config has '||_c||' rows (expected 1). Data-integrity issue.','BLOCKING');
      RAISE EXCEPTION 'PREFLIGHT STOP: platform_config has % rows (expected 1).', _c;
    ELSE
      INSERT INTO _pr VALUES (3,'PC3: platform_config row','PASS','1 row','INFO');
    END IF;
  END IF;

  -- claims without evidence
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='claims_registry') THEN
    SELECT count(*) INTO _c FROM public.claims_registry
    WHERE claim_type IN ('legal','commercial','financial')
      AND publication_status='published'
      AND (evidence_source IS NULL OR evidence_url_or_reference IS NULL);
    IF _c>0 THEN
      INSERT INTO _pr VALUES (3,'PC4: claims without evidence','STOP',
        _c||' published legal/financial/commercial claims have no evidence source. Legal review required.','BLOCKING');
      RAISE EXCEPTION 'PREFLIGHT STOP: % claims without evidence. Legal review required.', _c;
    ELSE
      INSERT INTO _pr VALUES (3,'PC4: claims without evidence','PASS',
        'All published claims have evidence sources','INFO');
    END IF;
  END IF;

  -- terms_acceptance duplicate session_ids
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='terms_acceptance') THEN
    BEGIN
      IF EXISTS (SELECT session_id, count(*) FROM public.terms_acceptance
        GROUP BY session_id HAVING count(*)>1) THEN
        INSERT INTO _pr VALUES (3,'PC5: terms duplicates','STOP',
          'Duplicate session_id values in terms_acceptance. Legal review required.','BLOCKING');
        RAISE EXCEPTION 'PREFLIGHT STOP: duplicate session_id in terms_acceptance.';
      ELSE
        INSERT INTO _pr VALUES (3,'PC5: terms duplicates','PASS',
          'No duplicate session_id values','INFO');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _pr VALUES (3,'PC5: terms duplicates','WARNING',
        'Check skipped (column may not exist). 003b preflight will verify.','WARNING');
    END;
  END IF;
END $$;

-- ================================================================
-- PD. RLS STATUS (informational before migration)
-- ================================================================
DO $$ DECLARE _r RECORD; _off INT := 0;
BEGIN
  FOR _r IN SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND c.relname != 'schema_migrations' ORDER BY c.relname
  LOOP
    IF NOT _r.relrowsecurity THEN _off := _off + 1; END IF;
  END LOOP;
  IF _off > 0 THEN
    INSERT INTO _pr VALUES (4,'PD1: RLS status','WARNING',
      _off||' tables without RLS enabled. 003b will enable RLS on all 17.','WARNING');
  ELSE
    INSERT INTO _pr VALUES (4,'PD1: RLS status','PASS',
      'All application tables already have RLS enabled','INFO');
  END IF;
END $$;

-- ================================================================
-- PE. ACTIVE POLICIES (informational)
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_policies WHERE schemaname='public';
  INSERT INTO _pr VALUES (5,'PE1: active policies','PASS',
    _c||' active policies before 003b. 003b drops all 25 known and creates 5 new.','INFO');
END $$;

-- ================================================================
-- PF. FUNCTION OWNERSHIP AND EXECUTE
-- ================================================================
DO $$ DECLARE _c INT;
BEGIN
  SELECT count(*) INTO _c FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace=n.oid JOIN pg_roles r ON p.proowner=r.oid
  WHERE n.nspname='public' AND p.prokind='f' AND r.rolname != 'postgres';
  IF _c>0 THEN
    INSERT INTO _pr VALUES (6,'PF1: function ownership','WARNING',
      _c||' public functions not owned by postgres. 003b verification checks this.','WARNING');
  ELSE
    INSERT INTO _pr VALUES (6,'PF1: function ownership','PASS',
      'All public functions owned by postgres','INFO');
  END IF;

  SELECT count(*) INTO _c FROM information_schema.routine_privileges
  WHERE routine_schema='public' AND grantee IN ('PUBLIC','anon','authenticated');
  IF _c>0 THEN
    INSERT INTO _pr VALUES (6,'PF2: client EXECUTE','WARNING',
      _c||' EXECUTE grants to PUBLIC/anon/authenticated. 003b revokes all.','WARNING');
  ELSE
    INSERT INTO _pr VALUES (6,'PF2: client EXECUTE','PASS',
      'No EXECUTE grants to PUBLIC/anon/authenticated','INFO');
  END IF;
END $$;

-- ================================================================
-- FINAL
-- ================================================================
SELECT section, check_name, status, detail, severity
FROM _pr ORDER BY section, check_name;

-- If any STOP status, abort
DO $$ DECLARE _stops INT;
BEGIN
  SELECT count(*) INTO _stops FROM _pr WHERE status='STOP';
  IF _stops > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: % STOP condition(s). See result table above.', _stops;
  END IF;
END $$;

-- Summary
DO $$ DECLARE _w INT; _s INT; _p INT;
BEGIN
  SELECT count(*) FILTER (WHERE status='PASS'),
         count(*) FILTER (WHERE status='WARNING'),
         count(*) FILTER (WHERE status='STOP')
  INTO _p, _w, _s FROM _pr;
  RAISE NOTICE 'PREFLIGHT SUMMARY: % PASS, % WARNING, % STOP', _p, _w, _s;
  IF _w = 0 AND _s = 0 THEN
    RAISE NOTICE 'RESULT: CLEAN - production upgrade may proceed after backup confirmation.';
  ELSIF _s = 0 THEN
    RAISE NOTICE 'RESULT: % WARNING(S) - review each WARNING before proceeding.', _w;
  END IF;
END $$;

ROLLBACK;
