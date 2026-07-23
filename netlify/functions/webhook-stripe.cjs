// ─── Stripe Webhook: checkout.session.completed ─────────────────────
// Separate Netlify function (NOT under /api/*) to avoid the blanket
// customer-facing IP rate limiter. Stripe webhook delivery must not
// be throttled. Signature verification remains mandatory.
//
// Architecture:
//   1. Verify Stripe signature (mandatory, returns 400 on failure)
//   2. Insert event into webhook_event_inbox (ON CONFLICT DO NOTHING)
//   3. If new event → process fulfilment atomically
//   4. If duplicate → return 200 OK immediately
//   5. Return 200 promptly to Stripe (within timeout)
//
// Idempotency:
//   - webhook_event_inbox: event_id PRIMARY KEY (Stripe event ID)
//   - terms_acceptance: session_id UNIQUE, ON CONFLICT DO NOTHING
//   - payment_reports: session_id UNIQUE, ON CONFLICT DO NOTHING
//   - booking_confirmations: session_id UNIQUE, ON CONFLICT DO NOTHING
//   - transactions: idempotency_key UNIQUE, ON CONFLICT DO NOTHING
//
// Retry policy (documented):
//   - Stripe retries failed webhooks with exponential backoff (up to 3 days)
//   - Our handler returns 200 early for duplicates; only 500 for true failures
//   - Failed events are recorded in webhook_event_inbox with status='failed'
//   - Manual retry: re-trigger from Stripe Dashboard or call fulfilment directly
//   - Alerting: console.error logs are captured by Netlify function logs

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const AMBASSADOR_COMMISSION_RATE = 0.05;

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret === 'whsec_REPLACE_ME_AFTER_STRIPE_DASHBOARD_CONFIGURATION') {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return json({ error: 'Webhook not configured' }, 500);
  }

  // ─── STEP 1: Verify Stripe signature (mandatory) ─────────────────
  let stripeEvent;
  try {
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    if (!sig) return json({ error: 'Missing Stripe signature' }, 400);
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (sigErr) {
    console.error('[Webhook] Signature verification failed:', sigErr.message);
    return json({ error: 'Invalid signature' }, 400);
  }

  const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });

  // ─── STEP 2: Record event in inbox (ON CONFLICT = idempotency gate) ─
  const eventId = stripeEvent.id;
  const eventType = stripeEvent.type;
  const session = stripeEvent.data.object;
  const sessionId = session.id;

  try {
    const { error: inboxErr } = await sr.from('webhook_event_inbox').insert({
      event_id: eventId,
      event_type: eventType,
      stripe_session_id: sessionId,
      payload: stripeEvent,
      status: 'received',
    });

    if (inboxErr) {
      // Unique violation = duplicate event → already processed or processing
      if (inboxErr.code === '23505') {
        console.log(`[Webhook] Duplicate event ${eventId}, skipping`);
        return json({ ok: true, duplicate: true, eventId });
      }
      console.error('[Webhook] Inbox insert error:', inboxErr.message);
      return json({ error: 'Failed to record event' }, 500);
    }
  } catch (inboxEx) {
    console.error('[Webhook] Inbox error:', inboxEx.message);
    return json({ error: 'Failed to record event' }, 500);
  }

  // ─── STEP 3: Acknowledge receipt immediately ─────────────────────
  // Return 200 to Stripe NOW to prevent timeout retries.
  // Fulfilment runs below; if it fails, the event is marked 'failed'
  // in the inbox and can be retried.

  // ─── STEP 4: Process event type ─────────────────────────────────
  if (eventType !== 'checkout.session.completed') {
    await sr.from('webhook_event_inbox')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    return json({ ok: true, ignored: eventType, eventId });
  }

  // Verify payment status
  if (session.payment_status !== 'paid') {
    await sr.from('webhook_event_inbox')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
    console.log(`[Webhook] Session ${sessionId} payment_status=${session.payment_status}, no fulfilment needed`);
    return json({ ok: true, skipped: 'not_paid', payment_status: session.payment_status, eventId });
  }

  const meta = session.metadata || {};
  const fulfilmentErrors = [];

  // ─── 5a. Persist booking confirmation (ON CONFLICT DO NOTHING) ───
  try {
    const { error: bookingErr } = await sr.from('booking_confirmations').insert({
      session_id: sessionId,
      booking_ref: meta.bookingRef || '',
      guide_id: meta.guideId || '',
      guide_name: meta.guideName || null,
      route_name: meta.routeName || '',
      guest_email: meta.guestEmail || null,
      guest_name: meta.guestName || null,
      departure_date: meta.date || null,
      deposit_amount: parseFloat(meta.presentmentAmount || '0'),
      currency: (meta.presentmentCurrency || 'usd').toLowerCase(),
      total_travelers: parseInt(meta.travelers) || 1,
      payment_status: 'paid',
      stripe_payment_intent: session.payment_intent || null,
      gross_platform_fee: parseFloat(meta.grossPlatformFee || '0'),
      referral_code: meta.referralCode || null,
      referral_discount_amount: parseFloat(meta.discountAmount || '0'),
      terms_version: meta.termsVersion || null,
      disclosure_version: meta.disclosureVersion || null,
    });
    if (bookingErr) {
      if (bookingErr.code !== '23505') { // Not unique violation
        console.error('[Webhook] booking_confirmations insert error:', bookingErr.message);
        fulfilmentErrors.push('booking_confirmation: ' + bookingErr.message);
      }
    }
  } catch (ex) {
    console.error('[Webhook] booking_confirmations error:', ex.message);
    fulfilmentErrors.push('booking_confirmation: ' + ex.message);
  }

  // ─── 5b. Persist terms acceptance (ON CONFLICT DO NOTHING) ───────
  try {
    const termsVersion = meta.termsVersion;
    const bookingRef = meta.bookingRef;

    if (termsVersion && bookingRef) {
      const { error: termsErr } = await sr.from('terms_acceptance').insert({
        session_id: sessionId,
        guest_email: meta.guestEmail || null,
        guest_name: meta.guestName || null,
        guide_id: meta.guideId || null,
        route_name: meta.routeName || null,
        booking_ref: bookingRef,
        departure_date: meta.date || null,
        deposit_amount: parseFloat(meta.presentmentAmount || '0'),
        currency: (meta.presentmentCurrency || 'usd').toLowerCase(),
        confirmed_checkbox: true,
        insurance_confirmed_checkbox: true,
        terms_version: termsVersion,
        disclosure_version: meta.disclosureVersion || termsVersion,
        client_accepted_at: meta.serverAcceptedAt || new Date().toISOString(),
      });
      if (termsErr) {
        if (termsErr.code !== '23505') { // Not unique violation
          console.error('[Webhook] terms_acceptance insert error:', termsErr.message);
          fulfilmentErrors.push('terms_acceptance: ' + termsErr.message);
        }
      }
    }
  } catch (ex) {
    console.error('[Webhook] terms_acceptance error:', ex.message);
    fulfilmentErrors.push('terms_acceptance: ' + ex.message);
  }

  // ─── 5c. Persist payment report (ON CONFLICT DO NOTHING) ─────────
  try {
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
      if (pi.latest_charge) {
        const charge = await stripe.charges.retrieve(pi.latest_charge);
        if (charge.balance_transaction) {
          const bt = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
          const processingFee = bt.fee_details ? bt.fee_details.filter(f => f.type === 'charge').reduce((s, f) => s + f.amount, 0) / 100 : null;
          const conversionFee = bt.fee_details ? bt.fee_details.filter(f => f.type === 'currency_conversion').reduce((s, f) => s + f.amount, 0) / 100 : null;
          const totalFee = bt.fee / 100;
          const settlementFee = (processingFee !== null && conversionFee !== null) ? Math.round((totalFee - processingFee - conversionFee) * 100) / 100 : null;

          const { error: reportErr } = await sr.from('payment_reports').insert({
            session_id: sessionId,
            guide_id: meta.guideId || null,
            guest_name: meta.guestName || null,
            guest_email: meta.guestEmail || null,
            route_name: meta.routeName || null,
            booking_date: meta.date || null,
            presentment_currency: (meta.presentmentCurrency || 'usd').toLowerCase(),
            presentment_amount: parseFloat(meta.presentmentAmount || '0') || (session.amount_total || 0) / 100,
            settlement_currency: bt.currency,
            settlement_amount: bt.net / 100,
            total_stripe_fee: totalFee,
            net_settlement_amount: bt.net / 100,
            stripe_balance_transaction_id: bt.id,
            stripe_processing_fee: processingFee,
            stripe_conversion_fee: conversionFee,
            stripe_settlement_fee: settlementFee,
            referral_code: meta.referralCode || null,
            referral_discount_amount: parseFloat(meta.discountAmount || '0') || 0,
            gross_platform_fee: parseFloat(meta.grossPlatformFee || '0'),
            platform_fee_pct: parseFloat(meta.platformFeePct || '0.2'),
          });
          if (reportErr) {
            if (reportErr.code !== '23505') {
              console.error('[Webhook] payment_reports insert error:', reportErr.message);
              fulfilmentErrors.push('payment_report: ' + reportErr.message);
            }
          }
        }
      }
    }
  } catch (ex) {
    console.error('[Webhook] payment_reports error:', ex.message);
    fulfilmentErrors.push('payment_report: ' + ex.message);
  }

  // ─── 5d. Referral rewards (idempotency_key ON CONFLICT) ──────────
  try {
    const referralCode = meta.referralCode;
    const referrerUserId = meta.referrerUserId;
    const discountAmount = parseFloat(meta.discountAmount || '0');

    if (referralCode && referrerUserId && discountAmount > 0) {
      const idempotencyKey = `referral_${sessionId}`;
      const referrerGuideId = meta.guideId; // the guide being booked
      const referrerName = meta.guestName || 'a traveller';
      const routeName = meta.routeName || 'a trip';
      const guideName = meta.guideName || 'a guide';

      const { data: rpcResult, error: rpcErr } = await sr.rpc('credit_referral_reward', {
        p_session_id: sessionId,
        p_user_id: referrerUserId,
        p_amount: discountAmount,
        p_reason: `Referral bonus: ${referrerName} booked ${routeName} with ${guideName}`,
        p_referral_code: referralCode,
        p_idempotency_key: idempotencyKey,
      });

      if (rpcErr) {
        console.error('[Webhook] referral RPC error:', rpcErr.message);
        fulfilmentErrors.push('referral_reward: ' + rpcErr.message);
      }
    }
  } catch (ex) {
    console.error('[Webhook] referral error:', ex.message);
    fulfilmentErrors.push('referral_reward: ' + ex.message);
  }

  // ─── 5e. Ambassador commission (idempotency_key ON CONFLICT) ─────
  try {
    const guideId = meta.guideId;
    if (guideId) {
      const { data: guideRecord } = await sr.from('guides')
        .select('id, referred_by_ambassador_id, name')
        .eq('id', guideId)
        .maybeSingle();

      if (guideRecord?.referred_by_ambassador_id) {
        const amountCharged = (session.amount_total || 0) / 100;
        const commissionAmount = Math.round(amountCharged * AMBASSADOR_COMMISSION_RATE * 100) / 100;

        if (commissionAmount > 0) {
          const idempotencyKey = `ambassador_${sessionId}`;
          const { data: rpcResult, error: rpcErr } = await sr.rpc('credit_ambassador_commission', {
            p_session_id: sessionId,
            p_ambassador_id: guideRecord.referred_by_ambassador_id,
            p_amount: commissionAmount,
            p_reason: `Ambassador commission (5%): ${meta.guestName || 'a traveller'} booked ${meta.routeName || 'a trip'} with guide ${guideRecord.name || guideId}`,
            p_idempotency_key: idempotencyKey,
          });

          if (rpcErr) {
            console.error('[Webhook] ambassador commission RPC error:', rpcErr.message);
            fulfilmentErrors.push('ambassador_commission: ' + rpcErr.message);
          }
        }
      }
    }
  } catch (ex) {
    console.error('[Webhook] ambassador commission error:', ex.message);
    fulfilmentErrors.push('ambassador_commission: ' + ex.message);
  }

  // ─── STEP 6: Update inbox status ─────────────────────────────────
  if (fulfilmentErrors.length > 0) {
    await sr.from('webhook_event_inbox')
      .update({
        status: 'failed',
        error_message: fulfilmentErrors.join('; '),
        processed_at: new Date().toISOString(),
      })
      .eq('event_id', eventId);

    console.error(`[Webhook] Fulfilment partial failure for ${eventId}:`, fulfilmentErrors);
    // Still return 200 to Stripe to prevent infinite retries for partial failures.
    // The event is marked 'failed' in the inbox for manual review/retry.
    return json({ ok: true, partial_failure: true, errors: fulfilmentErrors, eventId });
  }

  await sr.from('webhook_event_inbox')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  console.log(`[Webhook] Fulfilment complete for session ${sessionId} (event ${eventId})`);
  return json({ ok: true, eventId });
};

// ─── Retry Policy (documented) ───────────────────────────────────
// 1. Stripe retries: exponential backoff, up to 3 days, ~15 attempts
// 2. Duplicate protection: webhook_event_inbox.event_id UNIQUE prevents reprocessing
// 3. Partial failures: recorded as status='failed' in inbox with error_message
// 4. Manual retry: via Stripe Dashboard webhook resend, or direct RPC calls
// 5. Alerting: console.error captured by Netlify function logs + any configured alerts
// 6. Monitoring: query webhook_event_inbox WHERE status IN ('failed', 'received')
