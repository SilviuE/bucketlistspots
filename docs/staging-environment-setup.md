# Staging Environment Setup — Supabase Isolation + Netlify Deploy Preview

> Purpose: stop Deploy Preview / branch deploys from sharing the PRODUCTION Supabase DB
> (`nmyhytrnzfhdstqazttb`). Create an isolated **staging** Supabase project and wire
> Deploy Previews to it.
>
> Status: **NOT YET EXECUTED** — requires Netlify + Supabase dashboard access (owner
> credentials). This runbook is the exact step list. **No production changes.**

## 0. Decision record

| Decision | Choice |
|---|---|
| Staging Supabase project name (suggested) | `bucketlistspots-staging` |
| Staging project ref (assign after creation) | TBD → record everywhere in this doc |
| Netlify site for staging | same site `comfy-truffle-b279e3` — Deploy Previews are branch builds of the same repo |
| Staging trigger branch | `review/*` (or `dev`), NOT `main` |
| Production branch | `main` — must keep production env vars |
| Stripe mode | TEST mode only (`sk_test_…`, `whsec_…` test secret) |
| Supabase migration on staging | full scenario: `001…003b` + `004` from `supabase/migrations/` + dry-run scenarios |
| Cloud access method | **Dashboard-only** — owner performs Supabase/Netlify steps in the dashboards; no CLI credentials stored on this machine. Local prep uses the pinned repo dev dependency via `npm run supabase` (no login). |

## 1. Create staging Supabase project (owner, dashboard)

1. Go to https://supabase.com/dashboard → New project.
2. Organization: existing. Project name: `bucketlistspots-staging`.
3. Database password: generate a strong one, store in the ops vault (NOT in repo).
4. Region: same as production if known (else choose nearest); free tier OK.
5. Wait for provisioning. Record the **project reference** (URL slug, e.g. `abc123xyz`).
6. Save two things in the ops vault (NOT the repo):
   - `https://<ref>.supabase.co`
   - `anon` (publishable) key
   - `service_role` key
7. In staging SQL Editor: run ALL migrations in order from `supabase/migrations/`
   (`001…003b`, then `004_account_suspension.sql`). For the schema + test data, run the
   dry-run scenario `supabase/dry-run/scenario-c-rls-hardening.sql` (idempotent,
   36/36 PASS expected). This gives a realistic staging dataset, including
   admin/guide/ambassador test users.

## 2. Create the admin/guide/ambassador test accounts on STAGING

Reuse the same test identities (the scenario SQL seeds `public.users` for the three IDs,
but `auth.users` is created by the trigger — confirm or re-create via Supabase
Authentication → Add user):

- Admin: `silviu@bucketlistspots.com` (password set/rotated directly in staging Auth — never committed)
- Guide: `kilimanjarojoy@gmail.com` (role `guide`)
- Ambassador: `phototrust@yahoo.com` (role `ambassador`)

## 3. Set staging environment variables on Netlify

> CRITICAL: Netlify supports **per-context env vars** — Production vs Deploy Preview vs
> Branch. `main` (production) MUST keep production values. `review/*` and Deploy Previews
> MUST use staging values.

Netlify Dashboard → Site `comfy-truffle-b279e3` → Site configuration → Environment variables.
Create variable groups / contexts:

**Production context (unchanged, verify only):**
```
VITE_SUPABASE_URL            = https://nmyhytrnzfhdstqazttb.supabase.co
VITE_SUPABASE_ANON_KEY       = <prod anon key from vault>
SUPABASE_ANON_KEY            = <prod anon key from vault>   ← fix for auth.cjs:46 wiring
SUPABASE_SERVICE_ROLE_KEY    = <prod service role from vault>
STRIPE_SECRET_KEY            = <prod/test sk_test_…>
STRIPE_WEBHOOK_SECRET        = <prod whsec_… — currently placeholder, set after dashboard config>
```

**Deploy Preview / Branch context (`review/*`, `dev`):**
```
VITE_SUPABASE_URL            = https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY       = <staging anon key>
SUPABASE_ANON_KEY            = <staging anon key>           ← so createUserClient() works
SUPABASE_SERVICE_ROLE_KEY    = <staging service role key>
STRIPE_SECRET_KEY            = <staging sk_test_… (same test key OK)>
STRIPE_WEBHOOK_SECRET        = <staging whsec_… from Stripe dashboard, test-mode endpoint below>
```

Reference: https://docs.netlify.com/environment-variables/overview/ — scope a variable to
"Deploy contexts" and choose "Branch" with value `review/*`.

## 4. Configure the Stripe webhook (TEST MODE ONLY) for staging

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://<deploy-preview-url>/webhooks/stripe`
     (Deploy Preview URL pattern: `https://<hash>--comfy-truffle-b279e3.netlify.app`)
   - Events: `checkout.session.completed`
   - Mode: **Test** (NOT live).
2. Reveal the **Signing secret** (`whsec_…`) for the STAGING webhook → store in vault →
   set as `STRIPE_WEBHOOK_SECRET` in the Deploy Preview context (staging).
3. Do NOT configure live-mode webhook. Live webhook activation requires written go-ahead.

## 5. Verify Deploy Preview isolation (before any further work)

For each check, record PASS/FAIL with evidence screenshot.

| # | Check | How |
|---|---|---|
| 1 | Deploy a branch build (`review/*`) triggers Deploy Preview | Netlify Deploys → branch deploy |
| 2 | Preview serves the app | open the `<hash>--comfy-truffle-b279e3.netlify.app` URL, HTTP 200 |
| 3 | Preview uses STAGING Supabase | Preview Network tab → requests to `https://<staging-ref>.supabase.co`, NOT `nmyhytrnzfhdstqazttb` |
| 4 | Built bundle contains staging ref | Preview → view source of `assets/index-*.js`, grep for `<staging-ref>`; must NOT contain `nmyhytrnzfhdstqazttb` |
| 5 | anon SELECT on staging `users` blocked by RLS | REST probe as anon → empty |
| 6 | Staging guide listing returns seeded data | app page shows seeded guides |
| 7 | Production site unchanged | `https://bucketlistspots.com` still 200 and uses `nmyhytrnzfhdstqazttb` |
| 8 | No cross-writes | booking/apply actions in preview never appear in prod DB |

## 6. Staging validation of 003b (per authorized item 4)

Follow `003b-production-runbook.md` after this setup completes:
- Run 003b on staging (already run once in Section 1 — run AGAIN for idempotency evidence)
- Capture Section 11 output → `VERIFICATION: ALL CHECKS PASSED`
- Run full automated test suite + Supabase Security Advisor on staging
- Evidence: two runs → identical PASS output proves idempotency

## 6b. Apply 004_account_suspension.sql to staging

- Run `supabase/migrations/004_account_suspension.sql` in the staging SQL Editor.
- Expect NOTICE `VERIFICATION 004: ALL CHECKS PASSED`. Run it a second time to prove
  idempotency (same PASS output, no errors).
- On staging only, verify account status flow with the UAT matrix (rows AD-05 → AD-11):
  suspend a user, confirm login is gated with 403 `Account not active`, reactivate,
  and confirm `account_status_audit` recorded each transition.
- The 004 migration is staged-only for now. **Do NOT run on production** without a
  separate written go-ahead.

## 7. Cleanup & hygiene

- Never commit `.env`, keys, or `whsec_`/`sk_` values.
- Vault keys are stored OUTSIDE the repo (owner-managed).
- After staging is validated, this doc's "TBD" values get filled in and committed.

## 8. Blocked-on-credentials checklist (owner action)

- [ ] Supabase dashboard: create `bucketlistspots-staging`, record ref
- [ ] Netlify dashboard: set per-context env vars (Section 3)
- [ ] Stripe dashboard: add test-mode webhook for preview URL, record secret
- [ ] Confirm production context env vars unchanged
- [ ] Record Netlify Site API ID (UUID) → backfill `environment-identifiers.md` §1
