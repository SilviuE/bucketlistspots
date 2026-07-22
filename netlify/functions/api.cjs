const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

function headers(cors) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': cors ? 'Content-Type,Authorization' : 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function json(body, status = 200) {
  return { statusCode: status, headers: headers(true), body: JSON.stringify(body) };
}

function reqBody(event) {
  return JSON.parse(event.body);
}

function jwtDecode(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role || payload.app_metadata?.role,
      user_metadata: payload.user_metadata || {},
      app_metadata: payload.app_metadata || {},
    };
  } catch { return null; }
}

async function authUser(event) {
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const user = jwtDecode(token);
  if (!user) return { user: null, error: new Error('Invalid token'), supabase: null };
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { user, error: null, supabase };
}

// ─── Pricing Engine (Spec v1.4) ───────────────────────────────────────
// Configurable flat referral discounts per currency
const REFERRAL_FLAT_DISCOUNT = { gbp: 50, eur: 50, usd: 50 };
const REFERRAL_DISCOUNT_CAP_PCT = 0.15; // 15% of gross BLS Platform Fee

// Platform config cache (refreshed every 5 minutes from DB)
let _platformConfig = null;
let _platformConfigAt = 0;
const CONFIG_CACHE_MS = 5 * 60 * 1000;

async function getPlatformConfig() {
  const now = Date.now();
  if (_platformConfig && (now - _platformConfigAt) < CONFIG_CACHE_MS) return _platformConfig;
  try {
    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const { data } = await sr.from('platform_config').select('*').eq('id', 1).maybeSingle();
    if (data) {
      _platformConfig = data;
      _platformConfigAt = now;
    }
  } catch (err) {
    console.error('Failed to load platform_config:', err.message);
  }
  // Fallback to defaults if table doesn't exist yet or query fails
  if (!_platformConfig) {
    _platformConfig = {
      promotional_commission_pct: 0.20,
      standard_commission_pct: 0.18,
      promotional_start_date: new Date().toISOString(),
      promotional_end_date: null,
      saas_monthly_fee_gbp: 50,
      referral_program_enabled: true,
      charity_challenges_enabled: true,
    };
    _platformConfigAt = now;
  }
  return _platformConfig;
}

async function getCurrentPlatformFeePct() {
  const config = await getPlatformConfig();
  const now = new Date();
  const promoEnd = config.promotional_end_date ? new Date(config.promotional_end_date) : null;
  // If no end date set, or we're still within the promotional period
  if (!promoEnd || now < promoEnd) {
    return Number(config.promotional_commission_pct);
  }
  return Number(config.standard_commission_pct);
}

function roundCurrency(amount, currency) {
  // Round to 2 decimal places (minor units handled at Stripe level)
  return Math.round(amount * 100) / 100;
}

function calculateReferralDiscount({ currency, grossPlatformFee, eligiblePlatformFeeRemaining }) {
  const cur = (currency || 'usd').toLowerCase();
  const flatDiscount = REFERRAL_FLAT_DISCOUNT[cur] || REFERRAL_FLAT_DISCOUNT.usd;
  const percentageCap = roundCurrency(grossPlatformFee * REFERRAL_DISCOUNT_CAP_PCT, cur);
  const cap = eligiblePlatformFeeRemaining !== undefined ? eligiblePlatformFeeRemaining : grossPlatformFee;
  return Math.max(0, Math.min(flatDiscount, percentageCap, cap));
}

// ─── Stripe Checkout ──────────────────────────────────────────────────
async function handleStripe(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { routeName, guideName, guideId, price, travelers, depositAmount, guestName, guestEmail, date, currency, referralCode } = reqBody(event);
    const origin = event.headers.origin || event.headers.host || 'https://bucketlistspots.com';
    const platformFeePct = await getCurrentPlatformFeePct();

    let finalDeposit = depositAmount;
    let appliedReferral = null;

    // Validate referral code if provided
    if (referralCode) {
      const referrer = await findReferralByCode(referralCode);
      if (referrer) {
        // Prevent self-referral (guides cannot use their own code)
        const referrerGuideId = referrer.role === 'guide' ? referrer.id : null;
        if (referrerGuideId !== guideId) {
          // Calculate effective discount using pricing engine
          const grossPlatformFee = price * platformFeePct;
          const eligibleRemaining = grossPlatformFee; // Full fee eligible at checkout
          const effectiveDiscount = calculateReferralDiscount({
            currency: currency || 'usd',
            grossPlatformFee,
            eligiblePlatformFeeRemaining: eligibleRemaining,
          });
          const discountCents = Math.round(effectiveDiscount * 100);
          const depositCents = depositAmount * 100;
          finalDeposit = Math.max(0, (depositCents - discountCents)) / 100;
          appliedReferral = { code: referralCode, referrerUserId: referrer.user_id || referrer.id, discountAmount: effectiveDiscount };
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: guestEmail,
      line_items: [{
        price_data: {
          currency: currency || 'usd',
          product_data: {
            name: `${routeName} with ${guideName}`,
            description: `${travelers} traveler(s) · ${date} · 20% deposit`,
          },
          unit_amount: Math.round(finalDeposit * 100),
        },
        quantity: 1,
      }],
      metadata: {
        guideId, guideName, routeName, travelers: String(travelers), guestName, guestEmail, date,
        referralCode: appliedReferral?.code || '',
        referrerUserId: appliedReferral?.referrerUserId || '',
        discountAmount: String(appliedReferral?.discountAmount || 0),
        presentmentCurrency: (currency || 'usd').toLowerCase(),
        presentmentAmount: String(finalDeposit),
        grossPlatformFee: String(price * platformFeePct),
        platformFeePct: String(platformFeePct),
      },
      success_url: `${origin}/checkout/${guideId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${guideId}?payment=cancel`,
    });

    return json({ url: session.url, depositAmount: finalDeposit, discountAmount: appliedReferral?.discountAmount || 0 });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// Helper: find a user by referral code (checks guides, then users)
async function findReferralByCode(code) {
  const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
  // Check guides first
  const { data: guide } = await sr.from('guides').select('id, user_id, trading_name, bls_points_balance').eq('referral_code', code).maybeSingle();
  if (guide) return { ...guide, role: 'guide' };
  // Then check users (ambassadors)
  const { data: user } = await sr.from('users').select('id, name, bls_points_balance, role').eq('referral_code', code).maybeSingle();
  if (user) return { ...user, role: user.role };
  return null;
}

// POST /api/validate-referral
async function handleValidateReferral(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { code, currentGuideId, price, currency } = reqBody(event);
    if (!code) return json({ valid: false, error: 'No code provided' });

    const referrer = await findReferralByCode(code.toUpperCase());
    if (!referrer) return json({ valid: false, error: 'Invalid referral code' });

    // Prevent self-referral (only for guides)
    if (referrer.role === 'guide' && referrer.id === currentGuideId) {
      return json({ valid: false, error: 'Cannot use your own referral code' });
    }

    const cur = (currency || 'usd').toLowerCase();
    const advertisedMax = REFERRAL_FLAT_DISCOUNT[cur] || REFERRAL_FLAT_DISCOUNT.usd;
    const platformFeePct = await getCurrentPlatformFeePct();
    const grossPlatformFee = (price || 0) * platformFeePct;
    const percentageCap = roundCurrency(grossPlatformFee * REFERRAL_DISCOUNT_CAP_PCT, cur);
    const effectiveDiscount = calculateReferralDiscount({
      currency: cur,
      grossPlatformFee,
      eligiblePlatformFeeRemaining: grossPlatformFee,
    });

    return json({
      valid: true,
      code: code.toUpperCase(),
      currency: cur,
      platformFeePct,
      advertisedMaximumDiscount: advertisedMax,
      percentageCap: REFERRAL_DISCOUNT_CAP_PCT,
      percentageCapAmount: percentageCap,
      effectiveDiscount,
      appliesTo: 'platform_fee_balance',
      localPartnerBalanceAffected: false,
      referrerName: referrer.trading_name || referrer.name || 'Referrer',
      referrerRole: referrer.role,
      // Legacy field for backwards compat
      discountAmount: effectiveDiscount,
      message: effectiveDiscount < advertisedMax
        ? `Your code gives you ${cur === 'gbp' ? '£' : cur === 'eur' ? '€' : '$'}${effectiveDiscount} off this booking.`
        : `Your code gives you up to ${cur === 'gbp' ? '£' : cur === 'eur' ? '€' : '$'}${advertisedMax} off this booking.`,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/confirm-payment — credit BLS Points after successful payment + ambassador commission + persist financial data
const AMBASSADOR_COMMISSION_RATE = 0.05; // 5% lifetime commission

async function handleConfirmPayment(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { sessionId } = reqBody(event);
    if (!sessionId) return json({ error: 'Missing session_id' }, 400);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata || {};
    const referralCode = meta.referralCode;
    const referrerUserId = meta.referrerUserId;
    const discountAmount = parseFloat(meta.discountAmount || '0');
    const presentmentCurrency = (meta.presentmentCurrency || 'usd').toLowerCase();

    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: 'public' },
    });

    const results = {};

    // ─── Stripe Financial Data ──────────────────────────────────────
    // Retrieve balance transaction for accurate fee data
    let stripeFinancialData = null;
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
            // Settlement fee = total fee - processing fee - conversion fee
            const settlementFee = (processingFee !== null && conversionFee !== null) ? Math.round((totalFee - processingFee - conversionFee) * 100) / 100 : null;

            stripeFinancialData = {
              session_id: sessionId,
              guide_id: meta.guideId || null,
              guest_name: meta.guestName || null,
              guest_email: meta.guestEmail || null,
              route_name: meta.routeName || null,
              booking_date: meta.date || null,
              presentment_currency: presentmentCurrency,
              presentment_amount: parseFloat(meta.presentmentAmount || '0') || (session.amount_total || 0) / 100,
              settlement_currency: bt.currency,
              settlement_amount: bt.net / 100,
              total_stripe_fee: totalFee,
              net_settlement_amount: bt.net / 100,
              stripe_balance_transaction_id: bt.id,
              stripe_processing_fee: processingFee,
              stripe_conversion_fee: conversionFee,
              stripe_settlement_fee: settlementFee,
              referral_code: referralCode || null,
              referral_discount_amount: discountAmount || 0,
              gross_platform_fee: parseFloat(meta.grossPlatformFee || '0'),
              platform_fee_pct: parseFloat(meta.platformFeePct || '0.2'),
            };
          }
        }
      }
    } catch (stripeErr) {
      console.error('Could not retrieve Stripe balance transaction:', stripeErr.message);
    }

    // ─── Persist financial data to payment_reports table ─────────────
    if (stripeFinancialData) {
      try {
        const { error: insertErr } = await sr.from('payment_reports').insert(stripeFinancialData);
        if (insertErr) console.error('Failed to persist payment report:', insertErr.message);
        results.stripeFinancials = stripeFinancialData;
      } catch (insertEx) {
        console.error('payment_reports insert error:', insertEx.message);
      }
    }

    // ─── Traveller Referral Points ───────────────────────────────────
    if (referralCode && referrerUserId && discountAmount > 0) {
      const { data: guide } = await sr.from('guides').select('id, bls_points_balance').eq('referral_code', referralCode).maybeSingle();
      const { data: userRec } = await sr.from('users').select('id, bls_points_balance').eq('referral_code', referralCode).maybeSingle();

      const isGuide = !!guide;
      const targetTable = isGuide ? 'guides' : 'users';
      const record = isGuide ? guide : userRec;
      if (record) {
        const pointsToCredit = discountAmount;
        const newBalance = (record.bls_points_balance || 0) + pointsToCredit;
        await sr.from(targetTable).update({ bls_points_balance: newBalance }).eq('id', record.id);
        await sr.from('transactions').insert({
          user_id: referrerUserId,
          amount: pointsToCredit,
          type: 'credit',
          reason: `Referral bonus: ${meta.guestName || 'a traveller'} booked ${meta.routeName || 'a trip'} with ${meta.guideName || 'a guide'}`,
          linked_referral_code: referralCode,
          linked_booking_id: sessionId,
        });
        results.referral = { credited: true, pointsAdded: pointsToCredit, newBalance };
      }
    }

    // ─── Ambassador 5% Lifetime Commission ──────────────────────────
    const guideId = meta.guideId;
    if (guideId) {
      const { data: guideRecord } = await sr.from('guides')
        .select('id, referred_by_ambassador_id, bls_points_balance, name')
        .eq('id', guideId)
        .maybeSingle();

      if (guideRecord?.referred_by_ambassador_id) {
        const amountCharged = (session.amount_total || 0) / 100;
        const commissionAmount = Math.round(amountCharged * AMBASSADOR_COMMISSION_RATE * 100) / 100;

        if (commissionAmount > 0) {
          const ambassadorId = guideRecord.referred_by_ambassador_id;
          await sr.from('transactions').insert({
            user_id: ambassadorId,
            amount: commissionAmount,
            type: 'credit',
            reason: `Ambassador commission (5%): ${meta.guestName || 'a traveller'} booked ${meta.routeName || 'a trip'} with guide ${guideRecord.name || guideId}`,
            linked_booking_id: sessionId,
          });
          results.ambassadorCommission = { credited: true, amount: commissionAmount, ambassadorId };
        }
      }
    }

    return json(results);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// GET /api/rewards — fetch balance + transaction history
async function handleRewards(event) {
  const { user, error: authErr, supabase: sr } = await authUser(event);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Get balance from guides or users table
  const isGuide = user.role === 'guide';
  const table = isGuide ? 'guides' : 'users';
  const filterField = isGuide ? 'user_id' : 'id';
  const { data: profile } = await sr.from(table).select('referral_code, bls_points_balance, trading_name, name').eq(filterField, user.id).maybeSingle();
  if (!profile) return json({ error: 'Profile not found' }, 404);

  // Get transaction history
  const { data: transactions } = await sr.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);

  // Auto-generate referral code if missing
  let referralCode = profile.referral_code;
  if (!referralCode) {
    referralCode = await generateReferralCode(user, table, isGuide ? profile.trading_name : profile.name, sr);
    await sr.from(table).update({ referral_code: referralCode }).eq(filterField, user.id);
  }

  return json({
    referralCode,
    balance: profile.bls_points_balance || 0,
    transactions: transactions || [],
  });
}

// Generate a unique referral code
async function generateReferralCode(user, table, name, sr) {
  const prefix = (name || user.email || 'USER').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5);
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = String(Math.floor(10 + Math.random() * 90));
    const code = `${prefix}${suffix}`;
    const { data: existing } = await sr.from(table).select('id').eq('referral_code', code).maybeSingle();
    if (!existing) return code;
  }
  // Fallback: use timestamp
  return `${prefix}${Date.now() % 10000}`;
}

// ─── Guide Application ────────────────────────────────────────────────
async function handleApplyGuide(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { fullName, email, phone, country, experience, languages, specialties, message, heardFrom, referredByAmbassadorCode } = reqBody(event);
    if (!fullName || !email || !phone || !country) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const { error: dbError } = await supabase.from('guide_applications').insert({
      full_name: fullName, email, phone, country,
      experience: parseInt(experience) || 0, languages, specialties,
      message, heard_from: heardFrom, status: 'pending',
      referred_by_ambassador_code: referredByAmbassadorCode || null,
    });
    if (dbError) throw dbError;

    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      const html = `<h2>New Guide Application</h2><table style="border-collapse:collapse;width:100%">${
        [['Name', fullName], ['Email', email], ['Phone', phone], ['Country', country],
         ['Experience', experience + ' years'], ['Languages', languages],
         ['Specialties', specialties], ['Heard From', heardFrom],
         ['Message', message]].map(([k, v]) =>
          `<tr style="border:1px solid #ddd"><td style="padding:8px;font-weight:700">${k}</td><td style="padding:8px">${v || '—'}</td></tr>`
        ).join('')}</table><p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BucketListSpots <notifications@bucketlistspots.com>',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `New Guide Application: ${fullName} from ${country}`,
          html,
        }),
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('apply-guide error:', err);
    return json({ error: err.message }, 500);
  }
}

// ─── Ambassador Application ───────────────────────────────────────────
async function handleApplyAmbassador(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { fullName, email, phone, country, platform, handle, followers, niche, whyYou, heardFrom } = reqBody(event);
    if (!fullName || !email || !platform || !handle) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const { error: dbError } = await supabase.from('ambassador_applications').insert({
      full_name: fullName, email, phone, country, platform, handle,
      followers: parseInt(followers) || 0, niche, why_you: whyYou,
      heard_from: heardFrom, status: 'pending',
    });
    if (dbError) throw dbError;

    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      const html = `<h2>New Ambassador Application</h2><table style="border-collapse:collapse;width:100%">${
        [['Name', fullName], ['Email', email], ['Phone', phone], ['Country', country],
         ['Platform', platform], ['Handle', handle], ['Followers', followers],
         ['Niche', niche], ['Why', whyYou], ['Heard From', heardFrom]].map(([k, v]) =>
          `<tr style="border:1px solid #ddd"><td style="padding:8px;font-weight:700">${k}</td><td style="padding:8px">${v || '—'}</td></tr>`
        ).join('')}</table><p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BucketListSpots <notifications@bucketlistspots.com>',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `New Ambassador: ${fullName} (${platform}, ${followers} followers)`,
          html,
        }),
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('apply-ambassador error:', err);
    return json({ error: err.message }, 500);
  }
}

// ─── Admin Applications ───────────────────────────────────────────────
async function handleApplications(event) {
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const decoded = jwtDecode(token);
  if (!decoded || !decoded.id) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  const { data: userRecord } = await supabase.from('users').select('role').eq('id', decoded.id).maybeSingle();
  const adminRole = userRecord?.role || decoded.role;
  if (adminRole !== 'admin') return json({ error: `Forbidden: admin access required (role: "${adminRole}")` }, 403);

  if (event.httpMethod === 'GET') {
    const type = event.queryStringParameters?.type || new URL(event.url, 'http://localhost').searchParams.get('type') || 'all';

    const fetchTable = async (table, typeLabel) => {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({ ...r, _type: typeLabel }));
    };

    try {
      let results = [];
      if (type === 'all' || type === 'guide') {
        results = results.concat(await fetchTable('guide_applications', 'guide'));
      }
      if (type === 'all' || type === 'ambassador') {
        results = results.concat(await fetchTable('ambassador_applications', 'ambassador'));
      }
      if (type === 'all' || type === 'pending-guide') {
        const { data, error } = await supabase.from('guides').select('*').in('status', ['pending', 'draft']).order('updated_at', { ascending: false });
        if (!error) {
          results = results.concat((data || []).map(r => ({ ...r, _type: 'pending-guide' })));
        }
      }
      results.sort((a, b) => new Date(b.created_at || b.updated_at) - new Date(a.created_at || a.updated_at));
      return json(results);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }

  if (event.httpMethod === 'PATCH') {
    const { id, status, type } = reqBody(event);
    if (!id) return json({ error: 'Missing id' }, 400);

    if (type === 'pending-guide') {
      if (!['published', 'draft'].includes(status)) {
        return json({ error: 'Invalid status for guide' }, 400);
      }
      const { data, error } = await supabase.from('guides').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ ...data, _type: 'pending-guide' });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return json({ error: 'Invalid status' }, 400);
    }
    const table = type === 'ambassador' ? 'ambassador_applications' : 'guide_applications';
    const { data, error } = await supabase.from(table).update({ status }).eq('id', id).select().single();
    if (error) return json({ error: error.message }, 500);

    if (data?.email) {
      const targetRole = status === 'approved' ? (type === 'ambassador' ? 'ambassador' : 'guide') : 'traveller';
      await supabase.from('users').update({ role: targetRole }).eq('email', data.email);
      // Also update app_metadata so existing sessions get the new role
      try {
        const { data: userRecord } = await supabase.from('users').select('id').eq('email', data.email).maybeSingle();
        if (userRecord?.id) {
          const adminClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await adminClient.auth.admin.updateUserById(userRecord.id, { app_metadata: { role: targetRole } });
        }
      } catch (e) {
        console.error('Failed to update app_metadata:', e.message);
      }
    }

    return json(data);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Guide Profile ────────────────────────────────────────────────────
async function handleGuideProfile(event) {
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const user = jwtDecode(token);
  if (!user || !user.id) return json({ error: 'Unauthorized' }, 401);
  if (user.role !== 'guide') return json({ error: `Guide access required (role: "${user.role}")` }, 403);

  const method = event.httpMethod;
  const rawPath = event.path || '';
  const path = rawPath.replace(/^.*?\/guide-profile\/?/, '').split('/').filter(Boolean);

  const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });

  // GET — fetch my profile + routes
  if (method === 'GET') {
    const { data: guide, error } = await sr.from('guides').select('*').eq('user_id', user.id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json(guide || null);
  }

  // PUT — create or update profile
  if (method === 'PUT') {
    const body = reqBody(event);
    const allowed = ['trading_name', 'photo', 'hero_image', 'bio', 'why_independent', 'location',
      'languages', 'experience', 'certifications', 'promise', 'badge', 'price', 'price_currency', 'status'];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const { data: existing } = await sr.from('guides').select('id').eq('user_id', user.id).maybeSingle();

    if (existing) {
      updates.updated_at = new Date().toISOString();
      const { data, error } = await sr.from('guides').update(updates).eq('user_id', user.id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(data);
    } else {
      updates.user_id = user.id;
      updates.status = 'draft';
      updates.id = user.id.replace(/-/g, '').slice(0, 12);
      updates.name = updates.trading_name || user.email?.split('@')[0] || 'Guide';

      // Auto-link ambassador if this guide was referred via an ambassador code
      if (!updates.referred_by_ambassador_id) {
        try {
          const { data: app } = await sr.from('guide_applications')
            .select('referred_by_ambassador_code')
            .eq('email', user.email)
            .not('referred_by_ambassador_code', 'is', null)
            .maybeSingle();
          if (app?.referred_by_ambassador_code) {
            const { data: ambassador } = await sr.from('users')
              .select('id')
              .eq('referral_code', app.referred_by_ambassador_code)
              .maybeSingle();
            if (ambassador) {
              updates.referred_by_ambassador_id = ambassador.id;
            }
          }
        } catch (e) {
          console.error('Ambassador link failed:', e.message);
        }
      }

      const { data, error } = await sr.from('guides').insert(updates).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(data, 201);
    }
  }

  // POST /routes — add a route
  if (method === 'POST' && path[0] === 'routes') {
    const body = reqBody(event);
    const { data: guide } = await sr.from('guides').select('routes').eq('user_id', user.id).maybeSingle();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);
    const routes = guide.routes || [];
    routes.push({ id: 'rt_' + Date.now(), name: body.name, days: body.days || 1, difficulty: body.difficulty || 'Moderate', price: body.price || 0, description: body.description || '', image: body.image || '' });
    const { data, error } = await sr.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // PUT /routes/:id — update a route
  if (method === 'PUT' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const body = reqBody(event);
    const { data: guide } = await sr.from('guides').select('routes').eq('user_id', user.id).maybeSingle();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);
    const routes = (guide.routes || []).map(r => r.id === routeId ? { ...r, ...body, id: routeId } : r);
    const { data, error } = await sr.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // DELETE /routes/:id — delete a route
  if (method === 'DELETE' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const { data: guide } = await sr.from('guides').select('routes').eq('user_id', user.id).maybeSingle();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);
    const routes = (guide.routes || []).filter(r => r.id !== routeId);
    const { data, error } = await sr.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // POST /submit — submit for admin review
  if (method === 'POST' && path[0] === 'submit') {
    const { data: existing } = await sr.from('guides').select('*').eq('user_id', user.id).maybeSingle();
    if (!existing) return json({ error: 'Guide profile not found' }, 404);
    if (existing.status === 'published') return json({ error: 'Already published' }, 400);
    const { error: updErr } = await sr.from('guides').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (updErr) return json({ error: updErr.message }, 500);
    const { data, error: fetchErr } = await sr.from('guides').select('*').eq('user_id', user.id).maybeSingle();
    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!data || data.status !== 'pending') return json({ error: 'Status not updated' }, 500);

    try {
      if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
        const html = `<h2>Guide Profile Ready for Review</h2><p><strong>${existing.trading_name || 'Unnamed Guide'}</strong> has submitted their profile.</p><table style="border-collapse:collapse;width:100%">${
          [['Name', existing.trading_name], ['Location', existing.location],
           ['Price', existing.price ? '$' + existing.price : '—'],
           ['Languages', Array.isArray(existing.languages) ? existing.languages.join(', ') : existing.languages],
           ['Experience', existing.experience + ' years'],
           ['Routes', (existing.routes || []).length]].map(([k, v]) =>
            `<tr style="border:1px solid #ddd"><td style="padding:6px;font-weight:700">${k}</td><td style="padding:6px">${v || '—'}</td></tr>`
          ).join('')}</table><p><a href="https://bucketlistspots.com/admin/applications" style="background:#2A9D8F;color:#FFF;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">Review in Dashboard</a></p><p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>`;
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'BucketListSpots <notifications@bucketlistspots.com>',
            to: process.env.NOTIFICATION_EMAIL,
            subject: `Guide Profile Ready: ${existing.trading_name || 'Unnamed Guide'} submitted for review`,
            html,
          }),
        });
      }
    } catch (mailErr) { console.error('Email send failed:', mailErr); }

    return json(data);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Debug Auth ───────────────────────────────────────────────────────
async function handleDebugAuth(event) {
  const { user, error: authErr, supabase } = await authUser(event);
  if (authErr || !user) return json({ error: 'Unauthorized', detail: authErr?.message }, 401);
  const { data: profile, error: profErr } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  const srkSet = !!(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const srkLen = process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0;
  // Try inserting a test row using service role key (should bypass RLS)
  const testId = 'test_' + Date.now();
  const { data: insertTest, error: insertErr } = await supabase.from('guides').insert({ id: testId, user_id: user.id, trading_name: 'test', status: 'draft' }).select().single();
  if (insertErr) {
    // Also try listing existing guides
    const { data: guides, error: listErr } = await supabase.from('guides').select('id').limit(5);
    return json({ userId: user.id, email: user.email, profile, profErr: profErr?.message, serviceRoleKeySet: srkSet, serviceRoleKeyLen: srkLen, insertError: insertErr.message, listError: listErr?.message, guideCount: guides?.length });
  }
  await supabase.from('guides').delete().eq('id', testId);
  return json({ userId: user.id, email: user.email, profile, profErr: profErr?.message, serviceRoleKeySet: srkSet, serviceRoleKeyLen: srkLen, insertTest: 'OK' });
}

// ─── Charity Challenges ───────────────────────────────────────────────
const { getCharity, createFundraisingPage, getFundraisingPage, simulateDonation, MOCK_MODE } = require('./charityProvider.cjs');

// GET /api/charities?destination=kilimanjaro — fetch vetted charities for a destination
async function handleCharities(event) {
  if (event.httpMethod !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const destination = event.queryStringParameters?.destination || new URL(event.url, 'http://localhost').searchParams.get('destination');
    if (!destination) return json({ error: 'Missing destination parameter' }, 400);

    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const { data: charities, error } = await sr
      .from('destination_charities')
      .select('*')
      .eq('destination', destination.toLowerCase())
      .eq('is_active', true);

    if (error) return json({ error: error.message }, 500);

    // Enrich with JustGiving details if available (skip direct-donation charities)
    const enriched = [];
    for (const c of (charities || [])) {
      if (c.charity_api_id === 'KPAP_DIRECT') {
        enriched.push({ ...c, justgiving: null });
      } else {
        try {
          const details = await getCharity(c.charity_api_id);
          enriched.push({ ...c, justgiving: details });
        } catch {
          enriched.push({ ...c, justgiving: null });
        }
      }
    }

    return json({ charities: enriched, mockMode: MOCK_MODE });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/fundraising/create — create a fundraising page for a user's booking
async function handleCreateFundraising(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, error: authErr, supabase: sr } = await authUser(event);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { charityId, charityApiId, charityName, pageTitle, targetAmount, currency, eventDate, bookingId } = reqBody(event);
    if (!charityApiId || !pageTitle || !targetAmount) {
      return json({ error: 'Missing required fields: charityApiId, pageTitle, targetAmount' }, 400);
    }

    // Direct-donation charities (e.g. KPAP) don't have JustGiving pages
    if (charityApiId === 'KPAP_DIRECT') {
      return json({ error: 'This charity accepts direct donations. Please donate via their website.' }, 400);
    }

    // Create page via JustGiving (mock or real)
    const result = await createFundraisingPage({
      charityApiId,
      pageTitle,
      targetAmount: parseFloat(targetAmount),
      currency: currency || 'GBP',
      eventDate,
      userName: user.name || user.email,
    });

    // Save to database
    const { data: saved, error: dbErr } = await sr.from('fundraising_pages').insert({
      user_id: user.id,
      booking_id: bookingId || null,
      charity_id: charityId || null,
      charity_api_id: charityApiId,
      charity_name: charityName || '',
      page_short_name: result.pageShortName,
      page_url: result.pageUrl,
      page_title: pageTitle,
      target_amount: parseFloat(targetAmount),
      currency: currency || 'GBP',
      total_raised: 0,
      event_date: eventDate || null,
      status: 'active',
    }).select().single();

    if (dbErr) return json({ error: dbErr.message }, 500);

    return json({
      id: saved.id,
      pageUrl: result.pageUrl,
      pageShortName: result.pageShortName,
      pageTitle,
      targetAmount: parseFloat(targetAmount),
      currency: currency || 'GBP',
      charityName,
      status: 'active',
    }, 201);
  } catch (err) {
    console.error('create-fundraising error:', err);
    return json({ error: err.message }, 500);
  }
}

// GET /api/fundraising/my — list user's fundraising pages with live progress
async function handleMyFundraising(event) {
  if (event.httpMethod !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, error: authErr, supabase: sr } = await authUser(event);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: pages, error } = await sr
      .from('fundraising_pages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return json({ error: error.message }, 500);

    // Sync progress from JustGiving for each page
    const synced = [];
    for (const page of (pages || [])) {
      try {
        const live = await getFundraisingPage(page.page_short_name);
        if (live) {
          // Update DB with latest progress
          await sr.from('fundraising_pages').update({
            total_raised: live.totalRaised || 0,
            donor_count: live.donorCount || 0,
            last_synced_at: new Date().toISOString(),
          }).eq('id', page.id);

          synced.push({
            ...page,
            total_raised: live.totalRaised || page.total_raised,
            donor_count: live.donorCount || page.donor_count,
            last_synced_at: new Date().toISOString(),
          });
          continue;
        }
      } catch {
        // Sync failed — return DB values
      }
      synced.push(page);
    }

    return json({ pages: synced });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/fundraising/sync — force-sync a single page's progress
async function handleSyncFundraising(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, error: authErr, supabase: sr } = await authUser(event);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { pageId } = reqBody(event);
    if (!pageId) return json({ error: 'Missing pageId' }, 400);

    // Fetch page from DB (must belong to user)
    const { data: page, error: fetchErr } = await sr
      .from('fundraising_pages')
      .select('*')
      .eq('id', pageId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchErr || !page) return json({ error: 'Page not found' }, 404);

    // Sync from JustGiving
    const live = await getFundraisingPage(page.page_short_name);
    if (!live) return json({ error: 'Could not fetch page from JustGiving' }, 502);

    const { error: updErr } = await sr.from('fundraising_pages').update({
      total_raised: live.totalRaised || 0,
      donor_count: live.donorCount || 0,
      last_synced_at: new Date().toISOString(),
    }).eq('id', pageId);

    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      ...page,
      total_raised: live.totalRaised || 0,
      donor_count: live.donorCount || 0,
      last_synced_at: new Date().toISOString(),
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/fundraising/simulate-donation — mock endpoint for testing donations
async function handleSimulateDonation(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!MOCK_MODE) return json({ error: 'Only available in mock mode' }, 400);
  try {
    const { pageShortName, amount, donorName } = reqBody(event);
    if (!pageShortName || !amount) return json({ error: 'Missing pageShortName or amount' }, 400);

    const result = simulateDonation(pageShortName, parseFloat(amount), donorName || 'Anonymous');
    if (!result) return json({ error: 'Page not found' }, 404);

    // Update DB
    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    await sr.from('fundraising_pages').update({
      total_raised: result.totalRaised,
      donor_count: result.donorCount,
      last_synced_at: new Date().toISOString(),
    }).eq('page_short_name', pageShortName);

    return json({ ok: true, totalRaised: result.totalRaised, donorCount: result.donorCount });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/webhooks/charity — JustGiving webhook receiver (optional, for live updates)
async function handleCharityWebhook(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = reqBody(event);
    console.log('[Charity Webhook] Received:', JSON.stringify(body));

    // In production, validate the webhook signature here
    // For now, just acknowledge receipt
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── Posts / News ─────────────────────────────────────────────────────
async function handlePosts(event) {
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let user = null;
  try { user = jwtDecode(token); } catch { /* no auth — fine for GET */ }
  const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  const url = new URL(event.url, 'http://localhost');
  const method = event.httpMethod;
  const path = url.pathname.replace(/^.*?\/api\/posts\/?/, '').split('/').filter(Boolean);
  const postId = path[0];

  // GET /posts — fetch all posts or by user_id
  if (method === 'GET') {
    const userId = url.searchParams.get('user_id');
    const authorRole = url.searchParams.get('author_role');
    let query = sr.from('posts').select('*').order('created_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    if (authorRole) query = query.eq('author_role', authorRole);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  // POST /posts — create a post
  if (method === 'POST') {
    if (!user || !user.id) return json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'guide' && user.role !== 'ambassador') return json({ error: 'Only guides and ambassadors can post' }, 403);
    const body = reqBody(event);
    if (!body.content || body.content.length > 600) return json({ error: 'Content is required and must be 600 characters or less' }, 400);
    // Look up author name
    let authorName = user.email;
    if (user.role === 'guide') {
      const { data: g } = await sr.from('guides').select('trading_name').eq('user_id', user.id).maybeSingle();
      if (g?.trading_name) authorName = g.trading_name;
    }
    console.log('[posts] Inserting:', { id: 'pst_' + Date.now(), user_id: user.id, content: body.content });
    const { data, error } = await sr.from('posts').insert({
      id: 'pst_' + Date.now(),
      user_id: user.id,
      author_role: user.role,
      author_name: authorName,
      content: body.content,
      image_url: body.image_url || null,
      video_url: body.video_url || null,
    }).select().single();
    console.log('[posts] Insert result:', { data, error: error?.message });
    if (error) return json({ error: error.message }, 500);
    return json(data, 201);
  }

  // DELETE /posts/:id — delete own post
  if (method === 'DELETE') {
    if (!user || !user.id) return json({ error: 'Unauthorized' }, 401);
    if (!postId) return json({ error: 'Missing post id' }, 400);
    const { error } = await sr.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

// GET /api/admin/payment-reports — multi-currency payment report (admin-only)
// ?format=csv returns CSV download; default returns JSON
// ?currency=usd filters by presentment currency
// ?from=2026-01-01&to=2026-12-31 filters by date range
async function handleAdminPaymentReports(event) {
  if (event.httpMethod !== 'GET') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = (event.headers.authorization || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    let user;
    try { user = jwtDecode(token); } catch { return json({ error: 'Invalid token' }, 401); }
    if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const url = new URL(event.url, 'http://localhost');
    const format = url.searchParams.get('format') || 'json';
    const currency = url.searchParams.get('currency');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    let query = sr.from('payment_reports').select('*').order('created_at', { ascending: false });
    if (currency) query = query.eq('presentment_currency', currency.toLowerCase());
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to + 'T23:59:59Z');

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    if (format === 'csv') {
      const headers = [
        'session_id', 'guide_id', 'guest_name', 'guest_email', 'route_name', 'booking_date',
        'presentment_currency', 'presentment_amount', 'settlement_currency', 'settlement_amount',
        'total_stripe_fee', 'net_settlement_amount', 'stripe_balance_transaction_id',
        'stripe_processing_fee', 'stripe_conversion_fee', 'stripe_settlement_fee',
        'referral_code', 'referral_discount_amount', 'gross_platform_fee', 'platform_fee_pct', 'created_at',
      ];
      const csvRows = [headers.join(',')];
      for (const row of (data || [])) {
        csvRows.push(headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
      }
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="payment-reports.csv"',
          'Access-Control-Allow-Origin': '*',
        },
        body: csvRows.join('\n'),
      };
    }

    // Summary stats for JSON response
    const summary = {
      totalTransactions: (data || []).length,
      byCurrency: {},
      totalStripeFees: 0,
      totalReferralDiscounts: 0,
    };
    for (const row of (data || [])) {
      const cur = row.presentment_currency || 'usd';
      if (!summary.byCurrency[cur]) {
        summary.byCurrency[cur] = { count: 0, grossAmount: 0, stripeFees: 0, netSettlement: 0, referralDiscounts: 0 };
      }
      summary.byCurrency[cur].count += 1;
      summary.byCurrency[cur].grossAmount += Number(row.presentment_amount) || 0;
      summary.byCurrency[cur].stripeFees += Number(row.total_stripe_fee) || 0;
      summary.byCurrency[cur].netSettlement += Number(row.net_settlement_amount) || 0;
      summary.byCurrency[cur].referralDiscounts += Number(row.referral_discount_amount) || 0;
      summary.totalStripeFees += Number(row.total_stripe_fee) || 0;
      summary.totalReferralDiscounts += Number(row.referral_discount_amount) || 0;
    }

    return json({ reports: data || [], summary });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// GET/PUT /api/admin/platform-config — view/update commission settings (admin-only)
async function handleAdminPlatformConfig(event) {
  try {
    const token = (event.headers.authorization || '').replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    let user;
    try { user = jwtDecode(token); } catch { return json({ error: 'Invalid token' }, 401); }
    if (user.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });

    if (event.httpMethod === 'GET') {
      const { data, error } = await sr.from('platform_config').select('*').eq('id', 1).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      // Add computed fields
      const now = new Date();
      const promoEnd = data?.promotional_end_date ? new Date(data.promotional_end_date) : null;
      const isPromoActive = !promoEnd || now < promoEnd;
      const currentCommissionPct = isPromoActive ? Number(data.promotional_commission_pct) : Number(data.standard_commission_pct);
      return json({
        ...data,
        isPromotionalPeriod: isPromoActive,
        currentCommissionPct,
        daysUntilPromoEnd: promoEnd ? Math.max(0, Math.ceil((promoEnd - now) / (1000 * 60 * 60 * 24))) : null,
      });
    }

    if (event.httpMethod === 'PUT') {
      const body = reqBody(event);
      const allowedFields = [
        'promotional_commission_pct', 'standard_commission_pct',
        'promotional_start_date', 'promotional_end_date',
        'saas_monthly_fee_gbp', 'referral_program_enabled', 'charity_challenges_enabled',
      ];
      const updates = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = body[field];
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await sr.from('platform_config').update(updates).eq('id', 1).select().single();
      if (error) return json({ error: error.message }, 500);
      // Invalidate cache
      _platformConfig = null;
      _platformConfigAt = 0;
      return json(data);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── Main Router ──────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json({ ok: true });

  // event.path can be either the original (/api/...) or the function URL (/.netlify/functions/api/...)
  const p = event.path.replace(/^.*?\/functions\/api\/?/i, '');
  const parts = (p.startsWith('/api/') ? p.replace('/api/', '') : p).split('/').filter(Boolean);
  const route = parts[0] || '';

  switch (route) {
    case 'debug-auth':
      return handleDebugAuth(event);
    case 'create-checkout':
      return handleStripe(event);
    case 'validate-referral':
      return handleValidateReferral(event);
    case 'confirm-payment':
      return handleConfirmPayment(event);
    case 'rewards':
      return handleRewards(event);
    case 'apply-guide':
      return handleApplyGuide(event);
    case 'apply-ambassador':
      return handleApplyAmbassador(event);
    case 'applications':
      return handleApplications(event);
    case 'guide-profile':
      return handleGuideProfile(event);
    case 'posts':
      return handlePosts(event);
    case 'charities':
      return handleCharities(event);
    case 'fundraising':
      // Route sub-paths: /fundraising/my, /fundraising/create, /fundraising/sync, /fundraising/simulate-donation
      const fundPath = (p.startsWith('/api/') ? p.replace('/api/', '') : p).split('/').filter(Boolean);
      const fundAction = fundPath[1] || 'my';
      if (fundAction === 'create') return handleCreateFundraising(event);
      if (fundAction === 'sync') return handleSyncFundraising(event);
      if (fundAction === 'simulate-donation') return handleSimulateDonation(event);
      return handleMyFundraising(event); // default: GET /fundraising/my
    case 'webhooks':
      const webhookPath = (p.startsWith('/api/') ? p.replace('/api/', '') : p).split('/').filter(Boolean);
      if (webhookPath[1] === 'charity') return handleCharityWebhook(event);
      return json({ error: 'Not found' }, 404);
    case 'admin':
      const adminPath = (p.startsWith('/api/') ? p.replace('/api/', '') : p).split('/').filter(Boolean);
      if (adminPath[1] === 'payment-reports') return handleAdminPaymentReports(event);
      if (adminPath[1] === 'platform-config') return handleAdminPlatformConfig(event);
      return json({ error: 'Not found' }, 404);
    default:
      return json({ error: 'Not found' }, 404);
  }
};
