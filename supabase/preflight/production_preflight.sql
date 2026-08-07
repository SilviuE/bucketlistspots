-- ================================================================
-- PRODUCTION PREFLIGHT / RECONCILIATION (STRICTLY READ-ONLY)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Safety  : ZERO writes. Pure SELECT. No temp objects.
-- Guarantee: Every defined check always returns exactly one row.
--           Absence of inspected objects produces PASS, WARNING or
--           STOP — never suppresses the row.
-- Gate    : Verifies all 17 required tables exist BEFORE the SELECT
--           is parsed. If any are absent, raises an exception with
--           the list of missing tables. This prevents parse errors
--           on direct table references later in the CTEs.
-- ================================================================

-- Verify required tables exist before parsing the SELECT
DO $$ DECLARE
  _missing TEXT := '';
  _tbl TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'users','guides','experiences','destinations',
    'guide_applications','ambassador_applications',
    'platform_config','transactions',
    'webhook_event_inbox','booking_confirmations',
    'terms_acceptance','payment_reports',
    'testimonials','claims_registry',
    'fundraising_pages','destination_charities',
    'posts'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=_tbl) THEN
      _missing := _missing || _tbl || ', ';
    END IF;
  END LOOP;

  IF _missing != '' THEN
    RAISE EXCEPTION 'PREFLIGHT STOP: required table(s) missing: %'
      '  Prerequisites before 003b:'
      '    webhook_event_inbox, booking_confirmations -> 002_webhook_infrastructure_upgrade.sql'
      '    terms_acceptance -> terms_acceptance.sql'
      '  See supabase/runbooks/production_upgrade.md for the full chain.',
      rtrim(_missing, ', ');
  END IF;
END $$;

WITH

-- ── Scalar values (each returns exactly 1 row) ───────────────────

scalars AS (
  SELECT
    -- PA: table existence
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='users') AS has_users,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='guides') AS has_guides,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='experiences') AS has_experiences,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='destinations') AS has_destinations,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='guide_applications') AS has_guide_apps,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='ambassador_applications') AS has_amb_apps,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='platform_config') AS has_platform_config,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='transactions') AS has_transactions,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='webhook_event_inbox') AS has_webhook,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='booking_confirmations') AS has_bookings,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='terms_acceptance') AS has_terms,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='payment_reports') AS has_payments,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='testimonials') AS has_testimonials,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='claims_registry') AS has_claims,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='fundraising_pages') AS has_fundraising,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='destination_charities') AS has_charities,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='posts') AS has_posts,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='schema_migrations') AS has_sm,
    (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name='account_status_audit') AS has_audit,
    (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS total_tables,

    -- PB: column existence counts (scalar values)
    (SELECT count(*) FROM (VALUES
      ('users','id'),('users','email'),('users','name'),('users','role'),
      ('users','referral_code'),('users','bls_points_balance'),('users','created_at')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_users_baseline,

    (SELECT count(*) FROM (VALUES
      ('users','avatar')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_users_003b_adds,

    (SELECT count(*) FROM (VALUES
      ('guides','id'),('guides','user_id'),('guides','name'),('guides','trading_name'),
      ('guides','email'),('guides','status'),('guides','referral_code'),
      ('guides','bls_points_balance'),('guides','referred_by_ambassador_id'),
      ('guides','price_currency'),('guides','routes'),('guides','photo'),
      ('guides','hero_image'),('guides','bio'),('guides','why_independent'),
      ('guides','location'),('guides','languages'),('guides','experience'),
      ('guides','certifications'),('guides','promise'),('guides','badge'),
      ('guides','tagline'),('guides','price'),('guides','featured'),
      ('guides','review_count'),('guides','trips_led'),('guides','video_intro'),
      ('guides','tripadvisor_embed'),('guides','identity_verified'),
      ('guides','license_verified'),('guides','safety_verified'),
      ('guides','fair_pay_verified'),('guides','updated_at')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_guides,

    (SELECT count(*) FROM (VALUES
      ('experiences','id'),('experiences','title'),('experiences','duration'),
      ('experiences','difficulty'),('experiences','location'),('experiences','image'),
      ('experiences','price'),('experiences','currency'),('experiences','guide_id'),
      ('experiences','badge'),('experiences','rating'),('experiences','reviews'),
      ('experiences','featured'),('experiences','is_published')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_experiences,

    (SELECT count(*) FROM (VALUES
      ('destinations','name'),('destinations','country'),('destinations','image'),
      ('destinations','guide_count'),('destinations','is_published')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_destinations,

    (SELECT count(*) FROM (VALUES
      ('guide_applications','id'),('guide_applications','full_name'),
      ('guide_applications','email'),('guide_applications','phone'),
      ('guide_applications','country'),('guide_applications','experience'),
      ('guide_applications','languages'),('guide_applications','specialties'),
      ('guide_applications','message'),('guide_applications','heard_from'),
      ('guide_applications','status')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_guide_apps,

    (SELECT count(*) FROM (VALUES
      ('ambassador_applications','id'),('ambassador_applications','full_name'),
      ('ambassador_applications','email'),('ambassador_applications','phone'),
      ('ambassador_applications','country'),('ambassador_applications','platform'),
      ('ambassador_applications','handle'),('ambassador_applications','followers'),
      ('ambassador_applications','niche'),('ambassador_applications','why_you'),
      ('ambassador_applications','heard_from'),('ambassador_applications','status')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_amb_apps,

    (SELECT count(*) FROM (VALUES
      ('posts','id'),('posts','user_id'),('posts','author_role'),
      ('posts','author_name'),('posts','content'),('posts','image_url'),
      ('posts','video_url')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_posts,

    (SELECT count(*) FROM (VALUES
      ('fundraising_pages','id'),('fundraising_pages','user_id'),
      ('fundraising_pages','charity_id'),('fundraising_pages','charity_api_id'),
      ('fundraising_pages','charity_name'),('fundraising_pages','page_title'),
      ('fundraising_pages','target_amount'),('fundraising_pages','currency'),
      ('fundraising_pages','total_raised'),('fundraising_pages','donor_count'),
      ('fundraising_pages','status'),('fundraising_pages','last_synced_at'),
      ('fundraising_pages','created_at')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_fundraising,

    (SELECT count(*) FROM (VALUES
      ('platform_config','id'),('platform_config','promotional_commission_pct'),
      ('platform_config','standard_commission_pct'),
      ('platform_config','promotional_start_date'),
      ('platform_config','promotional_end_date'),
      ('platform_config','saas_monthly_fee_gbp'),
      ('platform_config','referral_program_enabled'),
      ('platform_config','charity_challenges_enabled')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_config,

    (SELECT count(*) FROM (VALUES
      ('destination_charities','id'),('destination_charities','destination'),
      ('destination_charities','charity_api_id'),('destination_charities','is_active')
    ) AS c(tbl,col) WHERE EXISTS(SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=c.tbl)
      AND NOT EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
    ) AS missing_charities,

    -- PC: data condition (to_jsonb avoids parse errors on absent columns)
    COALESCE((SELECT count(*) FROM public.experiences e
      WHERE (to_jsonb(e)->>'is_published')::boolean = true), 0) AS pub_experiences,
    COALESCE((SELECT count(*) FROM public.destinations d
      WHERE (to_jsonb(d)->>'is_published')::boolean = true), 0) AS pub_destinations,
    COALESCE((SELECT count(*) FROM public.platform_config), 0) AS platform_rows,
    COALESCE((SELECT count(*) FROM public.claims_registry c
      WHERE (to_jsonb(c)->>'claim_type') IN ('legal','commercial','financial')
        AND (to_jsonb(c)->>'publication_status') = 'published'
        AND ((to_jsonb(c)->>'evidence_source') IS NULL
          OR (to_jsonb(c)->>'evidence_url_or_reference') IS NULL)), 0) AS claims_no_evidence,
    COALESCE((SELECT count(*) FROM (
      SELECT (to_jsonb(t)->>'session_id') AS sid FROM public.terms_acceptance t
    ) sub GROUP BY sid HAVING count(*) > 1), 0) AS terms_duplicates,

    -- PD: RLS
    COALESCE((SELECT count(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname != 'schema_migrations' AND NOT c.relrowsecurity), 0) AS rls_off,

    -- PE: policies
    COALESCE((SELECT count(*) FROM pg_policies WHERE schemaname = 'public'), 0) AS policy_count,

    -- PF: functions
    COALESCE((SELECT count(*) FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_roles r ON p.proowner = r.oid
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND r.rolname != 'postgres'), 0) AS func_not_postgres,
    COALESCE((SELECT count(*) FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND grantee IN ('PUBLIC','anon','authenticated')), 0) AS client_execute
),

-- ── Computed check results (one row per check, unconditional) ───

results AS (
  -- PA1: core tables
  SELECT 1 AS section, 'PA1: core tables' AS check_name,
    CASE WHEN s.has_users + s.has_guides + s.has_experiences + s.has_destinations
      + s.has_guide_apps + s.has_amb_apps + s.has_platform_config + s.has_transactions
      + s.has_webhook + s.has_bookings + s.has_terms + s.has_payments
      + s.has_testimonials + s.has_claims + s.has_fundraising
      + s.has_charities + s.has_posts = 17 THEN 'PASS' ELSE 'STOP' END AS status,
    CASE WHEN s.has_users = 0 THEN 'users missing; ' ELSE '' END
    || CASE WHEN s.has_guides = 0 THEN 'guides missing; ' ELSE '' END
    || CASE WHEN s.has_experiences = 0 THEN 'experiences missing; ' ELSE '' END
    || CASE WHEN s.has_destinations = 0 THEN 'destinations missing; ' ELSE '' END
    || CASE WHEN s.has_guide_apps = 0 THEN 'guide_applications missing; ' ELSE '' END
    || CASE WHEN s.has_amb_apps = 0 THEN 'ambassador_applications missing; ' ELSE '' END
    || CASE WHEN s.has_platform_config = 0 THEN 'platform_config missing; ' ELSE '' END
    || CASE WHEN s.has_transactions = 0 THEN 'transactions missing; ' ELSE '' END
    || CASE WHEN s.has_webhook = 0 THEN 'webhook_event_inbox missing; ' ELSE '' END
    || CASE WHEN s.has_bookings = 0 THEN 'booking_confirmations missing; ' ELSE '' END
    || CASE WHEN s.has_terms = 0 THEN 'terms_acceptance missing; ' ELSE '' END
    || CASE WHEN s.has_payments = 0 THEN 'payment_reports missing; ' ELSE '' END
    || CASE WHEN s.has_testimonials = 0 THEN 'testimonials missing; ' ELSE '' END
    || CASE WHEN s.has_claims = 0 THEN 'claims_registry missing; ' ELSE '' END
    || CASE WHEN s.has_fundraising = 0 THEN 'fundraising_pages missing; ' ELSE '' END
    || CASE WHEN s.has_charities = 0 THEN 'destination_charities missing; ' ELSE '' END
    || CASE WHEN s.has_posts = 0 THEN 'posts missing; ' ELSE 'All 17 present' END AS detail,
    CASE WHEN s.has_users + s.has_guides + s.has_experiences + s.has_destinations
      + s.has_guide_apps + s.has_amb_apps + s.has_platform_config + s.has_transactions
      + s.has_webhook + s.has_bookings + s.has_terms + s.has_payments
      + s.has_testimonials + s.has_claims + s.has_fundraising
      + s.has_charities + s.has_posts = 17 THEN 'INFO' ELSE 'BLOCKING' END AS severity
  FROM scalars s

  UNION ALL

  -- PA2: schema_migrations
  SELECT 1, 'PA2: schema_migrations',
    CASE WHEN s.has_sm > 0 THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN s.has_sm > 0 THEN 'Exists' ELSE 'Not present. 003b creates it.' END,
    CASE WHEN s.has_sm > 0 THEN 'INFO' ELSE 'WARNING' END FROM scalars s

  UNION ALL

  -- PA3: account_status_audit
  SELECT 1, 'PA3: account_status_audit',
    CASE WHEN s.has_audit > 0 THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN s.has_audit > 0 THEN 'Exists' ELSE 'Not present. 004 creates it.' END,
    CASE WHEN s.has_audit > 0 THEN 'INFO' ELSE 'WARNING' END FROM scalars s

  UNION ALL

  -- PA4: total tables
  SELECT 1, 'PA4: total tables', 'PASS', s.total_tables::text || ' tables in public schema', 'INFO' FROM scalars s

  UNION ALL

  -- PB1: users baseline columns
  SELECT 2, 'PB1: users baseline columns',
    CASE WHEN s.missing_users_baseline > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_users_baseline > 0 THEN s.missing_users_baseline::text || ' baseline columns missing (BLOCKING)'
         ELSE 'All baseline columns present' END,
    CASE WHEN s.missing_users_baseline > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB2: users avatar (003b adds)
  SELECT 2, 'PB2: users.avatar',
    CASE WHEN s.missing_users_003b_adds > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN s.missing_users_003b_adds > 0 THEN 'Missing. 003b adds it.'
         ELSE 'Present' END,
    CASE WHEN s.missing_users_003b_adds > 0 THEN 'WARNING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB3: guides columns
  SELECT 2, 'PB3: guides columns',
    CASE WHEN s.missing_guides > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_guides > 0 THEN s.missing_guides::text || ' columns missing (BLOCKING)'
         ELSE 'All 34 columns present' END,
    CASE WHEN s.missing_guides > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB4: experiences columns
  SELECT 2, 'PB4: experiences columns',
    CASE WHEN s.missing_experiences > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_experiences > 0 THEN s.missing_experiences::text || ' columns missing (BLOCKING)'
         ELSE 'All 14 columns present' END,
    CASE WHEN s.missing_experiences > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB5: destinations columns
  SELECT 2, 'PB5: destinations columns',
    CASE WHEN s.missing_destinations > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_destinations > 0 THEN s.missing_destinations::text || ' columns missing (BLOCKING)'
         ELSE 'All 5 columns present' END,
    CASE WHEN s.missing_destinations > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB6: guide_applications columns
  SELECT 2, 'PB6: guide_applications columns',
    CASE WHEN s.missing_guide_apps > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_guide_apps > 0 THEN s.missing_guide_apps::text || ' columns missing (BLOCKING)'
         ELSE 'All 11 columns present' END,
    CASE WHEN s.missing_guide_apps > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB7: ambassador_applications columns
  SELECT 2, 'PB7: ambassador_applications columns',
    CASE WHEN s.missing_amb_apps > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_amb_apps > 0 THEN s.missing_amb_apps::text || ' columns missing (BLOCKING)'
         ELSE 'All 12 columns present' END,
    CASE WHEN s.missing_amb_apps > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB8: posts columns
  SELECT 2, 'PB8: posts columns',
    CASE WHEN s.missing_posts > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_posts > 0 THEN s.missing_posts::text || ' columns missing (BLOCKING)'
         ELSE 'All 7 columns present' END,
    CASE WHEN s.missing_posts > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB9: fundraising_pages columns
  SELECT 2, 'PB9: fundraising_pages columns',
    CASE WHEN s.missing_fundraising > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_fundraising > 0 THEN s.missing_fundraising::text || ' columns missing (BLOCKING)'
         ELSE 'All 13 columns present' END,
    CASE WHEN s.missing_fundraising > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB10: platform_config columns
  SELECT 2, 'PB10: platform_config columns',
    CASE WHEN s.missing_config > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_config > 0 THEN s.missing_config::text || ' columns missing (BLOCKING)'
         ELSE 'All 8 columns present' END,
    CASE WHEN s.missing_config > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PB11: destination_charities columns
  SELECT 2, 'PB11: destination_charities columns',
    CASE WHEN s.missing_charities > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.missing_charities > 0 THEN s.missing_charities::text || ' columns missing (BLOCKING)'
         ELSE 'All 4 columns present' END,
    CASE WHEN s.missing_charities > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PC1: published experiences
  SELECT 3, 'PC1: published experiences',
    CASE WHEN s.pub_experiences > 0 THEN 'PASS' ELSE 'WARNING' END,
    s.pub_experiences::text || ' published',
    CASE WHEN s.pub_experiences > 0 THEN 'INFO' ELSE 'WARNING' END FROM scalars s

  UNION ALL

  -- PC2: published destinations
  SELECT 3, 'PC2: published destinations',
    CASE WHEN s.pub_destinations > 0 THEN 'PASS' ELSE 'WARNING' END,
    s.pub_destinations::text || ' published',
    CASE WHEN s.pub_destinations > 0 THEN 'INFO' ELSE 'WARNING' END FROM scalars s

  UNION ALL

  -- PC3: platform_config rows
  SELECT 3, 'PC3: platform_config rows',
    CASE WHEN s.platform_rows = 0 OR s.platform_rows > 1 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.platform_rows = 0 THEN '0 rows (empty). Founder must seed.'
         WHEN s.platform_rows > 1 THEN s.platform_rows::text || ' rows (expected 1).'
         ELSE '1 row' END,
    CASE WHEN s.platform_rows = 0 OR s.platform_rows > 1 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PC4: claims without evidence
  SELECT 3, 'PC4: claims without evidence',
    CASE WHEN s.claims_no_evidence > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.claims_no_evidence > 0
         THEN s.claims_no_evidence::text || ' published legal/financial/commercial claims lack evidence. LEGAL REVIEW.'
         ELSE 'All published claims have evidence' END,
    CASE WHEN s.claims_no_evidence > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PC5: terms_acceptance duplicates
  SELECT 3, 'PC5: terms_acceptance duplicates',
    CASE WHEN s.terms_duplicates > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN s.terms_duplicates > 0
         THEN s.terms_duplicates::text || ' duplicate session_id groups found. LEGAL REVIEW.'
         ELSE 'No duplicate session_ids' END,
    CASE WHEN s.terms_duplicates > 0 THEN 'BLOCKING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PD1: RLS
  SELECT 4, 'PD1: RLS not enabled',
    CASE WHEN s.rls_off > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN s.rls_off > 0 THEN s.rls_off::text || ' tables without RLS. 003b enables RLS.'
         ELSE 'All app tables have RLS enabled' END,
    CASE WHEN s.rls_off > 0 THEN 'WARNING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PE1: policies
  SELECT 5, 'PE1: active policies', 'PASS',
    s.policy_count::text || ' policies. 003b drops all 25 known and creates 5 new.', 'INFO' FROM scalars s

  UNION ALL

  -- PF1: function ownership
  SELECT 6, 'PF1: function ownership',
    CASE WHEN s.func_not_postgres > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN s.func_not_postgres > 0 THEN s.func_not_postgres::text || ' not owned by postgres'
         ELSE 'All owned by postgres' END,
    CASE WHEN s.func_not_postgres > 0 THEN 'WARNING' ELSE 'INFO' END FROM scalars s

  UNION ALL

  -- PF2: client EXECUTE
  SELECT 6, 'PF2: client EXECUTE grants',
    CASE WHEN s.client_execute > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN s.client_execute > 0 THEN s.client_execute::text || ' grants to PUBLIC/anon/auth. 003b revokes.'
         ELSE 'No grants to PUBLIC/anon/authenticated' END,
    CASE WHEN s.client_execute > 0 THEN 'WARNING' ELSE 'INFO' END FROM scalars s
),

-- ── Summary row ───────────────────────────────────────────────────
summary AS (
  SELECT
    999 AS section,
    '== SUMMARY ==' AS check_name,
    CASE WHEN r.stop_count > 0 THEN 'STOP'
         WHEN r.warning_count > 0 THEN 'WARNINGS'
         ELSE 'CLEAN' END AS status,
    r.total::text || ' checks: ' || r.pass_count::text || ' PASS, '
      || r.warning_count::text || ' WARNING, '
      || r.stop_count::text || ' STOP' AS detail,
    CASE WHEN r.stop_count > 0 THEN 'BLOCKING'
         WHEN r.warning_count > 0 THEN 'WARNING'
         ELSE 'INFO' END AS severity
  FROM (
    SELECT count(*) AS total,
           count(*) FILTER (WHERE status = 'PASS') AS pass_count,
           count(*) FILTER (WHERE status = 'WARNING') AS warning_count,
           count(*) FILTER (WHERE status = 'STOP') AS stop_count
    FROM results
    WHERE section < 999
  ) r
),

-- ── Preflight self-check (as a result row) ───────────────────────
self_check_row AS (
  SELECT
    998 AS section,
    '== SELF-CHECK ==' AS check_name,
    CASE WHEN (SELECT count(*) FROM results WHERE section < 999) = 24
         THEN 'PASS'
         ELSE 'STOP' END AS status,
    CASE WHEN (SELECT count(*) FROM results WHERE section < 999) = 24
         THEN 'Expected 24 checks, got 24'
         ELSE 'EXPECTED 24 CHECKS, GOT '
           || (SELECT count(*) FROM results WHERE section < 999)::text
           || ' — PREFLIGHT ITSELF MAY BE BROKEN' END AS detail,
    CASE WHEN (SELECT count(*) FROM results WHERE section < 999) = 24
         THEN 'INFO' ELSE 'BLOCKING' END AS severity
)

-- ── Final output ──────────────────────────────────────────────────
SELECT section, check_name, status, detail, severity
FROM (
  SELECT section, check_name, status, detail, severity FROM results
  UNION ALL
  SELECT section, check_name, status, detail, severity FROM self_check_row
  UNION ALL
  SELECT section, check_name, status, detail, severity FROM summary
) AS final
ORDER BY section, check_name;
