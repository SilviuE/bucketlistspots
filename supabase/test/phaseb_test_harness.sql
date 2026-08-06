-- ================================================================
-- PHASE B DISPOSABLE DATABASE TEST HARNESS
-- ================================================================
-- Builds a completely empty PostgreSQL database using ONLY
-- committed files. No manual/temporary SQL except the documented
-- Supabase-compatible stub setup.
--
-- This harness:
--   1. Creates Supabase-compatible stub (auth schema, roles)
--   2. Applies 0000_core_schema.sql
--   3. Applies 003b_rls_privilege_hardening.sql
--   4. Applies 004_account_suspension.sql
--   5. Applies staging seed
--   6. Runs comprehensive verification
--   7. Tests application REST queries via SET ROLE
--
-- Usage: psql -U postgres -f supabase/test/phaseb_test_harness.sql
-- ================================================================

\set ON_ERROR_STOP on
\timing on

-- ================================================================
-- SETUP: Supabase-compatible stub environment
-- ================================================================
DO $stub$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE B TEST HARNESS: Setting up environment';
  RAISE NOTICE '══════════════════════════════════════════';
END $stub$;

-- Create Supabase-compatible roles
DO $$ BEGIN
  CREATE ROLE anon WITH LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE authenticated WITH LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE service_role WITH LOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER ROLE service_role BYPASSRLS;
DO $$ BEGIN
  CREATE ROLE supabase_admin WITH LOGIN CREATEDB CREATEROLE BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant auth schema usage
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_admin;

-- Stub auth.users (minimal for FK references)
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  role TEXT DEFAULT 'authenticated'
);

-- Stub auth functions referenced by RLS policies
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    'anon'
  );
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $stub$ BEGIN
  RAISE NOTICE 'Stub environment ready.';
END $stub$;


-- ================================================================
-- PHASE 1: Apply 0000_core_schema.sql (baseline)
-- ================================================================
DO $p1$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 1: Applying 0000_core_schema.sql';
  RAISE NOTICE '══════════════════════════════════════════';
END $p1$;

\i supabase/migrations/0000_core_schema.sql


-- ================================================================
-- PHASE 2: Apply 003b_rls_privilege_hardening.sql
-- ================================================================
DO $p2$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 2: Applying 003b_rls_privilege_hardening.sql';
  RAISE NOTICE '══════════════════════════════════════════';
END $p2$;

-- Create test published content (003b no longer aborts without it, but verifies)
INSERT INTO public.experiences (title, duration, difficulty, location, price, currency, guide_id, is_published)
VALUES ('Test Experience', '3 days', 'Easy', 'Test Location', 100.00, 'usd', 'guide-test', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.destinations (name, country, image, guide_count, is_published)
VALUES ('Test Destination', 'Testland', '/test.jpg', 1, true)
ON CONFLICT (name) DO NOTHING;

\i supabase/migrations/003b_rls_privilege_hardening.sql


-- ================================================================
-- PHASE 3: Apply 004_account_suspension.sql
-- ================================================================
DO $p3$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 3: Applying 004_account_suspension.sql';
  RAISE NOTICE '══════════════════════════════════════════';
END $p3$;

\i supabase/migrations/004_account_suspension.sql


-- ================================================================
-- PHASE 4: Apply staging seed
-- ================================================================
DO $p4$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 4: Applying staging seed';
  RAISE NOTICE '══════════════════════════════════════════';
END $p4$;

-- Stub auth.users for seed FK references (posts references auth.users)
INSERT INTO auth.users (id, email, role) VALUES
  ('22222222-2222-2222-2222-222222222222', 'guide-test@bucketlistspots.com', 'authenticated')
ON CONFLICT (id) DO NOTHING;

\i supabase/seed/staging_seed.sql


-- ================================================================
-- PHASE 5: Idempotency re-run (verify safe re-execution)
-- ================================================================
DO $p5$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 5: Idempotency re-run checks';
  RAISE NOTICE '══════════════════════════════════════════';
END $p5$;

-- Re-run 0000 (should exit cleanly)
DO $rerun$ BEGIN
  RAISE NOTICE '--- Re-running 0000 (expect clean exit) ---';
END $rerun$;
\i supabase/migrations/0000_core_schema.sql

-- Re-run 003b (should exit cleanly via schema_migrations guard)
DO $rerun$ BEGIN
  RAISE NOTICE '--- Re-running 003b (expect clean exit) ---';
END $rerun$;
\i supabase/migrations/003b_rls_privilege_hardening.sql

-- Re-run 004 (should exit cleanly via schema_migrations guard)
DO $rerun$ BEGIN
  RAISE NOTICE '--- Re-running 004 (expect clean exit) ---';
END $rerun$;
\i supabase/migrations/004_account_suspension.sql


-- ================================================================
-- PHASE 6: COMPREHENSIVE VERIFICATION
-- ================================================================
DO $p6$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 6: Comprehensive Verification';
  RAISE NOTICE '══════════════════════════════════════════';
END $p6$;

-- ── 6a. Table Inventory ─────────────────────────────────────────
DO $h$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- 6a. Table Inventory ---';
END $h$;

SELECT tablename AS "TABLE"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ── 6b. Column Inventory ────────────────────────────────────────
DO $h$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '--- 6b. Column Inventory ---';
END $h$;

SELECT table_name AS "TABLE",
       column_name AS "COLUMN",
       data_type AS "TYPE",
       is_nullable AS "NULL?",
       column_default AS "DEFAULT"
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ── 6c. Constraints ─────────────────────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6c. Constraints ---'; END $h$;

SELECT tc.table_name AS "TABLE",
       tc.constraint_name AS "CONSTRAINT",
       tc.constraint_type AS "TYPE",
       pg_get_constraintdef(pgc.oid) AS "DEFINITION"
FROM information_schema.table_constraints tc
JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;


-- ── 6d. Indexes ─────────────────────────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6d. Indexes ---'; END $h$;

SELECT tablename AS "TABLE",
       indexname AS "INDEX",
       indexdef AS "DEFINITION"
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ── 6e. RLS-Enabled Tables ──────────────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6e. RLS-Enabled Tables ---'; END $h$;

SELECT c.relname AS "TABLE",
       c.relrowsecurity AS "RLS_ENABLED"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname NOT IN ('schema_migrations')
ORDER BY c.relname;


-- ── 6f. Policy Inventory ────────────────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6f. Policy Inventory ---'; END $h$;

SELECT tablename AS "TABLE",
       policyname AS "POLICY"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ── 6g. Function Ownership & EXECUTE Privileges ─────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6g. Function Ownership ---'; END $h$;

SELECT p.proname AS "FUNCTION",
       r.rolname AS "OWNER",
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS "SECURITY"
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public'
ORDER BY p.proname;


DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6g. EXECUTE Privileges ---'; END $h$;

SELECT routine_name AS "FUNCTION",
       grantee AS "GRANTEE",
       privilege_type AS "PRIVILEGE"
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name, grantee;


-- ── 6h. Default ACL Verification ────────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6h. Default ACLs ---'; END $h$;

SELECT d.defaclobjtype AS "OBJ_TYPE",
       r.rolname AS "OWNER",
       d.defaclacl::text AS "ACL"
FROM pg_default_acl d
JOIN pg_roles r ON r.oid = d.defaclrole
WHERE d.defaclnamespace = 'public'::regnamespace
ORDER BY d.defaclobjtype, r.rolname;


-- ── 6i. Schema Migrations History ───────────────────────────────
DO $h$ BEGIN RAISE NOTICE ''; RAISE NOTICE '--- 6i. Schema Migrations ---'; END $h$;

SELECT version AS "VERSION",
       name AS "NAME",
       applied_at AS "APPLIED_AT"
FROM public.schema_migrations
ORDER BY version;


-- ================================================================
-- PHASE 7: APPLICATION REST-QUERY TESTS
-- ================================================================
DO $p7$ BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE 7: Application REST-Query Tests';
  RAISE NOTICE '══════════════════════════════════════════';
END $p7$;

-- Clean up test auth users if present
DELETE FROM auth.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Insert auth stub users for test sessions
INSERT INTO auth.users (id, email, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin-test@bucketlistspots.com', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'guide-test@bucketlistspots.com', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'traveller-test@bucketlistspots.com', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- ── 7a. ANON: Can SELECT published guides ───────────────────────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE anon;
  SELECT count(*) INTO v_count FROM public.guides WHERE status = 'published';
  IF v_count >= 2 THEN
    RAISE NOTICE 'PASS: 7a — anon can SELECT published guides (% rows)', v_count;
  ELSE
    RAISE WARNING 'FAIL: 7a — anon got % published guides (expected >=2)', v_count;
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7a — anon guides SELECT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7b. ANON: Can SELECT published experiences (RLS filters) ─────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE anon;
  SELECT count(*) INTO v_count FROM public.experiences;
  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: 7b — anon can SELECT published experiences via RLS (% rows)', v_count;
  ELSE
    RAISE WARNING 'FAIL: 7b — anon got 0 published experiences via RLS';
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7b — anon experiences SELECT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7c. ANON: Can SELECT published destinations (RLS filters) ────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE anon;
  SELECT count(*) INTO v_count FROM public.destinations;
  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: 7c — anon can SELECT published destinations via RLS (% rows)', v_count;
  ELSE
    RAISE WARNING 'FAIL: 7c — anon got 0 published destinations via RLS';
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7c — anon destinations SELECT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7d. ANON: Cannot see users (RLS returns 0 rows) ─────────────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE anon;
  SELECT count(*) INTO v_count FROM public.users;
  IF v_count = 0 THEN
    RAISE NOTICE 'PASS: 7d — anon sees 0 users (RLS deny)';
  ELSE
    RAISE WARNING 'FAIL: 7d — anon sees % users (expected 0)', v_count;
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7d — anon blocked from users (hard deny): %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7e. ANON: Cannot SELECT guide_applications ──────────────────
DO $test$
BEGIN
  SET ROLE anon;
  PERFORM count(*) FROM public.guide_applications;
  RAISE WARNING 'FAIL: 7e — anon SHOULD NOT read guide_applications';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7e — anon blocked from guide_applications: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7f. ANON: Cannot SELECT account_status_audit ────────────────
DO $test$
BEGIN
  SET ROLE anon;
  PERFORM count(*) FROM public.account_status_audit;
  RAISE WARNING 'FAIL: 7f — anon SHOULD NOT read account_status_audit';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7f — anon blocked from account_status_audit: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7g. ANON: Cannot SELECT platform_config ─────────────────────
DO $test$
BEGIN
  SET ROLE anon;
  PERFORM count(*) FROM public.platform_config;
  RAISE WARNING 'FAIL: 7g — anon SHOULD NOT read platform_config';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7g — anon blocked from platform_config: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7h. AUTHENTICATED: user can SELECT own row ──────────────────
DO $test$
DECLARE v_count INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SET ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.users;
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS: 7h — authenticated sees own user row (1 row)';
  ELSE
    RAISE WARNING 'FAIL: 7h — authenticated sees % rows (expected 1)', v_count;
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7h — authenticated users SELECT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7i. AUTHENTICATED: Cannot UPDATE role ───────────────────────
DO $test$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SET ROLE authenticated;
  UPDATE public.users SET role = 'admin' WHERE id = '22222222-2222-2222-2222-222222222222';
  RAISE WARNING 'FAIL: 7i — authenticated SHOULD NOT update role';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7i — authenticated blocked from role UPDATE: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7j. AUTHENTICATED: Cannot SELECT guide_applications ─────────
DO $test$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  SET ROLE authenticated;
  PERFORM count(*) FROM public.guide_applications;
  RAISE WARNING 'FAIL: 7j — authenticated SHOULD NOT read guide_applications';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7j — authenticated blocked from guide_applications: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7k. SERVICE_ROLE: Can INSERT into webhook_event_inbox ───────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE service_role;
  INSERT INTO public.webhook_event_inbox (event_id, event_type, stripe_session_id, payload)
  VALUES ('evt_test_001', 'checkout.session.completed', 'cs_test_001', '{}'::jsonb)
  ON CONFLICT (event_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.webhook_event_inbox;
  IF v_count > 0 THEN
    RAISE NOTICE 'PASS: 7k — service_role can INSERT webhook_event_inbox (% rows)', v_count;
  ELSE
    RAISE WARNING 'FAIL: 7k — service_role webhook INSERT failed';
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7k — service_role webhook INSERT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7l. SERVICE_ROLE: Can SELECT platform_config ────────────────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE service_role;
  SELECT count(*) INTO v_count FROM public.platform_config;
  IF v_count = 1 THEN
    RAISE NOTICE 'PASS: 7l — service_role can SELECT platform_config (1 row)';
  ELSE
    RAISE WARNING 'FAIL: 7l — platform_config has % rows (expected 1)', v_count;
  END IF;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7l — service_role platform_config error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7m. SERVICE_ROLE: Can SELECT account_status_audit ───────────
DO $test$
DECLARE v_count INT;
BEGIN
  SET ROLE service_role;
  SELECT count(*) INTO v_count FROM public.account_status_audit;
  RAISE NOTICE 'PASS: 7m — service_role can SELECT account_status_audit (% rows)', v_count;
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'FAIL: 7m — service_role account_status_audit SELECT error: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7n. ANON: Cannot UPDATE users ───────────────────────────────
DO $test$
BEGIN
  SET ROLE anon;
  UPDATE public.users SET name = 'HACKED' WHERE email = 'guide-test@bucketlistspots.com';
  RAISE WARNING 'FAIL: 7n — anon SHOULD NOT update users';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7n — anon blocked from users UPDATE: %', SQLERRM;
  RESET ROLE;
END $test$;

-- ── 7o. ANON: Cannot INSERT guides ──────────────────────────────
DO $test$
BEGIN
  SET ROLE anon;
  INSERT INTO public.guides (id, name, status) VALUES ('hack-guide', 'Hacked Guide', 'published');
  RAISE WARNING 'FAIL: 7o — anon SHOULD NOT insert guides';
  RESET ROLE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PASS: 7o — anon blocked from guides INSERT: %', SQLERRM;
  RESET ROLE;
END $test$;


-- ================================================================
-- FINAL RESULT
-- ================================================================
DO $final$
DECLARE
  v_pass INT := 0;
  v_fail INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PHASE B HARNESS: EXECUTION COMPLETE';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the output above for PASS/FAIL results.';
  RAISE NOTICE 'Expected: All 15 REST-query tests (7a-7o) PASS.';
  RAISE NOTICE 'Expected: 20 tables in public schema.';
  RAISE NOTICE 'Expected: RLS enabled on all 19 application tables.';
  RAISE NOTICE 'Expected: 5 hardened policies post-003b.';
  RAISE NOTICE 'Expected: service_role=arwd table default ACL.';
  RAISE NOTICE 'Expected: schema_migrations records: 0000, 003b, 004.';
  RAISE NOTICE '';
  RAISE NOTICE 'Re-run checks: 0000, 003b, 004 all exited cleanly.';
END $final$;
