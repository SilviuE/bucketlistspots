-- ================================================================
-- 005: GUIDES AGENCY PRICE COLUMN (additive, idempotent)
-- ================================================================
-- Purpose : Add agency_price to guides for agency-price comparison
--           feature. Production already has this column (app-added);
--           staging does not.
-- Safety  : ADD COLUMN IF NOT EXISTS. Validates type on existing
--           column. No backfill. No RLS/policy changes.
-- ================================================================

BEGIN;

-- Add if absent; validate if present
DO $$
DECLARE
  _exists BOOLEAN;
  _dtype  TEXT;
  _nullable TEXT;
  _default TEXT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides'
      AND column_name = 'agency_price'
  ) INTO _exists;

  IF NOT _exists THEN
    ALTER TABLE public.guides ADD COLUMN agency_price INTEGER;
    RAISE NOTICE '005: Added guides.agency_price (INTEGER, nullable, no default).';
  ELSE
    SELECT data_type, is_nullable, column_default
    INTO _dtype, _nullable, _default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides'
      AND column_name = 'agency_price';

    IF _dtype != 'integer' THEN
      RAISE EXCEPTION '005 ABORT: guides.agency_price exists but has type % (expected integer).', _dtype;
    END IF;

    IF _nullable != 'YES' THEN
      RAISE EXCEPTION '005 ABORT: guides.agency_price is NOT NULL (expected nullable).';
    END IF;

    RAISE NOTICE '005: guides.agency_price exists and is valid (INTEGER, nullable). No changes needed.';
  END IF;
END $$;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guides'
      AND column_name = 'agency_price' AND data_type = 'integer' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION '005 VERIFY FAILED: guides.agency_price not present or wrong type.';
  END IF;

  RAISE NOTICE '005 VERIFIED: guides.agency_price (INTEGER, nullable) present.';
END $$;

COMMIT;
