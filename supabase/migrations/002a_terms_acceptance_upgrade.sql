-- Terms Acceptance Table Upgrade: staged migration for EXISTING production databases.
-- DO NOT use for fresh installs — use 002_webhook_infrastructure.sql instead.
--
-- Stages:
--   1. Preflight: schema report (columns, constraints, NULL counts)
--   2. Backfill check: confirm table is empty or all NULLs resolvable
--   3. Upgrade: add columns, indexes, RLS, triggers, privileges
--   4. Final constraints: abort if violations remain (NOT NULL, CHECK, UNIQUE)
--   5. Rollback: procedure documented at end
--
-- IMPORTANT: Do not populate historical legal records with invented values.
-- Server-generated fields (termsVersion, bookingRef, serverAcceptedAt) are
-- written only by the webhook handler for future records.

-- ═══════════════════════════════════════════════════════════════════
-- STAGE 1: PREFLIGHT — Schema Report
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_missing_columns TEXT[];
  v_existing_constraints TEXT[];
  v_row_count BIGINT;
  v_null_session_id BIGINT;
  v_null_confirmed BIGINT;
  v_null_terms_version BIGINT;
BEGIN
  -- Report missing columns
  SELECT array_agg(column_name) INTO v_missing_columns
  FROM (VALUES ('session_id'), ('guest_email'), ('guest_name'), ('guide_id'),
                ('route_name'), ('booking_ref'), ('departure_date'), ('deposit_amount'),
                ('currency'), ('confirmed_checkbox'), ('insurance_confirmed_checkbox'),
                ('terms_version'), ('disclosure_version'), ('client_accepted_at'),
                ('server_accepted_at'), ('created_at'))
  AS required(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terms_acceptance' AND column_name = required.col
  );

  IF v_missing_columns IS NOT NULL AND array_length(v_missing_columns, 1) > 0 THEN
    RAISE WARNING 'PREFLIGHT: terms_acceptance is missing columns: %', array_to_string(v_missing_columns, ', ');
  ELSE
    RAISE NOTICE 'PREFLIGHT: All required columns present.';
  END IF;

  -- Report row count
  SELECT COUNT(*) INTO v_row_count FROM terms_acceptance;
  RAISE NOTICE 'PREFLIGHT: terms_acceptance has % rows.', v_row_count;

  -- Report NULL counts for critical columns
  IF v_row_count > 0 THEN
    SELECT COUNT(*) INTO v_null_session_id FROM terms_acceptance WHERE session_id IS NULL;
    SELECT COUNT(*) INTO v_null_confirmed FROM terms_acceptance WHERE confirmed_checkbox IS NULL;
    SELECT COUNT(*) INTO v_null_terms_version FROM terms_acceptance WHERE terms_version IS NULL;
    RAISE NOTICE 'PREFLIGHT: NULL counts — session_id: %, confirmed_checkbox: %, terms_version: %',
      v_null_session_id, v_null_confirmed, v_null_terms_version;
  END IF;

  -- Report existing constraints
  SELECT array_agg(conname) INTO v_existing_constraints
  FROM pg_constraint
  WHERE conrelid = 'terms_acceptance'::regclass;

  IF v_existing_constraints IS NOT NULL THEN
    RAISE NOTICE 'PREFLIGHT: Existing constraints: %', array_to_string(v_existing_constraints, ', ');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- STAGE 2: BACKFILL CHECK — Confirm no NULL violations remain
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_total_rows BIGINT;
  v_null_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total_rows FROM terms_acceptance;

  -- If table is empty, skip all checks — this is a fresh-ish database
  IF v_total_rows = 0 THEN
    RAISE NOTICE 'BACKFILL CHECK: Table is empty. All checks will pass.';
    RETURN;
  END IF;

  -- Check for rows that would violate future NOT NULL constraints
  SELECT COUNT(*) INTO v_null_rows
  FROM terms_acceptance
  WHERE session_id IS NULL
     OR confirmed_checkbox IS NULL
     OR insurance_confirmed_checkbox IS NULL
     OR terms_version IS NULL;

  IF v_null_rows > 0 THEN
    RAISE WARNING 'BACKFILL CHECK: % of % rows have NULL values in required columns. '
      'NOT NULL constraints will be SKIPPED for existing rows. '
      'Run the backfill script before adding NOT NULL constraints.',
      v_null_rows, v_total_rows;
  ELSE
    RAISE NOTICE 'BACKFILL CHECK: All % rows have non-NULL values for required columns.', v_total_rows;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- STAGE 3: UPGRADE — Add columns, indexes, RLS, triggers
-- ═══════════════════════════════════════════════════════════════════

-- 3a. Add missing columns as NULLABLE (safe for populated tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'session_id') THEN
    ALTER TABLE terms_acceptance ADD COLUMN session_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guest_email') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guest_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guest_name') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guest_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guide_id') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guide_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'route_name') THEN
    ALTER TABLE terms_acceptance ADD COLUMN route_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'booking_ref') THEN
    ALTER TABLE terms_acceptance ADD COLUMN booking_ref TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'departure_date') THEN
    ALTER TABLE terms_acceptance ADD COLUMN departure_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'deposit_amount') THEN
    ALTER TABLE terms_acceptance ADD COLUMN deposit_amount NUMERIC(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'currency') THEN
    ALTER TABLE terms_acceptance ADD COLUMN currency TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'confirmed_checkbox') THEN
    ALTER TABLE terms_acceptance ADD COLUMN confirmed_checkbox BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'insurance_confirmed_checkbox') THEN
    ALTER TABLE terms_acceptance ADD COLUMN insurance_confirmed_checkbox BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'terms_version') THEN
    ALTER TABLE terms_acceptance ADD COLUMN terms_version TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'disclosure_version') THEN
    ALTER TABLE terms_acceptance ADD COLUMN disclosure_version TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'client_accepted_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN client_accepted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'server_accepted_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN server_accepted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'created_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3b. UNIQUE constraint on session_id (conditional, with duplicate check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_session_id_key'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    IF (SELECT COUNT(*) FROM (SELECT session_id FROM terms_acceptance WHERE session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1) sub) = 0 THEN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_session_id_key UNIQUE (session_id);
      RAISE NOTICE 'UPGRADE: Added UNIQUE constraint on terms_acceptance.session_id';
    ELSE
      RAISE WARNING 'UPGRADE: Duplicate session_ids exist. Resolve before adding UNIQUE.';
    END IF;
  ELSE
    RAISE NOTICE 'UPGRADE: UNIQUE constraint on terms_acceptance.session_id already exists.';
  END IF;
END $$;

-- 3c. payment_reports session_id UNIQUE (conditional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reports_session_id_key'
    AND conrelid = 'payment_reports'::regclass
  ) THEN
    IF (SELECT COUNT(*) FROM (SELECT session_id FROM payment_reports WHERE session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1) sub) = 0 THEN
      ALTER TABLE payment_reports ADD CONSTRAINT payment_reports_session_id_key UNIQUE (session_id);
      RAISE NOTICE 'UPGRADE: Added UNIQUE constraint on payment_reports.session_id';
    ELSE
      RAISE WARNING 'UPGRADE: payment_reports duplicate session_ids exist.';
    END IF;
  END IF;
END $$;

-- 3d. transactions.idempotency_key
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3e. RLS
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_insert" ON terms_acceptance
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_select" ON terms_acceptance
  FOR SELECT TO service_role USING (true);

-- 3f. Triggers (idempotent)
CREATE OR REPLACE FUNCTION reject_terms_acceptance_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'terms_acceptance records are immutable. UPDATE and DELETE operations are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reject_terms_update ON terms_acceptance;
CREATE TRIGGER trg_reject_terms_update
  BEFORE UPDATE ON terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION reject_terms_acceptance_update_delete();

DROP TRIGGER IF EXISTS trg_reject_terms_delete ON terms_acceptance;
CREATE TRIGGER trg_reject_terms_delete
  BEFORE DELETE ON terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION reject_terms_acceptance_update_delete();

-- 3g. Revoke UPDATE/DELETE
REVOKE UPDATE, DELETE ON terms_acceptance FROM PUBLIC;
REVOKE UPDATE, DELETE ON terms_acceptance FROM service_role;
REVOKE UPDATE, DELETE ON terms_acceptance FROM authenticated;
REVOKE UPDATE, DELETE ON terms_acceptance FROM anon;

-- 3h. Grant INSERT/SELECT to service_role
GRANT INSERT, SELECT ON terms_acceptance TO service_role;

-- 3i. Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

-- ═══════════════════════════════════════════════════════════════════
-- STAGE 4: FINAL CONSTRAINTS — Abort on violations
-- ═══════════════════════════════════════════════════════════════════

-- Only apply CHECK constraints if there are no violating rows
DO $$
DECLARE
  v_violations BIGINT;
BEGIN
  -- Check confirmed_checkbox: must be true (or NULL for legacy rows — skip)
  SELECT COUNT(*) INTO v_violations
  FROM terms_acceptance
  WHERE confirmed_checkbox IS NOT NULL AND confirmed_checkbox = false;

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: % rows have confirmed_checkbox = false. '
      'Fix before re-running migration.', v_violations;
  END IF;

  -- Check insurance_confirmed_checkbox
  SELECT COUNT(*) INTO v_violations
  FROM terms_acceptance
  WHERE insurance_confirmed_checkbox IS NOT NULL AND insurance_confirmed_checkbox = false;

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: % rows have insurance_confirmed_checkbox = false. '
      'Fix before re-running migration.', v_violations;
  END IF;

  -- Check currency
  SELECT COUNT(*) INTO v_violations
  FROM terms_acceptance
  WHERE currency IS NOT NULL AND currency NOT IN ('gbp', 'eur', 'usd');

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: % rows have invalid currency. '
      'Fix before re-running migration.', v_violations;
  END IF;

  -- Check deposit_amount
  SELECT COUNT(*) INTO v_violations
  FROM terms_acceptance
  WHERE deposit_amount IS NOT NULL AND deposit_amount < 0;

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'CONSTRAINT CHECK FAILED: % rows have negative deposit_amount. '
      'Fix before re-running migration.', v_violations;
  END IF;

  RAISE NOTICE 'CONSTRAINT CHECK: All data validation passed.';
END $$;

-- Apply CHECK constraints (now safe — we verified no violations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_confirmed_checkbox_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_confirmed_checkbox_check CHECK (confirmed_checkbox = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_insurance_confirmed_checkbox_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_insurance_confirmed_checkbox_check CHECK (insurance_confirmed_checkbox = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_currency_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_currency_check CHECK (currency IN ('gbp', 'eur', 'usd'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_deposit_amount_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_deposit_amount_check CHECK (deposit_amount >= 0);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- STAGE 5: NOT NULL constraints (only if all rows satisfy them)
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_null_count BIGINT;
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM terms_acceptance;

  -- Only apply NOT NULL if table is empty OR no NULLs
  SELECT COUNT(*) INTO v_null_count FROM terms_acceptance
    WHERE session_id IS NULL OR confirmed_checkbox IS NULL
    OR insurance_confirmed_checkbox IS NULL OR terms_version IS NULL;

  IF v_null_count = 0 THEN
    -- Apply NOT NULL constraints
    BEGIN ALTER TABLE terms_acceptance ALTER COLUMN session_id SET NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'NOT NULL skip: session_id'; END;
    BEGIN ALTER TABLE terms_acceptance ALTER COLUMN confirmed_checkbox SET NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'NOT NULL skip: confirmed_checkbox'; END;
    BEGIN ALTER TABLE terms_acceptance ALTER COLUMN insurance_confirmed_checkbox SET NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'NOT NULL skip: insurance_confirmed_checkbox'; END;
    BEGIN ALTER TABLE terms_acceptance ALTER COLUMN terms_version SET NOT NULL; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'NOT NULL skip: terms_version'; END;
    RAISE NOTICE 'NOT NULL: Constraints applied to % rows.', v_total;
  ELSE
    RAISE WARNING 'NOT NULL: Skipped — % of % rows have NULL values. '
      'Apply NOT NULL after backfilling.', v_null_count, v_total;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK PROCEDURE
-- ═══════════════════════════════════════════════════════════════════
-- If this migration causes issues, run the following to rollback:
--
-- BEGIN;
--
-- -- Remove constraints added by this migration
-- ALTER TABLE terms_acceptance DROP CONSTRAINT IF EXISTS terms_acceptance_confirmed_checkbox_check;
-- ALTER TABLE terms_acceptance DROP CONSTRAINT IF EXISTS terms_acceptance_insurance_confirmed_checkbox_check;
-- ALTER TABLE terms_acceptance DROP CONSTRAINT IF EXISTS terms_acceptance_currency_check;
-- ALTER TABLE terms_acceptance DROP CONSTRAINT IF EXISTS terms_acceptance_deposit_amount_check;
-- ALTER TABLE terms_acceptance DROP CONSTRAINT IF EXISTS terms_acceptance_session_id_key;
-- ALTER TABLE payment_reports DROP CONSTRAINT IF EXISTS payment_reports_session_id_key;
--
-- -- Remove NOT NULL constraints
-- ALTER TABLE terms_acceptance ALTER COLUMN session_id DROP NOT NULL;
-- ALTER TABLE terms_acceptance ALTER COLUMN confirmed_checkbox DROP NOT NULL;
-- ALTER TABLE terms_acceptance ALTER COLUMN insurance_confirmed_checkbox DROP NOT NULL;
-- ALTER TABLE terms_acceptance ALTER COLUMN terms_version DROP NOT NULL;
--
-- -- Remove triggers
-- DROP TRIGGER IF EXISTS trg_reject_terms_update ON terms_acceptance;
-- DROP TRIGGER IF EXISTS trg_reject_terms_delete ON terms_acceptance;
-- DROP FUNCTION IF EXISTS reject_terms_acceptance_update_delete();
--
-- -- Remove columns (only if safe — no data loss)
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS session_id;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS guest_email;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS guest_name;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS guide_id;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS route_name;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS booking_ref;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS departure_date;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS deposit_amount;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS currency;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS confirmed_checkbox;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS insurance_confirmed_checkbox;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS terms_version;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS disclosure_version;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS client_accepted_at;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS server_accepted_at;
-- ALTER TABLE terms_acceptance DROP COLUMN IF EXISTS created_at;
--
-- -- Remove idempotency_key from transactions
-- DROP INDEX IF EXISTS idx_transactions_idempotency_key;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS idempotency_key;
--
-- -- Restore previous RLS
-- ALTER TABLE terms_acceptance DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
-- DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
--
-- -- Re-restore previous permissions
-- REVOKE INSERT, SELECT ON terms_acceptance FROM service_role;
--
-- COMMIT;

COMMIT;
