-- 007_traveller_enquiries.sql
-- Enquiry-first launch: travellers request a quote; no payment is taken.
-- Written only by the Netlify function (service role). No anon/auth access.

CREATE TABLE IF NOT EXISTS public.traveller_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  country TEXT,
  route TEXT,
  guide_id TEXT,
  travel_month TEXT,
  group_size INTEGER,
  budget TEXT,
  charity_climb BOOLEAN DEFAULT false,
  message TEXT,
  ref_code TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualified', 'quoted', 'booked', 'lost', 'spam')),
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.traveller_enquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.traveller_enquiries FROM anon, authenticated, PUBLIC;

CREATE INDEX IF NOT EXISTS idx_traveller_enquiries_created ON public.traveller_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traveller_enquiries_status ON public.traveller_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_traveller_enquiries_email ON public.traveller_enquiries(email);
