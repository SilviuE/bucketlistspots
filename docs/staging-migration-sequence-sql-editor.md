# Staging Migration Sequence — SQL Editor (Dashboard)

Target: **staging Supabase** project `tqooyiyqsidbemzlcsfp` ONLY.
Never run on production (`nmyhytrnzfhdstqazttb`). No automatic application — you run these
personally in the dashboard SQL Editor.

Order is critical: **001 → 002 → 003a → 003b → 004** then scenario-c checks.
If any earlier migration is already applied on staging, skip it. 003b and 004 are idempotent.

## Where
Supabase Dashboard → (staging project `tqooyiyqsidbemzlcsfp`) → SQL Editor → New query.
Paste the **full file contents** from the repo, then **Run**.

## Step M1 — Preflight (read-only sanity)
Run this first and confirm no unexpected errors:

```sql
select current_database(), current_user, version() \g
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```
Expected: standard `postgres` DB on staging; table list shows existing staging tables.

## Step M2 — 003b RLS / privilege hardening
File: `supabase/migrations/003b_rls_privilege_hardening.sql` (776 lines, transactional `BEGIN … COMMIT`).

1. Open the file, select all, paste into SQL Editor, Run.
2. Expected NOTICE output (SQL Editor "Messages"/"Notice" panel):
   - `PREFLIGHT SCHEMA AUDIT` → each `OK public.<table>`
   - `Step 1: Revoked EXECUTE from all roles on all functions`
   - `Step 2: Per-function REVOKE complete`
   - `Step 3: Regranted 3 approved RPCs to service_role`
   - `POST-MIGRATION VERIFICATION` → `  RLS enabled on all 17 tables`
   - **`VERIFICATION: ALL CHECKS PASSED`**  ← required
   - `003b_rls_privilege_hardening v3: MIGRATION COMPLETE`
3. If any `RAISE WARNING` appears, STOP and report the warning text verbatim.
   Do not proceed to M3.
4. **Run the exact same file a second time** (idempotency check). Must end with the same
   `VERIFICATION: ALL CHECKS PASSED` and no new warnings.

## Step M3 — 004 account suspension
File: `supabase/migrations/004_account_suspension.sql` (292 lines, transactional `BEGIN … COMMIT`).

1. Paste full file into SQL Editor, Run.
2. Expected NOTICE output:
   - `PREFLIGHT: public.users baseline`
   - `account_status: active | suspended | deactivated` steps
   - `  trigger trg_users_account_status_audit present`
   - **`VERIFICATION 004: ALL CHECKS PASSED`**  ← required
   - `004_account_suspension: MIGRATION COMPLETE`
3. Any `RAISE WARNING` → STOP and report verbatim.
4. **Run the exact same file a second time** (idempotency check). Must end with the same
   `VERIFICATION 004: ALL CHECKS PASSED`.

## Step M4 — Post-migration sanity (read-only)
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='users'
and column_name='account_status';

select count(*) from public.account_status_audit;

select n.nspname, p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname in ('claim_webhook_event','record_account_status_change');
```
Expected: `account_status` column present; audit table exists (0 rows is fine);
both functions present.

## Evidence to capture
For each run, screenshot:
1. The pasted SQL + Run button.
2. The Messages/Notice output showing the VERIFICATION line.
3. Repeat for the second (idempotency) run.
4. The Step M4 query results.

## Abort criteria (do not continue to scenario-c)
- Any `RAISE WARNING … FAILED` / `CHECK FAILED`.
- Any statement error mid-migration (transaction rolls back automatically — safe).
- Any doubt that the query was run on staging vs production (check the URL bar: project ref
  `tqooyiyqsidbemzlcsfp`).
