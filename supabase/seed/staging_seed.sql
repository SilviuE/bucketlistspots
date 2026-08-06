-- ================================================================
-- STAGING-ONLY SEED DATA
-- ================================================================
--   WARNING: STAGING ONLY - NEVER RUN ON PRODUCTION 
--
-- This file inserts synthetic test data for a fresh staging
-- environment deployment. All data is clearly fake/test data
-- (test accounts, demo guides, sample destinations).
--
-- Prerequisites:
--   0000_core_schema.sql must be applied first.
--   Subsequent migrations (RLS policies, publication columns)
--   should be applied BEFORE running this seed to ensure
--   proper policy evaluation.
--
-- Idempotent: uses ON CONFLICT DO NOTHING throughout.
-- Safe to re-run.
-- ================================================================

BEGIN;

-- ================================================================
-- TEST USERS
-- ================================================================
-- These reference fictional auth.users UUIDs.
-- In staging, create matching auth.users entries via the
-- Supabase Auth dashboard or admin API first.
-- ================================================================
INSERT INTO public.users (id, email, name, role, account_status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin-test@bucketlistspots.com', 'Admin Test', 'admin', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'guide-test@bucketlistspots.com', 'Guide Test User', 'user', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'traveller-test@bucketlistspots.com', 'Traveller Test', 'user', 'active')
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST GUIDES (published)
-- ================================================================
INSERT INTO public.guides (id, name, trading_name, status, location, bio, price_currency, price, featured, identity_verified, license_verified, safety_verified, fair_pay_verified)
VALUES
  ('guide-staging-pub', 'Kibo Guides', 'Kibo Guides Ltd', 'published', 'Moshi, Tanzania', 'Professional Kilimanjaro expedition operator with 15 years of experience.', 'usd', 2500.00, true, true, true, true, true),
  ('guide-staging-featured', 'Andes Expeditions', 'Andes Expeditions SAC', 'published', 'Cusco, Peru', 'Inca Trail and high-altitude trekking specialists.', 'usd', 1800.00, true, true, true, true, false)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST GUIDES (draft - not visible to anon)
-- ================================================================
INSERT INTO public.guides (id, name, trading_name, status, location, bio, price_currency, price)
VALUES
  ('guide-staging-draft', 'Himalaya Treks', 'Himalaya Treks Pvt', 'draft', 'Kathmandu, Nepal', 'Everest Base Camp and Annapurna specialists.', 'usd', 1200.00)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST EXPERIENCES (published)
-- ================================================================
INSERT INTO public.experiences (id, title, duration, difficulty, location, image, price, currency, guide_id, rating, reviews, is_published)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Kilimanjaro Machame Route - 7 Days', '7 days', 'Challenging', 'Tanzania', '/images/experiences/kilimanjaro.jpg', 2500.00, 'usd', 'guide-staging-pub', 4.8, 12, true),
  ('e0000000-0000-0000-0000-000000000002', 'Inca Trail to Machu Picchu - 4 Days', '4 days', 'Moderate', 'Peru', '/images/experiences/inca-trail.jpg', 1800.00, 'usd', 'guide-staging-featured', 4.9, 8, true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST DESTINATIONS (published)
-- ================================================================
INSERT INTO public.destinations (name, country, image, guide_count, is_published)
VALUES
  ('Kilimanjaro', 'Tanzania', '/images/destinations/kilimanjaro.jpg', 3, true),
  ('Machu Picchu', 'Peru', '/images/destinations/machu-picchu.jpg', 2, true)
ON CONFLICT (name) DO NOTHING;


-- ================================================================
-- TEST DESTINATION CHARITIES
-- ================================================================
INSERT INTO public.destination_charities (id, destination, charity_name, charity_api_id, charity_description, website_url, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Kilimanjaro', 'Kilimanjaro Porter Assistance Project (KPAP)', 'kpap-tz', 'Improving working conditions for Kilimanjaro porters.', 'https://www.kiliporters.org', true),
  ('a0000000-0000-0000-0000-000000000002', 'Kilimanjaro', 'African Wildlife Foundation', 'awf-tz', 'Protecting Africa''s wildlife and wild lands.', 'https://www.awf.org', true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST CLAIMS (published)
-- ================================================================
INSERT INTO public.claims_registry (id, claim_key, claim_text, page, claim_type, approval_status, publication_status)
VALUES
  ('a0000000-0000-0000-0000-000000000010', 'GUIDE_80_PERCENT_DIRECT', 'The Local Partner receives 80% of the Listed Trip Price directly.', '/for-guides', 'financial', 'approved', 'published'),
  ('a0000000-0000-0000-0000-000000000011', 'UK_REGISTERED_MARKETPLACE', 'BucketListSpots is a UK-registered marketplace (Company No. 16595661).', '/for-guides', 'verification', 'approved', 'published')
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST TESTIMONIALS (approved, published)
-- ================================================================
INSERT INTO public.testimonials (id, person_name, testimonial_text, consent_status, approval_status, is_published)
VALUES
  ('a0000000-0000-0000-0000-000000000020', 'Sarah K.', 'Amazing experience booking through BLS. The guide was professional and the trip exceeded expectations.', 'granted', 'approved', true),
  ('a0000000-0000-0000-0000-000000000021', 'James M.', 'Found the perfect Kilimanjaro expedition. Transparent pricing and excellent communication.', 'granted', 'approved', true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TEST POSTS
-- ================================================================
INSERT INTO public.posts (id, user_id, author_role, author_name, content)
VALUES
  ('post-staging-001', '22222222-2222-2222-2222-222222222222', 'guide', 'Kibo Guides', 'New season dates announced for Kilimanjaro expeditions - book now for September departures!')
ON CONFLICT (id) DO NOTHING;


DO $done$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STAGING SEED: Complete (test data only)';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Users: 3 test accounts';
  RAISE NOTICE 'Guides: 2 published, 1 draft';
  RAISE NOTICE 'Experiences: 2 published';
  RAISE NOTICE 'Destinations: 2 published';
  RAISE NOTICE 'Charities: 2 seeded';
  RAISE NOTICE 'Claims: 2 approved/published';
  RAISE NOTICE 'Testimonials: 2 approved/published';
  RAISE NOTICE 'Posts: 1 test post';
  RAISE NOTICE '';
  RAISE NOTICE 'All data is fake/test data. Safe for staging use only.';
  RAISE NOTICE '============================================================';
END $done$;

COMMIT;
