# Phase B: Fresh Staging Installation — Documented Execution Path

Target: **staging Supabase** project `tqooyiyqsidbemzlcsfp` ONLY.
Never run on production (`nmyhytrnzfhdstqazttb`).

This runbook supersedes the earlier `staging-migration-sequence-sql-editor.md`.
Phase B introduces a canonical baseline (`0000_core_schema.sql`) that creates ALL
tables from scratch, eliminating the "app-created tables" gap.

---

## 0. What this path creates

| Table | Source |
|---|---|
| all 19 application tables | `0000_core_schema.sql` |
| RLS policies (5) | `003b_rls_privilege_hardening.sql` |
| account_status + audit | `004_account_suspension.sql` |
| test data | `supabase/seed/staging_seed.sql` |

---

## 1. Prerequisites

- Empty/no database in the staging Supabase project
- Supabase Dashboard → SQL Editor access
- Project ref visible in URL bar must be `tqooyiyqsidbemzlcsfp`
- If Supabase Auth tables (`auth.users`) exist, that is fine (0000 uses `REFERENCES auth.users`)

---

## 2. Ordered File List

| Step | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/0000_core_schema.sql` | Baseline: ALL 19 tables, constraints, indexes, deny-by-default RLS, default ACLs, RPC functions, `schema_migrations` table |
| 2 | `supabase/migrations/003b_rls_privilege_hardening.sql` | RLS privilege hardening: 5 restrictive policies, column grants, function EXECUTE lockdown |
| 3 | `supabase/migrations/004_account_suspension.sql` | Account suspension: `account_status` column, audit table, trigger |
| 4 | `supabase/seed/staging_seed.sql` | Staging-only test data (fake accounts, demo guides, sample destinations) |

> Do **not** run the legacy feature migrations (`platform_config.sql`, `referral_program.sql`,
> `001_landing_page_infrastructure.sql`, `charity_challenges.sql`, `create_posts.sql`,
> `terms_acceptance.sql`, `002_webhook_infrastructure.sql`, `003a_publication_columns.sql`,
> `003_backfill_experiences_destinations.sql`) — 0000 incorporates all their schema.

---

## 3. Execution

### Step 1: Baseline Schema

Open SQL Editor → New Query. Paste ENTIRE contents of `supabase/migrations/0000_core_schema.sql`.
Run.

**Expected:**
- `CREATE TABLE` × 20 (19 app tables + `schema_migrations`)
- `0000: CORE SCHEMA COMPLETE`
- `RLS: enabled on all 19 application tables. Policies: ZERO (deny-by-default).`

**Abort if:** any `RAISE EXCEPTION` appears.

### Step 2: RLS Hardening (003b)

Open SQL Editor → New Query. Paste ENTIRE contents of `supabase/migrations/003b_rls_privilege_hardening.sql`.
Run.

**Expected:**
- `Publication readiness: (counts)`
- `VERIFICATION: ALL CHECKS PASSED`
- `003b_rls_privilege_hardening v3: MIGRATION COMPLETE`
- `schema_migrations: 003b recorded.`

**Idempotency:** re-run exits cleanly with `Migration 003b already applied — exiting cleanly.`

### Step 3: Account Suspension (004)

Open SQL Editor → New Query. Paste ENTIRE contents of `supabase/migrations/004_account_suspension.sql`.
Run.

**Expected:**
- `VERIFICATION 004: ALL CHECKS PASSED`
- `004_account_suspension: MIGRATION COMPLETE`
- `schema_migrations: 004 recorded.`

**Idempotency:** re-run exits cleanly with `Migration 004 already applied — exiting cleanly.`

### Step 4: Staging Seed

Open SQL Editor → New Query. Paste ENTIRE contents of `supabase/seed/staging_seed.sql`.
Run.

**Expected:**
- `STAGING SEED: Complete (test data only)`
- Lists test data counts

---

## 4. Post-Install Verification (read-only — run after Step 4)

```sql
-- tables (expect 20: 19 app + schema_migrations)
select tablename from pg_tables where schemaname='public' order by 1;

-- RLS enabled on all 19 app tables (schema_migrations excluded)
select count(*) filter (where relrowsecurity) as rls_on,
       count(*) filter (where not relrowsecurity) as rls_off
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname != 'schema_migrations';
-- expected: rls_on=19, rls_off=0

-- policies: exactly 5
select tablename, policyname from pg_policies
where schemaname='public' order by 1,2;

-- schema_migrations history: 0000, 003b, 004
select version, name from public.schema_migrations order by version;

-- default ACL: service_role=arwd on tables
select defaclacl::text from pg_default_acl d
join pg_roles r on r.oid=d.defaclrole
where d.defaclobjtype='r' and r.rolname='postgres'
  and d.defaclnamespace='public'::regnamespace;

-- function ownership
select p.proname, r.rolname as owner from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='public' order by 1;
```

---

## 5. Application REST-Query Checks

Use the Supabase API (or dashboard SQL Editor with `SET ROLE`) to verify:

| # | Role | Query | Expected |
|---|---|---|---|
| 1 | anon | `GET /rest/v1/guides?status=eq.published` | Returns published guides |
| 2 | anon | `GET /rest/v1/experiences?is_published=eq.true` | Returns published experiences |
| 3 | anon | `GET /rest/v1/destinations?is_published=eq.true` | Returns published destinations |
| 4 | anon | `GET /rest/v1/users` | 401/403 or empty result |
| 5 | authenticated | `GET /rest/v1/users` | Returns own row only |
| 6 | anon | `POST /rest/v1/guides` | 401/403 |
| 7 | anon | `GET /rest/v1/guide_applications` | 401/403 or empty result |

---

## 6. SHA-256 Checksums (for evidence)

Generate before execution:
```powershell
Get-FileHash supabase\migrations\0000_core_schema.sql -Algorithm SHA256
Get-FileHash supabase\migrations\003b_rls_privilege_hardening.sql -Algorithm SHA256
Get-FileHash supabase\migrations\004_account_suspension.sql -Algorithm SHA256
Get-FileHash supabase\seed\staging_seed.sql -Algorithm SHA256
```

---

## 7. Abort Criteria

- Any `RAISE EXCEPTION` from any step
- Any `VERIFICATION: % CHECKS FAILED`
- Schema_migrations shows fewer than 3 records (0000, 003b, 004) after step 3
- Fewer than 19 tables with RLS enabled
- Any doubt about which project the query ran on

---

## 8. Evidence to Capture

For each step, screenshot:
1. The pasted SQL in the editor
2. The Messages/Notice output panel
3. The project URL bar (must show `tqooyiyqsidbemzlcsfp`)
4. The final verification query results
