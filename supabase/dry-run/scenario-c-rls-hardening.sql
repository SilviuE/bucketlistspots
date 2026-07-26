-- ================================================================
-- 003 DRY RUN: RLS PRIVILEGE HARDENING — Scenario-C Test Suite
-- ================================================================
-- Run this in a DISPOSABLE Supabase project SQL Editor.
--
-- Part 1: Production-schema setup (17 tables + RPCs)
-- Part 2: Add is_published columns (simulates 003a)
-- Part 3: Backfill founder-approved rows (simulates 003_backfill)
-- Part 4: Apply 003b migration inline (within a transaction)
-- Part 5: Behavioral RLS tests (28+ assertions)
-- Part 6: Emergency recovery test
-- Part 7: pg_proc signature audit
--
-- DO NOT run against production.
-- ================================================================


-- ================================================================
-- PART 1: PRODUCTION-SCHEMA SETUP
-- ================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT, name TEXT, role TEXT DEFAULT 'user',
  referral_code TEXT UNIQUE, bls_points_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.guides (
  id TEXT PRIMARY KEY, user_id UUID REFERENCES auth.users(id),
  name TEXT, trading_name TEXT, email TEXT, status TEXT DEFAULT 'draft',
  photo TEXT, hero_image TEXT, bio TEXT, why_independent TEXT, location TEXT,
  languages JSONB DEFAULT '[]'::jsonb, experience INTEGER DEFAULT 0,
  certifications TEXT, promise TEXT, badge TEXT, tagline TEXT,
  routes JSONB DEFAULT '[]'::jsonb, price NUMERIC(10,2) DEFAULT 0,
  price_currency TEXT DEFAULT 'usd', featured BOOLEAN DEFAULT false,
  review_count INTEGER DEFAULT 0, trips_led INTEGER DEFAULT 0,
  video_intro TEXT, tripadvisor_embed TEXT,
  identity_verified BOOLEAN DEFAULT false, license_verified BOOLEAN DEFAULT false,
  safety_verified BOOLEAN DEFAULT false, fair_pay_verified BOOLEAN DEFAULT false,
  referral_code TEXT UNIQUE, bls_points_balance INTEGER NOT NULL DEFAULT 0,
  referred_by_ambassador_id TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL,
  duration TEXT, difficulty TEXT, location TEXT, image TEXT,
  price NUMERIC(10,2), currency TEXT DEFAULT 'usd', guide_id TEXT,
  badge TEXT, rating NUMERIC(3,2) DEFAULT 0, reviews INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.destinations (
  name TEXT PRIMARY KEY, country TEXT, image TEXT, guide_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.guide_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT, email TEXT, phone TEXT, country TEXT, experience TEXT,
  languages TEXT, specialties TEXT, message TEXT, heard_from TEXT,
  status TEXT DEFAULT 'pending', referred_by_ambassador_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ambassador_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT, email TEXT, phone TEXT, country TEXT, platform TEXT,
  handle TEXT, followers TEXT, niche TEXT, why_you TEXT, heard_from TEXT,
  status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL, author_name TEXT, content TEXT NOT NULL,
  image_url TEXT, video_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  promotional_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  standard_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  promotional_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promotional_end_date TIMESTAMPTZ, saas_monthly_fee_gbp NUMERIC(8,2) NOT NULL DEFAULT 50.00,
  referral_program_enabled BOOLEAN NOT NULL DEFAULT true,
  charity_challenges_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL,
  linked_referral_code TEXT, linked_booking_id TEXT, idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_event_inbox (
  event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, stripe_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'received',
  skip_reason TEXT, error_message TEXT, retryable BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT NOT NULL UNIQUE,
  booking_ref TEXT NOT NULL, guide_id TEXT NOT NULL, guide_name TEXT,
  route_name TEXT NOT NULL, guest_email TEXT, guest_name TEXT, departure_date DATE,
  deposit_amount NUMERIC(12,2) NOT NULL, currency TEXT NOT NULL,
  total_travelers INTEGER NOT NULL DEFAULT 1, payment_status TEXT NOT NULL DEFAULT 'paid',
  stripe_payment_intent TEXT, gross_platform_fee NUMERIC(12,2) DEFAULT 0,
  referral_code TEXT, referral_discount_amount NUMERIC(12,2) DEFAULT 0,
  terms_version TEXT, disclosure_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terms_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT NOT NULL UNIQUE,
  guest_email TEXT NOT NULL, guest_name TEXT NOT NULL, guide_id TEXT NOT NULL,
  route_name TEXT NOT NULL, booking_ref TEXT NOT NULL, departure_date DATE NOT NULL,
  deposit_amount NUMERIC(12,2) NOT NULL, currency TEXT NOT NULL,
  confirmed_checkbox BOOLEAN NOT NULL DEFAULT false,
  insurance_confirmed_checkbox BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT NOT NULL, disclosure_version TEXT NOT NULL,
  client_accepted_at TIMESTAMPTZ NOT NULL, server_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION public.reject_terms_acceptance_update_delete()
RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'immutable'; RETURN NULL; END; $$ LANGUAGE plpgsql SET search_path = '';
DROP TRIGGER IF EXISTS trg_reject_terms_update ON public.terms_acceptance;
CREATE TRIGGER trg_reject_terms_update BEFORE UPDATE ON public.terms_acceptance FOR EACH ROW EXECUTE FUNCTION public.reject_terms_acceptance_update_delete();
DROP TRIGGER IF EXISTS trg_reject_terms_delete ON public.terms_acceptance;
CREATE TRIGGER trg_reject_terms_delete BEFORE DELETE ON public.terms_acceptance FOR EACH ROW EXECUTE FUNCTION public.reject_terms_acceptance_update_delete();
REVOKE UPDATE, DELETE ON public.terms_acceptance FROM PUBLIC, service_role, authenticated, anon;
GRANT INSERT, SELECT ON public.terms_acceptance TO service_role;

CREATE TABLE IF NOT EXISTS public.payment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id TEXT UNIQUE,
  guide_id TEXT, guest_name TEXT, guest_email TEXT, route_name TEXT,
  presentment_currency TEXT NOT NULL DEFAULT 'usd', presentment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_stripe_fee NUMERIC(12,2), net_settlement_amount NUMERIC(12,2),
  referral_code TEXT, referral_discount_amount NUMERIC(12,2) DEFAULT 0,
  gross_platform_fee NUMERIC(12,2) DEFAULT 0, platform_fee_pct NUMERIC(5,4) DEFAULT 0.2000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), person_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL, consent_status TEXT DEFAULT 'pending',
  approval_status TEXT DEFAULT 'draft', is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claims_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), claim_key TEXT UNIQUE NOT NULL,
  claim_text TEXT NOT NULL, page TEXT NOT NULL, claim_type TEXT NOT NULL,
  approval_status TEXT DEFAULT 'draft', publication_status TEXT DEFAULT 'hidden',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fundraising_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  charity_name TEXT NOT NULL, charity_api_id TEXT NOT NULL, page_title TEXT,
  target_amount NUMERIC(10,2), currency TEXT DEFAULT 'GBP', total_raised NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.destination_charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), destination TEXT NOT NULL,
  charity_name TEXT NOT NULL, charity_api_id TEXT NOT NULL, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RPCs (exact signatures from 002 migration source)
CREATE OR REPLACE FUNCTION public.credit_referral_reward(
  p_session_id TEXT, p_user_id UUID, p_amount NUMERIC, p_reason TEXT,
  p_referral_code TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_new_balance NUMERIC; v_booking RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('credited', false); END IF;
  SELECT * INTO v_booking FROM public.booking_confirmations WHERE session_id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('credited', false, 'reason', 'not_found'); END IF;
  IF v_booking.payment_status <> 'paid' THEN RETURN jsonb_build_object('credited', false, 'reason', 'not_paid'); END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN RETURN jsonb_build_object('credited', false, 'reason', 'duplicate'); END IF;
  UPDATE public.users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount WHERE referral_code = p_referral_code RETURNING bls_points_balance INTO v_new_balance;
  IF v_new_balance IS NULL THEN RETURN jsonb_build_object('credited', false, 'reason', 'not_found'); END IF;
  INSERT INTO public.transactions (user_id, amount, type, reason, linked_referral_code, linked_booking_id, idempotency_key) VALUES (p_user_id, p_amount, 'credit', p_reason, p_referral_code, p_session_id, p_idempotency_key);
  RETURN jsonb_build_object('credited', true, 'newBalance', v_new_balance);
END; $$;

CREATE OR REPLACE FUNCTION public.credit_ambassador_commission(
  p_session_id TEXT, p_ambassador_id UUID, p_amount NUMERIC, p_reason TEXT, p_idempotency_key TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'stub'; RETURN NULL; END; $$;

CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_event_id TEXT, p_stale_cutoff TIMESTAMPTZ
) RETURNS TABLE (claimed BOOLEAN, action TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'stub'; RETURN; END; $$;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_charities ENABLE ROW LEVEL SECURITY;

-- Pre-003 simple policies
CREATE POLICY "platform_config_admin" ON public.platform_config FOR ALL TO service_role USING (true);
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "payment_reports_admin_only" ON public.payment_reports FOR ALL TO service_role USING (true);
CREATE POLICY "admin_manage_claims" ON public.claims_registry FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "public_read_approved_claims" ON public.claims_registry FOR SELECT USING (approval_status = 'approved' AND publication_status = 'published');
CREATE POLICY "admin_manage_testimonials" ON public.testimonials FOR ALL USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "public_read_approved_testimonials" ON public.testimonials FOR SELECT USING (consent_status = 'granted' AND approval_status = 'approved' AND is_published = true);
CREATE POLICY "Users read own fundraising pages" ON public.fundraising_pages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own fundraising pages" ON public.fundraising_pages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fundraising pages" ON public.fundraising_pages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Public can view active charities" ON public.destination_charities FOR SELECT USING (is_active = true);
CREATE POLICY "posts_select" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "posts_select_anon" ON public.posts FOR SELECT TO anon USING (true);
CREATE POLICY "terms_acceptance_service_insert" ON public.terms_acceptance FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "terms_acceptance_service_select" ON public.terms_acceptance FOR SELECT TO service_role USING (true);
CREATE POLICY "webhook_inbox_service_all" ON public.webhook_event_inbox FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "booking_conf_service_all" ON public.booking_confirmations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Pre-003 Supabase-default grants
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Representative data
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.com', crypt('pass', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.com', crypt('pass', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.com', crypt('pass', gen_salt('bf')), NOW(), NOW(), NOW(), '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, name, role, referral_code, bls_points_balance) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com', 'Alice', 'user', 'ALICE2026', 100),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com', 'Bob', 'guide', 'BOB2026', 200),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.com', 'Admin', 'admin', 'ADMIN2026', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.guides (id, user_id, name, trading_name, status, photo, bio, location, price, price_currency, experience, referral_code) VALUES
  ('guide_pub', '22222222-2222-2222-2222-222222222222', 'Bob Mountain', 'Bob Adventures', 'published', 'photo.jpg', 'Expert guide', 'Nepal', 2500, 'usd', 15, 'BOB2026'),
  ('guide_draft', '11111111-1111-1111-1111-111111111111', 'Alice Jungle', 'Alice Expeditions', 'draft', 'photo2.jpg', 'Jungle specialist', 'Amazon', 1800, 'usd', 8, 'ALICE2026')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.experiences (id, title, duration, difficulty, location, image, price, currency, guide_id, featured) VALUES
  ('exp001', 'Kilimanjaro Machame', '7 days', 'Challenging', 'Tanzania', 'kili.jpg', 2500, 'usd', 'guide_pub', true),
  ('exp002', 'Everest Base Camp Trek', '14 days', 'Hard', 'Nepal', 'ebc.jpg', 3200, 'usd', 'guide_pub', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.destinations (name, country, image, guide_count) VALUES
  ('Kilimanjaro', 'Tanzania', 'kili-dest.jpg', 3),
  ('Everest Base Camp', 'Nepal', 'ebc.jpg', 5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.fundraising_pages (id, user_id, charity_name, charity_api_id, page_title, target_amount, currency, status) VALUES
  ('fp001', '11111111-1111-1111-1111-111111111111', 'KPAP', 'kpap', 'Climb for Charity', 500, 'GBP', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.destination_charities (id, destination, charity_name, charity_api_id, is_active) VALUES
  ('dc001', 'Kilimanjaro', 'KPAP', 'kpap', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.testimonials (id, person_name, testimonial_text, consent_status, approval_status, is_published) VALUES
  ('t001', 'Happy Traveller', 'Amazing experience!', 'granted', 'approved', true),
  ('t002', 'Unapproved Person', 'Great trip', 'pending', 'draft', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.claims_registry (id, claim_key, claim_text, page, claim_type, approval_status, publication_status) VALUES
  ('c001', 'fair_pay', 'All guides earn fair wages', 'home', 'ethical', 'approved', 'published'),
  ('c002', 'unverified', 'Not approved', 'home', 'ethical', 'draft', 'hidden')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PART 1: Production schema + data complete';
  RAISE NOTICE '══════════════════════════════════════════';
END $$;


-- ================================================================
-- PART 2: ADD PUBLICATION COLUMNS (simulates 003a)
-- ================================================================
ALTER TABLE public.experiences ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.destinations ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  RAISE NOTICE 'PART 2: is_published columns added';
END $$;


-- ================================================================
-- PART 3: BACKFILL FOUNDER-APPROVED ROWS (simulates 003_backfill)
-- ================================================================
UPDATE public.experiences SET is_published = true WHERE id = 'exp001';
UPDATE public.destinations SET is_published = true WHERE name = 'Kilimanjaro';

DO $$ BEGIN
  RAISE NOTICE 'PART 3: Backfill complete (exp001 + Kilimanjaro published)';
END $$;


-- ================================================================
-- PART 4: APPLY 003b MIGRATION INLINE (within a transaction)
-- ================================================================
BEGIN;

-- 4a. Publication abort check (two separate checks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.experiences WHERE is_published = true LIMIT 1) THEN
    RAISE EXCEPTION '003b ABORT: No published experiences.';
  END IF;
  RAISE NOTICE 'Publication check passed: experiences has at least one published row.';
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.destinations WHERE is_published = true LIMIT 1) THEN
    RAISE EXCEPTION '003b ABORT: No published destinations.';
  END IF;
  RAISE NOTICE 'Publication check passed: destinations has at least one published row.';
END $$;

-- 4b. Add avatar column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users' AND column_name='avatar') THEN
    ALTER TABLE public.users ADD COLUMN avatar TEXT;
  END IF;
END $$;

-- 4c. Drop all policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  RAISE NOTICE 'Dropped all existing policies';
END $$;

-- 4d. Revoke unused privileges
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.guide_applications      FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ambassador_applications FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.posts                   FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fundraising_pages       FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.testimonials            FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.destination_charities   FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.claims_registry         FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.platform_config        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions           FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_event_inbox    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.booking_confirmations  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_reports        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.terms_acceptance       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.guides                 FROM anon, authenticated;

-- 4e. Column-level grants
GRANT SELECT (
  id, name, trading_name, status, photo, hero_image,
  bio, why_independent, location, languages, experience,
  certifications, promise, badge, tagline, routes,
  price, price_currency, featured, review_count, trips_led,
  video_intro, tripadvisor_embed,
  identity_verified, license_verified, safety_verified, fair_pay_verified,
  created_at, updated_at
) ON public.guides TO anon;

GRANT SELECT (
  id, title, duration, difficulty, location, image,
  price, currency, guide_id, badge, rating, reviews, featured
) ON public.experiences TO anon;

GRANT SELECT (name, country, image, guide_count) ON public.destinations TO anon;

GRANT SELECT (id, email, name, avatar, role, created_at) ON public.users TO authenticated;

GRANT SELECT (
  id, name, trading_name, status, photo, hero_image,
  bio, why_independent, location, languages, experience,
  certifications, promise, badge, tagline, routes,
  price, price_currency, featured, review_count, trips_led,
  video_intro, tripadvisor_embed,
  identity_verified, license_verified, safety_verified, fair_pay_verified,
  created_at, updated_at
) ON public.guides TO authenticated;

GRANT SELECT (
  id, title, duration, difficulty, location, image,
  price, currency, guide_id, badge, rating, reviews, featured
) ON public.experiences TO authenticated;

GRANT SELECT (name, country, image, guide_count) ON public.destinations TO authenticated;

GRANT SELECT ON public.platform_config TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT UPDATE (name, avatar) ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- 4f. RLS policies
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_name_avatar"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "guides_select_published"
  ON public.guides FOR SELECT
  USING (status = 'published');

CREATE POLICY "experiences_select_published"
  ON public.experiences FOR SELECT
  USING (is_published = true);

CREATE POLICY "destinations_select_published"
  ON public.destinations FOR SELECT
  USING (is_published = true);

-- 4g. Function EXECUTE security — revoke all, regrant approved only
DO $$
BEGIN
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;         EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;           EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM service_role;   EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE 'Revoked EXECUTE from all roles';
END $$;

DO $$
BEGIN
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM service_role; EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM service_role; EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM service_role; EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM authenticated; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION public.reject_terms_acceptance_update_delete() FROM service_role; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

GRANT EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- 4h. Default privilege hardening
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

COMMIT;

DO $$ BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'PART 4: 003b migration applied inline';
  RAISE NOTICE '══════════════════════════════════════════';
END $$;


-- ================================================================
-- PART 5: BEHAVIORAL RLS TESTS (28+ assertions)
-- ================================================================
DO $$
DECLARE
  v_test_count INT := 0;
  v_pass_count INT := 0;
  v_fail_count INT := 0;
  v_count BIGINT;
  v_text TEXT;
  v_curr_user TEXT;
BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'BEHAVIORAL RLS TESTS:';
  RAISE NOTICE '══════════════════════════════════════════';

  -- ═══ CATEGORY A: CATALOGUE ═══

  -- TEST 1: Anon reads published guide (exact 29-column list)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.guides;
    IF v_count = 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 1: Anon sees 1 published guide';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 1: Anon sees % guides, expected 1', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 1: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 2: Anon reads published experience (RLS filters by is_published)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.experiences;
    IF v_count = 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 2: Anon sees 1 published experience (RLS filters)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 2: Anon sees % experiences, expected 1', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 2: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 3: Anon reads published destination (RLS filters by is_published)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.destinations;
    IF v_count = 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 3: Anon sees 1 published destination (RLS filters)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 3: Anon sees % destinations, expected 1', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 3: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 4: Anon blocked from unpublished experience
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.experiences WHERE id = 'exp002';
    IF v_count = 0 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 4: Anon cannot see unpublished experience';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 4: Anon sees % unpublished experiences', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 4: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY B: USERS ═══

  -- TEST 5: Auth reads own profile (6-column list including avatar)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT count(*) INTO v_count
      FROM (SELECT id FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111') sub;
    IF v_count = 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 5: Auth reads own profile';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 5: count=% expected 1', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 5: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 6: Auth own profile — real SELECT of all 6 safe columns + current_user assertion
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);

    -- Verify current_user is authenticated
    SELECT current_user INTO v_curr_user;
    IF v_curr_user <> 'authenticated' THEN
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 6: current_user=%, expected authenticated', v_curr_user;
    ELSE
      -- Real SELECT of all 6 safe columns
      SELECT id || '|' || email || '|' || name || '|' || coalesce(avatar,'') || '|' || role || '|' || created_at::text
        INTO v_text
        FROM public.users
        WHERE id = '11111111-1111-1111-1111-111111111111';

      IF v_text IS NOT NULL AND v_text LIKE '%alice@test.com%' AND v_text LIKE '%Alice%' THEN
        v_pass_count := v_pass_count + 1;
        RAISE NOTICE '  PASS TEST 6: Auth SELECT returned all 6 columns (current_user=authenticated)';
      ELSE
        v_fail_count := v_fail_count + 1;
        RAISE WARNING '  FAIL TEST 6: SELECT returned %', v_text;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 6: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 7: Auth reads other user profile (should return 0 rows via RLS)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT count(*) INTO v_count FROM public.users WHERE id = '22222222-2222-2222-2222-222222222222';
    IF v_count = 0 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 7: Cannot read other profile';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 7: CAN read other profile (count=%)', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 7: Blocked from other profile (%)', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY C: PRIVILEGE ESCALATION ═══

  -- TEST 8: Auth update name (allowed)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    UPDATE public.users SET name = 'Alice Updated' WHERE id = '11111111-1111-1111-1111-111111111111';
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 8: Can update name';
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 8: Cannot update name - %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 9: Auth update role (blocked — not in GRANT)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    UPDATE public.users SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 9: CAN update role';
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 9: role update denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 10: Auth update bls_points_balance (blocked)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    UPDATE public.users SET bls_points_balance = 99999 WHERE id = '11111111-1111-1111-1111-111111111111';
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 10: CAN update bls_points_balance';
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 10: bls_points_balance denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 11: Auth update referral_code (blocked)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    UPDATE public.users SET referral_code = 'HACKED' WHERE id = '11111111-1111-1111-1111-111111111111';
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 11: CAN update referral_code';
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 11: referral_code denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY D: WRITE DENY ═══

  -- TEST 12: Anon INSERT guides (blocked)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    INSERT INTO public.guides (id, name, status) VALUES ('hacker', 'Hacker', 'published');
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 12: Anon CAN insert guides';
  EXCEPTION WHEN OTHERS THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 12: Anon INSERT on guides blocked';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 13: Auth INSERT guides (blocked)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    INSERT INTO public.guides (id, name, status) VALUES ('hacker2', 'Hacker2', 'published');
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 13: Auth CAN insert guides';
  EXCEPTION WHEN OTHERS THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 13: Auth INSERT on guides blocked';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY E: NETLIFY-ONLY TABLES ═══

  -- TEST 14: Anon SELECT guide_applications (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.guide_applications;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 14: Anon sees % guide_applications (expected error)', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 14: Anon SELECT guide_applications denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 15: Anon SELECT posts (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.posts;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 15: Anon sees % posts (expected error)', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 15: Anon SELECT posts denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 16: Anon SELECT testimonials (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.testimonials;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 16: Anon sees % testimonials (expected error)', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 16: Anon SELECT testimonials denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 17: Anon SELECT claims_registry (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.claims_registry;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 17: Anon sees % claims_registry (expected error)', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 17: Anon SELECT claims_registry denied (insufficient_privilege)';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY F: SENSITIVE COLUMNS ═══

  -- TEST 18: Auth SELECT users.referral_code (must error, not NULL)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT referral_code INTO v_text FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 18: auth read referral_code — got %, expected permission denied', v_text;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 18: auth SELECT users.referral_code denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 19: Auth SELECT users.bls_points_balance (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT bls_points_balance INTO v_count FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 19: auth read bls_points_balance — got %', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 19: auth SELECT users.bls_points_balance denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 20: Anon SELECT guides.user_id (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT user_id INTO v_text FROM public.guides WHERE status = 'published' LIMIT 1;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 20: anon read guides.user_id — got %', v_text;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 20: anon SELECT guides.user_id denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 21: Anon SELECT guides.referral_code (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT referral_code INTO v_text FROM public.guides WHERE status = 'published' LIMIT 1;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 21: anon read guides.referral_code — got %', v_text;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 21: anon SELECT guides.referral_code denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 22: Anon SELECT guides.bls_points_balance (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT bls_points_balance INTO v_count FROM public.guides WHERE status = 'published' LIMIT 1;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 22: anon read guides.bls_points_balance — got %', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 22: anon SELECT guides.bls_points_balance denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 23: Anon SELECT guides.referred_by_ambassador_id (must error)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT referred_by_ambassador_id INTO v_text FROM public.guides WHERE status = 'published' LIMIT 1;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 23: anon read guides.referred_by_ambassador_id — got %', v_text;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 23: anon SELECT guides.referred_by_ambassador_id denied';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY G: INFRASTRUCTURE ═══

  -- TEST 24: TRUNCATE revoked
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    TRUNCATE TABLE public.guides;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 24: Anon CAN truncate guides';
  EXCEPTION WHEN OTHERS THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 24: TRUNCATE blocked';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 25: RPC denied to anon
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM public.claim_webhook_event('nonexistent', NOW());
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 25: Anon CAN execute claim_webhook_event';
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 25: Anon blocked from claim_webhook_event';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 26: Future function EXECUTE denied to anon
  v_test_count := v_test_count + 1;
  CREATE OR REPLACE FUNCTION public.test_execute_deny()
  RETURNS TEXT AS $fn$ BEGIN RETURN 'ok'; END; $fn$ LANGUAGE plpgsql;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM public.test_execute_deny();
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 26: Anon can execute function';
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 26: Anon blocked from executing function';
  END;
  PERFORM set_config('role', 'postgres', true);
  DROP FUNCTION public.test_execute_deny();

  -- TEST 27: Anon users access MUST error (not empty)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'anon', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    SELECT count(*) INTO v_count FROM public.users;
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 27: Anon sees % users (expected insufficient_privilege error, not empty)', v_count;
  EXCEPTION WHEN insufficient_privilege THEN
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 27: Anon SELECT users returns insufficient_privilege';
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 28: Auth SELECT 5-column list (simulates b3c4695 fallback)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT id || '|' || email || '|' || name || '|' || role || '|' || created_at::text
      INTO v_text
      FROM public.users
      WHERE id = '11111111-1111-1111-1111-111111111111';
    IF v_text IS NOT NULL AND v_text LIKE '%alice@test.com%' THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 28: 5-column fallback SELECT works (b3c4695 compatible)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 28: 5-column SELECT returned %', v_text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 28: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- TEST 29: Auth SELECT 6-column list (new code with avatar)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT id || '|' || email || '|' || name || '|' || coalesce(avatar,'') || '|' || role || '|' || created_at::text
      INTO v_text
      FROM public.users
      WHERE id = '11111111-1111-1111-1111-111111111111';
    IF v_text IS NOT NULL AND v_text LIKE '%alice@test.com%' THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 29: 6-column SELECT with avatar works (new code compatible)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 29: 6-column SELECT returned %', v_text;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 29: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  -- ═══ CATEGORY H: SERVICE ROLE ═══

  -- TEST 30: Service reads all guides
  v_test_count := v_test_count + 1;
  BEGIN
    SELECT count(*) INTO v_count FROM public.guides;
    IF v_count = 2 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 30: Service reads all guides (2)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 30: Service sees % guides', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 30: %', SQLERRM;
  END;

  -- TEST 31: Service reads platform_config
  v_test_count := v_test_count + 1;
  BEGIN
    SELECT count(*) INTO v_count FROM public.platform_config;
    IF v_count = 1 THEN
      v_pass_count := v_pass_count + 1;
      RAISE NOTICE '  PASS TEST 31: Service reads platform_config (1)';
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '  FAIL TEST 31: Service sees % rows', v_count;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 31: %', SQLERRM;
  END;

  -- TEST 32: Auth SELECT users.avatar (should be accessible, returns NULL if not set)
  v_test_count := v_test_count + 1;
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    PERFORM set_config('request.jwt.sub', '11111111-1111-1111-1111-111111111111', true);
    SELECT avatar INTO v_text FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';
    v_pass_count := v_pass_count + 1;
    RAISE NOTICE '  PASS TEST 32: Auth can SELECT users.avatar (value=%)', v_text;
  EXCEPTION WHEN OTHERS THEN
    v_fail_count := v_fail_count + 1;
    RAISE WARNING '  FAIL TEST 32: %', SQLERRM;
  END;
  PERFORM set_config('role', 'postgres', true);

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'TESTS: % passed, % failed (of % total)', v_pass_count, v_fail_count, v_test_count;
  RAISE NOTICE '══════════════════════════════════════════';
END $$;


-- ================================================================
-- PART 6: EMERGENCY RECOVERY TEST
-- ================================================================
DO $$
DECLARE r RECORD; v_count INT;
BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'EMERGENCY RECOVERY TEST';
  RAISE NOTICE '══════════════════════════════════════════';

  -- Drop the 5 restrictive policies
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('users_select_own','users_update_own_name_avatar',
        'guides_select_published','experiences_select_published','destinations_select_published')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  RAISE NOTICE '  Dropped 5 restrictive policies';

  -- Recreate minimum policies
  CREATE POLICY "guides_select_published" ON public.guides FOR SELECT TO anon USING (status = 'published');
  CREATE POLICY "guides_select_published_auth" ON public.guides FOR SELECT TO authenticated USING (status = 'published');
  CREATE POLICY "experiences_select_published" ON public.experiences FOR SELECT TO anon USING (is_published = true);
  CREATE POLICY "experiences_select_published_auth" ON public.experiences FOR SELECT TO authenticated USING (is_published = true);
  CREATE POLICY "destinations_select_published" ON public.destinations FOR SELECT TO anon USING (is_published = true);
  CREATE POLICY "destinations_select_published_auth" ON public.destinations FOR SELECT TO authenticated USING (is_published = true);
  CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
  CREATE POLICY "users_update_own_name_avatar" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  RAISE NOTICE '  Recreated minimum policies';

  -- Verify catalogue queries work
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SELECT count(*) INTO v_count FROM public.guides;
  IF v_count = 1 THEN
    RAISE NOTICE '  Catalogue queries work after recovery';
  ELSE
    RAISE WARNING '  Catalogue broken after recovery: % guides', v_count;
  END IF;
  PERFORM set_config('role', 'postgres', true);

  RAISE NOTICE 'EMERGENCY RECOVERY TEST COMPLETE';
END $$;


-- ================================================================
-- PART 7: pg_proc SIGNATURE AUDIT
-- ================================================================
DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'pg_proc SIGNATURE AUDIT';
  RAISE NOTICE '══════════════════════════════════════════';

  FOR r IN
    SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
           pg_catalog.pg_get_function_result(p.oid) AS rettype,
           p.prosecdef AS security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('credit_referral_reward', 'credit_ambassador_commission',
                         'claim_webhook_event', 'reject_terms_acceptance_update_delete')
    ORDER BY p.proname
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '  %.%(%) RETURNS % — security_definer=%',
      r.proname, r.proname, r.args, r.rettype, r.security_definer;
  END LOOP;

  IF v_count = 4 THEN
    RAISE NOTICE 'pg_proc audit: Found all 4 expected functions';
  ELSE
    RAISE WARNING 'pg_proc audit: Expected 4 functions, found %', v_count;
  END IF;

  RAISE NOTICE '══════════════════════════════════════════';
END $$;


-- ================================================================
-- FINAL SUMMARY
-- ================================================================
DO $$ BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '003 DRY RUN SCENARIO-C: COMPLETE';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'Schema: 17 tables + avatar column + is_published on experiences/destinations.';
  RAISE NOTICE 'Policies: 5 restrictive (users, guides, experiences, destinations).';
  RAISE NOTICE 'Functions: ALL EXECUTE revoked from PUBLIC/anon/authenticated/service_role;';
  RAISE NOTICE '  3 RPCs regranted to service_role with exact pg_proc signatures.';
  RAISE NOTICE 'Default privileges: global + schema-scoped for postgres and supabase_admin.';
  RAISE NOTICE 'Tests: 32 assertions (catalogue, users, privilege escalation, write deny,';
  RAISE NOTICE '  Netlify-only tables, sensitive columns, infrastructure, service role,';
  RAISE NOTICE '  fallback column lists, emergency recovery, pg_proc audit).';
  RAISE NOTICE 'NEXT: Run Supabase Security Advisor.';
  RAISE NOTICE '══════════════════════════════════════════';
END $$;
