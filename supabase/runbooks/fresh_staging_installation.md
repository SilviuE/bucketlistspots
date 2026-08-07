# Phase B: Fresh Staging Installation -- Documented Execution Path

Target: **staging Supabase** project `tqooyiyqsidbemzlcsfp` ONLY.
Never run on production (`nmyhytrnzfhdstqazttb`).

This runbook supersedes `staging-migration-sequence-sql-editor.md`.
Phase B introduces a canonical baseline (`0000_core_schema.sql`) that
creates ALL tables from scratch and a full-file SHA-256 manifest for
independent integrity verification.

---

## 0. Pre-Flight: Verify Branch, Commit and File Integrity

### 0a. Confirm branch and commit

```powershell
git checkout review/terms-sections-6-7
git rev-parse HEAD
git rev-parse origin/review/terms-sections-6-7
# Both must match. Working tree must be clean.
```

**Gate:** Do not proceed if hashes differ or `git status --short` is non-empty.

### 0b. Run full-file SHA-256 verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File supabase\manifest\verify_checksums.ps1
```

**Expected:** `PASS - all files match the manifest. The staging chain is intact.`
**Exit code must be 0.**

### 0c. Confirm staging project reference

Open Supabase Dashboard. The URL bar must show `tqooyiyqsidbemzlcsfp`.
Take a screenshot showing the project reference.

### 0d. Verify manifest commit matches branch

The manifest at `supabase/manifest/phaseb_checksum_manifest.json` lists
the exact commit. Verify it matches `git rev-parse HEAD`.

---

## 1. Ordered Migration Chain

| Step | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/0000_core_schema.sql` | Baseline: ALL 19 tables, constraints, indexes, deny-by-default RLS, default ACLs, RPCs, `schema_migrations` |
| 2 | `supabase/migrations/003b_rls_privilege_hardening.sql` | RLS privilege hardening: 5 policies, column grants, function EXECUTE lockdown, structural schema_migrations validation |
| 3 | `supabase/migrations/004_account_suspension.sql` | Account suspension: `account_status` column, trigger-written audit table |
| 4 | `supabase/seed/staging_seed.sql` | Staging-only test data (fake accounts, demo guides, sample destinations) |

> Do **not** run the legacy feature migrations. 0000 incorporates all their
> schema. They remain in the repo for reference only.

---

## 2. Execution

### Step 1: Baseline Schema

Open SQL Editor -> New Query. Paste ENTIRE `0000_core_schema.sql`. Run.

**Expected:** `0000: CORE SCHEMA COMPLETE`. RLS on 18 app tables. Zero policies.

### Step 2: RLS Hardening (003b)

Open SQL Editor -> New Query. Paste ENTIRE `003b_rls_privilege_hardening.sql`. Run.

**Expected:**
- `schema_migrations structure validated: 4 columns, no runtime-role grants.`
- `VERIFICATION: ALL CHECKS PASSED`
- `003b_rls_privilege_hardening v3: MIGRATION COMPLETE`

### Step 3: Account Suspension (004)

Open SQL Editor -> New Query. Paste ENTIRE `004_account_suspension.sql`. Run.

**Expected:**
- `schema_migrations structure validated: 4 columns, no runtime-role grants.`
- `VERIFICATION 004: ALL CHECKS PASSED`

### Step 4: Staging Seed

Open SQL Editor -> New Query. Paste ENTIRE `supabase/seed/staging_seed.sql`. Run.

**Expected:** `STAGING SEED: Complete (test data only)`.

---

## 3. Post-Install Verification (read-only)

Run in SQL Editor after Step 4:

```sql
-- tables (expect 19)
select tablename from pg_tables where schemaname='public' order by 1;

-- RLS (expect 18/18)
select count(*) filter (where relrowsecurity) as rls_on,
       count(*) filter (where not relrowsecurity) as rls_off
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname != 'schema_migrations';

-- policies (expect 5)
select tablename, policyname from pg_policies
where schemaname='public' order by 1,2;

-- schema_migrations (expect 0000, 003b, 004)
select version, name, checksum from public.schema_migrations order by version;

-- schema_migrations grants (expect postgres only)
select grantee, privilege_type from information_schema.role_table_grants
where table_name='schema_migrations' and table_schema='public' order by 1,2;

-- default ACL (expect service_role=arwd on tables)
select defaclacl::text from pg_default_acl d
join pg_roles r on r.oid=d.defaclrole
where d.defaclobjtype='r' and r.rolname='postgres'
  and d.defaclnamespace='public'::regnamespace;

-- function ownership (expect all postgres)
select p.proname, r.rolname as owner from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_roles r on r.oid=p.proowner
where n.nspname='public' order by 1;
```

---

## 4. Deploy Preview Application Tests

After deploying the staging branch to Netlify's Deploy Preview:

| # | Test | Expected |
|---|---|---|
| 1 | Homepage loads | 200, guides visible |
| 2 | `/for-guides` loads | 200 or 301 |
| 3 | Guide application submit (test email) | success, pending |
| 4 | Ambassador application submit (test email) | success, pending |
| 5 | Admin login | success |

---

## 5. SHA-256 Checksums

The authoritative manifest is at `supabase/manifest/phaseb_checksum_manifest.json`.
All file hashes are 64-character SHA-256. Verify with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File supabase\manifest\verify_checksums.ps1
```

---

## 6. Abort Criteria

- Any `RAISE EXCEPTION` from any step
- `VERIFICATION: % CHECKS FAILED`
- `SCHEMA_MIGRATIONS STRUCTURE FAILURE` or `GRANT FAILURE`
- Fewer than 19 tables or fewer than 18 with RLS enabled
- Fewer than 5 policies or more than 5 policies
- Full-file SHA-256 verification returns non-zero exit code
- Any doubt about which project the query ran on
