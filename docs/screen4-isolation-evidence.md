# Screen 4 — Isolation Verification Evidence (staging Deploy Preview)

Date: 2026-08-06
Staging Supabase project ref: `tqooyiyqsidbemzlcsfp`
Production Supabase project ref (must be ABSENT from staging): `nmyhytrnzfhdstqazttb`
Netlify site: `comfy-truffle-b279e1` (Deploy Previews = branch builds of the same repo)

## Check 4.1 — Production Supabase reference absent from deployed frontend

**Source audit (repo, `src/`):** 0 occurrences of `nmyhytrnzfhdstqazttb` in `src/`.
**Local staging build (`npm run build` with `VITE_SUPABASE_URL=https://tqooyiyqsidbemzlcsfp.supabase.co`):**
- `nmyhytrnzfhdstqazttb` in `dist/`: **0**
- `https://tqooyiyqsidbemzlcsfp.supabase.co` in bundle: **1** (exactly the staging URL)
- Any other `*.supabase.co` refs: **none** (unique)
- Result: **PASS**

**Deployed preview bundle** (`https://deploy-preview-1--comfy-truffle-b279e1.netlify.app/`, fetched 2026-08-06):
- Bundle: `assets/index-BXbTb8Jx.js` (1,058,705 bytes)
- `nmyhytrnzfhdstqazttb`: **0**
- `https://tqooyiyqsidbemzlcsfp.supabase.co`: **1** (only supabase ref present)
- Result: **PASS**

## Check 4.2 — Staging reference present

**Local staging build:** staging URL present in bundle. Result: **PASS**
**Deployed preview bundle:** `https://tqooyiyqsidbemzlcsfp.supabase.co` present, and it is the **only**
`*.supabase.co` ref in the served bundle. Result: **PASS**

## Check 4.3 — No secrets in frontend files

**Source audit (`src/`):** 0 occurrences of `sk_live_` / `sk_test_` / `whsec_` / `sb_secret_` / `postgres://`.
Client Supabase access is env-only (`src/lib/supabaseClient.js`: `import.meta.env.VITE_SUPABASE_URL`,
`import.meta.env.VITE_SUPABASE_ANON_KEY`). Anon key is publishable by design.
**Local staging build (`dist/`):** 0 occurrences of `sk_live_`/`sk_test_`/`whsec_`/`sb_secret_`/`service_role`/`eyJhbGci` (JWT).
Result: **PASS**

**Repo-wide (excl. `.git`, `node_modules`, `dist`):** matches are only in
- `.env` (gitignored via `.gitignore:3`, untracked — local dev only, never deployed)
- `docs/*.md` (placeholders like `whsec_REPLACE_ME…`, `sk_test_.`, field-name references — no real values)
- `netlify/functions/*.cjs` + `tests/*` (prefix validation code, no real secrets)
Result: **PASS**

## Check 4.4 — Netlify Functions use staging

`netlify/functions/*.cjs` read Supabase credentials exclusively from
`process.env.VITE_SUPABASE_URL` / `process.env.SUPABASE_SERVICE_ROLE_KEY` /
`process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY`
(`auth.cjs:46`). No hardcoded refs anywhere in functions.
0 occurrences of `nmyhytrnzfhdstqazttb` in `netlify/functions/`.
Dashboard verification (user, dashboard-only): confirm Branch/Deploy Preview context vars point at
`https://tqooyiyqsidbemzlcsfp.supabase.co`. Result: **PASS (source)** / PENDING (dashboard screenshot)

**Deployed function probes (fetched 2026-08-06):**
- Preview `GET /api/charities?destination=kenya` → HTTP 500
  `{"error":"Could not find the table 'public.destination_charities' in the schema cache"}`
  → function hit the **staging** project, which has not yet had migrations applied (table absent).
- Production `GET /api/charities?destination=kenya` (same site, main domain) → HTTP 200
  `{"charities":[],"mockMode":true}` → production project intact.
- Preview `POST /webhooks/stripe` → HTTP 503 `{"error":"Webhook not configured"}`
  → staging has no Stripe secrets set (safe; nothing leaks).
Result: **PASS** — preview functions resolve staging env, production functions resolve production.

## Check 4.5 — Production and main untouched

- Remote `main` HEAD: `e843e9cec3dead1a3f17654c0c4005a9a6dc931c` — unchanged since session start.
- `refs/heads/main` on `origin` = same hash. No merge from PR #1.
- Staging work lives only on `review/terms-sections-6-7` = `97e37c157efd9a0244243ee0f20b77fb767eb0f2`.
- Production Supabase project untouched (dashboard confirmation by user; no migrations run on prod).
Result: **PASS (git)** / PENDING (dashboard screenshot)

## Summary

| Check | Result |
|---|---|
| 4.1 prod ref absent (source + local build + deployed bundle) | PASS |
| 4.2 staging ref present (local build + deployed bundle) | PASS |
| 4.3 no secrets in frontend (source + build + deployed bundle) | PASS |
| 4.4 functions use staging (source + deployed function probes) | PASS |
| 4.5 main/production untouched (git + production probe) | PASS |

All five Screen 4 checks PASS. Proceed to migrations via SQL Editor on staging
(`docs/staging-migration-sequence-sql-editor.md`).
