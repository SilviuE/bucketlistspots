-- ================================================================
-- PRODUCTION PREFLIGHT / RECONCILIATION (STRICTLY READ-ONLY)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Safety  : ZERO writes. No CREATE/ALTER/DROP/TRUNCATE/INSERT/
--           UPDATE/DELETE/MERGE/GRANT/REVOKE. No temp objects.
--           Pure SELECT with CTEs and UNION ALL.
-- Output  : Structured result table:
--             section | check_name | status | detail | severity
-- Stop    : Rows with status STOP must be reviewed and resolved
--           before migration. They are unmistakably labelled.
-- WARNING : Review required, does not block. Each row documents
--           which migration resolves it.
-- PASS    : No issue.
-- ================================================================

WITH

-- ================================================================
-- PA. TABLE INVENTORY
-- ================================================================
-- Expected before 003b: 17 core tables. schema_migrations and
-- account_status_audit are created by 003b/004 respectively.
-- ================================================================
tables_missing AS (
  SELECT string_agg(t.tbl, ', ') AS missing
  FROM (VALUES
    ('users'),('guides'),('experiences'),('destinations'),
    ('guide_applications'),('ambassador_applications'),
    ('platform_config'),('transactions'),
    ('webhook_event_inbox'),('booking_confirmations'),
    ('terms_acceptance'),('payment_reports'),
    ('testimonials'),('claims_registry'),
    ('fundraising_pages'),('destination_charities'),
    ('posts')
  ) AS t(tbl)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.tbl
  )
),
total_tables AS (
  SELECT count(*)::text AS n FROM pg_tables WHERE schemaname = 'public'
),
sm_exists AS (
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='schema_migrations') AS ex
),
as_exists AS (
  SELECT EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='account_status_audit') AS ex
),

-- ================================================================
-- PB. COLUMN AUDIT (core tables only)
-- ================================================================
col_check AS (
  SELECT c.tbl, c.col, c.added_by
  FROM (VALUES
    ('users','id',NULL),
    ('users','email',NULL),('users','name',NULL),('users','role',NULL),
    ('users','referral_code',NULL),('users','bls_points_balance',NULL),
    ('users','created_at',NULL),('users','avatar','003b'),
    ('guides','id',NULL),('guides','user_id',NULL),
    ('guides','name',NULL),('guides','trading_name',NULL),
    ('guides','email',NULL),('guides','status',NULL),
    ('guides','referral_code',NULL),('guides','bls_points_balance',NULL),
    ('guides','referred_by_ambassador_id',NULL),
    ('guides','price_currency',NULL),('guides','routes',NULL),
    ('guides','photo',NULL),('guides','hero_image',NULL),
    ('guides','bio',NULL),('guides','why_independent',NULL),
    ('guides','location',NULL),('guides','languages',NULL),
    ('guides','experience',NULL),('guides','certifications',NULL),
    ('guides','promise',NULL),('guides','badge',NULL),
    ('guides','tagline',NULL),('guides','price',NULL),
    ('guides','featured',NULL),('guides','review_count',NULL),
    ('guides','trips_led',NULL),('guides','video_intro',NULL),
    ('guides','tripadvisor_embed',NULL),
    ('guides','identity_verified',NULL),('guides','license_verified',NULL),
    ('guides','safety_verified',NULL),('guides','fair_pay_verified',NULL),
    ('guides','updated_at',NULL),
    ('experiences','id',NULL),('experiences','title',NULL),
    ('experiences','duration',NULL),('experiences','difficulty',NULL),
    ('experiences','location',NULL),('experiences','image',NULL),
    ('experiences','price',NULL),('experiences','currency',NULL),
    ('experiences','guide_id',NULL),('experiences','badge',NULL),
    ('experiences','rating',NULL),('experiences','reviews',NULL),
    ('experiences','featured',NULL),('experiences','is_published',NULL),
    ('destinations','name',NULL),('destinations','country',NULL),
    ('destinations','image',NULL),('destinations','guide_count',NULL),
    ('destinations','is_published',NULL),
    ('guide_applications','id',NULL),('guide_applications','full_name',NULL),
    ('guide_applications','email',NULL),('guide_applications','phone',NULL),
    ('guide_applications','country',NULL),('guide_applications','experience',NULL),
    ('guide_applications','languages',NULL),('guide_applications','specialties',NULL),
    ('guide_applications','message',NULL),('guide_applications','heard_from',NULL),
    ('guide_applications','status',NULL),
    ('ambassador_applications','id',NULL),('ambassador_applications','full_name',NULL),
    ('ambassador_applications','email',NULL),('ambassador_applications','phone',NULL),
    ('ambassador_applications','country',NULL),('ambassador_applications','platform',NULL),
    ('ambassador_applications','handle',NULL),('ambassador_applications','followers',NULL),
    ('ambassador_applications','niche',NULL),('ambassador_applications','why_you',NULL),
    ('ambassador_applications','heard_from',NULL),('ambassador_applications','status',NULL),
    ('posts','id',NULL),('posts','user_id',NULL),
    ('posts','author_role',NULL),('posts','author_name',NULL),
    ('posts','content',NULL),('posts','image_url',NULL),('posts','video_url',NULL),
    ('fundraising_pages','id',NULL),('fundraising_pages','user_id',NULL),
    ('fundraising_pages','charity_id',NULL),('fundraising_pages','charity_api_id',NULL),
    ('fundraising_pages','charity_name',NULL),('fundraising_pages','page_title',NULL),
    ('fundraising_pages','target_amount',NULL),('fundraising_pages','currency',NULL),
    ('fundraising_pages','total_raised',NULL),('fundraising_pages','donor_count',NULL),
    ('fundraising_pages','status',NULL),('fundraising_pages','last_synced_at',NULL),
    ('fundraising_pages','created_at',NULL),
    ('platform_config','id',NULL),('platform_config','promotional_commission_pct',NULL),
    ('platform_config','standard_commission_pct',NULL),
    ('platform_config','promotional_start_date',NULL),
    ('platform_config','promotional_end_date',NULL),
    ('platform_config','saas_monthly_fee_gbp',NULL),
    ('platform_config','referral_program_enabled',NULL),
    ('platform_config','charity_challenges_enabled',NULL),
    ('destination_charities','id',NULL),('destination_charities','destination',NULL),
    ('destination_charities','charity_api_id',NULL),('destination_charities','is_active',NULL)
  ) AS c(tbl, col, added_by)
  WHERE EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=c.tbl)
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=c.tbl AND column_name=c.col)
),

-- ================================================================
-- PC. DATA CONDITION
-- ================================================================
pub_experiences AS (
  SELECT count(*)::text AS n FROM public.experiences WHERE is_published = true
),
pub_destinations AS (
  SELECT count(*)::text AS n FROM public.destinations WHERE is_published = true
),
platform_rows AS (
  SELECT count(*)::text AS n FROM public.platform_config
),
claims_no_evidence AS (
  SELECT count(*)::text AS n FROM public.claims_registry
  WHERE claim_type IN ('legal','commercial','financial')
    AND publication_status = 'published'
    AND (evidence_source IS NULL OR evidence_url_or_reference IS NULL)
),

-- ================================================================
-- PD. RLS STATUS
-- ================================================================
rls_off_count AS (
  SELECT count(*)::text AS n FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname != 'schema_migrations' AND NOT c.relrowsecurity
),

-- ================================================================
-- PE. POLICIES
-- ================================================================
policy_count AS (
  SELECT count(*)::text AS n FROM pg_policies WHERE schemaname = 'public'
),

-- ================================================================
-- PF. FUNCTION OWNERSHIP
-- ================================================================
func_not_postgres AS (
  SELECT count(*)::text AS n FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  JOIN pg_roles r ON p.proowner = r.oid
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND r.rolname != 'postgres'
),
client_execute AS (
  SELECT count(*)::text AS n FROM information_schema.routine_privileges
  WHERE routine_schema = 'public' AND grantee IN ('PUBLIC','anon','authenticated')
)

-- ================================================================
-- ASSEMBLE FINAL RESULT TABLE
-- ================================================================
SELECT section, check_name, status, detail, severity
FROM (

  -- PA1: Core tables
  SELECT 1 AS section,
    'PA1: core tables' AS check_name,
    CASE WHEN tm.missing IS NULL THEN 'PASS'
         ELSE 'STOP' END AS status,
    CASE WHEN tm.missing IS NULL
         THEN 'All 17 tables required by 003b preflight exist'
         ELSE 'MISSING: ' || tm.missing END AS detail,
    CASE WHEN tm.missing IS NULL THEN 'INFO' ELSE 'BLOCKING' END AS severity
  FROM tables_missing tm

  UNION ALL

  -- PA2: schema_migrations
  SELECT 1, 'PA2: schema_migrations',
    CASE WHEN sm.ex THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN sm.ex THEN 'Exists'
         ELSE 'Not present. 003b will create it. Expected on first production upgrade.'
    END,
    CASE WHEN sm.ex THEN 'INFO' ELSE 'WARNING' END
  FROM sm_exists sm

  UNION ALL

  -- PA3: account_status_audit
  SELECT 1, 'PA3: account_status_audit',
    CASE WHEN asa.ex THEN 'PASS' ELSE 'WARNING' END,
    CASE WHEN asa.ex THEN 'Exists'
         ELSE 'Not present. 004 will create it. Expected before 004 is applied.'
    END,
    CASE WHEN asa.ex THEN 'INFO' ELSE 'WARNING' END
  FROM as_exists asa

  UNION ALL

  -- PA4: total tables
  SELECT 1, 'PA4: total tables', 'PASS',
    tt.n || ' tables in public schema', 'INFO'
  FROM total_tables tt

  UNION ALL

  -- PB: Column audit (aggregated per table)
  SELECT 2, 'PB: missing columns',
    CASE WHEN cc.missing_cols IS NULL THEN 'PASS'
         WHEN cc.missing_cols LIKE '%(BLOCKING)%' THEN 'STOP'
         ELSE 'WARNING' END,
    coalesce(cc.missing_cols, 'All expected columns present on all 10 tables'),
    CASE WHEN cc.missing_cols IS NULL THEN 'INFO'
         WHEN cc.missing_cols LIKE '%(BLOCKING)%' THEN 'BLOCKING'
         ELSE 'WARNING' END
  FROM (
    SELECT string_agg(
      cc.tbl || '.' || cc.col ||
      CASE WHEN cc.added_by IS NOT NULL
        THEN ' (added by ' || cc.added_by || ')'
        ELSE ' (BLOCKING)' END,
      ', ' ORDER BY
        CASE WHEN cc.added_by IS NOT NULL THEN 1 ELSE 0 END,
        cc.tbl, cc.col
    ) AS missing_cols
    FROM col_check cc
  ) cc

  UNION ALL

  -- PC1: published experiences
  SELECT 3, 'PC1: published experiences',
    CASE WHEN pe.n::int > 0 THEN 'PASS' ELSE 'WARNING' END,
    pe.n || ' published (founder must publish before public launch; 003b proceeds regardless)',
    CASE WHEN pe.n::int > 0 THEN 'INFO' ELSE 'WARNING' END
  FROM pub_experiences pe

  UNION ALL

  -- PC2: published destinations
  SELECT 3, 'PC2: published destinations',
    CASE WHEN pd.n::int > 0 THEN 'PASS' ELSE 'WARNING' END,
    pd.n || ' published (founder must publish before public launch; 003b proceeds regardless)',
    CASE WHEN pd.n::int > 0 THEN 'INFO' ELSE 'WARNING' END
  FROM pub_destinations pd

  UNION ALL

  -- PC3: platform_config row count
  SELECT 3, 'PC3: platform_config rows',
    CASE WHEN pr.n::int = 0 THEN 'STOP'
         WHEN pr.n::int > 1 THEN 'STOP'
         ELSE 'PASS' END,
    CASE WHEN pr.n::int = 0 THEN '0 rows (empty). Founder must seed configuration.'
         WHEN pr.n::int > 1 THEN pr.n || ' rows (expected 1). Data-integrity issue.'
         ELSE '1 row' END,
    CASE WHEN pr.n::int = 0 OR pr.n::int > 1 THEN 'BLOCKING' ELSE 'INFO' END
  FROM platform_rows pr

  UNION ALL

  -- PC4: claims without evidence
  SELECT 3, 'PC4: claims without evidence',
    CASE WHEN cne.n::int > 0 THEN 'STOP' ELSE 'PASS' END,
    CASE WHEN cne.n::int > 0
         THEN cne.n || ' published legal/financial/commercial claims have no evidence source. LEGAL REVIEW REQUIRED.'
         ELSE 'All published claims have evidence sources' END,
    CASE WHEN cne.n::int > 0 THEN 'BLOCKING' ELSE 'INFO' END
  FROM claims_no_evidence cne

  UNION ALL

  -- PD1: RLS status
  SELECT 4, 'PD1: RLS not enabled',
    CASE WHEN ro.n::int > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN ro.n::int > 0
         THEN ro.n || ' tables without RLS. 003b will enable RLS on all 17.'
         ELSE 'All application tables have RLS enabled' END,
    CASE WHEN ro.n::int > 0 THEN 'WARNING' ELSE 'INFO' END
  FROM rls_off_count ro

  UNION ALL

  -- PE1: policies
  SELECT 5, 'PE1: active policies',
    'PASS',
    pc.n || ' active policies before 003b. 003b drops all 25 known and creates 5 new.',
    'INFO'
  FROM policy_count pc

  UNION ALL

  -- PF1: function ownership
  SELECT 6, 'PF1: function ownership',
    CASE WHEN fp.n::int > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN fp.n::int > 0
         THEN fp.n || ' public functions not owned by postgres. 003b verification checks this.'
         ELSE 'All public functions owned by postgres' END,
    CASE WHEN fp.n::int > 0 THEN 'WARNING' ELSE 'INFO' END
  FROM func_not_postgres fp

  UNION ALL

  -- PF2: client EXECUTE
  SELECT 6, 'PF2: client EXECUTE grants',
    CASE WHEN ce.n::int > 0 THEN 'WARNING' ELSE 'PASS' END,
    CASE WHEN ce.n::int > 0
         THEN ce.n || ' EXECUTE grants to PUBLIC/anon/authenticated. 003b revokes all.'
         ELSE 'No EXECUTE grants to PUBLIC/anon/authenticated' END,
    CASE WHEN ce.n::int > 0 THEN 'WARNING' ELSE 'INFO' END
  FROM client_execute ce

) AS results
ORDER BY section, check_name;
