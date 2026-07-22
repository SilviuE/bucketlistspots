-- Platform Configuration: commission rates, promotional periods, and feature flags
-- Single-row table — admin can update settings without code changes

CREATE TABLE IF NOT EXISTS platform_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  -- Commission rates
  promotional_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  standard_commission_pct NUMERIC(5,4) NOT NULL DEFAULT 0.1800,
  -- Promotional period
  promotional_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  promotional_end_date TIMESTAMPTZ,
  -- SaaS fee (post-promo only)
  saas_monthly_fee_gbp NUMERIC(8,2) NOT NULL DEFAULT 50.00,
  -- Feature flags
  referral_program_enabled BOOLEAN NOT NULL DEFAULT true,
  charity_challenges_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default config (promotional 20% for 6 months from launch)
INSERT INTO platform_config (id, promotional_commission_pct, standard_commission_pct, promotional_start_date, promotional_end_date, saas_monthly_fee_gbp)
VALUES (1, 0.2000, 0.1800, NOW(), NOW() + INTERVAL '6 months', 50.00)
ON CONFLICT (id) DO NOTHING;

-- RLS: service role only
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_config_admin" ON platform_config;
CREATE POLICY "platform_config_admin" ON platform_config FOR ALL
  TO service_role USING (true);
