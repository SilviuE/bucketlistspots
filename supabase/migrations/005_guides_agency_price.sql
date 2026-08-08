-- ================================================================
-- 005: GUIDES AGENCY PRICE COLUMN (additive, idempotent)
-- ================================================================
-- Purpose : Add agency_price to guides for agency-price comparison.
--           Production: INTEGER (app-added). Staging: absent.
-- Safety  : ADD COLUMN IF NOT EXISTS. Accepts integer or numeric.
--           Aborts on incompatible non-numeric definition.
--           No backfill. No RLS/policy changes.
-- ================================================================

BEGIN;

-- Add if absent; validate if present
DO $$
DECLARE
  _exists BOOLEAN;
  _dtype  TEXT;
  _nullable TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides'
      AND column_name = 'agency_price'
  ) INTO _exists;

  IF NOT _exists THEN
    ALTER TABLE public.guides ADD COLUMN agency_price NUMERIC(10,2);
    RAISE NOTICE '005: Added guides.agency_price (NUMERIC(10,2), nullable).';
  ELSE
    SELECT data_type, is_nullable
    INTO _dtype, _nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides'
      AND column_name = 'agency_price';

    IF _dtype NOT IN ('integer', 'numeric', 'bigint', 'smallint', 'real', 'double precision') THEN
      RAISE EXCEPTION '005 ABORT: guides.agency_price has type % (expected numeric).', _dtype;
    END IF;

    IF _nullable != 'YES' THEN
      RAISE EXCEPTION '005 ABORT: guides.agency_price is NOT NULL (expected nullable).';
    END IF;

    RAISE NOTICE '005: guides.agency_price exists (type %, nullable). No changes needed.', _dtype;
  END IF;
END $$;

-- Verification
DO $$
DECLARE _dtype TEXT; _nullable TEXT; _default TEXT;
BEGIN
  SELECT data_type, is_nullable, column_default
  INTO _dtype, _nullable, _default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'guides'
    AND column_name = 'agency_price';

  IF NOT FOUND THEN
    RAISE EXCEPTION '005 VERIFY FAILED: guides.agency_price not present.';
  END IF;

  IF _dtype NOT IN ('integer', 'numeric', 'bigint', 'smallint', 'real', 'double precision') THEN
    RAISE EXCEPTION '005 VERIFY FAILED: guides.agency_price has type % (expected numeric).', _dtype;
  END IF;

  IF _nullable != 'YES' THEN
    RAISE EXCEPTION '005 VERIFY FAILED: guides.agency_price is NOT NULL (expected nullable).';
  END IF;

  IF _default IS NOT NULL THEN
    RAISE WARNING '005: guides.agency_price has a non-NULL default (%), which differs from the canonical NULL default.', _default;
  END IF;

  RAISE NOTICE '005 VERIFIED: guides.agency_price (%, nullable) exists.', coalesce(_dtype,'?');
END $$;

COMMIT;
