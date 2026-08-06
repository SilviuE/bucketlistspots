# Screen 4 — Isolation Verification Evidence (staging Deploy Preview)

Date: 2026-08-06
Staging Supabase project ref: `tqooyiyqsidbemzlcsfp`
Production Supabase project ref (must be ABSENT from staging): `nmyhytrnzfhdstqazttb`
Netlify site: `comfy-truffle-b279e3` (Deploy Previews = branch builds of the same repo)

## Check 4.1 — Production Supabase reference absent from deployed frontend

**Source audit (repo, `src/`):** 0 occurrences of `nmyhytrnzfhdstqazttb` in `src/`.
**Local staging build (`npm run build` with `VITE_SUPABASE_URL=https://tqooyiyqsidbemzlcsfp.supabase.co`):**
- `nmyhytrnzfhdstqazttb` in `dist/`: **0**
- `https://tqooyiyqsidbemzlcsfp.supabase.co` in bundle: **1** (exactly the staging URL)
- Any other `*.supabase.co` refs: **none** (unique)
- Result: **PASS**

**Deployed preview bundle (actual URL):** PENDING — requires preview URL from user.
(Command once available: fetch `<preview>/assets/index-*.js`, grep `nmyhytrnzfhdstqazttb` → must be 0.)

## Check 4.2 — Staging reference present

**Local staging build:** staging URL present in bundle. Result: **PASS**
**Deployed preview bundle:** PENDING preview URL.

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

## Check 4.5 — Production and main untouched

- Remote `main` HEAD: `e843e9cec3dead1a3f17654c0c4005a9a6dc931c` — unchanged since session start.
- `refs/heads/main` on `origin` = same hash. No merge from PR #1.
- Staging work lives only on `review/terms-sections-6-7` = `97e37c157efd9a0244243ee0f20b77fb767eb0f2`.
- Production Supabase project untouched (dashboard confirmation by user; no migrations run on prod).
Result: **PASS (git)** / PENDING (dashboard screenshot)

## Summary

| Check | Result |
|---|---|
| 4.1 prod ref absent (source + local build) | PASS |
| 4.1 prod ref absent (deployed bundle) | PENDING preview URL |
| 4.2 staging ref present (local build) | PASS |
| 4.3 no secrets in frontend (source + build) | PASS |
| 4.4 functions use staging (source) | PASS |
| 4.5 main/production untouched (git) | PASS |

## Blocking action

Provide the Deploy Preview URL (e.g. `https://<hash>--comfy-truffle-b279e3.netlify.app`) so the
deployed bundle + functions can be grepped directly to close Checks 4.1/4.2/4.4.
