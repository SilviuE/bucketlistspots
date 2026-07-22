-- Platform Config Expansion v1.0
-- Adds Founding Guide dates, Global Zone copy, referral limits, Trust Gate checks.
-- Does NOT add Global Zone fee amounts (not yet approved).
-- Does NOT remove standard_commission_pct or saas_monthly_fee_gbp (kept for future use, not exposed publicly).

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  founding_guide_start_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  founding_guide_end_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 months');

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  founding_guide_is_active BOOLEAN DEFAULT true;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  founding_guide_copy TEXT DEFAULT 'During the first six months of the BucketListSpots platform promotional period, approved guides pay no membership or verification charge. Guides join with Standard status and may apply for an upgrade when eligible.';

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  global_pricing_zones_enabled BOOLEAN DEFAULT true;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  global_pricing_zones_public_copy TEXT DEFAULT 'After the promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions. Pricing will be communicated before the Founding Guide period ends.';

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  global_pricing_zone_names JSONB DEFAULT '["Global Zone A", "Global Zone B", "Global Zone C"]';

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  referral_max_gbp NUMERIC(6,2) DEFAULT 50.00;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  referral_max_eur NUMERIC(6,2) DEFAULT 50.00;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  referral_max_usd NUMERIC(6,2) DEFAULT 50.00;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  referral_cap_pct NUMERIC(5,4) DEFAULT 0.1500;

ALTER TABLE platform_config ADD COLUMN IF NOT EXISTS
  trust_gate_checks JSONB DEFAULT '[
    {"key": "identity", "label": "Identity Review", "description": "BLS confirms the identity of the applicant."},
    {"key": "licence", "label": "Licence and Documentation", "description": "Relevant operating documents are reviewed according to the destination."},
    {"key": "references", "label": "Experience and References", "description": "Route experience, references and supporting evidence are assessed."},
    {"key": "interview", "label": "Safety and Operational Interview", "description": "Guide explains emergency procedures, communication practices and operating standards."},
    {"key": "approval", "label": "Profile Approval", "description": "Approved information is published with a verification date."}
  ]';
