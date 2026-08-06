# Manual UAT Matrix — BucketListSpots.com (Staging)

**Status:** Authorised scope item 7 — run against the isolated **staging** Deploy Preview
(`https://<hash>--comfy-truffle-b279e3.netlify.app`) wired to the staging Supabase
project. **Never** run against `bucketlistspots.com` / production Supabase.

## Test Accounts (create in staging Supabase Auth)

| Role        | Email                | Password         | Notes |
|-------------|----------------------|------------------|-------|
| Admin       | silviu@bucketlistspots.com | (rotated — set in staging Auth) | Set `role='admin'` via staging SQL Editor |
| Guide       | kilimanjarojoy@gmail.com  | (set on create) | Guide profile seeded + `status='pending'` |
| Ambassador  | phototrust@yahoo.com      | (set on create) | `role='ambassador'`, linked `referred_by_ambassador_id` |
| Traveller   | traveller@test.com        | (set on create) | Default `role='traveller'` (trigger-assigned) |

Seeding SQL (staging SQL Editor, one-time):

```sql
-- after creating each user in Auth, assign roles in public.users
UPDATE public.users SET role = 'admin'      WHERE email = 'silviu@bucketlistspots.com';
UPDATE public.users SET role = 'ambassador' WHERE email = 'phototrust@yahoo.com';
-- guide: insert a guides row referencing the guide's users.id
-- so guide dashboard routes and payments have a real record.
```

## How To Run

1. Open the staging Deploy Preview URL in an incognito window.
2. Complete each row below; record **Actual result** and **Pass / Fail**.
3. Note: Terms Sections 6 & 7 remain DRAFT — do not treat checkout acceptance as final legal sign-off.

---

## A. Traveller (default role)

| ID | Test case | Expected result |
|----|-----------|-----------------|
| T-01 | Register new account with a fresh email | Profile created with `role='traveller'` (DB trigger); redirected to `/dashboard` |
| T-02 | Log in with traveller credentials | Dashboard loads; user name + email shown; `account_status='active'` |
| T-03 | Browse `/`, `/book`, `/bucketlist`, `/trust`, `/news` | All public pages render without auth errors |
| T-04 | View a guide profile `/guide/:id` | Routes, pricing, and "Book" CTA visible |
| T-05 | Start checkout `/checkout/:guideId` (Test Mode) | Price preview loads (debounced `/api/pricing-preview`); select route + date; terms checkbox required |
| T-06 | Complete a Stripe Test payment (card 4242 4242 4242 4242) | Checkout completes; redirect to success; terms acceptance recorded |
| T-07 | Edit own profile name/avatar | Update persists; role/account_status are NOT editable (no fields shown) |
| T-08 | Negative: try to set `role` or `account_status` via devtools / crafted request | Fails — role never written client-side; UPDATE grant limited to name/avatar |
| T-09 | Negative: access `/admin/applications` as traveller | Access denied (admin only) |
| T-10 | Negative: access `/guide-dashboard` as traveller | Access denied (guide only) |
| T-11 | Log out, then revisit a dashboard URL | Redirected to `/auth` (session guarded) |

## B. Guide

| ID | Test case | Expected result |
|----|-----------|-----------------|
| G-01 | Log in as guide | `/guide-dashboard` loads; guide profile + routes shown |
| G-02 | Add a route | POST `/api/guide-profile/routes` succeeds; route appears |
| G-03 | Edit a route | PUT succeeds; price/name/days update |
| G-04 | Delete a route | DELETE succeeds; route removed |
| G-05 | Negative: modify `status`, `price_currency`, `featured`, verification flags | Rejected — never allowlisted in `guide-profile.cjs` |
| G-06 | Negative: access `/admin/applications` as guide | Access denied |
| G-07 | Negative: view another guide's dashboard data | Only own guide record returned (auth filtered by user id) |
| G-08 | Submit guide application (`/become-a-guide`) | Creates application with `status='pending'`; appears in admin queue |
| G-09 | Negative: set own application status to `approved` | Rejected — status only changes server-side via admin approval |

## C. Ambassador

| ID | Test case | Expected result |
|----|-----------|-----------------|
| A-01 | Log in as ambassador | `/ambassador-dashboard` loads; referrals + commission summary visible |
| A-02 | Copy/share referral link | Referral code embedded in URL |
| A-03 | Refer a new guide who then gets booked | Ambassador commission (5%) credited to balance on booking completion |
| A-04 | Negative: claim a commission without a real booking | No reward — commission only credited by webhook RPC with idempotency key |
| A-05 | Negative: access `/admin/applications` as ambassador | Access denied |
| A-06 | Negative: access `/guide-dashboard` as ambassador | Access denied |

## D. Admin

| ID | Test case | Expected result |
|----|-----------|-----------------|
| AD-01 | Log in as admin | Admin navigation appears |
| AD-02 | Review pending guide applications | Approve/reject works; approved guide gets `role='guide'` via server-side flow |
| AD-03 | View `/admin/payment-reports` | Payment reports render; settlement, fees, currency columns populated |
| AD-04 | Approve a guide profile | Status transitions `pending → published` only through sanctioned flow |
| AD-05 | Suspend a user via POST `/api/admin/user-status` (body `{userId, status:'suspended', reason}`) | `account_status='suspended'`, `suspended_by=<admin>`, audit row written |
| AD-06 | Attempt to log in as the suspended user | Login succeeds at Auth layer but function/profile gate returns **403 Account not active**; no dashboard access |
| AD-07 | Reactivate via `/api/admin/user-status` (`status:'active'`) | Login works again; audit row records `suspended → active` |
| AD-08 | Deactivate a user (`status:'deactivated'`) | Access blocked (403); booking history + payment records preserved |
| AD-09 | Negative: non-admin calls `/api/admin/user-status` | 401/403 — `authenticateAdmin` required |
| AD-10 | Negative: admin tries invalid status value | 400 — status must be one of active/suspended/deactivated |
| AD-11 | Verify append-only audit | `account_status_audit` holds full transition history; service_role cannot UPDATE/DELETE rows (REVOKE in 004) |

## E. Cross-cutting / negative / permission-denied

| ID | Test case | Expected result |
|----|-----------|-----------------|
| X-01 | Rate limit: hit `/api/*` endpoints rapidly | 429 after configured threshold (see `docs/rate-limit-evidence.md`) |
| X-02 | Stripe webhook replay / duplicate | Second delivery of same `event_id` → 200 `duplicate:true`; no double booking |
| X-03 | Webhook with invalid signature | HTTP 400; no inbox row |
| X-04 | Unauthenticated call to any `/api/admin/*` | 401/403 |
| X-05 | Stale processing event (>5 min) | Reprocessed by `claim_webhook_event` on next delivery |
| X-06 | Suspended user on a `/guide/:id` public page | Public pages still render; only authenticated actions blocked |
| X-07 | Deleted vs deactivated | No hard deletes of users; deactivation preserves history, payments, audit |
| X-08 | Referral reward idempotency | Same session cannot credit referral twice (`referral_<sessionId>` key) |

## Sign-off

| Date | Run by | Env (staging preview URL) | Traveller | Guide | Ambassador | Admin | Negatives | Notes |
|------|--------|---------------------------|-----------|-------|------------|-------|-----------|-------|
|      |        |                           | /11       | /9    | /6         | /11   | /8        |       |

Approved for production consideration only after: written go-ahead from site owner, all
rows pass, and Sections 6 & 7 of the Terms are no longer DRAFT.
