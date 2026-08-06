# Stripe Webhook Testing Scenarios (Test Mode vs Staging)

**Status:** Authorised scope item 6 — run against the isolated **staging** Deploy Preview
once it exists. **Live webhook is NOT configured against production. No live Stripe.**
Terms Sections 6 & 7 remain DRAFT.

## Purpose

Prove the `webhook_stripe` state machine and payment fulfilment behave correctly in an
isolated environment across six scenarios:

| # | Scenario        | What it proves |
|---|-----------------|----------------|
| 1 | **Success**     | A valid signed `checkout.session.completed` is fulfilled exactly once (booking + terms + payment report + rewards/commission). |
| 2 | **Failure**     | An invalid signature is rejected with HTTP 400 and leaves **no** inbox row (rejected before recording). |
| 3 | **Duplicate**   | Re-delivery of the same `event_id` is idempotent — one inbox row, one fulfilment. |
| 4 | **Delayed**     | A Stripe retry arriving after completion is skipped (200, `duplicate: true`), status stays `completed`. |
| 5 | **Out-of-order**| Two different sessions delivered in reverse order both fulfil independently. |
| 6 | **Retry**       | An inbox row forced to `failed` is reprocessed to `completed` on resend (claim RPC supports `failed → processing`). |

## State Machine Under Test

```
received → processing → completed | failed | ignored
failed   → processing  (retry / Stripe Dashboard resend)
stale processing (>5 min) → reprocessed atomically by claim_webhook_event RPC
```

- Idempotency gate: `webhook_event_inbox.event_id` UNIQUE (`ON CONFLICT DO NOTHING`).
- Terminal states: `completed`, `ignored` (non-retryable).
- `claim_webhook_event` RPC is SECURITY DEFINER, service_role-only, atomic claim.
- Partial failures record `status='failed'`, `retryable=true`, `error_message`.

## Prerequisites (staging environment exists)

1. **Staging Supabase project** `bucketlistspots-staging` created and schema applied
   (see `staging-environment-setup.md`; includes `webhook_event_inbox`,
   `booking_confirmations`, `terms_acceptance`, `payment_reports`, claim/credit RPCs).
2. **Netlify Deploy Preview** for branch `review/*` wired to the staging project
   (per-context env vars: `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`).
3. **Stripe test-mode webhook endpoint** configured in the Stripe Dashboard to the
   preview URL `/webhooks/stripe` with event `checkout.session.completed` subscribed.
   Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET` for the preview
   context, and into the runner below.
4. Node deps installed (`npm install`).

## How To Run

```powershell
# From website/ (repo root)
$env:STAGING_WEBHOOK_URL      = "https://<hash>--comfy-truffle-b279e1.netlify.app/webhooks/stripe"
$env:STRIPE_WEBHOOK_SECRET    = "whsec_..._staging_..."   # signing secret from step 3
$env:STRIPE_SECRET_KEY        = "sk_test_..."             # staging test-mode key (creates real test PIs)
$env:VITE_SUPABASE_URL        = "https://<staging-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY= "sb_secret_..."           # staging service role (inbox verification)

node tests/webhook-scenario-runner.cjs          # real test-mode PIs (default)
node tests/webhook-scenario-runner.cjs --synthetic   # synthetic payloads only
```

Safety guards in the runner:
- Aborts unless `STAGING_WEBHOOK_URL` is set and contains `--comfy-truffle-b279e1`.
- Aborts if the URL is `bucketlistspots.com` (production domain).
- Aborts if `STRIPE_WEBHOOK_SECRET` is unset or still `whsec_REPLACE_ME...`.

### Real vs synthetic mode

- **Real (default):** creates genuine test-mode PaymentIntents with `pm_card_visa`
  (`confirm:true`), waits for the balance transaction to settle (~1–3 s), then builds
  the `checkout.session.completed` event around that real PI. The webhook's own calls
  to `stripe.paymentIntents.retrieve()`, `charges.retrieve()`, and
  `balanceTransactions.retrieve()` therefore succeed, so **`payment_reports` is fully
  populated** (fees, settlement, net). This is the only mode that exercises step 5c.
- **Synthetic:** constructs payloads with fake `pi_test_*` ids. The 5c payment-report
  step partial-fails (`status=failed, retryable=true`) — usable for signature/state
  checks only.

## Expected Assertions (per scenario)

1. **Success** — HTTP 200, `{ ok: true }`; inbox `status=completed`; 1 row in
   `booking_confirmations`; (real mode) 1 row in `payment_reports` with a real
   `stripe_balance_transaction_id`.
2. **Failure** — HTTP 400; no `webhook_event_inbox` row for that `event_id`; no
   `booking_confirmations` row.
3. **Duplicate** — first 200; second 200 with `duplicate: true`; exactly 1 inbox row;
   exactly 1 booking confirmation.
4. **Delayed** — retry 200 with `duplicate: true`; inbox stays `completed`.
5. **Out-of-order** — both 200; both inbox rows `completed`; two distinct bookings.
6. **Retry** — after forcing inbox to `failed` + `retryable=true`, resend returns 200
   and inbox transitions to `completed`.

## Verification Queries (Staging SQL Editor / service role)

```sql
-- All inbox rows from this run
SELECT event_id, event_type, status, retryable, skip_reason, error_message, processed_at
FROM webhook_event_inbox ORDER BY created_at DESC LIMIT 25;

-- Stuck / retryable events (should be empty in steady state)
SELECT count(*) AS retryable_open FROM webhook_event_inbox WHERE retryable = true;

-- Duplicate bookings (must be zero per session_id)
SELECT session_id, count(*) FROM booking_confirmations GROUP BY session_id HAVING count(*) > 1;

-- Payment reports with real settlement data (real mode)
SELECT session_id, presentment_amount, net_settlement_amount, total_stripe_fee,
       stripe_balance_transaction_id
FROM payment_reports WHERE stripe_balance_transaction_id IS NOT NULL ORDER BY created_at DESC;
```

## Notes / Caveats

- Test-mode balance transactions settle asynchronously (~1–3 s); the runner waits up to
  10 s per PI. If the staging function receives the event before the transaction has
  settled, `payment_reports` will be skipped for that charge (guarded by
  `if (charge.balance_transaction)`); re-running the same event id will not repair it
  (terminal `completed`). Re-run scenario 1 fresh if you need a settled report.
- The retry scenario (6) deliberately force-marks an inbox row as `failed`; this is a
  service-role-only write and mimics what the function itself does on partial failure.
- To see Stripe's own retries, fail scenario 1 twice with `--synthetic` (5c partial
  failure sets `failed`), then resend from the **Stripe Dashboard → Webhooks → Your
  endpoint → resend event** and re-check the inbox.
- Nothing in this harness touches the production Supabase project or the production
  domain; all writes go to the staging preview URL and staging project.
