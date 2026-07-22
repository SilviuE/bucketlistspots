-- Claims Registry v1.0
-- Auditable record of public claims with approval workflow.
-- All seeded claims start as draft/pending/hidden.

CREATE TABLE claims_registry (
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
   '/', 'LifetimeDepositCredit', 'legal', 'Terms of Service section');
