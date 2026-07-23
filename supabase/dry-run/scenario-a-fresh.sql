-- ═══════════════════════════════════════════════════════════════════
-- SCENARIO A: FRESH DATABASE — Full Migration Sequence
-- ═══════════════════════════════════════════════════════════════════
-- Run this in a DISPOSABLE Supabase project SQL Editor.
-- Assumes: Supabase Auth tables (auth.users) already exist.
-- Does NOT assume: guides, users (public), or any custom tables.
--
-- Expected: All tables, constraints, indexes, functions, triggers,
-- RLS policies and privileges created successfully.
-- ═══════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- STEP 0: Create prerequisite tables that migrations depend on
-- (guides, users, guide_applications — not in migrations, created by app)
-- ────────────────────────────────────────────────────────────────

-- Minimal guides table (the app creates this via Supabase Dashboard or first guide signup)
CREATE TABLE IF NOT EXISTS public.guides (
  id TEXT PRIMARY KEY,
  name TEXT,
  trading_name TEXT,
  email TEXT,
  status TEXT DEFAULT 'draft',
  referral_code TEXT UNIQUE,
  bls_points_balance INTEGER NOT NULL DEFAULT 0,
  referred_by_ambassador_id TEXT,
  price_currency TEXT DEFAULT 'usd',
  routes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',
  referral_code TEXT UNIQUE,
  bls_points_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal guide_applications table
CREATE TABLE IF NOT EXISTS public.guide_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES auth.users(id),
  guide_name TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending',
  referred_by_ambassador_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: platform_config
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  promotional_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  standard_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  promotional_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promotional_end_date TIMESTAMPTZ,
  saas_monthly_fee_gbp NUMERIC(8,2) NOT NULL DEFAULT 50.00,
  referral_program_enabled BOOLEAN NOT NULL DEFAULT true,
  charity_challenges_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO platform_config (id, promotional_commission_pct, standard_commission_pct, promotional_start_date, promotional_end_date, saas_monthly_fee_gbp)
VALUES (1, 0.2000, 0.1800, NOW(), NOW() + INTERVAL '6 months', 50.00)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_admin" ON platform_config;
CREATE POLICY "platform_config_admin" ON platform_config FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: platform_config_expansion
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS founding_guide_start_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS founding_guide_end_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months');
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS founding_guide_is_active BOOLEAN DEFAULT true;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS founding_guide_copy TEXT DEFAULT 'During the first six months of the BucketListSpots platform promotional period, approved guides pay no membership or verification charge. Guides join with Standard status and may apply for an upgrade when eligible.';
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS global_pricing_zones_enabled BOOLEAN DEFAULT true;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS global_pricing_zones_public_copy TEXT DEFAULT 'After the promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions. Pricing will be communicated before the Founding Guide period ends.';
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS global_pricing_zone_names JSONB DEFAULT '["Global Zone A", "Global Zone B", "Global Zone C"]';
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS referral_max_gbp NUMERIC(6,2) DEFAULT 50.00;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS referral_max_eur NUMERIC(6,2) DEFAULT 50.00;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS referral_max_usd NUMERIC(6,2) DEFAULT 50.00;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS referral_cap_pct NUMERIC(5,4) DEFAULT 0.1500;
ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS trust_gate_checks JSONB DEFAULT '[{"key":"identity","label":"Identity Review"},{"key":"licence","label":"Licence and Documentation"},{"key":"references","label":"Experience and References"},{"key":"interview","label":"Safety and Operational Interview"},{"key":"approval","label":"Profile Approval"}]';

-- ═══════════════════════════════════════════════════════════════════
-- STEP 3: referral_program
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS bls_points_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bls_points_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  linked_referral_code TEXT,
  linked_booking_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 4: payment_reports
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  guide_id TEXT,
  guest_name TEXT,
  guest_email TEXT,
  route_name TEXT,
  booking_date TEXT,
  presentment_currency TEXT NOT NULL DEFAULT 'usd',
  presentment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  settlement_currency TEXT,
  settlement_amount NUMERIC(12,2),
  total_stripe_fee NUMERIC(12,2),
  net_settlement_amount NUMERIC(12,2),
  stripe_balance_transaction_id TEXT,
  stripe_processing_fee NUMERIC(12,2),
  stripe_conversion_fee NUMERIC(12,2),
  stripe_settlement_fee NUMERIC(12,2),
  referral_code TEXT,
  referral_discount_amount NUMERIC(12,2) DEFAULT 0,
  gross_platform_fee NUMERIC(12,2) DEFAULT 0,
  platform_fee_pct NUMERIC(5,4) DEFAULT 0.2000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_reports_created_at ON payment_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_reports_guide_id ON payment_reports(guide_id);
CREATE INDEX IF NOT EXISTS idx_payment_reports_currency ON payment_reports(presentment_currency);
ALTER TABLE payment_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_reports_admin_only" ON payment_reports;
CREATE POLICY "payment_reports_admin_only" ON payment_reports FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 5: ambassador_commission
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS referred_by_ambassador_id TEXT;
ALTER TABLE public.guide_applications ADD COLUMN IF NOT EXISTS referred_by_ambassador_code TEXT;
CREATE INDEX IF NOT EXISTS idx_guides_referred_by ON public.guides(referred_by_ambassador_id);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 6: 001_landing_page_infrastructure (claims_registry + testimonials + platform_config seed)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claims_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_key TEXT UNIQUE NOT NULL,
  claim_text TEXT NOT NULL,
  page TEXT NOT NULL,
  component TEXT,
  claim_type TEXT NOT NULL,
  evidence_source TEXT,
  evidence_url_or_reference TEXT,
  evidence_last_checked_at TIMESTAMPTZ,
  evidence_owner TEXT,
  date_verified DATE,
  next_review_date DATE,
  approval_status TEXT DEFAULT 'draft',
  legal_review_status TEXT DEFAULT 'pending',
  publication_status TEXT DEFAULT 'hidden',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE claims_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_claims" ON claims_registry;
DROP POLICY IF EXISTS "public_read_approved_claims" ON claims_registry;
CREATE POLICY "admin_manage_claims" ON claims_registry FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "public_read_approved_claims" ON claims_registry FOR SELECT USING (approval_status = 'approved' AND publication_status = 'published');

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  display_name TEXT,
  role TEXT,
  relationship_to_bls TEXT,
  country TEXT,
  destination TEXT,
  testimonial_text TEXT NOT NULL,
  date_given DATE,
  consent_status TEXT DEFAULT 'pending',
  incentive_disclosed TEXT,
  photo_url TEXT,
  photo_permission BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  approval_status TEXT DEFAULT 'draft',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  testimonial_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_testimonials" ON testimonials;
DROP POLICY IF EXISTS "public_read_approved_testimonials" ON testimonials;
CREATE POLICY "admin_manage_testimonials" ON testimonials FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "public_read_approved_testimonials" ON testimonials FOR SELECT USING (consent_status = 'granted' AND approval_status = 'approved' AND is_published = true);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 7: charity_challenges
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS destination_charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination TEXT NOT NULL,
  charity_name TEXT NOT NULL,
  charity_api_id TEXT NOT NULL,
  charity_description TEXT,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_destination_charities_destination ON destination_charities(destination);
CREATE INDEX IF NOT EXISTS idx_destination_charities_active ON destination_charities(is_active);

CREATE TABLE IF NOT EXISTS fundraising_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id TEXT,
  charity_id UUID REFERENCES destination_charities(id),
  charity_api_id TEXT NOT NULL,
  charity_name TEXT NOT NULL,
  page_short_name TEXT,
  page_url TEXT,
  page_title TEXT,
  target_amount NUMERIC(10,2),
  currency TEXT DEFAULT 'GBP',
  total_raised NUMERIC(10,2) DEFAULT 0,
  donor_count INT DEFAULT 0,
  event_date DATE,
  status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_user ON fundraising_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_status ON fundraising_pages(status);
ALTER TABLE destination_charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraising_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active charities" ON destination_charities FOR SELECT USING (is_active = true);
CREATE POLICY "Users read own fundraising pages" ON fundraising_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own fundraising pages" ON fundraising_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fundraising pages" ON fundraising_pages FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 8: posts
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('guide', 'ambassador')),
  author_name TEXT,
  content TEXT NOT NULL CHECK (char_length(content) <= 600),
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_select_anon" ON posts;
CREATE POLICY "posts_select_anon" ON posts FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- STEP 9: terms_acceptance (fresh install — full schema)
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON terms_acceptance(terms_version);

REVOKE UPDATE, DELETE ON terms_acceptance FROM PUBLIC;
REVOKE UPDATE, DELETE ON terms_acceptance FROM service_role;
REVOKE UPDATE, DELETE ON terms_acceptance FROM authenticated;
REVOKE UPDATE, DELETE ON terms_acceptance FROM anon;

ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "terms_acceptance_service_insert" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_insert" ON terms_acceptance FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "terms_acceptance_service_select" ON terms_acceptance;
CREATE POLICY "terms_acceptance_service_select" ON terms_acceptance FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION reject_terms_acceptance_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'terms_acceptance records are immutable. UPDATE and DELETE operations are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS trg_reject_terms_update ON terms_acceptance;
CREATE TRIGGER trg_reject_terms_update
  BEFORE UPDATE ON terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION reject_terms_acceptance_update_delete();

DROP TRIGGER IF EXISTS trg_reject_terms_delete ON terms_acceptance;
CREATE TRIGGER trg_reject_terms_delete
  BEFORE DELETE ON terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION reject_terms_acceptance_update_delete();

GRANT INSERT, SELECT ON terms_acceptance TO service_role;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 10: 002_webhook_infrastructure (fresh install)
-- ═══════════════════════════════════════════════════════════════════
\i supabase/migrations/002_webhook_infrastructure.sql

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION: Check all objects exist
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tables TEXT[];
  v_functions TEXT[];
  v_missing TEXT[];
BEGIN
  -- Check required tables
  SELECT array_agg(t.table_name) INTO v_tables
  FROM (VALUES
    ('platform_config'), ('transactions'), ('payment_reports'),
    ('claims_registry'), ('testimonials'), ('posts'),
    ('destination_charities'), ('fundraising_pages'),
    ('terms_acceptance'), ('webhook_event_inbox'), ('booking_confirmations')
  ) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = required.table_name
  );

  IF v_tables IS NOT NULL THEN
    RAISE EXCEPTION 'MISSING TABLES: %', array_to_string(v_tables, ', ');
  END IF;

  -- Check required functions
  SELECT array_agg(func_name) INTO v_functions
  FROM (VALUES
    ('credit_referral_reward'), ('credit_ambassador_commission'), ('claim_webhook_event'),
    ('reject_terms_acceptance_update_delete')
  ) AS required(func_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = required.func_name
  );

  IF v_functions IS NOT NULL THEN
    RAISE EXCEPTION 'MISSING FUNCTIONS: %', array_to_string(v_functions, ', ');
  END IF;

  RAISE NOTICE 'SCENARIO A VERIFICATION: All tables and functions created successfully.';
END $$;

-- Check ignored is in webhook_event_inbox CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'webhook_event_inbox'::regclass
    AND pg_get_constraintdef(oid) LIKE '%ignored%'
  ) THEN
    RAISE EXCEPTION 'webhook_event_inbox CHECK constraint missing ignored status';
  END IF;
  RAISE NOTICE 'SCENARIO A: webhook_event_inbox CHECK includes ignored.';
END $$;

-- Check skip_reason column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_event_inbox' AND column_name = 'skip_reason'
  ) THEN
    RAISE EXCEPTION 'webhook_event_inbox missing skip_reason column';
  END IF;
  RAISE NOTICE 'SCENARIO A: skip_reason column present.';
END $$;

DO $$ BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'SCENARIO A COMPLETE: Fresh install successful.';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
