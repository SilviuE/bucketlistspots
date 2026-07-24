-- ================================================================
-- 003a: ADD PUBLICATION COLUMNS
-- ================================================================
-- Run in a DISPOSABLE Supabase project SQL Editor.
-- DO NOT run against production.
--
-- Adds is_published BOOLEAN to experiences and destinations.
-- All existing rows default to false (not publicly visible).
-- No RLS policy changes — existing USING (true) policies remain in effect.
-- ================================================================

DO $$ BEGIN
  RAISE NOTICE '003a: Adding publication columns';
END $$;

-- experiences
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'experiences' AND column_name = 'is_published') THEN
    ALTER TABLE experiences ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE '  Added experiences.is_published';
  ELSE
    RAISE NOTICE '  experiences.is_published exists';
  END IF;
END $$;

-- destinations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'destinations' AND column_name = 'is_published') THEN
    ALTER TABLE destinations ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE '  Added destinations.is_published';
  ELSE
    RAISE NOTICE '  destinations.is_published exists';
  END IF;
END $$;

-- Preflight: list current rows for founder review
-- (Uncomment manually to review before backfill)
-- SELECT 'experiences' AS tbl, id, title, is_published FROM experiences ORDER BY title;
-- SELECT 'destinations' AS tbl, name, is_published FROM destinations ORDER BY name;

DO $$ BEGIN
  RAISE NOTICE '003a: PUBLICATION COLUMNS COMPLETE';
  RAISE NOTICE 'NEXT: Review preflight queries above, then run 003_backfill.';
END $$;
