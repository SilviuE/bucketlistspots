# Phase B: Production Upgrade -- Documented Execution Path

Target: **production Supabase** project `nmyhytrnzfhdstqazttb` ONLY.
Never run on staging (`tqooyiyqsidbemzlcsfp`).

> **CRITICAL**: This path must NEVER execute the fresh baseline migration
> (`0000_core_schema.sql`) against existing production tables.

---

## 0. Pre-Flight Gate (READ-ONLY)

### Step 0a -- Repository Verification

```powershell
git checkout review/terms-sections-6-7
git rev-parse HEAD
git rev-parse origin/review/terms-sections-6-7
git status --short
powershell -NoProfile -ExecutionPolicy Bypass -File supabase\manifest\verify_checksums.ps1
```

All hashes must match the approved commit. Working tree must be clean. Checksum verifier must exit 0.

### Step 0b -- Confirm Backup

Supabase Dashboard -> Database -> Backups. Verify a PITR (Point-In-Time Recovery) backup exists with a timestamp BEFORE any production write. Record the backup timestamp.

**If PITR backup is unavailable** (free-tier project), create a manual logical backup. Use a secure method that does NOT expose the password in command history:

```powershell
# Read password from a secure prompt, not command-line
$pw = Read-Host -AsSecureString "DB password"
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
pg_dump "postgresql://postgres:${plain}@db.nmyhytrnzfhdstqazttb.supabase.co:5432/postgres" -F c -Z 9 -f "prod-pre-003b-$(Get-Date -Format yyyyMMdd-HHmm).dump"
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
```

Verify the dump is readable:
```powershell
pg_restore --list "prod-pre-003b-*.dump" | Select-Object -First 5
```

Record SHA-256 of the dump file for evidence.

### Step 0c -- Run Production Preflight

Open SQL Editor on **PRODUCTION** (`nmyhytrnzfhdstqazttb`). Paste ENTIRE `supabase/preflight/production_preflight.sql`. Run.

The script returns a structured result table: `section | check_name | status | detail | severity`.

**How to read the result:**

| Status | Meaning |
|---|---|
| PASS | No issue. Proceed. |
| WARNING | Review required. Does NOT block migration. |
| STOP | BLOCKING. Migration must not proceed. |

**Expected WARNINGs (do not block):**
- `PA2: schema_migrations` -- not present. 003b creates it. This is expected on first production upgrade.
- `PA3: account_status_audit` -- not present. 004 creates it. Expected before 004 runs.
- `PB: users columns` -- `avatar(003b adds)`. 003b Section 3 adds this column.
- `PC1/PC2: published experiences/destinations` -- 0 published. Founder must publish before public launch. 003b proceeds regardless.
- `PD1: RLS status` -- tables without RLS. 003b enables RLS.
- `PF1/PF2: function ownership/EXECUTE` -- 003b verifies and fixes.
- `PE1: active policies` -- informational, 003b replaces them.

**STOP conditions (BLOCKING):**
- Any missing core table from the 17 required by 003b preflight
- Missing columns on existing tables that 003b requires but does NOT create
- `platform_config` has 0 or >1 rows
- Published legal/financial/commercial claims without evidence sources
- Duplicate `session_id` in `terms_acceptance`
- The script raises an exception with details

---

## 1. Upgrade-Only Migrations

The baseline (`0000_core_schema.sql`) is **NOT** applied to production.

| Step | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/003b_rls_privilege_hardening.sql` | RLS hardening, schema_migrations bootstrap, structural validation |
| 2 | `supabase/migrations/004_account_suspension.sql` | Account suspension: status column, audit table, trigger |

### Step 1: Apply 003b

Open SQL Editor on PRODUCTION. Paste ENTIRE `003b_rls_privilege_hardening.sql`. Run.

**Expected:**
- `schema_migrations structure validated` -- table bootstrapped and validated
- `Section 10 HARD: global + schema-scoped postgres defaults applied.`
- Up to 13 `WARNING: ADVISORY SKIP [42501]` for supabase_admin (normal on hosted Supabase)
- `VERIFICATION: ALL CHECKS PASSED`
- `003b_rls_privilege_hardening v3: MIGRATION COMPLETE`

**Abort if:** any `RAISE EXCEPTION`, any `ERROR:`, any `CHECKS FAILED`, any `ADVISORY SKIP` with SQLSTATE other than `42501`.

### Step 2: Apply 004

Open SQL Editor on PRODUCTION. Paste ENTIRE `004_account_suspension.sql`. Run.

**Expected:**
- `schema_migrations structure validated`
- `VERIFICATION 004: ALL CHECKS PASSED`
- `004_account_suspension: MIGRATION COMPLETE`

---

## 2. Post-Deployment Verification

Run `supabase/test/production_verification.sql` on production. Expected: all checks PASS.

Smoke tests on production URL:
| # | Test | Expected |
|---|---|---|
| 1 | Homepage loads | 200, guides visible |
| 2 | `/for-guides` loads | 200 or 301 |
| 3 | Admin login | success |

### Guide Application Write Test (requires separate approval)

The guide-application submission is a production write. It creates a row in `guide_applications`. Before this test is performed, confirm:
- No downstream email/SMTP integration is active
- No webhook endpoints are configured for live Stripe
- No syndication or notification system is live
- The test row can be manually reviewed and deleted after verification

**This write test is NOT authorised yet. It requires separate written approval.**

---

## 3. Recovery

### Recovery Hierarchy (in order of preference)

1. **Transaction rollback** -- if 003b or 004 aborts with RAISE EXCEPTION, nothing was applied. The entire migration runs in a single BEGIN...COMMIT. Fix the issue and re-run.

2. **Diagnose** -- review the error message, query affected tables, determine root cause.

3. **PITR / backup restore** -- if the migration applied but verification fails, restore from the pre-migration backup. Supabase Dashboard -> Database -> Restore.

4. **Emergency recovery** -- `003b_emergency_recovery.sql` is committed for **emergency use only**. It drops the 5 hardened policies and recreates them with broader privileges, then re-grants revoked table-level SELECT. **This deliberately restores wider access.** It requires **explicit written approval** before execution. It is NOT an automatic rollback.

---

## 4. Confirmed Constraints

| Constraint | Status |
|---|---|
| Terms Sections 6 & 7 | **DRAFT** |
| Stripe live webhook | **NOT configured** |
| JustGiving live | **NOT configured** |
| PR merge to main | **NOT authorised** |
| `0000_core_schema.sql` on production | **NEVER** |
| Guide application write test | **NOT authorised** (requires separate approval) |
