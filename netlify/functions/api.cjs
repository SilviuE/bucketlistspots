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

const DISCOUNT_AMOUNT = 50; // £50 / $50 / €50 off the deposit

// ─── Stripe Checkout ──────────────────────────────────────────────────
async function handleStripe(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { routeName, guideName, guideId, price, travelers, depositAmount, guestName, guestEmail, date, currency, referralCode } = reqBody(event);
    const origin = event.headers.origin || event.headers.host || 'https://bucketlistspots.com';

    let finalDeposit = depositAmount;
    let appliedReferral = null;

    // Validate referral code if provided
    if (referralCode) {
      const referrer = await findReferralByCode(referralCode);
      if (referrer) {
        // Prevent self-referral (guides cannot use their own code)
        const referrerGuideId = referrer.role === 'guide' ? referrer.id : null;
        if (referrerGuideId !== guideId) {
          const discountCents = DISCOUNT_AMOUNT * 100;
          const depositCents = depositAmount * 100;
          finalDeposit = Math.max(0, (depositCents - discountCents)) / 100;
          appliedReferral = { code: referralCode, referrerUserId: referrer.user_id || referrer.id, discountAmount: DISCOUNT_AMOUNT };
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
    const { code, currentGuideId } = reqBody(event);
    if (!code) return json({ valid: false, error: 'No code provided' });

    const referrer = await findReferralByCode(code.toUpperCase());
    if (!referrer) return json({ valid: false, error: 'Invalid referral code' });

    // Prevent self-referral (only for guides)
    if (referrer.role === 'guide' && referrer.id === currentGuideId) {
      return json({ valid: false, error: 'Cannot use your own referral code' });
    }

    return json({
      valid: true,
      discountAmount: DISCOUNT_AMOUNT,
      referrerName: referrer.trading_name || referrer.name || 'Referrer',
      referrerRole: referrer.role,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /api/confirm-payment — credit BLS Points after successful payment + ambassador commission
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
    const discountAmount = parseInt(meta.discountAmount || '0');

    const sr = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: 'public' },
    });

    const results = {};

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
        // Use the actual amount charged to Stripe as the basis
        const amountCharged = (session.amount_total || 0) / 100;
        const commissionAmount = Math.round(amountCharged * AMBASSADOR_COMMISSION_RATE * 100) / 100;

        if (commissionAmount > 0) {
          const ambassadorId = guideRecord.referred_by_ambassador_id;

          // Credit ambassador via transactions table
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

    if (!results.referral && !results.ambassadorCommission) {
      return json({ credited: false, reason: 'No referral or ambassador commission to process' });
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

    // Enrich with JustGiving details if available
    const enriched = [];
    for (const c of (charities || [])) {
      try {
        const details = await getCharity(c.charity_api_id);
        enriched.push({ ...c, justgiving: details });
      } catch {
        enriched.push({ ...c, justgiving: null });
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
    default:
      return json({ error: 'Not found' }, 404);
  }
};
