-- Terms Acceptance Table Upgrade Migration
-- Safe upgrade: adds missing columns, constraints, privileges, and triggers
-- without losing existing records. Idempotent (safe to run multiple times).
-- Run this INSTEAD OF terms_acceptance.sql if the table already exists.

BEGIN;

-- 1. Add missing columns (safe: no-op if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'session_id') THEN
    ALTER TABLE terms_acceptance ADD COLUMN session_id TEXT NOT NULL UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guest_email') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guest_email TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guest_name') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guest_name TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'guide_id') THEN
    ALTER TABLE terms_acceptance ADD COLUMN guide_id TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'route_name') THEN
    ALTER TABLE terms_acceptance ADD COLUMN route_name TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'booking_ref') THEN
    ALTER TABLE terms_acceptance ADD COLUMN booking_ref TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'departure_date') THEN
    ALTER TABLE terms_acceptance ADD COLUMN departure_date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'deposit_amount') THEN
    ALTER TABLE terms_acceptance ADD COLUMN deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'currency') THEN
    ALTER TABLE terms_acceptance ADD COLUMN currency TEXT NOT NULL DEFAULT 'usd';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'confirmed_checkbox') THEN
    ALTER TABLE terms_acceptance ADD COLUMN confirmed_checkbox BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'insurance_confirmed_checkbox') THEN
    ALTER TABLE terms_acceptance ADD COLUMN insurance_confirmed_checkbox BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'terms_version') THEN
    ALTER TABLE terms_acceptance ADD COLUMN terms_version TEXT NOT NULL DEFAULT 'draft-0.3';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'disclosure_version') THEN
    ALTER TABLE terms_acceptance ADD COLUMN disclosure_version TEXT NOT NULL DEFAULT 'draft-0.3';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'client_accepted_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN client_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'server_accepted_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN server_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'terms_acceptance' AND column_name = 'created_at') THEN
    ALTER TABLE terms_acceptance ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 2. Add UNIQUE constraint on session_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_session_id_key'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_session_id_key UNIQUE (session_id);
  END IF;
END $$;

-- 3. Add CHECK constraints if missing (safe: only adds, never removes)
DO $$
BEGIN
  -- deposit_amount >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_deposit_amount_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_deposit_amount_check CHECK (deposit_amount >= 0);
  END IF;

  -- currency IN ('gbp', 'eur', 'usd')
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_currency_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_currency_check CHECK (currency IN ('gbp', 'eur', 'usd'));
  END IF;

  -- confirmed_checkbox = true
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_confirmed_checkbox_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_confirmed_checkbox_check CHECK (confirmed_checkbox = true);
  END IF;

  -- insurance_confirmed_checkbox = true
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_insurance_confirmed_checkbox_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_insurance_confirmed_checkbox_check CHECK (insurance_confirmed_checkbox = true);
  END IF;

  -- terms_version length > 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_terms_version_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_terms_version_check CHECK (length(terms_version) > 0);
  END IF;

  -- disclosure_version length > 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptance_disclosure_version_check'
    AND conrelid = 'terms_acceptance'::regclass
  ) THEN
    ALTER TABLE terms_acceptance ADD CONSTRAINT terms_acceptance_disclosure_version_check CHECK (length(disclosure_version) > 0);
  END IF;
END $$;

-- 4. Revoke UPDATE and DELETE privileges from all roles
REVOKE UPDATE, DELETE ON terms_acceptance FROM PUBLIC;
REVOKE UPDATE, DELETE ON terms_acceptance FROM service_role;
REVOKE UPDATE, DELETE ON terms_acceptance FROM authenticated;
REVOKE UPDATE, DELETE ON terms_acceptance FROM anon;

-- 5. RLS: enable if not already enabled
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;

-- 6. Recreate RLS policies (DROP IF EXISTS is safe)
DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_insert" ON terms_acceptance
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_select" ON terms_acceptance
  FOR SELECT TO service_role USING (true);

-- 7. Recreate trigger function and triggers (DROP IF EXISTS is safe)
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

-- 8. Grant only INSERT and SELECT to service_role
GRANT INSERT, SELECT ON terms_acceptance TO service_role;

-- 9. Create indexes if missing (CREATE INDEX IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

COMMIT;
