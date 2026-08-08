# Phase B: Production Upgrade -- Documented Execution Path

Target: **production Supabase** project `nmyhytrnzfhdstqazttb` ONLY.
Never run on staging (`tqooyiyqsidbemzlcsfp`).

> **CRITICAL**: This path must NEVER execute `0000_core_schema.sql`.
> Terms remain DRAFT. Stripe/JustGiving/live launch remain disabled.

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

All hashes must match the approved commit. Working tree must be clean. Verifier must exit 0.

### Step 0b -- Confirm Backup

Supabase Dashboard -> `nmyhytrnzfhdstqazttb` -> Database -> Backups. Verify a PITR backup exists. If unavailable, use the secure Read-Host backup procedure (see below).

### Step 0c -- Run Production Preflight

Open SQL Editor on PRODUCTION. Paste ENTIRE `supabase/preflight/production_preflight.sql`. Run.

**If PREFLIGHT STOP on missing tables:** The error message lists which tables are missing and which prerequisite migration resolves them. Run P1 and/or P2 from Section 1 below, then re-run the preflight.

**If the result table is shown:** all 26 rows present. Review STOP rows. WARNING rows are documented below.

---

## 1. Full Migration Chain

`0000_core_schema.sql` is **NEVER** applied to production.

### Prerequisites (before Phase B)


| Step | File | Purpose |
|---|---|---|
| P1 | `supabase/migrations/002_webhook_infrastructure_upgrade.sql` | Creates `webhook_event_inbox` and `booking_confirmations`. Adds `idempotency_key` to `transactions`. Creates 3 RPC functions. Conditional UNIQUE on `payment_reports.session_id`. Creates 2 legacy policies. |
| P2 | `supabase/migrations/terms_acceptance.sql` | Creates `terms_acceptance` from scratch. Adds indexes, RLS, trigger function, 2 legacy policies. |

### Phase B Hardening

| Step | File | Purpose |
|---|---|---|
| 1 | `supabase/migrations/003b_rls_privilege_hardening.sql` | RLS hardening. Drops all 25 known policies (including 4 from P1+P2). Creates 5 hardened policies. Column grants, function EXECUTE lockdown, schema_migrations bootstrap. Supabase_admin defaults advisory. |
| 2 | `supabase/migrations/004_account_suspension.sql` | Account suspension. `account_status` column on users. Trigger-written audit table. |
| 3 | supabase/migrations/005_guides_agency_price.sql | Additive: gency_price NUMERIC(10,2) on guides if absent. Production no-op (column already exists). |
| 4 | supabase/migrations/006_guides_agency_price_privileges.sql | Column-level SELECT on guides.agency_price for anon and authenticated. |

### Execution Order

```
P1: 002_webhook_infrastructure_upgrade.sql
P2: terms_acceptance.sql
1:  003b_rls_privilege_hardening.sql
2:  004_account_suspension.sql
| 3 | supabase/migrations/005_guides_agency_price.sql | Additive: gency_price NUMERIC(10,2) on guides if absent. Production no-op (column already exists). |
| 4 | supabase/migrations/006_guides_agency_price_privileges.sql | Column-level SELECT on guides.agency_price for anon and authenticated. |
```

### Prerequisite Audit

| Step | Tables created | Destructive DDL | Backfills | Idempotent |
|---|---|---|---|---|
| P1 | webhook_event_inbox, booking_confirmations | None (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, conditional UNIQUE) | None | Yes |
| P2 | terms_acceptance | None (CREATE TABLE IF NOT EXISTS, DROP IF EXISTS for policy/trigger) | None | Yes |

P1 creates 3 RPC functions (`credit_referral_reward`, `credit_ambassador_commission`, `claim_webhook_event` — SECURITY DEFINER, SET search_path = ''). P2 creates 1 trigger function (`reject_terms_acceptance_update_delete` — SECURITY INVOKER, SET search_path = '').

Both P1 and P2 together create 4 legacy policies. 003b (Step 1) drops all 25 known policies and replaces them with 5 hardened policies. 003b also re-hardens function EXECUTE: P1 grants service_role EXECUTE on 3 RPCs; 003b revokes ALL EXECUTE from all roles, then re-grants only those 3 to service_role.

### PASS/STOP Criteria Per Step

| Step | PASS marker | STOP conditions |
|---|---|---|
| P1 | Tables created, functions replaced, policies created | Any RAISE EXCEPTION or ERROR. Duplicate session_ids in payment_reports (conditional UNIQUE will WARN). |
| P2 | Table created, trigger function created, policies created | Any RAISE EXCEPTION or ERROR. |
| 1 | `VERIFICATION: ALL CHECKS PASSED`, `003b_rls_privilege_hardening v3: MIGRATION COMPLETE` | Any RAISE EXCEPTION, CHECKS FAILED, ADVISORY SKIP with non-42501 SQLSTATE |
| 2 | `VERIFICATION 004: ALL CHECKS PASSED`, `004_account_suspension: MIGRATION COMPLETE` | Any RAISE EXCEPTION, CHECKS FAILED |

---

## 2. Post-Deployment Verification

Run `supabase/test/production_verification.sql` on production. Expected: all PASS.

Smoke tests on production URL:
| # | Test | Expected |
|---|---|---|
| 1 | Homepage loads | 200 |
| 2 | `/for-guides` loads | 200 or 301 |
| 3 | Admin login | success |

---

## 3. Recovery

### Hierarchy (in order of preference)

1. **Transaction rollback** -- if any step aborts with RAISE EXCEPTION, nothing was applied (all steps use BEGIN...COMMIT).
2. **Diagnose** -- review the error, query affected tables.
3. **PITR/backup restore** -- via Supabase Dashboard -> Database -> Restore.
4. **Emergency recovery** -- `003b_emergency_recovery.sql` is committed for emergency use only. It deliberately restores broader access. Requires explicit written approval.

---

## 4. Backup Procedure (if PITR unavailable)

```powershell
$pw = Read-Host -AsSecureString "DB password"
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
$plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
pg_dump "postgresql://postgres:${plain}@db.nmyhytrnzfhdstqazttb.supabase.co:5432/postgres" -F c -Z 9 -f "prod-pre-migration-$(Get-Date -Format yyyyMMdd-HHmm).dump"
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
```

---

## 5. Confirmed Constraints

| Constraint | Status |
|---|---|
| Terms Sections 6 & 7 | DRAFT |
| Stripe live webhook | NOT configured |
| JustGiving live | NOT configured |
| PR merge to main | NOT authorised |
| `0000_core_schema.sql` on production | NEVER |
| Guide application write test | NOT authorised |


