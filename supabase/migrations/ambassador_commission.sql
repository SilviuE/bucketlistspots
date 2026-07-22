-- Ambassador 5% lifetime commission on referred guides' bookings
-- Each guide can be linked to one ambassador who recruited them.

-- Add the column to guides
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS referred_by_ambassador_id text;

-- Add the column to guide_applications so we can capture it at sign-up
ALTER TABLE public.guide_applications
  ADD COLUMN IF NOT EXISTS referred_by_ambassador_code text;

-- Index for fast lookups when processing payments
CREATE INDEX IF NOT EXISTS idx_guides_referred_by ON public.guides(referred_by_ambassador_id);

COMMENT ON COLUMN public.guides.referred_by_ambassador_id IS 'User ID of the ambassador who recruited this guide. Ambassador earns 5% lifetime commission on all bookings.';
COMMENT ON COLUMN public.guide_applications.referred_by_ambassador_code IS 'Ambassador referral code entered during guide application.';
