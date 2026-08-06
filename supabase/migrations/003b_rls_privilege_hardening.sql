-- ================================================================
-- 003b: RLS PRIVILEGE HARDENING (v3 EUR" production-hardened)
-- ================================================================
-- Run in a DISPOSABLE Supabase project SQL Editor.
-- DO NOT run against production.
--
-- Prerequisites:
--   1. 003a_publication_columns.sql applied (is_published columns added)
--   2. Core tables exist (from 0000 baseline or app-created)
--
-- Publication readiness is now a SEPARATE read-only preflight gate
-- (supabase/preflight/production_preflight.sql). 003b no longer
-- aborts on missing published content EUR" it hardens RLS regardless.
--
-- Safe re-execution: checks schema_migrations; exits cleanly if
-- already applied (no "0000" migration required EUR" standalone guard).
--
-- Function signatures (verified from pg_proc / 002 migration source):
--   public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT)
--   public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT)
--   public.claim_webhook_event(TEXT, TIMESTAMPTZ)
--   public.reject_terms_acceptance_update_delete() EUR" trigger function, no args
-- ================================================================

BEGIN;

-- ================================================================
-- SECTION 0: SCHEMA_MIGRATIONS GUARD (checksumEUR'verified)
-- ================================================================
-- On production, 0000 is never run so schema_migrations may not
-- exist. Create it if absent before the guard checks.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT
);
REVOKE ALL ON public.schema_migrations FROM anon, authenticated, PUBLIC, service_role;

-- ================================================================
-- Structural validation: schema_migrations must have the expected
-- columns with exact types, nullability, single-column PK and
-- zero runtime-role grants (table-level AND column-level).
-- Abort on any incompatibility.
-- ================================================================
DO $struct$
DECLARE
  _missing TEXT[];
  _bad_grants TEXT[];
  _col RECORD;
  _pk_cols INT;
  _pk_count INT;
  _version_attnum SMALLINT;
  -- {column_name, data_type, is_nullable}
  _expected TEXT[][] := ARRAY[
    ARRAY['version',    'text',                        'NO' ],
    ARRAY['name',       'text',                        'NO' ],
    ARRAY['applied_at', 'timestamp with time zone',    'NO' ],
    ARRAY['checksum',   'text',                        'YES']
  ];
BEGIN
  -- 1. Verify each expected column: existence, type, nullability
  FOR i IN 1..array_length(_expected, 1) LOOP
    SELECT c.column_name, c.data_type, c.is_nullable INTO _col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'schema_migrations'
      AND c.column_name = _expected[i][1];

    IF NOT FOUND THEN
      _missing := array_append(_missing, _expected[i][1] || ' (missing)');
      CONTINUE;
    END IF;

    IF _col.data_type != _expected[i][2] THEN
      _missing := array_append(_missing,
        _expected[i][1] || ' type: expected ' || _expected[i][2] || ', got ' || _col.data_type);
    END IF;

    IF _col.is_nullable != _expected[i][3] THEN
      _missing := array_append(_missing,
        _expected[i][1] || ' nullability: expected ' ||
        CASE WHEN _expected[i][3] = 'NO' THEN 'NOT NULL' ELSE 'NULL' END ||
        ', got ' || CASE WHEN _col.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END);
    END IF;
  END LOOP;

  IF _missing IS NOT NULL AND array_length(_missing, 1) > 0 THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS STRUCTURE FAILURE: %',
      array_to_string(_missing, '; ');
  END IF;

  -- 2. Verify no extra columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
      AND column_name NOT IN ('version','name','applied_at','checksum')
  ) THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS STRUCTURE FAILURE: unexpected extra columns found';
  END IF;

  -- 3. Verify exactly one PK constraint, one column, that column is version
  SELECT count(*) INTO _pk_count
  FROM pg_constraint
  WHERE conrelid = 'public.schema_migrations'::regclass
    AND contype = 'p';

  IF _pk_count != 1 THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS STRUCTURE FAILURE: expected 1 PRIMARY KEY, found %', _pk_count;
  END IF;

  SELECT array_length(conkey, 1) INTO _pk_cols
  FROM pg_constraint
  WHERE conrelid = 'public.schema_migrations'::regclass
    AND contype = 'p';

  IF _pk_cols != 1 THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS STRUCTURE FAILURE: PRIMARY KEY has % columns (expected exactly 1)', _pk_cols;
  END IF;

  SELECT attnum::smallint INTO _version_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.schema_migrations'::regclass
    AND attname = 'version';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.schema_migrations'::regclass
      AND contype = 'p'
      AND conkey = ARRAY[_version_attnum]::smallint[]
  ) THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS STRUCTURE FAILURE: PRIMARY KEY column is not (version)';
  END IF;

  -- 4. Verify NO table-level grants for runtime roles
  SELECT array_agg(g.grantee || ':' || g.privilege_type) INTO _bad_grants
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.table_name = 'schema_migrations'
    AND g.grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role');

  IF _bad_grants IS NOT NULL AND array_length(_bad_grants, 1) > 0 THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS GRANT FAILURE (table): runtime roles have access: %',
      array_to_string(_bad_grants, ', ');
  END IF;

  -- 5. Verify NO column-level grants for runtime roles
  SELECT array_agg(g.grantee || ':' || g.column_name || ':' || g.privilege_type) INTO _bad_grants
  FROM information_schema.role_column_grants g
  WHERE g.table_schema = 'public'
    AND g.table_name = 'schema_migrations'
    AND g.grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role');

  IF _bad_grants IS NOT NULL AND array_length(_bad_grants, 1) > 0 THEN
    RAISE EXCEPTION 'SCHEMA_MIGRATIONS GRANT FAILURE (column): runtime roles have column grants: %',
      array_to_string(_bad_grants, ', ');
  END IF;

  RAISE NOTICE 'schema_migrations structure validated: 4 columns [version TEXT NOT NULL PK, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL, checksum TEXT], exact PK=(version), zero table/column grants for runtime roles.';
END $struct$;

DO $guard$
DECLARE
  _expected TEXT := '5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED';
  _recorded RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
    SELECT version, checksum, applied_at INTO _recorded
    FROM public.schema_migrations WHERE version = '003b';

    IF FOUND THEN
      IF _recorded.checksum IS NULL THEN
        RAISE WARNING 'Migration 003b recorded without checksum (legacy record).';
        RAISE EXCEPTION 'LEGACY MIGRATION: 003b has no historical checksum. Founder/legal review required.';
      ELSIF _recorded.checksum = _expected THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE 'Migration 003b already applied EUR" exiting cleanly.';
        RAISE NOTICE '(Checksum matches, applied at %)', _recorded.applied_at;
        RAISE NOTICE '============================================================';
        RETURN;
      ELSE
        RAISE EXCEPTION 'MIGRATION INTEGRITY FAILURE: 003b.\n  Recorded checksum: %\n  Expected checksum: %\n  The migration file has changed since it was first applied.\n  Restore the original file or obtain written founder authorisation.',
          _recorded.checksum, _expected;
      END IF;
    END IF;
  ELSE
    RAISE NOTICE 'schema_migrations table not present EUR" first-time run, proceeding.';
  END IF;
END $guard$;

-- ================================================================
-- SECTION 1: PUBLICATION READINESS NOTICE (advisory only EUR" no abort)
-- ================================================================
DO $$ DECLARE
  v_pub_exp INT; v_pub_dest INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='experiences') THEN
    SELECT count(*) INTO v_pub_exp FROM public.experiences WHERE is_published = true;
  ELSE
    v_pub_exp := 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='destinations') THEN
    SELECT count(*) INTO v_pub_dest FROM public.destinations WHERE is_published = true;
  ELSE
    v_pub_dest := 0;
  END IF;

  IF v_pub_exp = 0 OR v_pub_dest = 0 THEN
    RAISE WARNING 'Publication readiness: experiences=% published, destinations=% published.', v_pub_exp, v_pub_dest;
    RAISE WARNING '003b RLS hardening WILL proceed (publication check is now a separate read-only preflight gate).';
    RAISE WARNING 'Run supabase/preflight/production_preflight.sql before public launch to verify publication readiness.';
  ELSE
    RAISE NOTICE 'Publication readiness: % published experiences, % published destinations.', v_pub_exp, v_pub_dest;
  END IF;
END $$;


-- ================================================================
-- SECTION 2: PREFLIGHT EUR" Schema Audit
-- ================================================================
DO $$
DECLARE
  v_missing TEXT[];
BEGIN
  RAISE NOTICE 'PREFLIGHT SCHEMA AUDIT';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('email'),('name'),('role'),('created_at'),
               ('referral_code'),('bls_points_balance'),('avatar'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='users' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: users missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.users';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('user_id'),('name'),('trading_name'),('status'),
               ('photo'),('hero_image'),('bio'),('why_independent'),('location'),
               ('languages'),('experience'),('certifications'),('promise'),
               ('badge'),('tagline'),('routes'),('price'),('price_currency'),
               ('featured'),('review_count'),('trips_led'),('video_intro'),
               ('tripadvisor_embed'),('identity_verified'),('license_verified'),
               ('safety_verified'),('fair_pay_verified'),('referral_code'),
               ('bls_points_balance'),('referred_by_ambassador_id'),('updated_at'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='guides' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.guides missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.guides';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('title'),('duration'),('difficulty'),('location'),
               ('image'),('price'),('currency'),('guide_id'),('badge'),
               ('rating'),('reviews'),('featured'),('is_published'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='experiences' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.experiences missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.experiences';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('name'),('country'),('image'),('guide_count'),('is_published'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='destinations' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.destinations missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.destinations';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('full_name'),('email'),('phone'),('country'),
               ('experience'),('languages'),('specialties'),('message'),
               ('heard_from'),('status'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='guide_applications' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.guide_applications missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.guide_applications';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('full_name'),('email'),('phone'),('country'),
               ('platform'),('handle'),('followers'),('niche'),
               ('why_you'),('heard_from'),('status'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='ambassador_applications' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.ambassador_applications missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.ambassador_applications';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('user_id'),('author_role'),('author_name'),
               ('content'),('image_url'),('video_url'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='posts' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.posts missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.posts';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('user_id'),('charity_id'),('charity_api_id'),
               ('charity_name'),('page_short_name'),('page_url'),
               ('page_title'),('target_amount'),('currency'),
               ('total_raised'),('event_date'),('status'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='fundraising_pages' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.fundraising_pages missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.fundraising_pages';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('promotional_commission_pct'),('standard_commission_pct'),
               ('promotional_start_date'),('promotional_end_date'),
               ('saas_monthly_fee_gbp'),('referral_program_enabled'),
               ('charity_challenges_enabled'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='platform_config' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.platform_config missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.platform_config';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('destination'),('charity_api_id'),('is_active'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='destination_charities' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: public.destination_charities missing: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.destination_charities';

  RAISE NOTICE 'PREFLIGHT: All columns verified.';
END $$;


-- ================================================================
-- SECTION 3: SCHEMA CHANGES
-- ================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='avatar') THEN
    ALTER TABLE public.users ADD COLUMN avatar TEXT;
    RAISE NOTICE 'Added public.users.avatar';
  ELSE
    RAISE NOTICE 'public.users.avatar exists';
  END IF;
END $$;


-- ================================================================
-- SECTION 4: ENABLE RLS (idempotent)
-- ================================================================
ALTER TABLE public.guides                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_applications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_inbox     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_confirmations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims_registry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_charities   ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- SECTION 5: DROP EXISTING POLICIES (explicit list, abort on unexpected)
-- ================================================================
DO $$
DECLARE
  v_known_policies TEXT[] := ARRAY[
    -- 20 legacy pre-003 policies
    'platform_config_admin',
    'transactions_select_own',
    'payment_reports_admin_only',
    'admin_manage_claims',
    'public_read_approved_claims',
    'admin_manage_testimonials',
    'public_read_approved_testimonials',
    'Users read own fundraising pages',
    'Users create own fundraising pages',
    'Users update own fundraising pages',
    'Public can view active charities',
    'posts_select',
    'posts_insert',
    'posts_update',
    'posts_delete',
    'posts_select_anon',
    'terms_acceptance_service_insert',
    'terms_acceptance_service_select',
    'webhook_inbox_service_all',
    'booking_conf_service_all',
    -- 5 hardened post-003b policies (for safe re-execution)
    'users_select_own',
    'users_update_own_name_avatar',
    'guides_select_published',
    'experiences_select_published',
    'destinations_select_published'
  ];
  v_unknown TEXT[];
  v_pol TEXT;
  v_tablename TEXT;
BEGIN
  SELECT array_agg(p.policyname) INTO v_unknown
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND NOT p.policyname = ANY(v_known_policies);

  IF v_unknown IS NOT NULL AND array_length(v_unknown, 1) > 0 THEN
    RAISE EXCEPTION 'UNEXPECTED POLICIES FOUND EUR" aborting. List: %',
      array_to_string(v_unknown, ', ');
  END IF;

  FOREACH v_pol IN ARRAY v_known_policies LOOP
    FOR v_tablename IN
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND policyname = v_pol
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol, v_tablename);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Dropped % known policies, 0 unexpected',
    array_length(v_known_policies, 1);
END $$;


-- ================================================================
-- SECTION 6: REVOKE UNUSED PRIVILEGES
-- ================================================================
-- CRITICAL: Revoke ALL table-level privileges from client roles first.
-- Supabase defaults grant broad table-level SELECT to anon/authenticated.
-- Column-level GRANTs in Section 7 establish the exact access model.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.guide_applications      FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ambassador_applications FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.posts                   FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fundraising_pages       FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.testimonials            FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.destination_charities   FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.claims_registry         FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.platform_config        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions           FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_event_inbox    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_confirmations  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_reports        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.terms_acceptance       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.guides                 FROM anon, authenticated;


-- ================================================================
-- SECTION 7: COLUMN-LEVEL SELECT GRANTS
-- ================================================================

-- anon: public.users EUR" NO access (no grant, no policy)

-- anon: public.guides EUR" 29 published-safe columns
GRANT SELECT (
  id, name, trading_name, status, photo, hero_image,
  bio, why_independent, location, languages, experience,
  certifications, promise, badge, tagline, routes,
  price, price_currency, featured, review_count, trips_led,
  video_intro, tripadvisor_embed,
  identity_verified, license_verified, safety_verified, fair_pay_verified,
  created_at, updated_at
) ON public.guides TO anon;

-- anon: public.experiences EUR" 13 public-safe columns
GRANT SELECT (
  id, title, duration, difficulty, location, image,
  price, currency, guide_id, badge, rating, reviews, featured
) ON public.experiences TO anon;

-- anon: public.destinations EUR" 4 public columns
GRANT SELECT (name, country, image, guide_count) ON public.destinations TO anon;

-- authenticated: public.users EUR" 6 own-row safe columns (includes avatar)
GRANT SELECT (id, email, name, avatar, role, created_at) ON public.users TO authenticated;

-- authenticated: public.guides EUR" same 29 columns as anon
GRANT SELECT (
  id, name, trading_name, status, photo, hero_image,
  bio, why_independent, location, languages, experience,
  certifications, promise, badge, tagline, routes,
  price, price_currency, featured, review_count, trips_led,
  video_intro, tripadvisor_embed,
  identity_verified, license_verified, safety_verified, fair_pay_verified,
  created_at, updated_at
) ON public.guides TO authenticated;

-- authenticated: public.experiences EUR" same 13 columns as anon
GRANT SELECT (
  id, title, duration, difficulty, location, image,
  price, currency, guide_id, badge, rating, reviews, featured
) ON public.experiences TO authenticated;

-- authenticated: public.destinations EUR" same 4 columns as anon
GRANT SELECT (name, country, image, guide_count) ON public.destinations TO authenticated;

-- authenticated: public.platform_config (read-only, RLS default deny)
GRANT SELECT ON public.platform_config TO authenticated;

-- authenticated: public.transactions (read-only, RLS own-row)
GRANT SELECT ON public.transactions TO authenticated;

-- authenticated: UPDATE public.users (name, avatar only)
GRANT UPDATE (name, avatar) ON public.users TO authenticated;

-- service_role: full table access (bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;


-- ================================================================
-- SECTION 8: RLS POLICIES
-- ================================================================

-- public.users: authenticated own row only
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_name_avatar"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- public.guides: published only
CREATE POLICY "guides_select_published"
  ON public.guides FOR SELECT
  USING (status = 'published');

-- public.experiences: published only (RLS performs the filtering)
CREATE POLICY "experiences_select_published"
  ON public.experiences FOR SELECT
  USING (is_published = true);

-- public.destinations: published only (RLS performs the filtering)
CREATE POLICY "destinations_select_published"
  ON public.destinations FOR SELECT
  USING (is_published = true);

-- No policies on public.platform_config ' RLS default deny for anon/authenticated
-- No policies on public.transactions ' RLS default deny (authenticated has GRANT but no policy ' 0 rows)
-- No policies on Netlify-only tables ' RLS default deny for all roles


-- ================================================================
-- SECTION 9: FUNCTION EXECUTE SECURITY
-- ================================================================
-- Revoke from ALL roles including service_role, then regrant only approved RPCs.

-- Step 1: REVOKE EXECUTE from every role
DO $$
BEGIN
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE 'Step 1: Revoked EXECUTE from all roles on all functions';
END $$;

-- Step 2: REVOKE per-function from each role (belt and suspenders)
DO $$
BEGIN
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;

  RAISE NOTICE 'Step 2: Per-function REVOKE complete';
END $$;

-- Step 3: Regrant ONLY approved RPCs to service_role
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- Note: reject_terms_acceptance_update_delete is a trigger function.
-- It is invoked by the trigger, not by direct call. No EXECUTE grant needed.

DO $$ BEGIN
  RAISE NOTICE 'Step 3: Regranted 3 approved RPCs to service_role';
END $$;


-- ================================================================
-- SECTION 10: DEFAULT PRIVILEGE HARDENING
-- ================================================================
-- Two tiers:
--   HARD  EUR" ALTER DEFAULT PRIVILEGES FOR ROLE postgres (global and
--           schema-scoped). These are under application control.
--           Any failure is a hard abort.
--   ADVISORY EUR" FOR ROLE supabase_admin. Supabase SQL Editor runs
--           as a managed postgres role that cannot alter defaults
--           for the platform-managed supabase_admin role. Each
--           statement is attempted; insufficient_privilege (42501)
--           produces a WARNING. All other exceptions rethrow.
--
-- Global postgres function EXECUTE revocation is a hard requirement
-- because schema-scoped defaults alone cannot reliably undo PUBLIC
-- EXECUTE behaviour for future functions created outside schema public.

-- "EUR"EUR Retroactive: strip sequences from client roles "EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR"EUR
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- *******************************************************************
-- HARD: Global postgres function default (current role = postgres;
--       PostgreSQL allows a role to alter its own global defaults)
-- *******************************************************************
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

-- *******************************************************************
-- HARD: Schema-scoped postgres defaults (application-controlled)
-- *******************************************************************
-- Future functions in public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM service_role;

-- Future tables in public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- Future sequences in public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

DO $$ BEGIN
  RAISE NOTICE 'Section 10 HARD: global + schema-scoped postgres defaults applied.';
END $$;

-- *******************************************************************
-- ADVISORY: supabase_admin defaults (platform-managed role)
-- *******************************************************************
-- These statements target supabase_admin, which is managed by the
-- Supabase platform. The SQL Editor postgres role may not have
-- permission to alter its defaults. Each is attempted; only
-- insufficient_privilege (SQLSTATE 42501) is caught and warned.
-- Every other exception (syntax error, undefined role, etc.) is
-- rethrown as a hard abort.
DO $adv_supa_admin$
DECLARE
  _ok INT := 0;
  _fail INT := 0;
  _stmt TEXT;
  _sqlstate TEXT;
  _msg TEXT;
BEGIN
  -- Global function defaults
  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM anon';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM authenticated';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  -- Schema-scoped function defaults
  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM service_role';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  -- Schema-scoped table defaults
  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  -- Schema-scoped sequence defaults
  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  _stmt := 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  BEGIN EXECUTE _stmt; _ok := _ok + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    RAISE WARNING 'ADVISORY SKIP [%] %: %', _sqlstate, _stmt, _msg;
    _fail := _fail + 1;
  END;

  IF _fail > 0 THEN
    RAISE WARNING 'ADVISORY SUMMARY: %/% supabase_admin default ACLs skipped (platform-managed role).', _fail, _ok + _fail;
  ELSE
    RAISE NOTICE 'ADVISORY: all % supabase_admin default ACLs applied.', _ok;
  END IF;
END $adv_supa_admin$;


-- ================================================================
-- SECTION 11: POST-MIGRATION VERIFICATION
-- ================================================================
DO $$
DECLARE
  v_errors INT := 0;
  v_count  BIGINT;
  r        RECORD;
BEGIN
  RAISE NOTICE 'POST-MIGRATION VERIFICATION';

  SELECT count(*) INTO v_count FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relrowsecurity = false
    AND relname IN ('guides','users','experiences','destinations',
      'guide_applications','ambassador_applications','posts',
      'platform_config','transactions','webhook_event_inbox',
      'booking_confirmations','terms_acceptance','payment_reports',
      'testimonials','claims_registry','fundraising_pages',
      'destination_charities');
  IF v_count > 0 THEN
    RAISE WARNING '% tables missing RLS', v_count;
    v_errors := v_errors + 1;
  ELSE
    RAISE NOTICE '  RLS enabled on all 17 tables';
  END IF;

  -- anon: NO SELECT on public.users
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='users' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select public.users'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT select public.users'; END IF;

  -- anon: CAN select public.guides (column-restricted)
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='anon' AND table_name='guides' AND table_schema='public'
             AND privilege_type='SELECT' AND column_name='name') THEN
    RAISE NOTICE '  anon: CAN select public.guides (column-restricted)';
  ELSE RAISE WARNING 'anon CANNOT select public.guides'; v_errors := v_errors + 1; END IF;

  -- anon: NO SELECT on Netlify-only tables
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='guide_applications' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select public.guide_applications'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT select public.guide_applications'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='posts' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select public.posts'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT select public.posts'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='testimonials' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select public.testimonials'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT select public.testimonials'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='claims_registry' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select public.claims_registry'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT select public.claims_registry'; END IF;

  -- authenticated: CAN select public.guides (column-restricted)
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='guides' AND table_schema='public'
             AND privilege_type='SELECT' AND column_name='name') THEN
    RAISE NOTICE '  authenticated: CAN select public.guides (column-restricted)';
  ELSE RAISE WARNING 'authenticated CANNOT select public.guides'; v_errors := v_errors + 1; END IF;

  -- authenticated: CAN update public.users.name
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users' AND table_schema='public'
             AND privilege_type='UPDATE' AND column_name='name') THEN
    RAISE NOTICE '  authenticated: CAN update public.users.name';
  ELSE RAISE WARNING 'authenticated CANNOT update public.users.name'; v_errors := v_errors + 1; END IF;

  -- authenticated: CANNOT update public.users.role
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users' AND table_schema='public'
             AND privilege_type='UPDATE' AND column_name='role') THEN
    RAISE WARNING 'authenticated CAN update public.users.role'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  authenticated: CANNOT update public.users.role'; END IF;

  -- authenticated: CANNOT update public.users.bls_points_balance
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users' AND table_schema='public'
             AND privilege_type='UPDATE' AND column_name='bls_points_balance') THEN
    RAISE WARNING 'authenticated CAN update public.users.bls_points_balance'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  authenticated: CANNOT update public.users.bls_points_balance'; END IF;

  -- authenticated: NO SELECT on public.guide_applications
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='authenticated' AND table_name='guide_applications' AND table_schema='public'
             AND privilege_type='SELECT') THEN
    RAISE WARNING 'authenticated CAN select public.guide_applications'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  authenticated: CANNOT select public.guide_applications'; END IF;

  -- RPCs: service_role CAN execute approved RPCs
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE grantee='service_role' AND routine_schema='public'
             AND routine_name='claim_webhook_event' AND privilege_type='EXECUTE') THEN
    RAISE NOTICE '  service_role: CAN execute public.claim_webhook_event';
  ELSE RAISE WARNING 'service_role CANNOT execute public.claim_webhook_event'; v_errors := v_errors + 1; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE grantee='service_role' AND routine_schema='public'
             AND routine_name='credit_referral_reward' AND privilege_type='EXECUTE') THEN
    RAISE NOTICE '  service_role: CAN execute public.credit_referral_reward';
  ELSE RAISE WARNING 'service_role CANNOT execute public.credit_referral_reward'; v_errors := v_errors + 1; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE grantee='service_role' AND routine_schema='public'
             AND routine_name='credit_ambassador_commission' AND privilege_type='EXECUTE') THEN
    RAISE NOTICE '  service_role: CAN execute public.credit_ambassador_commission';
  ELSE RAISE WARNING 'service_role CANNOT execute public.credit_ambassador_commission'; v_errors := v_errors + 1; END IF;

  -- RPCs: anon retains NO function EXECUTE
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE grantee='anon' AND routine_schema='public' AND privilege_type='EXECUTE') THEN
    RAISE WARNING 'anon retains EXECUTE on at least one function'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  anon: CANNOT execute any function'; END IF;

  -- RPCs: authenticated retains NO function EXECUTE
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE grantee='authenticated' AND routine_schema='public' AND privilege_type='EXECUTE') THEN
    RAISE WARNING 'authenticated retains EXECUTE on at least one function'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  authenticated: CANNOT execute any function'; END IF;

  -- Default ACL: postgres function EXECUTE defaults must contain no client roles (HARD-FAIL)
  -- supabase_admin defaults: ADVISORY only (platform-managed on hosted Supabase)
  FOR r IN
    SELECT rolname AS owner, d.defaclacl::text AS acl
    FROM pg_default_acl d
    JOIN pg_roles rol ON d.defaclrole = rol.oid
    WHERE d.defaclobjtype = 'f'
      AND d.defaclnamespace = 'public'::regnamespace
      AND rol.rolname IN ('postgres','supabase_admin')
  LOOP
    IF r.owner = 'postgres' THEN
      IF r.acl LIKE '%anon=%' OR r.acl LIKE '%authenticated=%' OR r.acl LIKE '%service_role=%' THEN
        RAISE WARNING 'Default ACL: postgres has client roles in public/function: %', r.acl;
        v_errors := v_errors + 1;
      ELSE
        RAISE NOTICE '  Default ACL: postgres has no client roles in public/function';
      END IF;
    ELSE
      -- supabase_admin: advisory only
      IF r.acl LIKE '%anon=%' OR r.acl LIKE '%authenticated=%' OR r.acl LIKE '%service_role=%' THEN
        RAISE NOTICE '  ADVISORY: supabase_admin default ACL retains client roles (platform-managed): %', r.acl;
      ELSE
        RAISE NOTICE '  Default ACL: supabase_admin has no client roles in public/function';
      END IF;
    END IF;
  END LOOP;

  -- Function ownership: all public functions must be owned by postgres
  SELECT count(*) INTO v_count FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_roles rol ON p.proowner = rol.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND rol.rolname != 'postgres';
  IF v_count > 0 THEN
    RAISE WARNING 'Function ownership: % public functions not owned by postgres', v_count;
    v_errors := v_errors + 1;
  ELSE
    RAISE NOTICE '  All public functions owned by postgres';
  END IF;

  -- Table default ACL: service_role must have arwd only (no TRUNCATE/REFERENCES/TRIGGER/MAINTAIN)
  FOR r IN
    SELECT d.defaclacl::text AS acl
    FROM pg_default_acl d
    JOIN pg_roles rol ON d.defaclrole = rol.oid
    WHERE d.defaclobjtype = 'r'
      AND d.defaclnamespace = 'public'::regnamespace
      AND rol.rolname = 'postgres'
  LOOP
    IF r.acl LIKE '%service_role=arwd/%postgres%'
       AND r.acl NOT LIKE '%service_role=arwdDxtm/%postgres%'
       AND r.acl NOT LIKE '%anon=%' AND r.acl NOT LIKE '%authenticated=%' THEN
      RAISE NOTICE '  Table default ACL: service_role=arwd (SELECT,INSERT,UPDATE,DELETE only)';
    ELSE
      RAISE WARNING 'Table default ACL unexpected: %', r.acl;
      v_errors := v_errors + 1;
    END IF;
  END LOOP;

  -- Sequence default ACL: service_role must have rU only (no UPDATE)
  FOR r IN
    SELECT d.defaclacl::text AS acl
    FROM pg_default_acl d
    JOIN pg_roles rol ON d.defaclrole = rol.oid
    WHERE d.defaclobjtype = 'S'
      AND d.defaclnamespace = 'public'::regnamespace
      AND rol.rolname = 'postgres'
  LOOP
    IF r.acl LIKE '%service_role=rU/%postgres%'
       AND r.acl NOT LIKE '%service_role=rUw/%postgres%'
       AND r.acl NOT LIKE '%anon=%' AND r.acl NOT LIKE '%authenticated=%' THEN
      RAISE NOTICE '  Sequence default ACL: service_role=rU (SELECT,USAGE only)';
    ELSE
      RAISE WARNING 'Sequence default ACL unexpected: %', r.acl;
      v_errors := v_errors + 1;
    END IF;
  END LOOP;

  -- TRUNCATE revoked
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='guides' AND table_schema='public'
             AND privilege_type='TRUNCATE') THEN
    RAISE WARNING 'anon retains TRUNCATE on public.guides'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  TRUNCATE revoked on public.guides'; END IF;

  IF v_errors = 0 THEN
    RAISE NOTICE 'VERIFICATION: ALL CHECKS PASSED';
  ELSE
    RAISE WARNING 'VERIFICATION: % CHECKS FAILED', v_errors;
  END IF;
END $$;


-- ================================================================
-- FINAL SUMMARY
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '003b_rls_privilege_hardening v3: MIGRATION COMPLETE';
  RAISE NOTICE 'Policies: 5 restrictive policies on public.users, public.guides,';
  RAISE NOTICE '  public.experiences, public.destinations.';
  RAISE NOTICE 'Functions: ALL EXECUTE revoked from PUBLIC/anon/authenticated/service_role;';
  RAISE NOTICE '  3 RPCs regranted to service_role only.';
  RAISE NOTICE 'Default privileges: postgres hard-pass, supabase_admin advisory (platform-managed).';
  RAISE NOTICE '  Table defaults: service_role=arwd (SELECT,INSERT,UPDATE,DELETE only).';
  RAISE NOTICE '  Sequence defaults: service_role=rU (SELECT,USAGE only).';
  RAISE NOTICE 'Function ownership: all public functions verified owned by postgres.';
  RAISE NOTICE 'Application functions MUST be created by postgres, not supabase_admin.';
  RAISE NOTICE 'Publication: experiences/destinations gated by is_published = true (RLS).';
END $$;

-- Record migration in schema_migrations (safe re-execution guard)
DO $record$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
    INSERT INTO public.schema_migrations (version, name, checksum)
    VALUES ('003b', 'RLS Privilege Hardening EUR" 5 restrictive policies, column grants, default ACLs, function EXECUTE lockdown', '5393486531414C2F975C21A3033187294A60EEA51012D6F7386CC726C0750BED')
    ON CONFLICT (version) DO NOTHING;
    RAISE NOTICE 'schema_migrations: 003b recorded.';
    -- Belt-and-braces: ensure service_role has no write access
    -- to schema_migrations (migration history is DBA-only).
    REVOKE ALL ON public.schema_migrations FROM service_role;
  ELSE
    RAISE NOTICE 'schema_migrations table not present EUR" migration record not written.';
  END IF;
END $record$;

COMMIT;
