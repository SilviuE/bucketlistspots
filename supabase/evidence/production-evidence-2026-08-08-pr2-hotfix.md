# Production Hotfix Evidence — 2026-08-08 — PR #2
# ================================================================
# PR:  #2 — fix: prevent NaN guide pricing and restore agency comparison
# Base: main
# Source: hotfix/guide-card-nan
# Tested commit: 3727200298bb4fb113faecede6ebf6c9145927f2
# Merge commit: d3c620fd4a48dfb0a9df7eef9fd3a49b4d6080cc
# Production deploy: 2026-08-08 ~09:34 UK
# ================================================================

## Root Cause

agency_price column existed in Production public.guides but was
omitted from PUBLIC_GUIDE_COLUMNS in src/lib/api.js. The frontend
mapGuide() function received undefined for g.agency_price, producing
$NaN and Save NaN% on guide cards.

## Code Fixes

- api.js: added agency_price to PUBLIC_GUIDE_COLUMNS
- currency.js: formatGuidePrice() with Math.ceil() and NaN guards
- GuideCard.jsx: hides agency comparison when agencyPrice absent
- ImpactCalculator.jsx: guards missing agencyPrice
- Traveller-facing prices display whole currency units

## Migrations

| Migration | Staging | Production |
|---|---|---|
| 005_guides_agency_price.sql | Added NUMERIC(10,2) | Accepted existing INTEGER (compatible) |
| 006_guides_agency_price_privileges.sql | Column SELECT granted | Column SELECT granted |

## Staging Verification (tqooyiyqsidbemzlcsfp)

- 005 PASS, 006 PASS
- anon SELECT agency_price = true
- authenticated SELECT agency_price = true
- No write privileges leaked
- REST query via Deploy Preview: 200 OK

## Production Verification (nmyhytrnzfhdstqazttb)

Pre-006 state:
  agency_price: INTEGER, nullable
  anon column SELECT: false
  authenticated column SELECT: false

006 execution: Success. No rows returned.

Post-006:
  anon column SELECT: true
  authenticated column SELECT: true
  no INSERT/UPDATE leaked
  no table-wide SELECT granted
  RLS + guides_select_published intact

Production functional tests (all 7 published guides):
  David Bakari: $900 / $3,200 / Save 72%
  Erik Nordstrom: $2,200 / $3,500 / Save 37%
  Maria Komba: $1,950 / $3,200 / Save 39%
  Andrei Popescu: $1,200 / $2,200 / Save 45%
  Pemba Sherpa: $1,600 / $2,800 / Save 43%
  Carlos Quispe: $850 / $1,500 / Save 43%
  Kilimanjaro: $100, agency_price=NULL, no comparison (correct)

Confirmed: $NaN absent, Save NaN% absent, REST 200 OK.

## Environment Correction

Netlify Deploy Preview VITE_SUPABASE_* variables were pointing to
Production. Corrected to point to Staging. Production-scoped
variables unchanged.

## Known Non-Blocking

Kilimanjaro guide renders ( reviews) due to NULL review_count.
Separate UI cleanup item, not part of PR #2.

## Constraints (unchanged)

- Terms: draft-0.3, DRAFT, legal acknowledgement HOLD
- Stripe live: disabled
- JustGiving: disabled
- Live launch: not activated
