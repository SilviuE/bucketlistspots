# Environment Identifiers (Canonical)

> Verified 2026-08-06 from local audit. Covers PRODUCTION only.
> Staging identifiers are recorded in `staging-environment-setup.md` once created.

## 1. Netlify — Production Site

| Item | Value |
|---|---|
| Custom domain (canonical URL) | `https://bucketlistspots.com` |
| Default Netlify subdomain | `comfy-truffle-b279e3.netlify.app` (returns 404 — custom domain is the serving URL) |
| Site name | `comfy-truffle-b279e3` |
| Netlify Site API ID (UUID) | NOT YET VERIFIED — retrieve from Netlify dashboard: Site → Site configuration → General → Site details (requires dashboard access, see Staging Runbook Section 8) |
| Production deploy branch | `main` (`remotes/origin/HEAD -> origin/main`) |
| Current production commit | `e843e9cec3dead1a3f17654c0c4005a9a6dc931c` (branch `main`) |
| Build command | `npm install && npm run build` |
| Functions dir | `netlify/functions` |
| Publish dir | `dist` |
| Production site status | HTTP 200 (verified live) |

## 2. Supabase — Production Project

| Item | Value |
|---|---|
| Project reference | `nmyhytrnzfhdstqazttb` |
| Project URL (VITE_SUPABASE_URL) | `https://nmyhytrnzfhdstqazttb.supabase.co` |
| Auth token issuer (`iss`) | `supabase` |
| Service role JWT `ref` claim | `nmyhytrnzfhdstqazttb` |
| Anon key (`sb_publishable_…`) | Stored in local `.env` (gitignored). NOT committed. |
| RLS check (anon SELECT on `public.users`) | Enforced — read-only REST probe returned empty set |

### 2.1. Production environment variables (used by Netlify functions + build)

Defined in `website/.env` (gitignored):

| Variable | Used by |
|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabaseClient.js`, all `netlify/functions/*` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabaseClient.js` (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | `netlify/functions/auth.cjs`, `webhook-stripe.cjs`, `api.cjs` |
| `STRIPE_SECRET_KEY` | `webhook-stripe.cjs` (currently `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | `webhook-stripe.cjs` (currently placeholder `whsec_REPLACE_ME…`) |
| JustGiving keys | commented out / mock mode — DO NOT activate until legal + fundraising reviews complete |

### 2.2. Known env wiring issue (to fix in staging, verify in prod)

`netlify/functions/auth.cjs:46` — `createUserClient()` reads `process.env.SUPABASE_ANON_KEY`.
The local `.env` defines `VITE_SUPABASE_ANON_KEY` only. On Netlify, unless a
`SUPABASE_ANON_KEY` variable is also set at the site/context level, `createUserClient()`
would receive `undefined` for the anon key. The function is currently only used by
RLS-gated user-scoped operations that are not yet deployed, but the wiring must be
recorded and corrected before staging uses it.

**Decision for staging:** set BOTH `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` to the
staging anon key so server functions and the browser bundle both work.

## 3. Git / GitHub

| Item | Value |
|---|---|
| Remote | `origin https://github.com/SilviuE/bucketlistspots.git` |
| Production branch | `main` |
| Active review branch | `review/terms-sections-6-7` |
| Review branch HEAD | `974276278e335c50d8ff1420188b7fd21bef22b6` (22 commits ahead of `main`) |
| Last commit | `Narrow service_role default privileges: tables=arwd, sequences=rU (Tests 35-36, 36/36 PASS)` |

## 4. Stripe (test mode only — no live mode anywhere)

| Item | Value |
|---|---|
| Secret key | `sk_test_…` in `.env` (test mode) |
| Webhook secret | `whsec_REPLACE_ME_AFTER_STRIPE_DASHBOARD_CONFIGURATION` placeholder — MUST be set from Stripe dashboard after webhook endpoint is configured |
| Webhook endpoint (prod path) | `https://bucketlistspots.com/webhooks/stripe` → `/.netlify/functions/webhook-stripe` |
| Live mode | NOT configured. Do NOT activate until written go-ahead. |

## 5. Deployment topology (current, pre-staging)

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│ Netlify (comfy-truffle-b279e3) │     │  Supabase prod                 │
│  main → bucketlistspots.com    │────▶│  ref nmyhytrnzfhdstqazttb      │
│  functions use prod env vars   │     │  anon + service_role keys      │
└─────────────────────────────┘      └──────────────────────────────┘
   ⚠ Deploy Previews (branch deploys) ALSO point to production Supabase today
```

**Gap:** Deploy Preview (e.g. builds of `review/terms-sections-6-7`) currently shares the
production Supabase project. This must be isolated into a staging Supabase project before
any branch deploy touches the DB. See `staging-environment-setup.md`.

## 6. Related preparation docs (authorised staging package)

| Doc | Purpose |
|---|---|
| `staging-environment-setup.md` | Create isolated staging Supabase + Deploy Preview rewire, per-context env vars, 8-point isolation checks, owner credential checklist |
| `003b-production-runbook.md` | Production gates, verified backup, exact 003b execution, Section 11 acceptance, rollback, RACI |
| `stripe-webhook-testing-scenarios.md` | Six test-mode webhook scenarios vs staging + `tests/webhook-scenario-runner.cjs` |
| `uat-matrix.md` | Manual UAT matrix (traveller/guide/ambassador/admin + negative/permission-denied) |
| `rate-limit-evidence.md` | Production rate-limit validation evidence |

## 7. Staged migrations status (staging-only until written go-ahead)

| Migration | Status | Local validation |
|---|---|---|
| `003b_rls_privilege_hardening.sql` | STAGED (do NOT run on prod) | PG16 parse 8/8; bare-`RAISE` fixed (wrapped in `DO $$`) — previously un-runnable |
| `004_account_suspension.sql` | STAGED (do NOT run on prod) | PG16 parse 16/16; applied twice on `bls_stage_test` → `VERIFICATION 004: ALL CHECKS PASSED` (idempotent); functional suspend/audit/RLS verified |
