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

async function authUser(event) {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return { user, error, supabase };
}

// ─── Stripe Checkout ──────────────────────────────────────────────────
async function handleStripe(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { routeName, guideName, guideId, price, travelers, depositAmount, guestName, guestEmail, date, currency } = reqBody(event);
    const origin = event.headers.origin || event.headers.host || 'https://bucketlistspots.com';

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
          unit_amount: depositAmount * 100,
        },
        quantity: 1,
      }],
      metadata: { guideId, guideName, routeName, travelers: String(travelers), guestName, guestEmail, date },
      success_url: `${origin}/checkout/${guideId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/${guideId}?payment=cancel`,
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── Guide Application ────────────────────────────────────────────────
async function handleApplyGuide(event) {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { fullName, email, phone, country, experience, languages, specialties, message, heardFrom } = reqBody(event);
    if (!fullName || !email || !phone || !country) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'public' } });
    const { error: dbError } = await supabase.from('guide_applications').insert({
      full_name: fullName, email, phone, country,
      experience: parseInt(experience) || 0, languages, specialties,
      message, heard_from: heardFrom, status: 'pending',
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
  const { user, error: authErr, supabase } = await authUser(event);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const userRole = user.user_metadata?.role || user.app_metadata?.role;
  if (userRole !== 'admin') return json({ error: `Forbidden: role is "${userRole}"` }, 403);

  if (event.httpMethod === 'GET') {
    const type = new URL(event.url, 'http://localhost').searchParams.get('type') || 'all';

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

    if (type !== 'ambassador' && status === 'approved' && data?.email) {
      await supabase.from('users').update({ role: 'guide' }).eq('email', data.email);
    }
    if (type !== 'ambassador' && status === 'rejected' && data?.email) {
      await supabase.from('users').update({ role: 'traveller' }).eq('email', data.email);
    }

    return json(data);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Guide Profile ────────────────────────────────────────────────────
async function handleGuideProfile(event) {
  const { user, error: authErr, supabase } = await authUser(event);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const userRole = user.user_metadata?.role || user.app_metadata?.role;
  if (userRole !== 'guide') return json({ error: `Guide access required (role: "${userRole}")` }, 403);

  const method = event.httpMethod;
  const rawPath = event.path || '';
  const path = rawPath.replace(/^.*?\/guide-profile\/?/, '').split('/').filter(Boolean);

  // GET — fetch my profile + routes
  if (method === 'GET') {
    const { data: guide, error } = await supabase.from('guides').select('*').eq('user_id', user.id).maybeSingle();
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

    const { data: existing } = await supabase.from('guides').select('id').eq('user_id', user.id).maybeSingle();

    if (existing) {
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('guides').update(updates).eq('id', existing.id).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(data);
    } else {
      updates.user_id = user.id;
      updates.status = 'draft';
      updates.id = user.id.replace(/-/g, '').slice(0, 12);
      const { data, error } = await supabase.from('guides').insert(updates).select().single();
      if (error) return json({ error: error.message }, 500);
      return json(data, 201);
    }
  }

  // POST /routes — add a route
  if (method === 'POST' && path[0] === 'routes') {
    const body = reqBody(event);
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);

    const routes = guide.routes || [];
    routes.push({
      id: 'rt_' + Date.now(),
      name: body.name,
      days: body.days || 1,
      difficulty: body.difficulty || 'Moderate',
      price: body.price || 0,
      description: body.description || '',
      image: body.image || '',
    });

    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // PUT /routes/:id — update a route
  if (method === 'PUT' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const body = reqBody(event);
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);

    const routes = (guide.routes || []).map(r => r.id === routeId ? { ...r, ...body, id: routeId } : r);
    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // DELETE /routes/:id — delete a route
  if (method === 'DELETE' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);

    const routes = (guide.routes || []).filter(r => r.id !== routeId);
    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }

  // POST /submit — submit for admin review
  if (method === 'POST' && path[0] === 'submit') {
    const { data: guide } = await supabase.from('guides').select('*').eq('user_id', user.id).single();
    if (!guide) return json({ error: 'Guide profile not found' }, 404);
    if (guide.status === 'published') return json({ error: 'Already published' }, 400);

    const { data, error } = await supabase.from('guides').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return json({ error: error.message }, 500);

    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      const html = `<h2>Guide Profile Ready for Review</h2><p><strong>${guide.trading_name || 'Unnamed Guide'}</strong> has submitted their profile.</p><table style="border-collapse:collapse;width:100%">${
        [['Name', guide.trading_name], ['Location', guide.location],
         ['Price', guide.price ? '$' + guide.price : '—'],
         ['Languages', Array.isArray(guide.languages) ? guide.languages.join(', ') : guide.languages],
         ['Experience', guide.experience + ' years'],
         ['Routes', (guide.routes || []).length]].map(([k, v]) =>
          `<tr style="border:1px solid #ddd"><td style="padding:6px;font-weight:700">${k}</td><td style="padding:6px">${v || '—'}</td></tr>`
        ).join('')}</table><p><a href="https://bucketlistspots.com/admin/applications" style="background:#2A9D8F;color:#FFF;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">Review in Dashboard</a></p><p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BucketListSpots <notifications@bucketlistspots.com>',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `Guide Profile Ready: ${guide.trading_name || 'Unnamed Guide'} submitted for review`,
          html,
        }),
      });
    }

    return json(data);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// ─── Debug Auth ───────────────────────────────────────────────────────
async function handleDebugAuth(event) {
  const { user, error: authErr, supabase } = await authUser(event);
  if (authErr || !user) return json({ error: 'Unauthorized', detail: authErr?.message }, 401);
  const { data: profile, error: profErr } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  return json({ userId: user.id, email: user.email, profile, profErr: profErr?.message });
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
    case 'apply-guide':
      return handleApplyGuide(event);
    case 'apply-ambassador':
      return handleApplyAmbassador(event);
    case 'applications':
      return handleApplications(event);
    case 'guide-profile':
      return handleGuideProfile(event);
    default:
      return json({ error: 'Not found' }, 404);
  }
};
