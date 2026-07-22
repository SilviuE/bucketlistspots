-- ============================================================
-- BucketListSpots Landing Page Migrations v1.0
-- Run this in Supabase SQL Editor → New Query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CLAIMS REGISTRY
-- ────────────────────────────────────────────────────────────
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

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_manage_claims" ON claims_registry;
  DROP POLICY IF EXISTS "public_read_approved_claims" ON claims_registry;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "admin_manage_claims"
  ON claims_registry FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "public_read_approved_claims"
  ON claims_registry FOR SELECT
  USING (
    approval_status = 'approved'
    AND publication_status = 'published'
  );

INSERT INTO claims_registry (claim_key, claim_text, page, component, claim_type, evidence_source) VALUES
  ('GUIDE_80_PERCENT_DIRECT',
   'The Local Partner receives 80% of the Listed Trip Price directly.',
   '/for-guides', 'GuideFinancialModel', 'financial', 'platform_config.commission rates'),
  ('FOUNDING_GUIDE_NO_CHARGE',
   'No membership or verification charge during the six-month Founding Guide promotional period.',
   '/for-guides', 'FoundingGuideProgramme', 'commercial', 'platform_config.founding_guide dates'),
  ('REFERRAL_NEVER_REDUCES_GUIDE',
   'Traveller referral discounts are funded from the BLS Platform Fee. They never reduce your Local Partner Balance.',
   '/for-guides', 'GuideFinancialModel', 'financial', 'calculateBookingPrice() implementation'),
  ('UK_REGISTERED_MARKETPLACE',
   'BucketListSpots is a UK-registered marketplace (Company No. 16595661).',
   '/for-guides', 'GuideHero', 'verification', 'Companies House record 16595661'),
  ('NAMED_LOCAL_PARTNER',
   'The named Local Partner operates and delivers the expedition.',
   '/for-guides', 'GuideHero', 'comparative', 'platform booking flow'),
  ('TRUST_GATE_DOCUMENTED',
   'Each profile shows which identity, licence, certification, reference and operational checks have been completed.',
   '/for-guides', 'TrustGateProcess', 'verification', 'Trust Gate checklist implementation'),
  ('STATUS_UPGRADES_NOT_AUTOMATIC',
   'Status upgrades are not automatic and do not guarantee search position or booking volume.',
   '/for-guides', 'GuideStatusPath', 'commercial', 'platform status policy'),
  ('GUIDE_SETS_PRICE',
   'The Local Partner remains responsible for setting an economically viable trip price.',
   '/for-guides', 'GuideFinancialModel', 'commercial', 'Local Partner Agreement'),
  ('VERIFICATION_NOT_SAFETY_GUARANTEE',
   'Trust Gate verification reduces information gaps but does not remove the inherent risks of adventure travel.',
   '/for-guides', 'TrustGateProcess', 'legal', 'legal review requirement'),
  ('STRIPE_SECURED_PAYMENTS',
   'BLS payments are processed through Stripe.',
   '/', 'TrustStrip', 'financial', 'Stripe integration documentation'),
  ('BOOKING_TERMS_GOVERN',
   'Precise responsibilities and payment arrangements are shown before the traveller confirms the booking.',
   '/', 'HowDirectBookingWorks', 'legal', 'checkout flow implementation'),
  ('DEPOSIT_CREDIT_CONDITIONS',
   'Eligibility, value, transferability and use are governed by the Booking Terms.',
   '/', 'LifetimeDepositCredit', 'legal', 'Terms of Service section')
ON CONFLICT (claim_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. TESTIMONIALS
-- ────────────────────────────────────────────────────────────
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

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_manage_testimonials" ON testimonials;
  DROP POLICY IF EXISTS "public_read_approved_testimonials" ON testimonials;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "admin_manage_testimonials"
  ON testimonials FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "public_read_approved_testimonials"
  ON testimonials FOR SELECT
  USING (
    consent_status = 'granted'
    AND approval_status = 'approved'
    AND is_published = true
  );

-- ────────────────────────────────────────────────────────────
-- 3. PLATFORM CONFIG EXPANSION
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN founding_guide_start_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN founding_guide_end_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months');
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN founding_guide_is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN founding_guide_copy TEXT DEFAULT 'During the first six months of the BucketListSpots platform promotional period, approved guides pay no membership or verification charge. Guides join with Standard status and may apply for an upgrade when eligible.';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN global_pricing_zones_enabled BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN global_pricing_zones_public_copy TEXT DEFAULT 'After the promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions. Pricing will be communicated before the Founding Guide period ends.';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN global_pricing_zone_names JSONB DEFAULT '["Global Zone A", "Global Zone B", "Global Zone C"]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN referral_max_gbp NUMERIC(6,2) DEFAULT 50.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN referral_max_eur NUMERIC(6,2) DEFAULT 50.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN referral_max_usd NUMERIC(6,2) DEFAULT 50.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN referral_cap_pct NUMERIC(5,4) DEFAULT 0.1500;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE platform_config ADD COLUMN trust_gate_checks JSONB DEFAULT '[{"key":"identity","label":"Identity Review","description":"BLS confirms the identity of the applicant."},{"key":"licence","label":"Licence and Documentation","description":"Relevant operating documents are reviewed according to the destination."},{"key":"references","label":"Experience and References","description":"Route experience, references and supporting evidence are assessed."},{"key":"interview","label":"Safety and Operational Interview","description":"Guide explains emergency procedures, communication practices and operating standards."},{"key":"approval","label":"Profile Approval","description":"Approved information is published with a verification date."}]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update the existing row with explicit founding guide dates
UPDATE platform_config SET
  founding_guide_start_at = NOW(),
  founding_guide_end_at = NOW() + INTERVAL '6 months',
  founding_guide_is_active = true
WHERE id = 1;
