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
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  error_message TEXT,
  retryable BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_session ON webhook_event_inbox(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_event_inbox(status);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_retryable ON webhook_event_inbox(retryable) WHERE retryable = true;

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
-- SECURITY: REVOKE from PUBLIC/anon/authenticated; GRANT to service_role only.
-- Validates: positive amount, valid session, session is paid + confirmed in booking_confirmations.
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
  -- Validate amount is positive
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid_amount');
  END IF;

  -- Validate session exists and is paid
  SELECT * INTO v_booking
  FROM public.booking_confirmations
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_found');
  END IF;

  IF v_booking.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_paid');
  END IF;

  -- Idempotency: check if already credited
  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  -- Determine if referrer is a guide or user
  SELECT EXISTS(SELECT 1 FROM public.guides WHERE referral_code = p_referral_code) INTO v_is_guide;

  IF v_is_guide THEN
    v_table := 'public.guides';
    UPDATE public.guides SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  ELSE
    v_table := 'public.users';
    UPDATE public.users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
    WHERE referral_code = p_referral_code
    RETURNING bls_points_balance INTO v_new_balance;
  END IF;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'referrer_not_found');
  END IF;

  -- Insert ledger entry with idempotency key
  INSERT INTO public.transactions (user_id, amount, type, reason, linked_referral_code, linked_booking_id, idempotency_key)
  VALUES (p_user_id, p_amount, 'credit', p_reason, p_referral_code, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'pointsAdded', p_amount, 'newBalance', v_new_balance);
END;
$$;

-- 6. RPC: Atomic ambassador commission — credit balance + insert ledger atomically
-- SECURITY: REVOKE from PUBLIC/anon/authenticated; GRANT to service_role only.
-- Validates: positive amount, valid session, session is paid.
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
  -- Validate amount is positive
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'invalid_amount');
  END IF;

  -- Validate session exists and is paid
  SELECT * INTO v_booking
  FROM public.booking_confirmations
  WHERE session_id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_found');
  END IF;

  IF v_booking.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'session_not_paid');
  END IF;

  -- Idempotency: check if already credited
  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'already_credited');
  END IF;

  -- Credit ambassador balance
  UPDATE public.users SET bls_points_balance = COALESCE(bls_points_balance, 0) + p_amount
  WHERE id = p_ambassador_id
  RETURNING bls_points_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'ambassador_not_found');
  END IF;

  -- Insert ledger entry with idempotency key
  INSERT INTO public.transactions (user_id, amount, type, reason, linked_booking_id, idempotency_key)
  VALUES (p_ambassador_id, p_amount, 'credit', p_reason, p_session_id, p_idempotency_key);

  RETURN jsonb_build_object('credited', true, 'amount', p_amount, 'newBalance', v_new_balance);
END;
$$;

-- 7. SECURITY: Revoke EXECUTE from all non-service_role roles
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_ambassador_commission(TEXT, UUID, NUMERIC, TEXT, TEXT) TO service_role;

-- 7b. RPC: Atomic webhook event claim — atomically transitions event to 'processing'
-- Handles: received → processing, failed → processing, stale processing (>cutoff) → processing.
-- SECURITY: REVOKE from PUBLIC/anon/authenticated; GRANT to service_role only.
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_event_id TEXT,
  p_stale_cutoff TIMESTAMPTZ
)
RETURNS TABLE (
  claimed BOOLEAN,
  action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INT;
BEGIN
  -- 1. Claim new event (status = 'received')
  UPDATE public.webhook_event_inbox
  SET status = 'processing', processed_at = NOW()
  WHERE event_id = p_event_id AND status = 'received';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    claimed := true;
    action := 'claimed_new';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Claim retry (status = 'failed' AND retryable = true)
  UPDATE public.webhook_event_inbox
  SET status = 'processing', processed_at = NOW(), error_message = NULL, retryable = false
  WHERE event_id = p_event_id AND status = 'failed' AND retryable = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    claimed := true;
    action := 'claimed_retry';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 3. Recover stale processing (processed_at older than cutoff)
  UPDATE public.webhook_event_inbox
  SET status = 'processing', processed_at = NOW(), error_message = NULL
  WHERE event_id = p_event_id
    AND status = 'processing'
    AND processed_at < p_stale_cutoff;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    claimed := true;
    action := 'claimed_stale';
    RETURN NEXT;
    RETURN;
  END IF;

  -- 4. Not claimable — determine reason
  claimed := false;

  IF EXISTS (SELECT 1 FROM public.webhook_event_inbox WHERE event_id = p_event_id AND status = 'completed') THEN
    action := 'already_completed';
  ELSIF EXISTS (SELECT 1 FROM public.webhook_event_inbox WHERE event_id = p_event_id AND status = 'ignored') THEN
    action := 'already_ignored';
  ELSIF EXISTS (SELECT 1 FROM public.webhook_event_inbox WHERE event_id = p_event_id AND status = 'processing') THEN
    action := 'active_processing';
  ELSIF EXISTS (SELECT 1 FROM public.webhook_event_inbox WHERE event_id = p_event_id AND status = 'failed' AND retryable = false) THEN
    action := 'failed_non_retryable';
  ELSIF EXISTS (SELECT 1 FROM public.webhook_event_inbox WHERE event_id = p_event_id AND status = 'received') THEN
    action := 'recent_received';
  ELSE
    action := 'not_found';
  END IF;

  RETURN NEXT;
END;
$$;

-- 7c. SECURITY: Revoke claim_webhook_event from non-service_role roles
REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TIMESTAMPTZ) TO service_role;

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
