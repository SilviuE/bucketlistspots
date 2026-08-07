-- ================================================================
-- 0000: CORE SCHEMA — Canonical Fresh-Database Baseline
-- ================================================================
-- This is the single source of truth for all core tables, columns,
-- constraints, indexes and default RLS configuration.
--
-- Run on a COMPLETELY EMPTY database (no existing tables).
-- Safe to re-run: uses IF NOT EXISTS throughout; checks
-- schema_migrations and exits cleanly if already applied.
--
-- Subsequent migrations (0001+) build on this baseline.
-- ================================================================

BEGIN;

-- ================================================================
-- PRE-MIGRATION GUARD: schema_migrations checksum verification
-- ================================================================
-- Creates the schema_migrations tracking table on first-ever run.
-- Checksum rules (founder‑approved):
--   same version + same checksum  → clean already‑applied exit
--   same version + different checksum → HARD ABORT (tamper detect)
--   same version + NULL checksum  → LEGACY ABORT (founder review)
--   no historical checksum is ever silently overwritten.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum TEXT
);

-- schema_migrations is a migration‑tracking table, not an
-- application table. No client role may read or write it.
-- The default ACL grants service_role=arwd on all tables, so
-- explicitly revoke everything. Migrations run as postgres
-- (SQL Editor), not as service_role.
REVOKE ALL ON public.schema_migrations FROM anon, authenticated, PUBLIC, service_role;

DO $guard$
DECLARE
  _expected TEXT := 'F35FFACD68A2B4ABE180CC8A3632767596B47F198821A8AB445DB56440B9E067';
  _recorded RECORD;
BEGIN
  SELECT version, checksum, applied_at INTO _recorded
  FROM public.schema_migrations WHERE version = '0000';

  IF FOUND THEN
    IF _recorded.checksum IS NULL THEN
      RAISE WARNING 'Migration 0000 recorded without checksum (legacy record).';
      RAISE EXCEPTION 'LEGACY MIGRATION: 0000 has no historical checksum. Founder/legal review required before re‑run.';
    ELSIF _recorded.checksum = _expected THEN
      RAISE NOTICE '============================================================';
      RAISE NOTICE 'Migration 0000 already applied — exiting cleanly.';
      RAISE NOTICE '(Checksum matches, applied at %)', _recorded.applied_at;
      RAISE NOTICE '============================================================';
      RETURN;
    ELSE
      RAISE EXCEPTION 'MIGRATION INTEGRITY FAILURE: 0000.\n  Recorded checksum: %\n  Expected checksum: %\n  The migration file has changed since it was first applied.\n  Restore the original file or obtain written founder authorisation.',
        _recorded.checksum, _expected;
    END IF;
  END IF;

  RAISE NOTICE 'Migration 0000: first‑time run. Expected SHA‑256: %', _expected;
END $guard$;


-- ================================================================
-- 1. USERS (extends Supabase auth.users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',
  referral_code TEXT UNIQUE,
  bls_points_balance INTEGER NOT NULL DEFAULT 0,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_status TEXT NOT NULL DEFAULT 'active',
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  suspended_by UUID
);

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'deactivated'));

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_users_suspended_by'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_suspended_by
      FOREIGN KEY (suspended_by) REFERENCES public.users(id);
  END IF;
END $fk$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);


-- ================================================================
-- 2. GUIDES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.guides (
  id TEXT PRIMARY KEY,
  user_id UUID,
  name TEXT,
  trading_name TEXT,
  email TEXT,
  status TEXT DEFAULT 'draft',
  referral_code TEXT UNIQUE,
  bls_points_balance INTEGER NOT NULL DEFAULT 0,
  referred_by_ambassador_id TEXT,
  price_currency TEXT DEFAULT 'usd',
  routes JSONB DEFAULT '[]'::jsonb,
  photo TEXT,
  hero_image TEXT,
  bio TEXT,
  why_independent TEXT,
  location TEXT,
  languages JSONB DEFAULT '[]'::jsonb,
  experience INTEGER DEFAULT 0,
  certifications TEXT,
  promise TEXT,
  badge TEXT,
  tagline TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  review_count INTEGER DEFAULT 0,
  trips_led INTEGER DEFAULT 0,
  video_intro TEXT,
  tripadvisor_embed TEXT,
  identity_verified BOOLEAN DEFAULT false,
  license_verified BOOLEAN DEFAULT false,
  safety_verified BOOLEAN DEFAULT false,
  fair_pay_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guides_status ON public.guides(status);
CREATE INDEX IF NOT EXISTS idx_guides_referral_code ON public.guides(referral_code);
CREATE INDEX IF NOT EXISTS idx_guides_referred_by ON public.guides(referred_by_ambassador_id);
CREATE INDEX IF NOT EXISTS idx_guides_location ON public.guides(location);


-- ================================================================
-- 3. EXPERIENCES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  duration TEXT,
  difficulty TEXT,
  location TEXT,
  image TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'usd',
  guide_id TEXT,
  badge TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_experiences_guide_id ON public.experiences(guide_id);
CREATE INDEX IF NOT EXISTS idx_experiences_published ON public.experiences(is_published);
CREATE INDEX IF NOT EXISTS idx_experiences_featured ON public.experiences(featured);


-- ================================================================
-- 4. DESTINATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.destinations (
  name TEXT PRIMARY KEY,
  country TEXT,
  image TEXT,
  guide_count INTEGER DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_destinations_country ON public.destinations(country);
CREATE INDEX IF NOT EXISTS idx_destinations_published ON public.destinations(is_published);


-- ================================================================
-- 5. GUIDE APPLICATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.guide_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES auth.users(id),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  experience TEXT,
  languages TEXT,
  specialties TEXT,
  message TEXT,
  heard_from TEXT,
  status TEXT DEFAULT 'pending',
  referred_by_ambassador_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guide_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guide_applications_status ON public.guide_applications(status);
CREATE INDEX IF NOT EXISTS idx_guide_applications_email ON public.guide_applications(email);


-- ================================================================
-- 6. AMBASSADOR APPLICATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.ambassador_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  platform TEXT,
  handle TEXT,
  followers TEXT,
  niche TEXT,
  why_you TEXT,
  heard_from TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ambassador_applications_status ON public.ambassador_applications(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_applications_email ON public.ambassador_applications(email);


-- ================================================================
-- 7. PLATFORM CONFIG (single-row configuration table)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  promotional_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  standard_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  promotional_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promotional_end_date TIMESTAMPTZ,
  saas_monthly_fee_gbp NUMERIC(8,2) NOT NULL DEFAULT 50.00,
  referral_program_enabled BOOLEAN NOT NULL DEFAULT true,
  charity_challenges_enabled BOOLEAN NOT NULL DEFAULT true,
  founding_guide_start_at TIMESTAMPTZ DEFAULT NOW(),
  founding_guide_end_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months'),
  founding_guide_is_active BOOLEAN DEFAULT true,
  founding_guide_copy TEXT DEFAULT 'During the first six months of the BucketListSpots platform promotional period, approved guides pay no membership or verification charge. Guides join with Standard status and may apply for an upgrade when eligible.',
  global_pricing_zones_enabled BOOLEAN DEFAULT true,
  global_pricing_zones_public_copy TEXT DEFAULT 'After the promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions. Pricing will be communicated before the Founding Guide period ends.',
  global_pricing_zone_names JSONB DEFAULT '["Global Zone A","Global Zone B","Global Zone C"]',
  referral_max_gbp NUMERIC(6,2) DEFAULT 50.00,
  referral_max_eur NUMERIC(6,2) DEFAULT 50.00,
  referral_max_usd NUMERIC(6,2) DEFAULT 50.00,
  referral_cap_pct NUMERIC(5,4) DEFAULT 0.1500,
  trust_gate_checks JSONB DEFAULT '[{"key":"identity","label":"Identity Review"},{"key":"licence","label":"Licence and Documentation"},{"key":"references","label":"Experience and References"},{"key":"interview","label":"Safety and Operational Interview"},{"key":"approval","label":"Profile Approval"}]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Seed the single row (idempotent)
INSERT INTO public.platform_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- 8. TRANSACTIONS (BLS Points Wallet ledger)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  linked_referral_code TEXT,
  linked_booking_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON public.transactions(idempotency_key);


-- ================================================================
-- 9. WEBHOOK EVENT INBOX (Stripe webhook idempotency gate)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.webhook_event_inbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  error_message TEXT,
  retryable BOOLEAN NOT NULL DEFAULT false,
  skip_reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_event_inbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON public.webhook_event_inbox(status);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_session ON public.webhook_event_inbox(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_event_type ON public.webhook_event_inbox(event_type);


-- ================================================================
-- 10. BOOKING CONFIRMATIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.booking_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  booking_ref TEXT NOT NULL,
  guide_id TEXT NOT NULL,
  guide_name TEXT,
  route_name TEXT NOT NULL,
  guest_email TEXT,
  guest_name TEXT,
  departure_date DATE,
  deposit_amount NUMERIC(12,2) NOT NULL CHECK (deposit_amount >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('gbp', 'eur', 'usd')),
  total_travelers INTEGER NOT NULL DEFAULT 1 CHECK (total_travelers > 0),
  payment_status TEXT NOT NULL DEFAULT 'paid',
  stripe_payment_intent TEXT,
  stripe_balance_transaction TEXT,
  gross_platform_fee NUMERIC(12,2) DEFAULT 0,
  local_partner_balance NUMERIC(12,2) DEFAULT 0,
  referral_code TEXT,
  referral_discount_amount NUMERIC(12,2) DEFAULT 0,
  porter_training BOOLEAN DEFAULT false,
  terms_version TEXT,
  disclosure_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.booking_confirmations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_booking_conf_session ON public.booking_confirmations(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_conf_guide ON public.booking_confirmations(guide_id);
CREATE INDEX IF NOT EXISTS idx_booking_conf_guest_email ON public.booking_confirmations(guest_email);
CREATE INDEX IF NOT EXISTS idx_booking_conf_payment_status ON public.booking_confirmations(payment_status);


-- ================================================================
-- 11. TERMS ACCEPTANCE (immutable append-only audit)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.terms_acceptance (
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

ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON public.terms_acceptance FROM PUBLIC, service_role, authenticated, anon;
GRANT INSERT, SELECT ON public.terms_acceptance TO service_role;

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_session_id ON public.terms_acceptance(session_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_guest_email ON public.terms_acceptance(guest_email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_terms_version ON public.terms_acceptance(terms_version);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_created_at ON public.terms_acceptance(created_at DESC);

-- Immutability trigger function
CREATE OR REPLACE FUNCTION public.reject_terms_acceptance_update_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'terms_acceptance records are immutable. UPDATE and DELETE operations are not permitted.';
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_reject_terms_update ON public.terms_acceptance;
CREATE TRIGGER trg_reject_terms_update
  BEFORE UPDATE ON public.terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION public.reject_terms_acceptance_update_delete();

DROP TRIGGER IF EXISTS trg_reject_terms_delete ON public.terms_acceptance;
CREATE TRIGGER trg_reject_terms_delete
  BEFORE DELETE ON public.terms_acceptance
  FOR EACH ROW EXECUTE FUNCTION public.reject_terms_acceptance_update_delete();


-- ================================================================
-- 12. PAYMENT REPORTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.payment_reports (
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

ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_reports_created_at ON public.payment_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_reports_guide_id ON public.payment_reports(guide_id);
CREATE INDEX IF NOT EXISTS idx_payment_reports_currency ON public.payment_reports(presentment_currency);
CREATE INDEX IF NOT EXISTS idx_payment_reports_session_id ON public.payment_reports(session_id);


-- ================================================================
-- 13. TESTIMONIALS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.testimonials (
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

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_testimonials_published ON public.testimonials(is_published);
CREATE INDEX IF NOT EXISTS idx_testimonials_consent ON public.testimonials(consent_status);
CREATE INDEX IF NOT EXISTS idx_testimonials_approval ON public.testimonials(approval_status);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON public.testimonials(is_featured);


-- ================================================================
-- 14. CLAIMS REGISTRY
-- ================================================================
CREATE TABLE IF NOT EXISTS public.claims_registry (
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

ALTER TABLE public.claims_registry ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_claims_registry_key ON public.claims_registry(claim_key);
CREATE INDEX IF NOT EXISTS idx_claims_registry_approval ON public.claims_registry(approval_status);
CREATE INDEX IF NOT EXISTS idx_claims_registry_publication ON public.claims_registry(publication_status);


-- ================================================================
-- 15. FUNDRAISING PAGES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.fundraising_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id TEXT,
  charity_id UUID,
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

ALTER TABLE public.fundraising_pages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fundraising_pages_user ON public.fundraising_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_status ON public.fundraising_pages(status);
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_charity ON public.fundraising_pages(charity_api_id);


-- ================================================================
-- 16. DESTINATION CHARITIES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.destination_charities (
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

ALTER TABLE public.destination_charities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_destination_charities_destination ON public.destination_charities(destination);
CREATE INDEX IF NOT EXISTS idx_destination_charities_active ON public.destination_charities(is_active);


-- ================================================================
-- 17. POSTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.posts (
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

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);


-- ================================================================
-- 18. ACCOUNT STATUS AUDIT (append-only)
-- ================================================================
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

-- Append-only audit trail. The SECURITY DEFINER trigger
-- public.record_account_status_change() writes every record
-- running as postgres. service_role needs SELECT only
-- (read‑only audit review). Direct INSERT is unnecessary
-- and is revoked.
GRANT SELECT ON public.account_status_audit TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.account_status_audit FROM service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.account_status_audit FROM anon, authenticated, PUBLIC;

CREATE INDEX IF NOT EXISTS idx_account_status_audit_user_id ON public.account_status_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_account_status_audit_created_at ON public.account_status_audit(created_at DESC);


-- ================================================================
-- 19. ACCOUNT STATUS AUDIT TRIGGER
-- ================================================================
-- Fires on users UPDATE when account_status actually changes.
-- SECURITY DEFINER owned by postgres. search_path = '' (empty) —
-- every table and function reference is schema‑qualified.
CREATE OR REPLACE FUNCTION public.record_account_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
    INSERT INTO public.account_status_audit (user_id, changed_by, from_status, to_status, reason)
    VALUES (NEW.id, NEW.suspended_by, OLD.account_status, NEW.account_status, NEW.suspended_reason);
  END IF;
  RETURN NEW;
END $$;

DO $trg$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_users_account_status_audit'
      AND tgrelid = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER trg_users_account_status_audit
      AFTER UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.record_account_status_change();
  END IF;
END $trg$;


-- ================================================================
-- 20. RPC FUNCTIONS (Webhook & Referral Infrastructure)
-- ================================================================

-- credit_referral_reward: atomic referral credit
CREATE OR REPLACE FUNCTION public.credit_referral_reward(
  p_session_id TEXT,
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_referral_code TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_new_balance NUMERIC;
  v_booking RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false);
  END IF;
  SELECT * INTO v_booking
  FROM public.booking_confirmations
  WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'not_found');
  END IF;
  IF v_booking.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'not_paid');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'duplicate');
  END IF;
  UPDATE public.users
  SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
  WHERE referral_code = p_referral_code
  RETURNING bls_points_balance INTO v_new_balance;
  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'not_found');
  END IF;
  INSERT INTO public.transactions (user_id, amount, type, reason, linked_referral_code, linked_booking_id, idempotency_key)
  VALUES (p_user_id, p_amount, 'credit', p_reason, p_referral_code, p_session_id, p_idempotency_key);
  RETURN jsonb_build_object('credited', true, 'newBalance', v_new_balance);
END $fn$;

-- credit_ambassador_commission: atomic ambassador credit
CREATE OR REPLACE FUNCTION public.credit_ambassador_commission(
  p_session_id TEXT,
  p_ambassador_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'Ambassador commission integration pending.';
  RETURN NULL;
END $fn$;

-- claim_webhook_event: atomic event claim for idempotency
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_event_id TEXT,
  p_stale_cutoff TIMESTAMPTZ
)
RETURNS TABLE (claimed BOOLEAN, action TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'Webhook event claim integration pending.';
  RETURN;
END $fn$;


-- ================================================================
-- 21. INITIAL DENY-BY-DEFAULT RLS
-- ================================================================
-- RLS is enabled on all 18 application tables.
-- Zero policies are created → ALL access denied to anon/authenticated.
-- server_role bypasses RLS (but we narrow grants below).

-- ================================================================
-- 22. DEFAULT PRIVILEGE HARDENING
-- ================================================================
-- Narrow default ACLs for all future objects created in public schema
-- by postgres. service_role gets arwd only on tables (no
-- TRUNCATE/REFERENCES/TRIGGER) and rU on sequences (select+usage,
-- no update). Functions get no EXECUTE by default (house rule).

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, USAGE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON ROUTINES FROM PUBLIC, anon, authenticated, service_role;


-- ================================================================
-- 23. RECORD MIGRATION IN schema_migrations
-- ================================================================
-- Belt‑and‑braces: revoke service_role again in case default ACLs
-- applied retroactively within the same transaction.
REVOKE ALL ON public.schema_migrations FROM service_role;

INSERT INTO public.schema_migrations (version, name, checksum)
VALUES ('0000', 'Core Schema — all tables, constraints, indexes, deny-by-default RLS, default ACLs, RPCs', 'F35FFACD68A2B4ABE180CC8A3632767596B47F198821A8AB445DB56440B9E067')
ON CONFLICT (version) DO NOTHING;

DO $done$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '0000: CORE SCHEMA COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Tables created: 19';
  RAISE NOTICE '  users, guides, experiences, destinations,';
  RAISE NOTICE '  guide_applications, ambassador_applications,';
  RAISE NOTICE '  platform_config, transactions,';
  RAISE NOTICE '  webhook_event_inbox, booking_confirmations,';
  RAISE NOTICE '  terms_acceptance, payment_reports,';
  RAISE NOTICE '  testimonials, claims_registry,';
  RAISE NOTICE '  fundraising_pages, destination_charities,';
  RAISE NOTICE '  posts, account_status_audit';
  RAISE NOTICE '  + schema_migrations (migration tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS: enabled on all 18 application tables.';
  RAISE NOTICE 'Policies: ZERO (deny-by-default).';
  RAISE NOTICE 'Default ACLs: postgres-narrowed for service_role.';
  RAISE NOTICE '';
  RAISE NOTICE 'schema_migrations: no client‑role access (read‑only DBA table).';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: apply ordered feature migrations (0001+),';
  RAISE NOTICE 'then staging seed (supabase/seed/staging_seed.sql).';
  RAISE NOTICE '============================================================';
END $done$;

COMMIT;
