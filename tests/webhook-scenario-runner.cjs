/**
 * Stripe Test-Mode Webhook Scenario Runner (STAGING)
 * =================================================
 * Sends signed Stripe test webhook events to a STAGING deploy preview URL
 * and verifies the webhook_stripe state machine + DB fulfilment.
 *
 * PURPOSE: authorised validation item 6 — test-mode webhooks against staging:
 *   - success      : valid signed event → fulfilled once
 *   - failure      : invalid signature  → 400, no fulfilment
 *   - duplicate    : same event_id twice → processed once only
 *   - delayed      : event delivered, then retried after completion → skip
 *   - out-of-order : two different sessions delivered in reverse order
 *   - retry        : inbox row marked failed → resent → reprocessed
 *
 * MODES:
 *   --real  (default when STRIPE_SECRET_KEY present)  Create real test-mode
 *           PaymentIntents (pm_card_visa) so the webhook's real calls to
 *           stripe.paymentIntents.retrieve / charges / balanceTransactions
 *           succeed and payment_reports is populated with genuine objects.
 *   --synthetic  Build synthetic checkout.session payloads only. The 5c
 *           payment_reports step will partial-fail (pi does not exist) —
 *           useful only for signature/state-machine checks.
 *
 * USAGE (after staging exists — see docs/staging-environment-setup.md):
 *   $env:STAGING_WEBHOOK_URL = "https://<hash>--comfy-truffle-b279e1.netlify.app/webhooks/stripe"
 *   $env:STRIPE_WEBHOOK_SECRET = "whsec_..."        (STAGING test-mode signing secret)
 *   $env:STRIPE_SECRET_KEY = "sk_test_..."          (STAGING test-mode secret — real PIs)
 *   $env:VITE_SUPABASE_URL = "https://<staging-ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."          (STAGING service role — inbox verification)
 *   node tests/webhook-scenario-runner.cjs [--synthetic]
 *
 * SAFETY: never point this at production. Requires a written go-ahead + staging
 * environment. Test-mode secret keys only. No live data.
 */

const Stripe = require('stripe');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const WEBHOOK_URL = process.env.STAGING_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USE_REAL = !process.argv.includes('--synthetic') && Boolean(STRIPE_SECRET);
const stripe = Stripe(STRIPE_SECRET || 'sk_test_dummy');

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} — ${detail || ''}`); }
}

function metaFor(overrides = {}) {
  return {
    guideId: overrides.guideId || 'guide_pub',
    guideName: 'Bob Mountain',
    routeName: 'Kilimanjaro Summit',
    guestEmail: 'traveller@test.com',
    guestName: 'Traveller Test',
    date: '2026-09-15',
    travelers: '2',
    presentmentAmount: '3000.00',
    presentmentCurrency: 'usd',
    grossPlatformFee: '600.00',
    platformFeePct: '0.2',
    bookingRef: overrides.bookingRef || `BK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    termsVersion: overrides.termsVersion || 'terms-2026-08-01',
    disclosureVersion: 'disclosure-2026-08-01',
    ...(overrides.metadata || {}),
  };
}

/** Real test-mode session object with a confirmed PI + settled balance transaction. */
async function makeRealSession(overrides = {}) {
  const amount = overrides.amountTotal ?? 300000;
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });
  // Balance transaction settles within ~1-3s in test mode.
  let btId = null;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ch = await stripe.charges.retrieve(pi.latest_charge);
    if (ch.balance_transaction) { btId = ch.balance_transaction; break; }
  }
  return {
    id: `cs_test_${Math.random().toString(36).slice(2, 14)}`,
    payment_status: 'paid',
    payment_intent: pi.id,
    amount_total: amount,
    currency: 'usd',
    latest_charge: pi.latest_charge,
    balance_transaction: btId,
    metadata: metaFor(overrides),
  };
}

function makeSyntheticSession(overrides = {}) {
  return {
    id: overrides.sessionId || `cs_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    payment_status: overrides.paymentStatus || 'paid',
    payment_intent: overrides.paymentIntent || `pi_test_${Math.random().toString(36).slice(2, 10)}`,
    amount_total: overrides.amountTotal ?? 300000,
    currency: 'usd',
    metadata: metaFor(overrides),
  };
}

function makeEvent(type, data, extra = {}) {
  return {
    id: extra.eventId || `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: 'event',
    api_version: '2026-06-24.dahlia',
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object: data },
    ...extra,
  };
}

function sign(payload, secret, options = {}) {
  return stripe.webhooks.generateTestHeaderString({ payload, secret, ...options });
}

async function postEvent(event, secret = WEBHOOK_SECRET, options = {}) {
  const payload = JSON.stringify(event);
  const sig = sign(payload, secret, options);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: payload,
  });
  let body = null;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { status: res.status, body };
}

async function inboxRows(eventId) {
  const { createClient } = require('@supabase/supabase-js');
  const sr = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await sr
    .from('webhook_event_inbox')
    .select('event_id, status, retryable, error_message')
    .eq('event_id', eventId);
  if (error) throw new Error(`inbox query failed: ${error.message}`);
  return data || [];
}

async function countBookingConfirmations(sessionId) {
  const { createClient } = require('@supabase/supabase-js');
  const sr = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await sr
    .from('booking_confirmations')
    .select('session_id')
    .eq('session_id', sessionId);
  if (error) throw new Error(`booking query failed: ${error.message}`);
  return (data || []).length;
}

async function countPaymentReports(sessionId) {
  const { createClient } = require('@supabase/supabase-js');
  const sr = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await sr
    .from('payment_reports')
    .select('session_id')
    .eq('session_id', sessionId);
  if (error) throw new Error(`payment_reports query failed: ${error.message}`);
  return (data || []).length;
}

(async () => {
  console.log('\n=== Stripe Test-Mode Webhook Scenario Runner ===\n');

  if (!WEBHOOK_URL) {
    console.log('STOP: STAGING_WEBHOOK_URL must be set to the STAGING deploy preview URL (never production).');
    console.log('  e.g. https://<hash>--comfy-truffle-b279e1.netlify.app/webhooks/stripe');
    process.exit(1);
  }
  if (WEBHOOK_URL.includes('bucketlistspots.com') || !WEBHOOK_URL.includes('--comfy-truffle-b279e1')) {
    console.log('STOP: STAGING_WEBHOOK_URL must be a Deploy Preview URL (contains --comfy-truffle-b279e1),');
    console.log('  never the production domain bucketlistspots.com. Aborting for safety.');
    process.exit(1);
  }
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET.includes('REPLACE_ME')) {
    console.log('STOP: STRIPE_WEBHOOK_SECRET must be the STAGING test-mode signing secret.');
    process.exit(1);
  }
  const canVerify = Boolean(SUPABASE_URL && SERVICE_ROLE);
  console.log(`Mode: ${USE_REAL ? 'REAL test-mode PIs' : 'synthetic'}`);
  console.log(`Target: ${WEBHOOK_URL}`);
  if (!canVerify) console.log('Note: no Supabase creds — skipping DB verification (HTTP assertions only).');
  console.log('');

  // ─── Scenario 1: SUCCESS ──────────────────────────────────────────────
  console.log('1. Success — valid signed checkout.session.completed:');
  const s1 = USE_REAL ? await makeRealSession() : makeSyntheticSession();
  const ev1 = makeEvent('checkout.session.completed', s1);
  const r1 = await postEvent(ev1);
  check('HTTP 200', r1.status === 200, `got ${r1.status}`);
  check('body ok', r1.body?.ok === true, JSON.stringify(r1.body));
  if (USE_REAL && !s1.balance_transaction) check('balance transaction settled', false, 'balance_transaction never appeared in test mode');
  if (canVerify) {
    const rows = await inboxRows(ev1.id);
    check('inbox status=completed', rows.some(r => r.status === 'completed'), JSON.stringify(rows));
    const count = await countBookingConfirmations(s1.id);
    check('booking_confirmations = 1', count === 1, `got ${count}`);
    if (USE_REAL) {
      const pr = await countPaymentReports(s1.id);
      check('payment_reports = 1 (real PI data)', pr === 1, `got ${pr}`);
    }
  }

  // ─── Scenario 2: FAILURE (bad signature) ─────────────────────────────
  console.log('\n2. Failure — invalid signature (rejected):');
  const s2 = USE_REAL ? await makeRealSession() : makeSyntheticSession();
  const ev2 = makeEvent('checkout.session.completed', s2);
  const payload2 = JSON.stringify(ev2);
  const badSig = sign(payload2, WEBHOOK_SECRET, { timestamp: Math.floor(Date.now() / 1000) - 1000 });
  const res2 = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': badSig.replace(/(t=\d+)/, 't=0') },
    body: payload2,
  });
  check('HTTP 400', res2.status === 400, `got ${res2.status}`);
  if (canVerify) {
    const rows = await inboxRows(ev2.id);
    check('no inbox row (rejected before record)', rows.length === 0, JSON.stringify(rows));
  }

  // ─── Scenario 3: DUPLICATE ───────────────────────────────────────────
  console.log('\n3. Duplicate — same event delivered twice:');
  const s3 = USE_REAL ? await makeRealSession() : makeSyntheticSession();
  const ev3 = makeEvent('checkout.session.completed', s3);
  const r3a = await postEvent(ev3);
  const r3b = await postEvent(ev3);
  check('first 200', r3a.status === 200, `got ${r3a.status}`);
  check('second 200', r3b.status === 200, `got ${r3b.status}`);
  check('second is duplicate', r3b.body?.duplicate === true, JSON.stringify(r3b.body));
  if (canVerify) {
    const rows = await inboxRows(ev3.id);
    check('one inbox row', rows.length === 1, `got ${rows.length}`);
    const count = await countBookingConfirmations(s3.id);
    check('booking_confirmations = 1 (not 2)', count === 1, `got ${count}`);
  }

  // ─── Scenario 4: DELAYED (retry after completion) ────────────────────
  console.log('\n4. Delayed — retry arrives after event completed:');
  const s4 = USE_REAL ? await makeRealSession() : makeSyntheticSession();
  const ev4 = makeEvent('checkout.session.completed', s4);
  const r4a = await postEvent(ev4);
  const r4b = await postEvent(ev4);
  check('retry returns 200', r4b.status === 200, `got ${r4b.status}`);
  check('retry skipped as duplicate', r4b.body?.duplicate === true, JSON.stringify(r4b.body));
  if (canVerify) {
    const rows = await inboxRows(ev4.id);
    check('status still completed', rows.some(r => r.status === 'completed'), JSON.stringify(rows));
  }

  // ─── Scenario 5: OUT-OF-ORDER (two sessions, reverse delivery) ───────
  console.log('\n5. Out-of-order — session B delivered before session A:');
  const s5a = USE_REAL ? await makeRealSession({ bookingRef: 'BK-OOA' }) : makeSyntheticSession({ sessionId: 'cs_test_outorder_a' });
  const s5b = USE_REAL ? await makeRealSession({ bookingRef: 'BK-OOB' }) : makeSyntheticSession({ sessionId: 'cs_test_outorder_b' });
  const ev5a = makeEvent('checkout.session.completed', s5a);
  const ev5b = makeEvent('checkout.session.completed', s5b);
  const r5b = await postEvent(ev5b);
  const r5a = await postEvent(ev5a);
  check('B first → 200', r5b.status === 200, `got ${r5b.status}`);
  check('A second → 200', r5a.status === 200, `got ${r5a.status}`);
  if (canVerify) {
    const rowsB = await inboxRows(ev5b.id);
    const rowsA = await inboxRows(ev5a.id);
    check('B completed', rowsB.some(r => r.status === 'completed'), JSON.stringify(rowsB));
    check('A completed', rowsA.some(r => r.status === 'completed'), JSON.stringify(rowsA));
  }

  // ─── Scenario 6: RETRY (inbox marked failed → resend → reprocess) ────
  console.log('\n6. Retry — failed inbox row reprocessed on resend:');
  const s6 = USE_REAL ? await makeRealSession() : makeSyntheticSession();
  const ev6 = makeEvent('checkout.session.completed', s6);
  await postEvent(ev6);
  if (canVerify) {
    const { createClient } = require('@supabase/supabase-js');
    const sr = createClient(SUPABASE_URL, SERVICE_ROLE);
    await sr.from('webhook_event_inbox')
      .update({ status: 'failed', retryable: true, error_message: 'SIMULATED_FAILURE' })
      .eq('event_id', ev6.id);
    const r6b = await postEvent(ev6);
    check('resend returns 200', r6b.status === 200, `got ${r6b.status}`);
    const rows = await inboxRows(ev6.id);
    check('reprocessed to completed', rows.some(r => r.status === 'completed'), JSON.stringify(rows));
  } else {
    console.log('  (skipped — no Supabase creds for retry simulation)');
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) process.exit(1);
})().catch((e) => { console.error('Runner error:', e.message); process.exit(1); });
