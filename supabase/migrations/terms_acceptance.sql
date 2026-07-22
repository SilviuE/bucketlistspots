-- Terms Acceptance Records: append-only audit trail for Terms acceptance
-- Server-generated timestamps prevent client manipulation.
-- Records are immutable once inserted (no UPDATE/DELETE policies).

CREATE TABLE IF NOT EXISTS terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  guest_email TEXT,
  guest_name TEXT,
  guide_id TEXT,
  route_name TEXT,
  booking_ref TEXT,
  departure_date TEXT,
  deposit_amount NUMERIC(12,2),
  currency TEXT,
  confirmed_checkbox BOOLEAN NOT NULL DEFAULT false,
  insurance_confirmed_checkbox BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT NOT NULL,
  disclosure_version TEXT NOT NULL,
  client_accepted_at TEXT,
  server_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent updates and deletes: historical records are immutable
ALTER TABLE terms_acceptance DISABLE ROW LEVEL SECURITY;

-- Index for lookups by session_id and email
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

-- RLS: only service role can access (admin-only via API with service role key)
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terms_acceptance_service_only" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_only" ON terms_acceptance
  FOR ALL TO service_role USING (true);

-- Prevent UPDATE and DELETE even from service_role (append-only)
DROP POLICY IF EXISTS "terms_acceptance_no_update" ON terms_acceptance;
CREATE POLICY "terms_acceptance_no_update" ON terms_acceptance
  FOR UPDATE TO service_role USING (false);

DROP POLICY IF EXISTS "terms_acceptance_no_delete" ON terms_acceptance;
CREATE POLICY "terms_acceptance_no_delete" ON terms_acceptance
  FOR DELETE TO service_role USING (false);
