# Production Migration Runbook — 003b RLS Privilege Hardening

> Applies to `supabase/migrations/003b_rls_privilege_hardening.sql` (v3, narrowed defaults).
> This is a RUNBOOK. Execution requires the named responsible persons to sign each gate.
> **Do not execute until the staging evidence review is approved and a written go-ahead is given.**

## 0. Migration overview

| Item | Value |
|---|---|
| File | `supabase/migrations/003b_rls_privilege_hardening.sql` |
| Version | v3 (commit `9742762`) |
| Transaction | single `BEGIN` … `COMMIT`; any `RAISE EXCEPTION` aborts the whole migration (safe) |
| Target project | PRODUCTION Supabase `nmyhytrnzfhdstqazttb` |
| Preconditions | 003a + 003 applied (published experiences/destinations exist) |
| Risk class | **HIGH** (revokes public access, changes default ACLs, enable RLS) |
| Rollback | `003b_emergency_recovery.sql` + re-grant of revoked privileges (Section 7) |

## 1. Responsible persons (RACI)

| Activity | R | A | C | I |
|---|---|---|---|---|
| Pre-migration checks | DB owner | Site owner | — | Support |
| Verified backup (`pg_dump`) | DB owner | Site owner | — | — |
| Maintenancy page / downtime decision | Site owner | Site owner | DB owner | — |
| Execute migration | Site owner / DB owner | Site owner | — | — |
| Section 11 verification | DB owner | Site owner | — | — |
| Post-migration smoke tests | Site owner | Site owner | DB owner | — |
| Rollback decision | Site owner | Site owner | DB owner | Support |

Legend: R = Responsible, A = Accountable, C = Consulted, I = Informed.
Use concrete names in the sign-off table (Section 10) before execution.

## 2. Pre-migration checks (gate 1 — all must pass)

1. Confirm branch: production deploys from `main`. Merge approval must already exist.
2. Confirm migration is **idempotent-safe** for a single run: verified locally on PostgreSQL 16.14
   (Scenario C ran 36/36 PASS twice; parser 8/8; structural 19/19).
3. Confirm prerequisites on production:
   - `public.experiences` has ≥1 `is_published = true` row (003 applied)
   - `public.destinations` has ≥1 `is_published = true` row (003 applied)
   - `public.users.avatar` column check (003b adds it if missing)
4. Confirm no unexpected policies exist in `public` schema. Run the read-only query:
   ```sql
   SELECT schemaname, tablename, policyname FROM pg_policies
   WHERE schemaname = 'public' ORDER BY tablename, policyname;
   ```
   Every policy must be one of the 20 known names listed in Section 5 of the migration.
5. Confirm production env vars (Netlify) match `docs/environment-identifiers.md` §2.1.
6. Snapshot `pg_default_acl` before migration (for diff evidence):
   ```sql
   SELECT d.defaclobjtype, d.defaclnamespace::regnamespace,
          r.rolname AS owner, d.defaclacl::text
   FROM pg_default_acl d JOIN pg_roles r ON d.defaclrole = r.oid
   WHERE d.defaclnamespace = 'public'::regnamespace
   ORDER BY d.defaclobjtype, r.rolname;
   ```

## 3. Verified backup (gate 2 — REQUIRED before any write)

Run via **psql/pg_dump against the production project** using a connection string that
has database access. The Supabase dashboard "Database → Database password" provides the
connection details. Use a dedicated ops connection string stored only in the ops vault.

```powershell
# Full logical backup (data + schema). Size will be small (startup project).
pg_dump "postgresql://postgres:[DB_PASSWORD]@db.nmyhytrnzfhdstqazttb.supabase.co:5432/postgres" -F c -Z 9 -f "C:\Users\silvi\OneDrive\Documents\BUSINESS & PROFESSIONAL\The Bucket List Spots\BucketListSpots.com\backups\prod-003b-pre-YYYYMMDD-HHMM.dump"

# ALSO export auth.users + public schema as plain SQL for greppable evidence
pg_dump "postgresql://...same..." -n public -n auth --no-owner --no-privileges -f "C:\...\backups\prod-003b-pre-YYYYMMDD-HHMM-public.sql"
```

Verify backup integrity:
```powershell
pg_restore --list "C:\...\prod-003b-pre-YYYYMMDD-HHMM.dump" | Select-Object -First 10
```
If `pg_restore --list` errors → STOP. Do not proceed without a verified backup.

Store the `.dump` file in the backups folder AND copy a second copy to a separate location
(OneDrive + local). Record SHA-256:
```powershell
Get-FileHash "C:\...\prod-003b-pre-YYYYMMDD-HHMM.dump" -Algorithm SHA256
```

## 4. Maintenance window & traffic control

- Recommended: run during low-traffic window (e.g. early morning UTC) as a courtesy.
- The migration is transactional and fast (small tables). A maintenance page is optional.
- If a maintenance page is used: set it via Netlify → Deploys → Publish a deploy or use a
  temporary redirect in `netlify.toml` (and remove after). Keep it simple; prefer no page.

## 5. Execution (gate 3)

> Only ONE operator runs this, from a single session, using the SQL Editor on the
> PRODUCTION Supabase project dashboard (Dashboard → SQL Editor → New query).

1. Paste the ENTIRE contents of `003b_rls_privilege_hardening.sql`.
2. Confirm the project reference shown in the URL bar is `nmyhytrnzfhdstqazttb`.
3. Execute. Expected: `SUCCESS` with NOTICEs. Any `RAISE EXCEPTION` → transaction aborts
   (no partial apply). If aborted, capture the error and STOP (go to Section 9).
4. Keep the SQL Editor output (NOTICEs + SUCCESS) — save as evidence PDF/PNG:
   `backups/evidence/prod-003b-execution-YYYYMMDD-HHMM.png`.

## 6. Section 11 post-migration verification (gate 4)

Expected Section 11 output (must show `VERIFICATION: ALL CHECKS PASSED`):
- RLS enabled on all 17 tables
- anon: CANNOT select `public.users`; CAN select `public.guides` (column-restricted); CANNOT select Netlify-only tables
- authenticated: CAN select `public.guides` (column-restricted); CAN update `public.users.name`; CANNOT update `role`/`bls_points_balance`; CANNOT select `guide_applications`
- service_role: CAN execute `claim_webhook_event`, `credit_referral_reward`, `credit_ambassador_commission`
- anon/authenticated: NO function EXECUTE retained
- Default ACL: postgres hard-pass (no client roles in `public/function`; table `service_role=arwd`; sequence `service_role=rU`)
- All public functions owned by `postgres`

Independent read-only re-verification (run as a separate query afterwards):
```sql
-- anon can't see users
SET ROLE anon; SELECT count(*) FROM public.users; RESET ROLE;
-- authenticated sees only own row (should return 0 rows for an anonymous session)
SET ROLE authenticated; SELECT * FROM public.users LIMIT 5; RESET ROLE;
```

## 7. Rollback plan (gate 5 — only if Section 11 fails or smoke tests fail)

Rollback options, in order of preference:

1. **Transactional abort already occurred** → nothing applied. No rollback needed; fix the
   SQL and re-run after re-checking.
2. **Restore from pre-migration backup** (verified `.dump` from Section 3):
   ```powershell
   # CREATE a new scratch project/DB, then:
   pg_restore -d postgres "C:\...\prod-003b-pre-YYYYMMDD-HHMM.dump"
   # Point Netlify env vars back to the restored project only if the original
   # project is unrecoverable. PREFFERED: restore to original project via
   # Supabase dashboard "Database → Restore" if available.
   ```
3. **Apply `003b_emergency_recovery.sql`** to restore emergency access, then re-grant the
   revoked privileges manually per Section 6 of the migration (REVOKE list is symmetric).

Rollback criteria (any one triggers rollback):
- Section 11 reports any CHECKS FAILED
- Post-migration smoke tests fail for anon/authenticated visibility or admin operations
- Unexpected policies found after migration

Rollback is STOP-THE-LINE: no other work proceeds until resolved and re-verified.

## 8. Post-migration smoke tests (gate 6)

Run on `https://bucketlistspots.com` after deployment completes:

| # | Test | Expected |
|---|---|---|
| 1 | Homepage loads | 200, guides visible |
| 2 | `/for-guides` loads | 301 → valid page |
| 3 | `/ambassadors` loads | 301 → valid page |
| 4 | Guide application submit (test email) | success, status `pending` |
| 5 | Ambassador application submit (test email) | success, status `pending` |
| 6 | Admin login `silviu@bucketlistspots.com` | success |
| 7 | Admin payment reports page | loads, table renders |
| 8 | Admin platform config | loads, GET 200 |
| 9 | Stripe test webhook to `/webhooks/stripe` | 400 (no signature) — proves endpoint alive, not 404/500 |
| 10 | Rate-limit evidence still valid | `docs/rate-limit-evidence.md` checks unchanged |

## 9. Sign-off record

| Gate | Name | Date/Time | Result / Evidence |
|---|---|---|---|
| 1 Pre-checks | | | |
| 2 Backup verified | | | SHA-256: |
| 3 Execution | | | PDF evidence saved |
| 4 Section 11 | | | ALL CHECKS PASSED |
| 5 Rollback (N/A) | | | — |
| 6 Smoke tests | | | 10/10 |
| Approval to merge/launch | | | written go-ahead |

## 10. Blockers / notes

- Requires Netlify + Supabase dashboard access (auth tokens) — not available in this
  environment. Cloud steps above must be performed by the site owner with credentials.
- Stripe live webhook must NOT be configured during this change.
- Terms Sections 6 & 7 remain DRAFT; no public charity promotion until reviews complete.
