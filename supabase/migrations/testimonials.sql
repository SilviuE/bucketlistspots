-- Testimonials v1.0
-- Public-facing testimonials with consent, approval, and publication controls.
-- Public read requires: consent_status = granted AND approval_status = approved AND is_published = true.

CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  display_name TEXT,
  role TEXT,
  relationship_to_bls TEXT,
  country TEXT,
  destination TEXT,
  testimonial_text TEXT NOT NULL,
  date_given DATE,
  consent_status TEXT DEFAULT 'pending',
  incentive_disclosed TEXT,
  photo_url TEXT,
  photo_permission BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  approval_status TEXT DEFAULT 'draft',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  testimonial_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_testimonials"
  ON testimonials FOR ALL
  USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "public_read_approved_testimonials"
  ON testimonials FOR SELECT
  USING (
    consent_status = 'granted'
    AND approval_status = 'approved'
    AND is_published = true
  );
