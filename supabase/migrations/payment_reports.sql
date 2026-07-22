-- Payment Reports: stores Stripe financial data per transaction for multi-currency reconciliation

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

-- Index for admin reporting queries
CREATE INDEX IF NOT EXISTS idx_payment_reports_created_at ON payment_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_reports_guide_id ON payment_reports(guide_id);
CREATE INDEX IF NOT EXISTS idx_payment_reports_currency ON payment_reports(presentment_currency);

-- RLS: only service role can access (admin-only via API with service role key)
ALTER TABLE payment_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_reports_admin_only" ON payment_reports;
CREATE POLICY "payment_reports_admin_only" ON payment_reports FOR ALL
  TO service_role USING (true);
