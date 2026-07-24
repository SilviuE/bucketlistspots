-- ================================================================
-- 003_backfill: PUBLISH FOUNDER-APPROVED EXPERIENCES AND DESTINATIONS
-- ================================================================
-- Run in a DISPOSABLE Supabase project SQL Editor.
-- DO NOT run against production.
--
-- HEADER: FOUNDER APPROVAL REQUIRED — DO NOT RUN AUTOMATICALLY
-- This file must be reviewed and edited by the founder before execution.
-- Generic "publish all" is not permitted. Add specific IDs/names only.
--
-- Prerequisites:
--   - 003a_publication_columns.sql must be applied first
--   - Review preflight output from 003a to see current rows
--   - Founder must uncomment and fill in the specific IDs below
--
-- Execution order:
--   1. 003a_publication_columns.sql (adds columns)
--   2. 003_backfill_experiences_destinations.sql (this file — sets specific rows to true)
--   3. 003b_rls_privilege_hardening.sql (aborts if no published rows found)
-- ================================================================

DO $$ BEGIN
  RAISE NOTICE '003_backfill: Publishing founder-approved rows';
END $$;

-- ──────────────────────────────────────────────────────────────
-- FOUNDER: Uncomment and fill in specific IDs after review.
-- DO NOT use a generic "UPDATE ... SET is_published = true".
-- Each row must be explicitly listed and justified.
-- ──────────────────────────────────────────────────────────────

-- Experiences: publish only founder-approved IDs
-- UPDATE experiences SET is_published = true WHERE id IN (
--   ' uuid-experience-1',  -- Experience Name 1
--   ' uuid-experience-2',  -- Experience Name 2
-- );

-- Destinations: publish only founder-approved names
-- UPDATE destinations SET is_published = true WHERE name IN (
--   'Destination Name 1',
--   'Destination Name 2',
-- );

-- ──────────────────────────────────────────────────────────────
-- VERIFICATION (run after backfill)
-- ──────────────────────────────────────────────────────────────
SELECT 'experiences' AS tbl, count(*) AS published_count FROM experiences WHERE is_published = true;
SELECT 'destinations' AS tbl, count(*) AS published_count FROM destinations WHERE is_published = true;

DO $$ BEGIN
  RAISE NOTICE '003_backfill: COMPLETE';
  RAISE NOTICE 'NEXT: Run 003b_rls_privilege_hardening.sql';
END $$;
