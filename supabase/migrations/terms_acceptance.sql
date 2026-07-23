-- Terms Acceptance Records: append-only audit trail for Terms acceptance
-- Atomic, safely repeatable migration (idempotent).
-- Server-generated timestamps prevent client manipulation.
-- Records are immutable: UPDATE and DELETE are blocked at both the trigger and privilege level.

BEGIN;

-- 1. Create table with proper types and constraints
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  guest_email TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guide_id TEXT NOT NULL,
  route_name TEXT NOT NULL,
  booking_ref TEXT NOT NULL,
  departure_date DATE NOT NULL,
  deposit_amount NUMERIC(12,2) NOT NULL CHECK (deposit_amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('gbp', 'eur', 'usd')),
  confirmed_checkbox BOOLEAN NOT NULL DEFAULT false CHECK (confirmed_checkbox = true),
  insurance_confirmed_checkbox BOOLEAN NOT NULL DEFAULT false CHECK (insurance_confirmed_checkbox = true),
  terms_version TEXT NOT NULL CHECK (length(terms_version) > 0),
  disclosure_version TEXT NOT NULL CHECK (length(disclosure_version) > 0),
  client_accepted_at TIMESTAMPTZ NOT NULL,
  server_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

-- 3. Revoke UPDATE and DELETE privileges from all roles
REVOKE UPDATE, DELETE ON terms_acceptance FROM PUBLIC;
REVOKE UPDATE, DELETE ON terms_acceptance FROM service_role;
REVOKE UPDATE, DELETE ON terms_acceptance FROM authenticated;
REVOKE UPDATE, DELETE ON terms_acceptance FROM anon;

-- 4. RLS: only service role can INSERT and SELECT
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_insert" ON terms_acceptance
  FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_select" ON terms_acceptance
  FOR SELECT TO service_role USING (true);

-- 5. Trigger: reject all UPDATE and DELETE operations at the row level
--    This provides defence-in-depth alongside privilege revocation.
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

-- 6. Grant only INSERT and SELECT to service_role
GRANT INSERT, SELECT ON terms_acceptance TO service_role;

COMMIT;
