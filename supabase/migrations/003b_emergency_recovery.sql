-- ================================================================
-- 003b: EMERGENCY RECOVERY
-- ================================================================
-- Run in a DISPOSABLE Supabase project SQL Editor.
-- DO NOT run against production.
--
-- EMERGENCY USE ONLY — not a standard rollback.
-- Restores minimum access for the 4 browser-accessible tables.
-- Does NOT restore TRUNCATE, REFERENCES, TRIGGER, broad SELECT,
-- insecure defaults, or original policy grants.
--
-- Use case: production 003b migration caused unexpected access issues
-- and catalogue or user profile queries are broken.
--
-- Recovery target: 003b_rls_privilege_hardening.sql applied state.
-- ================================================================

DO $$ BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'EMERGENCY RECOVERY: 003b_rls_privilege_hardening';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;


-- STEP 1: Drop 5 restrictive policies created by 003b
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'users_select_own',
        'users_update_own_name_avatar',
        'guides_select_published',
        'experiences_select_published',
        'destinations_select_published'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
  RAISE NOTICE 'Dropped 5 restrictive policies';
END $$;


-- STEP 2: Restore minimum catalogue access policies
-- anon: read published guides
CREATE POLICY "guides_select_published"
  ON guides FOR SELECT TO anon
  USING (status = 'published');

-- anon: read published experiences
CREATE POLICY "experiences_select_published"
  ON experiences FOR SELECT TO anon
  USING (is_published = true);

-- anon: read published destinations
CREATE POLICY "destinations_select_published"
  ON destinations FOR SELECT TO anon
  USING (is_published = true);

-- authenticated: read published guides
CREATE POLICY "guides_select_published_auth"
  ON guides FOR SELECT TO authenticated
  USING (status = 'published');

-- authenticated: read published experiences
CREATE POLICY "experiences_select_published_auth"
  ON experiences FOR SELECT TO authenticated
  USING (is_published = true);

-- authenticated: read published destinations
CREATE POLICY "destinations_select_published_auth"
  ON destinations FOR SELECT TO authenticated
  USING (is_published = true);

-- authenticated: own profile read
CREATE POLICY "users_select_own"
  ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- authenticated: own profile update (name, avatar only)
CREATE POLICY "users_update_own_name_avatar"
  ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

RAISE NOTICE 'Recreated minimum catalogue + user profile policies';


-- STEP 3: Verify recovery
DO $$
DECLARE
  v_errors INT := 0;
BEGIN
  RAISE NOTICE 'RECOVERY VERIFICATION';

  -- anon: CAN read published guides
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='guides' AND privilege_type='SELECT') THEN
    RAISE NOTICE '  anon: CAN select guides';
  ELSE
    RAISE WARNING 'anon CANNOT select guides'; v_errors := v_errors + 1;
  END IF;

  -- anon: CAN read published experiences
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='experiences' AND privilege_type='SELECT') THEN
    RAISE NOTICE '  anon: CAN select experiences';
  ELSE
    RAISE WARNING 'anon CANNOT select experiences'; v_errors := v_errors + 1;
  END IF;

  -- anon: CAN read published destinations
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='destinations' AND privilege_type='SELECT') THEN
    RAISE NOTICE '  anon: CAN select destinations';
  ELSE
    RAISE WARNING 'anon CANNOT select destinations'; v_errors := v_errors + 1;
  END IF;

  -- anon: CANNOT select users (still blocked)
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='anon' AND table_name='users' AND privilege_type='SELECT') THEN
    RAISE WARNING 'anon CAN select users — recovery did NOT preserve user privacy'; v_errors := v_errors + 1;
  ELSE
    RAISE NOTICE '  anon: CANNOT select users (privacy preserved)';
  END IF;

  -- authenticated: CAN read own profile
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users'
             AND privilege_type='UPDATE' AND column_name='name') THEN
    RAISE NOTICE '  authenticated: CAN update users.name';
  ELSE
    RAISE WARNING 'authenticated CANNOT update users.name'; v_errors := v_errors + 1;
  END IF;

  -- Verify column-level model: anon has NO access to users
  IF NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                 WHERE grantee='anon' AND table_name='users' AND privilege_type='SELECT') THEN
    RAISE NOTICE '  anon: CANNOT select users (column-level model intact)';
  ELSE
    RAISE WARNING 'anon CAN select users — column-level model broken'; v_errors := v_errors + 1;
  END IF;

  -- Verify column-level model: authenticated has SELECT on 6 users columns only
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users'
             AND privilege_type='SELECT' AND column_name='referral_code') THEN
    RAISE WARNING 'authenticated can SELECT users.referral_code — column-level model broken'; v_errors := v_errors + 1;
  ELSE
    RAISE NOTICE '  authenticated: CANNOT select users.referral_code (column-level model intact)';
  END IF;

  IF v_errors = 0 THEN
    RAISE NOTICE 'RECOVERY: ALL CHECKS PASSED';
  ELSE
    RAISE WARNING 'RECOVERY: % CHECKS FAILED', v_errors;
  END IF;
END $$;

DO $$ BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'EMERGENCY RECOVERY: COMPLETE';
  RAISE NOTICE 'Restored: minimum catalogue + user profile access.';
  RAISE NOTICE 'NOT restored: TRUNCATE/REFERENCES/TRIGGER, broad SELECT,';
  RAISE NOTICE '  original policy grants, insecure defaults.';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
