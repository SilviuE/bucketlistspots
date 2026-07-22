-- Charity Challenges: Maps destinations to vetted charities and tracks user fundraising pages
-- JustGiving integration for BucketListSpots

-- 1. Pre-vetted charities mapped to destinations
CREATE TABLE IF NOT EXISTS destination_charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination TEXT NOT NULL,              -- e.g. 'kilimanjaro', 'patagonia'
  charity_name TEXT NOT NULL,
  charity_api_id TEXT NOT NULL,           -- JustGiving charity ID (e.g. '12345')
  charity_description TEXT,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast destination lookups
CREATE INDEX IF NOT EXISTS idx_destination_charities_destination ON destination_charities(destination);
CREATE INDEX IF NOT EXISTS idx_destination_charities_active ON destination_charities(is_active);

-- 2. User fundraising pages linked to JustGiving
CREATE TABLE IF NOT EXISTS fundraising_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id TEXT,                         -- links to booking (bk_XXXXXXX)
  charity_id UUID REFERENCES destination_charities(id),
  charity_api_id TEXT NOT NULL,            -- JustGiving charity ID
  charity_name TEXT NOT NULL,              -- denormalized for display
  page_short_name TEXT,                    -- JustGiving page short name
  page_url TEXT,                           -- JustGiving public URL
  page_title TEXT,                         -- e.g. "John's Kilimanjaro Challenge"
  target_amount NUMERIC(10,2),
  currency TEXT DEFAULT 'GBP',
  total_raised NUMERIC(10,2) DEFAULT 0,
  donor_count INT DEFAULT 0,
  event_date DATE,
  status TEXT DEFAULT 'active',            -- active / closed / cancelled
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user's fundraising pages
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_user ON fundraising_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_pages_status ON fundraising_pages(status);

-- 3. Seed data: Kilimanjaro charities
INSERT INTO destination_charities (destination, charity_name, charity_api_id, charity_description, logo_url, website_url)
VALUES
  (
    'kilimanjaro',
    'Kilimanjaro Porters Assistance Project (KPAP)',
    'JUSTGIVING_KPAP_ID',
    'KPAP ensures that porters on Mount Kilimanjaro are treated fairly. They advocate for proper wages, adequate equipment, and safe working conditions for the people who make summit attempts possible.',
    'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=100&h=100&fit=crop',
    'https://www.kilimanjaroporters.org'
  ),
  (
    'kilimanjaro',
    'African Wildlife Foundation',
    'JUSTGIVING_AWF_ID',
    'AWF works to ensure that wildlife and wild lands thrive in modern Africa. Your fundraising helps protect elephants, lions, and the ecosystems that make Kilimanjaro a world heritage site.',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=100&h=100&fit=crop',
    'https://www.africanwildlife.org'
  );

-- 4. RLS policies
ALTER TABLE destination_charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraising_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read active charities (public directory)
CREATE POLICY "Public can view active charities"
  ON destination_charities FOR SELECT
  USING (is_active = true);

-- Users can read their own fundraising pages
CREATE POLICY "Users read own fundraising pages"
  ON fundraising_pages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own fundraising pages
CREATE POLICY "Users create own fundraising pages"
  ON fundraising_pages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own fundraising pages
CREATE POLICY "Users update own fundraising pages"
  ON fundraising_pages FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can manage charities (using service role which bypasses RLS)
-- No policy needed: service role key bypasses RLS entirely
