# Phase B: Production Upgrade — Documented Execution Path

Target: **production Supabase** project `nmyhytrnzfhdstqazttb` ONLY.
Never run on staging (`tqooyiyqsidbemzlcspp`).

> **CRITICAL**: This path must NEVER execute the fresh baseline migration
> (`0000_core_schema.sql`) against existing production tables. The baseline
> is for NEW databases only. Production uses upgrade-only migrations.

---

## 0. Pre-Flight Gate (READ-ONLY)

Before ANY write operation:

### Step 0a: Run Production Preflight

Open SQL Editor on **PRODUCTION** project. Paste ENTIRE contents of
`supabase/preflight/production_preflight.sql`. Run.

**Expected:**
- Complete inventory of tables, columns, RLS status, policies, functions
- WARNINGs for missing tables/columns/RLS/constraints
- WARNINGs for data-condition issues requiring founder/legal decisions
- Summary: `RESULT: CLEAN` or `RESULT: % WARNING(S) FOUND`

**Gate:** Review ALL warnings. Resolve or document each one before proceeding.
Do NOT proceed if any warning indicates data-integrity risk.

### Step 0b: Confirm Backup

Verify a recent production backup exists (Supabase Dashboard → Database → Backups).
```
Record:
  Backup date: _______________
  Backup ID:   _______________
  Verified by: _______________
```

### Step 0c: Existing-Schema Comparison

Compare the current production schema against the baseline (0000_core_schema.sql):
1. Run the preflight (Step 0a) — this IS the schema comparison
2. Review "TABLE INVENTORY" section for missing tables
3. Review "COLUMN AUDIT" section for missing columns

Tables/columns that exist on production but were created by the app (not migrations)
are expected and fine. The preflight reports them as informational.

---

## 1. Upgrade-Only Migrations

The baseline (`0000_core_schema.sql`) is **NOT** applied to production.
Only these upgrade migrations are applied (all use `IF NOT EXISTS` / idempotent DDL):

| Step | File | Purpose | Safe to re-run? |
|---|---|---|---|
| 1 | `supabase/migrations/003b_rls_privilege_hardening.sql` | RLS hardening (5 policies, column grants, default ACLs) | Yes (schema_migrations guard) |
| 2 | `supabase/migrations/004_account_suspension.sql` | Account suspension (status column, audit table) | Yes (schema_migrations guard) |

### Step 1: Apply 003b RLS Hardening

Open SQL Editor on PRODUCTION. Paste ENTIRE `003b_rls_privilege_hardening.sql`. Run.

**Expected:**
- `Publication readiness: (counts)` — advisory only, no longer aborts
- `PREFLIGHT SCHEMA AUDIT` — OK for each table present
- `VERIFICATION: ALL CHECKS PASSED`
- `003b_rls_privilege_hardening v3: MIGRATION COMPLETE`

**Abort if:** any `RAISE EXCEPTION` or `CHECKS FAILED`.
If aborted, the transaction rolls back (no partial apply).

### Step 2: Apply 004 Account Suspension

Open SQL Editor on PRODUCTION. Paste ENTIRE `004_account_suspension.sql`. Run.

**Expected:**
- `VERIFICATION 004: ALL CHECKS PASSED`
- `004_account_suspension: MIGRATION COMPLETE`

---

## 2. Data-Condition Report (post-upgrade)

After applying 003b and 004, run a read-only assessment:

```sql
-- publication status
select 'experiences' as tbl, count(*) as total,
       count(*) filter (where is_published) as published
from public.experiences
union all
select 'destinations', count(*), count(*) filter (where is_published)
from public.destinations;

-- RLS status
select c.relname, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname not in ('schema_migrations')
order by c.relname;

-- active policies
select tablename, policyname from pg_policies
where schemaname='public' order by 1,2;

-- schema_migrations history
select * from public.schema_migrations order by version;
```

---

## 3. Rollback Criteria

Trigger rollback if ANY of:
- `003b` Section 11 reports any `CHECKS FAILED`
- Post-migration smoke tests fail for anon/authenticated visibility
- Unexpected policies found (not exactly the 5 hardened + pre-existing)
- Any application endpoint returns 500 after deployment

### Rollback Procedure

1. **If 003b transaction aborted** (RAISE EXCEPTION): nothing was applied. Fix the issue and re-run.
2. **If 003b applied but verification fails**: restore from pre-upgrade backup via Supabase Dashboard → Database → Restore.
3. **Emergency fallback**: apply `003b_emergency_recovery.sql` to restore legacy access, then re-grant revoked privileges manually.

**Rollback is STOP-THE-LINE**: no other work until resolved and re-verified.

---

## 4. Post-Deployment Verification

After 003b + 004 are applied and verified:

```sql
-- 1. Table inventory
select tablename from pg_tables where schemaname='public' order by 1;

-- 2. RLS enabled on all expected tables
select relname as table_with_rls_missing from pg_class
where relnamespace='public'::regnamespace and relkind='r'
  and not relrowsecurity
  and relname not in ('schema_migrations');

-- 3. 5 hardened policies present
select tablename, policyname from pg_policies
where schemaname='public' order by 1,2;

-- 4. Function EXECUTE: service_role only on RPCs
select routine_name, grantee from information_schema.routine_privileges
where routine_schema='public' order by 1,2;

-- 5. Default ACL: service_role=arwd on tables
select defaclacl::text from pg_default_acl d
join pg_roles r on r.oid=d.defaclrole
where d.defaclobjtype='r' and r.rolname='postgres'
  and d.defaclnamespace='public'::regnamespace;
```

### Smoke Tests (on production URL after deployment)

| # | Test | Expected |
|---|---|---|
| 1 | Homepage loads | 200, guides visible |
| 2 | `/for-guides` loads | 200 or 301 |
| 3 | Guide application submit (test email) | success, status `pending` |
| 4 | Ambassador application submit (test email) | success, status `pending` |
| 5 | Admin login | success |
| 6 | Stripe test webhook to `/webhooks/stripe` | 400 (no signature) — proves endpoint alive |

---

## 5. Schema Migration History After Upgrade

Expected `schema_migrations` records:

| Version | Name |
|---|---|
| `003b` | RLS Privilege Hardening — 5 restrictive policies, column grants, default ACLs, function EXECUTE lockdown |
| `004` | Account Suspension — account_status column, audit table, trigger, visibility grants |

Note: `0000` will NOT be present (baseline was never applied to production).

---

## 6. Sign-Off Record

| Gate | Name | Date/Time | Result |
|---|---|---|---|
| 0a Preflight | | | |
| 0b Backup confirmed | | | |
| 0c Schema comparison | | | |
| 1 003b applied | | | |
| 2 004 applied | | | |
| 3 Data-condition report | | | |
| 4 Post-deployment verify | | | |
| Smoke tests | | | |
| Approval to continue | | | written go-ahead |
