-- Referral Program & BLS Points Wallet

-- 1. Add referral fields to guides table
ALTER TABLE guides ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS bls_points_balance INTEGER NOT NULL DEFAULT 0;

-- 2. Add referral fields to users table (for ambassadors)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bls_points_balance INTEGER NOT NULL DEFAULT 0;

-- 3. Transactions ledger table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  linked_referral_code TEXT,
  linked_booking_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for wallet queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- RLS: allow users to see own transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
