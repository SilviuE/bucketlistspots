# Staging Migration Sequence — Complete Clean-Database Runbook (SQL Editor)

Target: **staging Supabase** project `tqooyiyqsidbemzlcsfp` ONLY.
Never run on production (`nmyhytrnzfhdstqazttb`). No automatic application — you run these
personally in the dashboard SQL Editor.

This runbook is the complete ordered chain for a **new empty Supabase project** (staging's
current state). It supersedes the earlier partial sequence. Every step below has been executed
on a fresh disposable PostgreSQL 16 database in this repo's verification pass — including the
idempotency re-run and the abort-condition probes.

> Definitive commit of this evidence: `0e0c9f617d54ec2f1b7749b4693101437098db90`
> (`git rev-parse HEAD` = `git rev-parse origin/review/terms-sections-6-7`).

---

## 0. What the chain creates (and what it does NOT)

Verified from the migration files + disposable-DB execution:

| Table | Created by | Notes |
|---|---|---|
| `users` | **NONE — app-created** | No migration contains a CREATE for it. 003b preflight requires it. |
| `guides` | **NONE — app-created** | Same. Full 32-column production shape required by 003b. |
| `experiences` | **NONE — app-created** | 003b requires it + `is_published` (003a). |
| `destinations` | **NONE — app-created** | 003b requires it + `is_published` (003a). |
| `guide_applications` | **NONE — app-created** | 003b preflight requires it. |
| `ambassador_applications` | **NONE — app-created** | 003b preflight requires it. |
| `platform_config` | `platform_config.sql` | single-row config; expanded by 001 |
| `transactions` | `referral_program.sql` | wallet ledger; `idempotency_key` added by 002 |
| `payment_reports` | `payment_reports.sql` | UNIQUE `session_id` added by 002 |
| `claims_registry` | `001_landing_page_infrastructure.sql` | + 12 seed claims |
| `testimonials` | `001_landing_page_infrastructure.sql` | |
| `destination_charities` | `charity_challenges.sql` | + KPAP/AWF seeds |
| `fundraising_pages` | `charity_challenges.sql` | |
| `posts` | `create_posts.sql` | anon-read policy via `posts_public_select.sql` |
| `terms_acceptance` | `terms_acceptance.sql` | append-only, immutable |
| `webhook_event_inbox` | `002_webhook_infrastructure.sql` | |
| `booking_confirmations` | `002_webhook_infrastructure.sql` | |
| `account_status_audit` | `004_account_suspension.sql` | append-only |

**Key finding: on a truly empty project the six core catalogue/application tables
(`users`, `guides`, `experiences`, `destinations`, `guide_applications`,
`ambassador_applications`) must exist BEFORE the chain — they are created by the app, not by
migrations.** On staging they are currently absent, so Step 1 below is mandatory.

### Functions created (all owned by postgres)

| Function | Created by | EXECUTE granted to |
|---|---|---|
| `credit_referral_reward(TEXT,UUID,NUMERIC,TEXT,TEXT,TEXT)` | `002_webhook_infrastructure.sql` | `service_role` only |
| `credit_ambassador_commission(TEXT,UUID,NUMERIC,TEXT,TEXT)` | `002_webhook_infrastructure.sql` | `service_role` only |
| `claim_webhook_event(TEXT,TIMESTAMPTZ)` | `002_webhook_infrastructure.sql` | `service_role` only |
| `reject_terms_acceptance_update_delete()` | `terms_acceptance.sql` | trigger fn, none |
| `record_account_status_change()` | `004_account_suspension.sql` | trigger fn, none |

---

## 1. The complete ordered chain

**Step numbers below are the exact SQL Editor order.** Each step = paste the full file from
`supabase/migrations/` and Run. Do not proceed past any step that aborts or warns.

| Step | File | Purpose | Runs on empty project? |
|---|---|---|---|
| 1 | **core tables (SQL below)** | app-created base tables 003b needs | REQUIRED |
| 2 | `platform_config.sql` | single-row config table | yes |
| 3 | `platform_config_expansion.sql` | expansion columns | yes |
| 4 | `referral_program.sql` | `transactions` ledger, referral fields | yes |
| 5 | `payment_reports.sql` | payment/financial reports table | yes |
| 6 | `ambassador_commission.sql` | referral columns on guides/applications | yes |
| 7 | `001_landing_page_infrastructure.sql` | claims_registry, testimonials, config expansion | yes |
| 8 | `charity_challenges.sql` | destination_charities, fundraising_pages | yes |
| 9 | `create_posts.sql` | posts table + policies | yes |
| 10 | `posts_public_select.sql` | anonymous read on posts | yes |
| 11 | `terms_acceptance.sql` | append-only terms table | yes |
| 12 | `002_webhook_infrastructure.sql` | webhook inbox, bookings, 3 RPCs (**fresh-install file**) | yes |
| 13 | `003a_publication_columns.sql` | adds `is_published` to experiences/destinations | yes |
| 14 | `003_backfill_experiences_destinations.sql` | **founder-edited** — publish approved rows only | yes (must edit) |
| 15 | `003b_rls_privilege_hardening.sql` | RLS + privilege hardening (**one-shot**) | yes |
| 16 | `004_account_suspension.sql` | account_status + audit trail (idempotent) | yes |

> Do **not** run: `002_webhook_infrastructure_upgrade.sql` (for existing tables only),
> `003b_emergency_recovery.sql` (reverse/emergency only), or the standalone duplicates
> `claims_registry.sql` / `testimonials.sql` / `terms_acceptance_upgrade.sql` /
> `002a_terms_acceptance_upgrade.sql` (upgrade path, not fresh install).

### Step 1 — core tables (paste this first; no migration creates these)

```sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text, name text, role text default 'user',
  referral_code text, bls_points_balance integer not null default 0,
  created_at timestamptz default now()
);
alter table public.users add column if not exists avatar text;

create table if not exists public.guides (
  id text primary key, name text, trading_name text, email text,
  status text default 'draft', referral_code text,
  bls_points_balance integer not null default 0,
  referred_by_ambassador_id text, price_currency text default 'usd',
  routes jsonb default '[]'::jsonb, created_at timestamptz default now()
);
alter table public.guides add column if not exists user_id uuid;
alter table public.guides add column if not exists photo text;
alter table public.guides add column if not exists hero_image text;
alter table public.guides add column if not exists bio text;
alter table public.guides add column if not exists why_independent text;
alter table public.guides add column if not exists location text;
alter table public.guides add column if not exists languages jsonb default '[]'::jsonb;
alter table public.guides add column if not exists experience integer default 0;
alter table public.guides add column if not exists certifications text;
alter table public.guides add column if not exists promise text;
alter table public.guides add column if not exists badge text;
alter table public.guides add column if not exists tagline text;
alter table public.guides add column if not exists price numeric(10,2) default 0;
alter table public.guides add column if not exists featured boolean default false;
alter table public.guides add column if not exists review_count integer default 0;
alter table public.guides add column if not exists trips_led integer default 0;
alter table public.guides add column if not exists video_intro text;
alter table public.guides add column if not exists tripadvisor_embed text;
alter table public.guides add column if not exists identity_verified boolean default false;
alter table public.guides add column if not exists license_verified boolean default false;
alter table public.guides add column if not exists safety_verified boolean default false;
alter table public.guides add column if not exists fair_pay_verified boolean default false;
alter table public.guides add column if not exists updated_at timestamptz default now();

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(), title text not null,
  duration text, difficulty text, location text, image text,
  price numeric(10,2), currency text default 'usd', guide_id text,
  badge text, rating numeric(3,2) default 0, reviews integer default 0,
  featured boolean default false
);

create table if not exists public.destinations (
  name text primary key, country text, image text, guide_count integer default 0
);

create table if not exists public.guide_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text, email text, phone text, country text, experience text,
  languages text, specialties text, message text, heard_from text,
  status text default 'pending', referred_by_ambassador_code text,
  created_at timestamptz default now()
);

create table if not exists public.ambassador_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text, email text, phone text, country text, platform text,
  handle text, followers text, niche text, why_you text, heard_from text,
  status text default 'pending', created_at timestamptz default now()
);
```

**Expected:** `CREATE TABLE` × 6 (or "already exists" notices if re-run). **Abort:** none.

---

## 2. Expected success output + abort condition per step

All verified on the disposable DB (full logs kept in the evidence record).

| Step | Success marker (NOTICE) | Abort condition |
|---|---|---|
| 2 `platform_config` | `CREATE TABLE`, policy created | none (idempotent) |
| 3 `platform_config_expansion` | column-add notices | duplicate_column swallowed |
| 4 `referral_program` | `CREATE TABLE transactions` | none (idempotent) |
| 5 `payment_reports` | `CREATE TABLE payment_reports` | none (idempotent) |
| 6 `ambassador_commission` | `ADD COLUMN` notices | none (idempotent) |
| 7 `001` | `CREATE TABLE claims_registry/testimonials`, 12 seed rows | none (idempotent) |
| 8 `charity_challenges` | `CREATE TABLE ×2`, 2 charity seeds | none (idempotent) |
| 9 `create_posts` | `CREATE TABLE posts` + policies | none (idempotent) |
| 10 `posts_public_select` | policy created | none (idempotent) |
| 11 `terms_acceptance` | `CREATE TABLE terms_acceptance`, triggers | none (idempotent) |
| 12 `002` | `CREATE TABLE webhook_event_inbox`, `booking_confirmations`, 3 functions, policies | none (fresh-install file; idempotent via IF NOT EXISTS) |
| 13 `003a` | `003a: PUBLICATION COLUMNS COMPLETE` | none (idempotent) |
| 14 `003_backfill` | `003_backfill: COMPLETE` + verification SELECT counts | file ships with no active UPDATEs — **founder must edit first**; if run unedited it publishes nothing (not an abort, but 003b will then abort) |
| 15 `003b` | `VERIFICATION: ALL CHECKS PASSED` + `MIGRATION COMPLETE` | `003b ABORT: No published experiences/destinations. Run 003_backfill first.`; on empty project `relation "public.experiences" does not exist`; **re-run aborts `UNEXPECTED POLICIES FOUND`** (one-shot) |
| 16 `004` | `VERIFICATION 004: ALL CHECKS PASSED` | preflight abort if users baseline missing |

---

## 3. Idempotency — what running the chain twice does (verified)

| Step | Safe to run twice? | Evidence |
|---|---|---|
| Steps 2–14 | **Yes** | every DDL uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`; second run printed only "already exists, skipping" notices |
| Step 15 `003b` | **No — one-shot.** Second run **aborts** with `UNEXPECTED POLICIES FOUND` and the whole `BEGIN…COMMIT` rolls back leaving state identical | verified on pass 2 |
| Step 16 `004` | **Yes** | `VERIFICATION 004: ALL CHECKS PASSED` again on pass 2 |

**Implication:** the earlier doc's instruction to "run 003b twice" was wrong. Run 003b exactly
once. 004 may be re-run. Steps 2–14 may be re-run freely.

---

## 4. Post-migration verification (read-only — run after step 16)

```sql
-- tables
select tablename from pg_tables where schemaname='public' order by 1;
-- expected: 18 rows (17 chain tables + account_status_audit)

-- RLS enabled on all 17
select count(*) filter (where relrowsecurity) as rls_on,
       count(*) filter (where not relrowsecurity) as rls_missing
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in (
 'guides','users','experiences','destinations','guide_applications',
 'ambassador_applications','posts','platform_config','transactions',
 'webhook_event_inbox','booking_confirmations','terms_acceptance',
 'payment_reports','testimonials','claims_registry','fundraising_pages',
 'destination_charities');
-- expected: rls_on=17, rls_missing=0

-- policies: exactly 5 after 003b
select tablename, policyname from pg_policies where schemaname='public' order by 1,2;

-- publication columns
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('experiences','destinations')
  and column_name='is_published';
-- expected: 2 rows, default false

-- RPC EXECUTE: service_role only, 3 rows
select routine_name, grantee from information_schema.routine_privileges
where routine_schema='public' and grantee in ('service_role','anon','authenticated')
order by 1,2;
-- expected: only the 3 RPCs, grantee=service_role

-- default ACL: service_role=arwd only (no TRUNCATE/REFERENCES/TRIGGER)
select defaclacl::text from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
where d.defaclobjtype='r' and r.rolname='postgres'
  and d.defaclnamespace='public'::regnamespace;
-- expected: {service_role=arwd/postgres}

-- functions owned by postgres
select p.proname, r.rolname as owner from pg_proc p
join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where n.nspname='public' order by 1;
```

---

## 5. Disposable-DB evidence (how the chain was proven)

Executed on a fresh local PostgreSQL 16.14 cluster (trust auth, port 55433) with a
Supabase-compatible stub (`anon`/`authenticated`/`service_role`/`supabase_admin`, `auth.users`,
`auth.uid()`/`auth.jwt()`):

- **Pass 1 (clean run):** exit 0. `003b` printed `VERIFICATION: ALL CHECKS PASSED`;
  `004` printed `VERIFICATION 004: ALL CHECKS PASSED`. Final state: 18 tables, RLS on all 17,
  exactly 5 policies, `service_role=arwd` default ACL, 3 RPCs granted to service_role only.
- **Pass 2 (idempotency re-run):** steps 2–14 no-op'd cleanly; `003b` aborted
  `UNEXPECTED POLICIES FOUND` (transaction rolled back, state identical); `004` passed again.
- **Abort probes:** 003b on empty DB → `relation "public.experiences" does not exist`;
  003b with tables but zero published rows → `003b ABORT: No published experiences. Run 003_backfill first.`

**Two defects found and fixed during verification (committed in this branch):**
1. `003b` §11 first default-ACL loop aliased `pg_roles r` colliding with the `r` record
   variable → `record "r" is not assigned yet`; same class of bug in the function-ownership
   check (`pg_roles r` → `pg_roles rol`). Fixed.
2. `003b` §11 checked `role_table_grants` for guides when §7 grants column-level SELECT only →
   false `2 CHECKS FAILED`. Checks now query `role_column_grants`. Fixed.

## Evidence to capture
For each SQL Editor run, screenshot: pasted SQL + Run, the Messages/Notice panel showing the
success/abort markers above, and the step-16 verification query results.

## Abort criteria (do not continue)
- Any `RAISE WARNING … FAILED` / `CHECK FAILED`.
- `003b ABORT: No published …` → run Step 1 and a founder-edited backfill first.
- `UNEXPECTED POLICIES FOUND` on 003b → 003b already applied; do not re-run, continue at 004.
- Any doubt about which project the query ran on (URL bar must show `tqooyiyqsidbemzlcsfp`).
