-- ================================================================
-- P5: POLICY RECONCILIATION (production prerequisite)
-- ================================================================
-- Target  : nmyhytrnzfhdstqazttb (production) ONLY
-- Purpose : Drop 12 legacy policies not in 003b's v_known_policies
--           allowlist. These policies are replaced by 003b's 5
--           hardened policies or by service_role access via Netlify
--           functions.
-- Safety  : Guards verify ONLY the 12 expected legacy policies
--           exist before dropping. Aborts on unexpected state.
--           Idempotent: DROP POLICY IF EXISTS with guard.
-- ================================================================

BEGIN;

-- ── Audit: list all current policies ────────────────────────────
DO $$
DECLARE _total INT; _unexpected TEXT[];
BEGIN
  SELECT count(*) INTO _total FROM pg_policies WHERE schemaname='public';

  -- Collect policies NOT in 003b's 25-name allowlist AND NOT in
  -- the 12 policies we intend to drop. Any extra = abort.
  SELECT array_agg(tablename || '.' || policyname ORDER BY 1) INTO _unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (tablename, policyname) NOT IN (
      -- 12 legacy policies safe to drop
      ('ambassador_applications', 'Anyone can insert ambassador applications'),
      ('ambassador_applications', 'Only admins can view ambassador applications'),
      ('guide_applications',      'Anyone can insert applications'),
      ('guide_applications',      'Only admins can view applications'),
      ('guides',                  'Guides can insert own profile'),
      ('guides',                  'Guides can update their own profile'),
      ('guides',                  'Guides can view their own profile'),
      ('guides',                  'Public read access'),
      ('users',                   'Users can read own profile'),
      ('users',                   'Users can update own profile'),
      ('experiences',             'Public read access'),
      ('destinations',            'Public read access'),
      -- 25 policies in 003b's v_known_policies (must already exist or be absent)
      ('platform_config',         'platform_config_admin'),
      ('transactions',            'transactions_select_own'),
      ('payment_reports',         'payment_reports_admin_only'),
      ('claims_registry',         'admin_manage_claims'),
      ('claims_registry',         'public_read_approved_claims'),
      ('testimonials',            'admin_manage_testimonials'),
      ('testimonials',            'public_read_approved_testimonials'),
      ('fundraising_pages',       'Users read own fundraising pages'),
      ('fundraising_pages',       'Users create own fundraising pages'),
      ('fundraising_pages',       'Users update own fundraising pages'),
      ('destination_charities',   'Public can view active charities'),
      ('posts',                   'posts_select'),
      ('posts',                   'posts_insert'),
      ('posts',                   'posts_update'),
      ('posts',                   'posts_delete'),
      ('posts',                   'posts_select_anon'),
      ('terms_acceptance',        'terms_acceptance_service_insert'),
      ('terms_acceptance',        'terms_acceptance_service_select'),
      ('webhook_event_inbox',     'webhook_inbox_service_all'),
      ('booking_confirmations',   'booking_conf_service_all'),
      -- 5 hardened (may or may not exist yet)
      ('users',                   'users_select_own'),
      ('users',                   'users_update_own_name_avatar'),
      ('guides',                  'guides_select_published'),
      ('experiences',             'experiences_select_published'),
      ('destinations',            'destinations_select_published')
    );

  IF _unexpected IS NOT NULL AND array_length(_unexpected, 1) > 0 THEN
    RAISE EXCEPTION 'P5 ABORT: unexpected policies found: %', array_to_string(_unexpected, ', ');
  END IF;

  RAISE NOTICE 'P5 audit: % total policies, 12 legacy policies ready to drop.', _total;
END $$;

-- ── Audit each legacy policy for application impact ─────────────
-- All 12 are safe to drop because:
--
-- ambassador_applications (×2): apply-ambassador.cjs uses
--   SUPABASE_SERVICE_ROLE_KEY via Netlify function. No anon INSERT
--   or admin VIEW through direct REST API required.
-- guide_applications (×2): apply-guide.cjs uses service_role.
--   Admin dashboard reads via Netlify function, not direct API.
-- guides (×4): Guide profile CRUD handled by guide-profile.cjs
--   (service_role). Public read replaced by 003b
--   guides_select_published.
-- users (×2): Replaced by 003b users_select_own (SELECT own row)
--   and users_update_own_name_avatar (UPDATE name/avatar only).
-- experiences (×1): Replaced by 003b experiences_select_published.
-- destinations (×1): Replaced by 003b destinations_select_published.

-- ── Drop the 12 legacy policies (idempotent) ────────────────────
DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Only admins can view ambassador applications" ON ambassador_applications;
DROP POLICY IF EXISTS "Anyone can insert applications"             ON guide_applications;
DROP POLICY IF EXISTS "Only admins can view applications"          ON guide_applications;
DROP POLICY IF EXISTS "Guides can insert own profile"             ON guides;
DROP POLICY IF EXISTS "Guides can update their own profile"        ON guides;
DROP POLICY IF EXISTS "Guides can view their own profile"          ON guides;
DROP POLICY IF EXISTS "Public read access"                         ON guides;
DROP POLICY IF EXISTS "Users can read own profile"                 ON users;
DROP POLICY IF EXISTS "Users can update own profile"               ON users;
DROP POLICY IF EXISTS "Public read access"                         ON experiences;
DROP POLICY IF EXISTS "Public read access"                         ON destinations;

-- ── Verification ────────────────────────────────────────────────
DO $$
DECLARE
  _remaining TEXT[];
  _expected_dropped INT := 12;
BEGIN
  -- Collect any policies that are still present from the 12 we dropped
  SELECT array_agg(tablename || '.' || policyname ORDER BY 1) INTO _remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (tablename, policyname) IN (
      ('ambassador_applications', 'Anyone can insert ambassador applications'),
      ('ambassador_applications', 'Only admins can view ambassador applications'),
      ('guide_applications',      'Anyone can insert applications'),
      ('guide_applications',      'Only admins can view applications'),
      ('guides',                  'Guides can insert own profile'),
      ('guides',                  'Guides can update their own profile'),
      ('guides',                  'Guides can view their own profile'),
      ('guides',                  'Public read access'),
      ('users',                   'Users can read own profile'),
      ('users',                   'Users can update own profile'),
      ('experiences',             'Public read access'),
      ('destinations',            'Public read access')
    );

  IF _remaining IS NOT NULL AND array_length(_remaining, 1) > 0 THEN
    RAISE EXCEPTION 'P5 VERIFY FAILED: % legacy policies still present', array_to_string(_remaining, ', ');
  END IF;

  RAISE NOTICE 'P5 VERIFIED: all 12 legacy policies dropped. % policies remain.', (SELECT count(*) FROM pg_policies WHERE schemaname='public');
END $$;

COMMIT;
