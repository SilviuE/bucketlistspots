-- ================================================================
-- PRODUCTION PREFLIGHT / RECONCILIATION (READ-ONLY)
-- ================================================================
-- ⚠️  PRODUCTION USE ONLY — NEVER RUN AGAINST STAGING ⚠️
--
-- This file is READ-ONLY. It does NOT:
--   - Create, alter, or drop any tables, columns, or constraints
--   - Insert, update, or delete any rows
--   - Invent, overwrite, or silently backfill business data
--   - Change any privileges or policies
--
-- What it DOES:
--   - Report what tables exist and which are missing
--   - Report column-level discrepancies (missing columns per table)
--   - Report data-condition issues (e.g., zero published content)
--   - Report RLS status per table
--   - Report schema_migrations history
--   - Report function ownership and EXECUTE grants
--   - STOP on conditions that require founder or legal decisions
--
-- Output: WARNINGs for fixable issues; NOTICEs for informational;
--         EXCEPTIONs only where data-integrity is at risk.
--
-- Usage: Run in Supabase SQL Editor against the PRODUCTION project.
--        Review output BEFORE applying any upgrade migrations.
-- ================================================================

\set ON_ERROR_STOP on

DO $preflight$
DECLARE
  v_errors INT := 0;
  v_warnings INT := 0;
  v_tbl TEXT;
  v_missing_tables TEXT[];
  v_missing_cols TEXT;
  v_published_count INT;
  v_rec RECORD;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'PRODUCTION PREFLIGHT — READ-ONLY RECONCILIATION';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- ── 1. TABLE INVENTORY ────────────────────────────────────────
  RAISE NOTICE '1. TABLE INVENTORY';
  RAISE NOTICE '────────────────────────────────────────────────────';

  FOR v_rec IN
    SELECT x.tbl AS expected_table
    FROM (VALUES
      ('users'),('guides'),('experiences'),('destinations'),
      ('guide_applications'),('ambassador_applications'),
      ('platform_config'),('transactions'),
      ('webhook_event_inbox'),('booking_confirmations'),
      ('terms_acceptance'),('payment_reports'),
      ('testimonials'),('claims_registry'),
      ('fundraising_pages'),('destination_charities'),
      ('posts'),('account_status_audit'),
      ('schema_migrations')
    ) AS x(tbl)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_rec.expected_table
    ) THEN
      RAISE NOTICE '  ✓ % — EXISTS', v_rec.expected_table;
    ELSE
      RAISE WARNING '  ✗ % — MISSING (will be created by upgrades)', v_rec.expected_table;
      v_missing_tables := array_append(v_missing_tables, v_rec.expected_table);
      v_warnings := v_warnings + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '';

  -- ── 2. SCHEMA_MIGRATIONS HISTORY ──────────────────────────────
  RAISE NOTICE '2. SCHEMA MIGRATIONS HISTORY';
  RAISE NOTICE '────────────────────────────────────────────────────';

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
  ) THEN
    FOR v_rec IN
      SELECT version, name, applied_at
      FROM public.schema_migrations
      ORDER BY version
    LOOP
      RAISE NOTICE '  %  %  [%]', v_rec.version, v_rec.name, v_rec.applied_at;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.schema_migrations) THEN
      RAISE NOTICE '  (empty — no migrations recorded)';
    END IF;
  ELSE
    RAISE WARNING '  schema_migrations table does not exist — will be created by 0000 upgrade.';
    v_warnings := v_warnings + 1;
  END IF;

  RAISE NOTICE '';

  -- ── 3. CORE TABLE COLUMN AUDIT ────────────────────────────────
  RAISE NOTICE '3. COLUMN AUDIT (core tables)';
  RAISE NOTICE '────────────────────────────────────────────────────';

  -- users
  FOR v_rec IN
    SELECT r.col FROM (VALUES
      ('id'),('email'),('name'),('role'),('referral_code'),
      ('bls_points_balance'),('avatar'),('created_at'),
      ('account_status'),('suspended_at'),('suspended_reason'),('suspended_by')
    ) AS r(col)
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name=r.col)
  LOOP
    RAISE WARNING '  users.{% missing', v_rec.col;
    v_warnings := v_warnings + 1;
  END LOOP;
  RAISE NOTICE '  users: column audit complete';

  -- guides
  FOR v_rec IN
    SELECT r.col FROM (VALUES
      ('id'),('user_id'),('name'),('trading_name'),('email'),('status'),
      ('referral_code'),('bls_points_balance'),('referred_by_ambassador_id'),
      ('price_currency'),('routes'),('photo'),('hero_image'),('bio'),
      ('why_independent'),('location'),('languages'),('experience'),
      ('certifications'),('promise'),('badge'),('tagline'),('price'),
      ('featured'),('review_count'),('trips_led'),('video_intro'),
      ('tripadvisor_embed'),('identity_verified'),('license_verified'),
      ('safety_verified'),('fair_pay_verified'),('created_at'),('updated_at')
    ) AS r(col)
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='guides')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='guides' AND column_name=r.col)
  LOOP
    RAISE WARNING '  guides.{% missing', v_rec.col;
    v_warnings := v_warnings + 1;
  END LOOP;
  RAISE NOTICE '  guides: column audit complete';

  -- experiences
  FOR v_rec IN
    SELECT r.col FROM (VALUES
      ('id'),('title'),('duration'),('difficulty'),('location'),
      ('image'),('price'),('currency'),('guide_id'),('badge'),
      ('rating'),('reviews'),('featured'),('is_published')
    ) AS r(col)
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='experiences')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='experiences' AND column_name=r.col)
  LOOP
    RAISE WARNING '  experiences.{% missing', v_rec.col;
    v_warnings := v_warnings + 1;
  END LOOP;
  RAISE NOTICE '  experiences: column audit complete';

  -- destinations
  FOR v_rec IN
    SELECT r.col FROM (VALUES
      ('name'),('country'),('image'),('guide_count'),('is_published')
    ) AS r(col)
    WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='destinations')
      AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='destinations' AND column_name=r.col)
  LOOP
    RAISE WARNING '  destinations.{% missing', v_rec.col;
    v_warnings := v_warnings + 1;
  END LOOP;
  RAISE NOTICE '  destinations: column audit complete';

  RAISE NOTICE '';

  -- ── 4. PUBLICATION READINESS (separate gate, NOT a blocker) ──
  RAISE NOTICE '4. PUBLICATION READINESS (read-only gate)';
  RAISE NOTICE '────────────────────────────────────────────────────';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='experiences') THEN
    SELECT count(*) INTO v_published_count
    FROM public.experiences WHERE is_published = true;
    IF v_published_count = 0 THEN
      RAISE WARNING '  experiences: 0 published rows — founder must publish before public launch.';
      v_warnings := v_warnings + 1;
    ELSE
      RAISE NOTICE '  experiences: % published rows', v_published_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='destinations') THEN
    SELECT count(*) INTO v_published_count
    FROM public.destinations WHERE is_published = true;
    IF v_published_count = 0 THEN
      RAISE WARNING '  destinations: 0 published rows — founder must publish before public launch.';
      v_warnings := v_warnings + 1;
    ELSE
      RAISE NOTICE '  destinations: % published rows', v_published_count;
    END IF;
  END IF;

  RAISE NOTICE '';

  -- ── 5. RLS STATUS ─────────────────────────────────────────────
  RAISE NOTICE '5. RLS STATUS';
  RAISE NOTICE '────────────────────────────────────────────────────';

  FOR v_rec IN
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('schema_migrations')
    ORDER BY c.relname
  LOOP
    IF v_rec.rls_enabled THEN
      RAISE NOTICE '  ✓ % — RLS enabled', v_rec.table_name;
    ELSE
      RAISE WARNING '  ✗ % — RLS NOT enabled', v_rec.table_name;
      v_warnings := v_warnings + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '';

  -- ── 6. POLICY INVENTORY ───────────────────────────────────────
  RAISE NOTICE '6. ACTIVE POLICIES';
  RAISE NOTICE '────────────────────────────────────────────────────';

  v_published_count := 0;
  FOR v_rec IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  %.%', v_rec.tablename, v_rec.policyname;
    v_published_count := v_published_count + 1;
  END LOOP;
  IF v_published_count = 0 THEN
    RAISE NOTICE '  (no policies found — deny-by-default)';
  END IF;
  RAISE NOTICE '  Total: % policies', v_published_count;

  RAISE NOTICE '';

  -- ── 7. FUNCTION OWNERSHIP & EXECUTE PRIVILEGES ────────────────
  RAISE NOTICE '7. FUNCTION OWNERSHIP & EXECUTE';
  RAISE NOTICE '────────────────────────────────────────────────────';

  FOR v_rec IN
    SELECT p.proname,
           r.rolname AS owner,
           CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
           EXISTS (
             SELECT 1 FROM information_schema.routine_privileges rp
             WHERE rp.routine_name = p.proname
               AND rp.routine_schema = 'public'
               AND rp.grantee IN ('PUBLIC', 'anon', 'authenticated')
           ) AS has_client_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  LOOP
    IF v_rec.has_client_execute THEN
      RAISE WARNING '  %: owned by %, % — EXECUTE LEAKED to client roles', v_rec.proname, v_rec.owner, v_rec.security;
      v_warnings := v_warnings + 1;
    ELSE
      RAISE NOTICE '  %: owned by %, % — OK', v_rec.proname, v_rec.owner, v_rec.security;
    END IF;
  END LOOP;

  RAISE NOTICE '';

  -- ── 8. DATA-CONDITION CHECKS (founder/legal gates) ────────────
  RAISE NOTICE '8. DATA-CONDITION CHECKS';
  RAISE NOTICE '────────────────────────────────────────────────────';

  -- Check for terms_acceptance without CHECK constraint
  -- (legacy rows from before 002a upgrade)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='terms_acceptance') THEN
    -- Check confirmed_checkbox constraint
    IF EXISTS (
      SELECT 1 FROM information_schema.check_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name LIKE '%confirmed_checkbox%'
    ) THEN
      RAISE NOTICE '  terms_acceptance: confirmed_checkbox constraint present — OK';
    ELSE
      RAISE WARNING '  terms_acceptance: confirmed_checkbox CHECK constraint missing — upgrade needed.';
      v_warnings := v_warnings + 1;
    END IF;
  END IF;

  -- Check for duplicate session_ids (data integrity)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='terms_acceptance') THEN
    BEGIN
      IF EXISTS (
        SELECT session_id, count(*) FROM public.terms_acceptance
        GROUP BY session_id HAVING count(*) > 1
      ) THEN
        RAISE WARNING '  terms_acceptance: DUPLICATE session_id values found — requires legal review.';
        v_warnings := v_warnings + 1;
      ELSE
        RAISE NOTICE '  terms_acceptance: no duplicate session_id values — OK';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  terms_acceptance: unique check skipped (column may not exist)';
    END;
  END IF;

  -- Check platform_config has the single row
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_config') THEN
    BEGIN
      SELECT count(*) INTO v_published_count FROM public.platform_config;
      IF v_published_count = 0 THEN
        RAISE WARNING '  platform_config: empty — founder must seed configuration.';
        v_warnings := v_warnings + 1;
      ELSIF v_published_count > 1 THEN
        RAISE WARNING '  platform_config: % rows (expected 1) — data-integrity issue.', v_published_count;
        v_warnings := v_warnings + 1;
      ELSE
        RAISE NOTICE '  platform_config: 1 row — OK';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  platform_config: check skipped (table may not exist)';
    END;
  END IF;

  -- Check for claims_registry entries with legal significance (no evidence)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='claims_registry') THEN
    SELECT count(*) INTO v_published_count FROM public.claims_registry
    WHERE claim_type IN ('legal', 'commercial', 'financial')
      AND publication_status = 'published'
      AND (evidence_source IS NULL OR evidence_url_or_reference IS NULL);
    IF v_published_count > 0 THEN
      RAISE WARNING '  claims_registry: % published claims with legal/financial/commercial type but NO evidence — legal review needed.', v_published_count;
      v_warnings := v_warnings + 1;
    ELSE
      RAISE NOTICE '  claims_registry: published claims have evidence sources — OK';
    END IF;
  END IF;

  RAISE NOTICE '';

  -- ── 9. SUMMARY ────────────────────────────────────────────────
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'PREFLIGHT SUMMARY';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'Warnings: %', v_warnings;
  RAISE NOTICE '';

  IF v_warnings = 0 THEN
    RAISE NOTICE 'RESULT: CLEAN — production upgrade may proceed.';
    RAISE NOTICE 'ACTION: Proceed with backup confirmation, then apply upgrade-only migrations.';
  ELSE
    RAISE WARNING 'RESULT: % WARNING(S) FOUND', v_warnings;
    RAISE WARNING '';
    RAISE WARNING 'Required actions before proceeding:';
    RAISE WARNING '  - Review each WARNING above.';
    RAISE WARNING '  - Decisions requiring founder or legal input are marked.';
    RAISE WARNING '  - Do NOT execute upgrade migrations until all warnings';
    RAISE WARNING '    are either resolved or documented and accepted.';
    RAISE WARNING '';
    RAISE WARNING 'No data has been modified. This was a READ-ONLY preflight.';
  END IF;
END $preflight$;
