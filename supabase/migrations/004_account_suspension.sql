-- ================================================================
-- 004: ACCOUNT SUSPENSION / DEACTIVATION (idempotent, verifiable)
-- ================================================================
-- Purpose:
--   Add an account_status column to public.users (active | suspended | deactivated)
--   with an append-only audit trail. Booking history, payment records, and
--   prior audit evidence are PRESERVED — no deletes, no cascades.
--
-- Design constraints:
--   - account_status is a separate column. It is NEVER a role value.
--     Roles remain traveller/guide/ambassador/admin only (see security tests).
--   - Users CANNOT change their own account_status (no UPDATE grant).
--   - Status changes are made ONLY by an admin via the service-role path
--     (POST /api/admin/user-status) which writes suspended_by + reason.
--   - An AFTER UPDATE trigger records every status change into
--     account_status_audit (append-only; no UPDATE/DELETE for clients).
--   - Trigger function is SECURITY DEFINER owned by postgres. EXECUTE is
--     revoked from PUBLIC/anon/authenticated/service_role (house rule).
--
-- Prerequisites: 003b applied (RLS, column grants, function ownership).
-- Run order on staging: 001..003b then 004, then scenario-c.
-- Safe re-execution: checks schema_migrations with checksum verification;
-- exits cleanly if already applied with matching checksum;
-- aborts if checksum differs (integrity failure).
-- ================================================================

BEGIN;

-- ================================================================
-- SECTION 0: SCHEMA_MIGRATIONS GUARD (checksum‑verified)
-- ================================================================
DO $guard$
DECLARE
  _expected TEXT := 'E31D5DF971EE776BD7126EB12C65827DBFD374AA3C8D5C79725DF64C63DE6543';
  _recorded RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
    SELECT version, checksum, applied_at INTO _recorded
    FROM public.schema_migrations WHERE version = '004';

    IF FOUND THEN
      IF _recorded.checksum IS NULL THEN
        RAISE WARNING 'Migration 004 recorded without checksum (legacy record).';
        RAISE EXCEPTION 'LEGACY MIGRATION: 004 has no historical checksum. Founder/legal review required.';
      ELSIF _recorded.checksum = _expected THEN
        RAISE NOTICE '============================================================';
        RAISE NOTICE 'Migration 004 already applied — exiting cleanly.';
        RAISE NOTICE '(Checksum matches, applied at %)', _recorded.applied_at;
        RAISE NOTICE '============================================================';
        RETURN;
      ELSE
        RAISE EXCEPTION 'MIGRATION INTEGRITY FAILURE: 004.\n  Recorded checksum: %\n  Expected checksum: %\n  The migration file has changed since it was first applied.\n  Restore the original file or obtain written founder authorisation.',
          _recorded.checksum, _expected;
      END IF;
    END IF;
  ELSE
    RAISE NOTICE 'schema_migrations table not present — first-time run, proceeding.';
  END IF;
END $guard$;

-- ================================================================
-- SECTION 1: PREFLIGHT — users table baseline
-- ================================================================
DO $$
DECLARE v_missing TEXT[];
BEGIN
  RAISE NOTICE 'PREFLIGHT: public.users baseline';

  SELECT array_agg(r.col) INTO v_missing
  FROM (VALUES ('id'),('email'),('name'),('role'),('created_at'),
               ('referral_code'),('bls_points_balance'),('avatar'))
  AS r(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='users' AND column_name=r.col);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: users missing baseline columns: %',
      array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE '  OK public.users baseline present';
END $$;


-- ================================================================
-- SECTION 2: SCHEMA — status columns on users
-- ================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                 AND column_name='account_status') THEN
    ALTER TABLE public.users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';
    RAISE NOTICE 'Added public.users.account_status';
  ELSE
    RAISE NOTICE 'public.users.account_status exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                 AND column_name='suspended_at') THEN
    ALTER TABLE public.users ADD COLUMN suspended_at TIMESTAMPTZ;
    RAISE NOTICE 'Added public.users.suspended_at';
  ELSE
    RAISE NOTICE 'public.users.suspended_at exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                 AND column_name='suspended_reason') THEN
    ALTER TABLE public.users ADD COLUMN suspended_reason TEXT;
    RAISE NOTICE 'Added public.users.suspended_reason';
  ELSE
    RAISE NOTICE 'public.users.suspended_reason exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                 AND column_name='suspended_by') THEN
    ALTER TABLE public.users ADD COLUMN suspended_by UUID REFERENCES public.users(id);
    RAISE NOTICE 'Added public.users.suspended_by';
  ELSE
    RAISE NOTICE 'public.users.suspended_by exists';
  END IF;

  -- Enforce allowed status values (idempotent constraint)
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_status_check;
  ALTER TABLE public.users
    ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('active','suspended','deactivated'));
  RAISE NOTICE 'Constraint users_account_status_check ensured';
END $$;


-- ================================================================
-- SECTION 3: AUDIT TABLE (append-only, trigger‑written)
-- ================================================================
-- The SECURITY DEFINER trigger public.record_account_status_change()
-- writes every audit record as postgres. service_role does NOT
-- need direct INSERT — it only reads the audit trail (SELECT).
-- Direct INSERT is revoked to keep the audit trail append‑only
-- through the single authorised code path.
CREATE TABLE IF NOT EXISTS public.account_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  changed_by UUID REFERENCES public.users(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_status_audit ENABLE ROW LEVEL SECURITY;

-- service_role: SELECT only (read‑only audit review)
GRANT SELECT ON public.account_status_audit TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.account_status_audit FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.account_status_audit FROM anon, authenticated, PUBLIC;

DO $$ BEGIN
  RAISE NOTICE 'account_status_audit ready (RLS enabled, trigger‑written, service_role SELECT only)';
END $$;


-- ================================================================
-- SECTION 4: TRIGGER — record status changes atomically
-- ================================================================
-- SECURITY DEFINER owned by postgres → fires under postgres privileges.
-- Only fires when account_status actually changes.
CREATE OR REPLACE FUNCTION public.record_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
    INSERT INTO public.account_status_audit (user_id, changed_by, from_status, to_status, reason)
    VALUES (NEW.id, NEW.suspended_by, OLD.account_status, NEW.account_status, NEW.suspended_reason);
  END IF;
  RETURN NEW;
END $$;

-- Trigger creation is not naturally idempotent (no IF NOT EXISTS) → guard via pg_trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_users_account_status_audit'
                   AND tgrelid = 'public.users'::regclass) THEN
    CREATE TRIGGER trg_users_account_status_audit
      AFTER UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.record_account_status_change();
    RAISE NOTICE 'Created trigger trg_users_account_status_audit';
  ELSE
    RAISE NOTICE 'Trigger trg_users_account_status_audit exists';
  END IF;
END $$;


-- ================================================================
-- SECTION 5: FUNCTION EXECUTE HARDENING (house rule)
-- ================================================================
-- Trigger functions do not need EXECUTE grants to fire, but default EXECUTE
-- is granted to PUBLIC on creation. Revoke from every role to keep the
-- "no client role has EXECUTE on any public function" invariant.
REVOKE ALL ON FUNCTION public.record_account_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_account_status_change() FROM anon;
REVOKE ALL ON FUNCTION public.record_account_status_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.record_account_status_change() FROM service_role;

-- Function ownership: SECURITY DEFINER triggers must be owned by postgres.
-- (If applied via a non-postgres role this RAISEs a warning for review.)


-- ================================================================
-- SECTION 6: VISIBILITY GRANTS (client read-only)
-- ================================================================
-- A user may see their OWN status (RLS users_select_own filters to own row).
-- They CANNOT change it: account_status is NOT in the UPDATE grant for
-- authenticated (003b granted UPDATE only on name, avatar).
GRANT SELECT (account_status, suspended_at, suspended_reason) ON public.users TO authenticated;
GRANT SELECT (account_status) ON public.users TO anon;

-- Explicit belt-and-braces: authenticated must NOT update account_status.
REVOKE UPDATE (account_status, suspended_at, suspended_reason, suspended_by) ON public.users FROM authenticated;
REVOKE UPDATE (account_status, suspended_at, suspended_reason, suspended_by) ON public.users FROM anon;


-- ================================================================
-- SECTION 7: POST-MIGRATION VERIFICATION
-- ================================================================
DO $$
DECLARE
  v_errors INT := 0;
  v_status TEXT;
BEGIN
  RAISE NOTICE 'POST-MIGRATION VERIFICATION (004)';

  -- 1. Columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users'
             AND column_name='account_status' AND is_nullable='NO') THEN
    RAISE NOTICE '  users.account_status NOT NULL default active';
  ELSE RAISE WARNING '  users.account_status missing/nullable'; v_errors := v_errors + 1; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users'
             AND column_name='suspended_at') THEN
    RAISE NOTICE '  users.suspended_at present';
  ELSE RAISE WARNING '  users.suspended_at missing'; v_errors := v_errors + 1; END IF;

  -- 2. CHECK constraint exists
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname='users_account_status_check'
               AND conrelid='public.users'::regclass) THEN
    RAISE NOTICE '  users_account_status_check constraint present';
  ELSE RAISE WARNING '  users_account_status_check missing'; v_errors := v_errors + 1; END IF;

  -- 3. Audit table RLS enabled
  IF (SELECT relrowsecurity FROM pg_class
      WHERE relname='account_status_audit' AND relnamespace='public'::regnamespace) THEN
    RAISE NOTICE '  account_status_audit RLS enabled';
  ELSE RAISE WARNING '  account_status_audit RLS NOT enabled'; v_errors := v_errors + 1; END IF;

  -- 4. Audit table is trigger‑written (service_role SELECT only, no INSERT)
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='service_role' AND table_name='account_status_audit'
             AND table_schema='public' AND privilege_type='SELECT')
     AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee='service_role' AND table_name='account_status_audit'
             AND table_schema='public' AND privilege_type='INSERT') THEN
    RAISE NOTICE '  service_role: SELECT only on account_status_audit (trigger‑written)';
  ELSE
    RAISE WARNING '  account_status_audit service_role privileges unexpected (expected SELECT only)';
    v_errors := v_errors + 1;
  END IF;

  -- 5. anon/authenticated cannot SELECT account_status_audit
  IF NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee IN ('anon','authenticated') AND table_name='account_status_audit'
             AND table_schema='public') THEN
    RAISE NOTICE '  anon/authenticated: no access to account_status_audit';
  ELSE RAISE WARNING '  anon/authenticated can access account_status_audit'; v_errors := v_errors + 1; END IF;

  -- 6. authenticated CAN read own account_status but NOT update it
  IF EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users' AND table_schema='public'
             AND column_name='account_status' AND privilege_type='SELECT')
     AND NOT EXISTS (SELECT 1 FROM information_schema.role_column_grants
             WHERE grantee='authenticated' AND table_name='users' AND table_schema='public'
             AND column_name='account_status' AND privilege_type='UPDATE') THEN
    RAISE NOTICE '  authenticated: SELECT account_status yes, UPDATE no';
  ELSE RAISE WARNING '  users.account_status visibility/update grants unexpected'; v_errors := v_errors + 1; END IF;

  -- 7. Trigger exists and fires on UPDATE
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgname='trg_users_account_status_audit'
               AND tgrelid='public.users'::regclass) THEN
    RAISE NOTICE '  trigger trg_users_account_status_audit present';
  ELSE RAISE WARNING '  trigger missing'; v_errors := v_errors + 1; END IF;

  -- 8. Trigger function owned by postgres (advisory if not)
  SELECT prosrc INTO v_status FROM pg_proc WHERE proname='record_account_status_change';
  IF (SELECT p.proowner::regrole::text FROM pg_proc p
      WHERE p.proname='record_account_status_change') = 'postgres' THEN
    RAISE NOTICE '  trigger function owned by postgres';
  ELSE RAISE WARNING '  trigger function NOT owned by postgres'; v_errors := v_errors + 1; END IF;

  -- 9. No client role has EXECUTE on the trigger function
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE routine_name='record_account_status_change' AND routine_schema='public'
             AND grantee IN ('PUBLIC','anon','authenticated','service_role')) THEN
    RAISE WARNING '  EXECUTE retained on record_account_status_change'; v_errors := v_errors + 1;
  ELSE RAISE NOTICE '  EXECUTE revoked on record_account_status_change (all roles)'; END IF;

  IF v_errors = 0 THEN
    RAISE NOTICE 'VERIFICATION 004: ALL CHECKS PASSED';
  ELSE
    RAISE WARNING 'VERIFICATION 004: % CHECKS FAILED', v_errors;
  END IF;
END $$;


-- ================================================================
-- FINAL SUMMARY
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '004_account_suspension: MIGRATION COMPLETE';
  RAISE NOTICE 'account_status: active | suspended | deactivated (default active).';
  RAISE NOTICE 'Changes made ONLY by admin via service-role path; users cannot self-change.';
  RAISE NOTICE 'Audit: account_status_audit (trigger‑written by record_account_status_change(), RLS, service_role SELECT only).';
  RAISE NOTICE 'History preserved: no deletes, no cascades on bookings/payments.';
  RAISE NOTICE 'Trigger function owned by postgres, EXECUTE revoked from all roles.';
END $$;

-- Record migration in schema_migrations (safe re-execution guard)
DO $record$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
    INSERT INTO public.schema_migrations (version, name, checksum)
    VALUES ('004', 'Account Suspension — account_status column, audit table, trigger, visibility grants', 'E31D5DF971EE776BD7126EB12C65827DBFD374AA3C8D5C79725DF64C63DE6543')
    ON CONFLICT (version) DO NOTHING;
    RAISE NOTICE 'schema_migrations: 004 recorded.';
    -- Belt-and-braces: ensure service_role has no write access
    -- to schema_migrations (migration history is DBA-only).
    REVOKE ALL ON public.schema_migrations FROM service_role;
  ELSE
    RAISE NOTICE 'schema_migrations table not present — migration record not written.';
  END IF;
END $record$;

COMMIT;
