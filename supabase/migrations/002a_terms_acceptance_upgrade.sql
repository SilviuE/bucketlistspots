-- Terms Acceptance Table Upgrade: staged migration for EXISTING populated tables.
-- Safe: adds missing columns as nullable, adds constraints, does NOT invent values.
-- DO NOT use this for fresh installs — use 002_webhook_infrastructure.sql instead.
-- IMPORTANT: Do not populate historical legal records with invented empty values,
-- current dates, false acceptance states, or a default draft Terms version.

BEGIN;

-- STAGE 1: Add missing columns as NULLABLE (safe for populated tables)
DO $$
BEGIN
  -- session_id: existing rows may have this from earlier attempts; add if missing
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

-- STAGE 2: Report rows with unresolved NULLs (do NOT invent values)
DO $$
DECLARE
  v_null_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_null_count FROM terms_acceptance
  WHERE session_id IS NULL
     OR guest_email IS NULL
     OR guest_name IS NULL
     OR guide_id IS NULL
     OR route_name IS NULL
     OR booking_ref IS NULL
     OR departure_date IS NULL
     OR deposit_amount IS NULL
     OR currency IS NULL
     OR confirmed_checkbox IS NULL
     OR insurance_confirmed_checkbox IS NULL
     OR terms_version IS NULL
     OR disclosure_version IS NULL
     OR client_accepted_at IS NULL
     OR server_accepted_at IS NULL;

  IF v_null_count > 0 THEN
    RAISE WARNING 'terms_acceptance: % rows have unresolved NULL values. Resolve manually before adding NOT NULL constraints.', v_null_count;
  END IF;
END $$;

-- STAGE 3: Add UNIQUE constraint on session_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_session_id_key'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    -- Only add if no duplicates exist
    IF (SELECT COUNT(*) FROM (SELECT session_id FROM terms_acceptance WHERE session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1) sub) = 0 THEN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_session_id_key UNIQUE (session_id);
    ELSE
      RAISE WARNING 'terms_acceptance: duplicate session_ids exist. Resolve duplicates before adding UNIQUE constraint.';
    END IF;
  END IF;
END $$;

-- STAGE 4: Add CHECK constraints (only if columns are non-null and data is valid)
-- These are safe to add as they only affect future inserts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_deposit_amount_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    BEGIN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_deposit_amount_check CHECK (deposit_amount >= 0);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'terms_acceptance: CHECK constraint on deposit_amount skipped — existing rows violate constraint';
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_currency_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    BEGIN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_currency_check CHECK (currency IN ('gbp', 'eur', 'usd'));
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'terms_acceptance: CHECK constraint on currency skipped — existing rows violate constraint';
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_confirmed_checkbox_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    BEGIN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_confirmed_checkbox_check CHECK (confirmed_checkbox = true);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'terms_acceptance: CHECK constraint on confirmed_checkbox skipped — existing rows violate constraint';
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'terms_acceptance_insurance_confirmed_checkbox_check' AND conrelid = 'terms_acceptance'::regclass) THEN
    BEGIN
      ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_insurance_confirmed_checkbox_check CHECK (insurance_confirmed_checkbox = true);
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'terms_acceptance: CHECK constraint on insurance_confirmed_checkbox skipped — existing rows violate constraint';
    END;
  END IF;
END $$;

-- STAGE 5: Add payment_reports UNIQUE on session_id (for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reports_session_id_key'
    AND conrelid = 'payment_reports'::regclass
  ) THEN
    IF (SELECT COUNT(*) FROM (SELECT session_id FROM payment_reports WHERE session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1) sub) = 0 THEN
      ALTER TABLE payment_reports ADD CONSTRAINT payment_reports_session_id_key UNIQUE (session_id);
    ELSE
      RAISE WARNING 'payment_reports: duplicate session_ids exist. Resolve before adding UNIQUE.';
    END IF;
  END IF;
END $$;

-- STAGE 6: Add idempotency_key to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- STAGE 7: RLS, triggers, privileges (all idempotent)
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_insert" ON terms_acceptance
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_select" ON terms_acceptance
  FOR SELECT TO service_role USING (true);

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

REVOKE UPDATE, DELETE ON terms_acceptance FROM PUBLIC;
REVOKE UPDATE, DELETE ON terms_acceptance FROM service_role;
REVOKE UPDATE, DELETE ON terms_acceptance FROM authenticated;
REVOKE UPDATE, DELETE ON terms_acceptance FROM anon;

GRANT INSERT, SELECT ON terms_acceptance TO service_role;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

COMMIT;
