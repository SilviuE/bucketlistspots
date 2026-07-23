-- Webhook Infrastructure: UPGRADE for existing production databases.
-- This migration adds webhook_event_inbox, booking_confirmations,
-- and required constraints to an existing Supabase deployment.
-- DO NOT use for fresh installs — use 002_webhook_infrastructure.sql instead.
--
-- Safety: all CREATE TABLE IF NOT EXISTS, all constraints are conditional.
-- Atomic: wrapped in BEGIN/COMMIT — any failure rolls back.

BEGIN;

-- 1. Webhook Event Inbox
CREATE TABLE IF NOT EXISTS webhook_event_inbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_session_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retryable BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_session ON webhook_event_inbox(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_event_inbox(status);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_retryable ON webhook_event_inbox(retryable) WHERE retryable = true;

-- 2. Booking Confirmations
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

-- 3. payment_reports.session_id UNIQUE (conditional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_reports_session_id_key'
    AND conrelid = 'payment_reports'::regclass
  ) THEN
    IF (SELECT COUNT(*) FROM (SELECT session_id FROM payment_reports WHERE session_id IS NOT NULL GROUP BY session_id HAVING COUNT(*) > 1) sub) = 0 THEN
      ALTER TABLE payment_reports ADD CONSTRAINT payment_reports_session_id_key UNIQUE (session_id);
    ELSE
      RAISE WARNING 'payment_reports: duplicate session_ids exist. Resolve before adding UNIQUE.';
    END IF;
  END IF;
END $$;

-- 4. transactions.idempotency_key (conditional)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 5. RPC: credit_referral_reward (upsert, security hardened)
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
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_table TEXT;
  v_is_guide BOOLEAN;
  v_booking RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid_amount');
  END IF;

  SELECT * INTO v_booking
  FROM public.booking_confirmations
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_found');
  END IF;

  IF v_booking.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_paid');
  END IF;

  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.guides WHERE referral_code = p_referral_code) INTO v_is_guide;

  IF v_is_guide THEN
    UPDATE public.guides SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  ELSE
    UPDATE public.users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  END IF;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'referrer_not_found');
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, reason, linked_referral_code, linked_booking_id, idempotency_key)
  VALUES (p_user_id, p_amount, 'credit', p_reason, p_referral_code, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'pointsAdded', p_amount, 'newBalance', v_new_balance);
END;
$$;

-- 6. RPC: credit_ambassador_commission (upsert, security hardened)
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
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_booking RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid_amount');
  END IF;

  SELECT * INTO v_booking
  FROM public.booking_confirmations
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_found');
  END IF;

  IF v_booking.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_paid');
  END IF;

  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  UPDATE public.users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
  WHERE id = p_ambassador_id
  RETURNING bls_points_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'ambassador_not_found');
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, reason, linked_booking_id, idempotency_key)
  VALUES (p_ambassador_id, p_amount, 'credit', p_reason, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'amount', p_amount, 'newBalance', v_new_balance);
END;
$$;

-- 7. SECURITY: Revoke EXECUTE from non-service_role roles
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- 8. RLS for new tables
ALTER TABLE webhook_event_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_inbox_service_all" ON webhook_event_inbox;
CREATE POLICY "webhook_inbox_service_all" ON webhook_event_inbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE booking_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_conf_service_all" ON booking_confirmations;
CREATE POLICY "booking_conf_service_all" ON booking_confirmations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke direct mutations on webhook_event_inbox
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM PUBLIC;
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM authenticated;
REVOKE UPDATE, DELETE ON webhook_event_inbox FROM anon;

COMMIT;
