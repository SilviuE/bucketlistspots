-- =====================================================================
-- BucketListSpots — Trust cleanup (PRODUCTION data fix)
-- Date: 2026-11-21
-- Run in: Supabase Dashboard → SQL Editor → PRODUCTION project
-- Reversible: yes (rows are unpublished, not deleted; see ROLLBACK)
--
-- Why: the public site showed demo/fixture guides with invented review
-- counts, "Save X% vs agency" comparisons and Trust Gate flags that were
-- never evidenced. Under the DMCC Act 2024 fake reviews are banned and
-- unsubstantiated savings claims are a CMA risk (see DECISION-010).
-- =====================================================================

BEGIN;

-- 0) Snapshot current state for audit / rollback
CREATE TABLE IF NOT EXISTS public._backup_guides_20261121 AS
  SELECT * FROM public.guides;
REVOKE ALL ON public._backup_guides_20261121 FROM anon, authenticated, PUBLIC;
ALTER TABLE public._backup_guides_20261121 ENABLE ROW LEVEL SECURITY;

-- 1) Unpublish fixture / demo guides (not real partners) + test row
UPDATE public.guides
SET status = 'draft', featured = false, updated_at = NOW()
WHERE id IN (
  'maria-komba',      -- fictitious (claims KilimanjaroJoy trading name)
  'pemba-sherpa',     -- fictitious (Nepal)
  'erik-nordstrom',   -- fictitious (Norway)
  'carlos-quispe',    -- fictitious (Peru)
  'andrei-popescu',   -- fictitious (Romania)
  'afaeb91bfeab'      -- test row "Kilimanjaro " at $100
);

-- 2) Remove unsubstantiated claims from ALL guides
UPDATE public.guides
SET agency_price = NULL,   -- no "vs agency" comparison without methodology
    review_count = 0,      -- no review system yet; no invented counts
    updated_at   = NOW();

-- 3) David Bakari — real "from" price (Machame route, incl. park fees)
UPDATE public.guides
SET price = 1900,
    trips_led = 0,         -- re-enter only with evidence (e.g. KINAPA records)
    updated_at = NOW()
WHERE id = 'david-bakari';

-- 4) RECOMMENDED: Trust Gate flags only when evidence is on file.
--    The Trust Gate pilot for David is still open (documents pending),
--    so the profile will show "Verification in progress" until re-set.
--    Re-enable each flag individually once the evidence is filed.
UPDATE public.guides
SET identity_verified = false,
    license_verified  = false,
    safety_verified   = false,
    fair_pay_verified = false,
    badge             = NULL,
    updated_at        = NOW()
WHERE id = 'david-bakari';

-- 5) Verify: should return ONLY david-bakari
SELECT id, name, status, featured, price, agency_price, review_count,
       identity_verified, license_verified, safety_verified, fair_pay_verified
FROM public.guides
WHERE status = 'published';

COMMIT;

-- =====================================================================
-- ROLLBACK (only if needed):
-- UPDATE public.guides g SET
--   status = b.status, featured = b.featured, price = b.price,
--   agency_price = b.agency_price, review_count = b.review_count,
--   trips_led = b.trips_led, badge = b.badge,
--   identity_verified = b.identity_verified, license_verified = b.license_verified,
--   safety_verified = b.safety_verified, fair_pay_verified = b.fair_pay_verified
-- FROM public._backup_guides_20261121 b WHERE g.id = b.id;
-- =====================================================================
