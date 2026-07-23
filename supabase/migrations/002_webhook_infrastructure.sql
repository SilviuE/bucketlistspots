-- Webhook Infrastructure: event inbox, booking confirmations, idempotency constraints
-- FRESH INSTALL migration — for new environments only.
-- For existing tables, use 002_webhook_infrastructure_upgrade.sql instead.

BEGIN;

-- 1. Webhook Event Inbox — records every Stripe webhook event, idempotency gate
CREATE TABLE IF NOT EXISTS webhook_event_inbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_session ON webhook_event_inbox(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_event_inbox(status);

-- 2. Booking Confirmations — authoritative booking record from webhook
CREATE TABLE IF NOT EXISTS booking_confirmations (
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

CREATE INDEX IF NOT EXISTS idx_booking_confirmations_session ON booking_confirmations(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_confirmations_guide ON booking_confirmations(guide_id);
CREATE INDEX IF NOT EXISTS idx_booking_confirmations_booking_ref ON booking_confirmations(booking_ref);

-- 3. Add UNIQUE constraint on payment_reports.session_id (for idempotency)
-- Only safe on fresh install; upgrade migration handles existing tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reports_session_id_key'
    AND conrelid = 'payment_reports'::regclass
  ) THEN
    ALTER TABLE payment_reports ADD CONSTRAINT payment_reports_session_id_key UNIQUE (session_id);
  END IF;
END $$;

-- 4. Add idempotency key column to transactions (for deduplication)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 5. RPC: Atomic referral credit — credit balance + insert ledger atomically
CREATE OR REPLACE FUNCTION credit_referral_reward(
  p_session_id TEXT,
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_referral_code TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_new_balance NUMERIC;
  v_table TEXT;
  v_is_guide BOOLEAN;
BEGIN
  -- Idempotency: check if already credited
  IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  -- Determine if referrer is a guide or user
  SELECT EXISTS(SELECT 1 FROM guides WHERE referral_code = p_referral_code) INTO v_is_guide;

  IF v_is_guide THEN
    v_table := 'guides';
    UPDATE guides SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  ELSE
    v_table := 'users';
    UPDATE users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  END IF;

  -- Insert ledger entry with idempotency key
  INSERT INTO transactions (user_id, amount, type, reason, linked_referral_code, linked_booking_id, idempotency_key)
  VALUES (p_user_id, p_amount, 'credit', p_reason, p_referral_code, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'pointsAdded', p_amount, 'newBalance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Atomic ambassador commission — credit balance + insert ledger atomically
CREATE OR REPLACE FUNCTION credit_ambassador_commission(
  p_session_id TEXT,
  p_ambassador_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Idempotency: check if already credited
  IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  -- Credit ambassador balance
  UPDATE users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
  WHERE id = p_ambassador_id
  RETURNING bls_points_balance INTO v_new_balance;

  -- Insert ledger entry with idempotency key
  INSERT INTO transactions (user_id, amount, type, reason, linked_booking_id, idempotency_key)
  VALUES (p_ambassador_id, p_amount, 'credit', p_reason, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'amount', p_amount, 'newBalance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Revoke direct table modifications from service_role for balance columns
-- (forces all balance changes through RPC functions)
-- Note: We cannot fully revoke UPDATE on guides/users since other code uses it,
-- but the RPC functions provide atomic idempotent alternatives for financial ops.

-- 8. RLS for new tables
ALTER TABLE webhook_event_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_inbox_service_all" ON webhook_event_inbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE booking_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_conf_service_all" ON booking_confirmations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke direct mutations on webhook_event_inbox
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM PUBLIC;
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM authenticated;
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM anon;

COMMIT;
