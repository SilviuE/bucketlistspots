const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'guide') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Guide access required' }) };
  }

  const method = event.httpMethod;
  const path = event.path.replace(/\/?api\/guide-profile\/?/, '').split('/').filter(Boolean);

  // GET /api/guide-profile — fetch my profile + routes
  if (method === 'GET') {
    const { data: guide, error } = await supabase.from('guides').select('*').eq('user_id', user.id).maybeSingle();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(guide || null) };
  }

  // PUT /api/guide-profile — create or update profile
  if (method === 'PUT') {
    const body = JSON.parse(event.body);
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
      if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    } else {
      updates.user_id = user.id;
      updates.status = 'draft';
      updates.id = user.id.replace(/-/g, '').slice(0, 12);
      const { data, error } = await supabase.from('guides').insert(updates).select().single();
      if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 201, headers, body: JSON.stringify(data) };
    }
  }

  // POST /api/guide-profile/routes — add a route
  if (method === 'POST' && path[0] === 'routes') {
    const body = JSON.parse(event.body);
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Guide profile not found' }) };

    const routes = guide.routes || [];
    const newRoute = {
      id: 'rt_' + Date.now(),
      name: body.name,
      days: body.days || 1,
      difficulty: body.difficulty || 'Moderate',
      price: body.price || 0,
      description: body.description || '',
      image: body.image || '',
    };
    routes.push(newRoute);

    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // PUT /api/guide-profile/routes/:id — update a route
  if (method === 'PUT' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const body = JSON.parse(event.body);
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Guide profile not found' }) };

    const routes = (guide.routes || []).map(r => r.id === routeId ? { ...r, ...body, id: routeId } : r);
    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // DELETE /api/guide-profile/routes/:id — delete a route
  if (method === 'DELETE' && path[0] === 'routes' && path[1]) {
    const routeId = path[1];
    const { data: guide } = await supabase.from('guides').select('routes').eq('user_id', user.id).single();
    if (!guide) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Guide profile not found' }) };

    const routes = (guide.routes || []).filter(r => r.id !== routeId);
    const { data, error } = await supabase.from('guides').update({ routes, updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  // POST /api/guide-profile/submit — submit for admin review
  if (method === 'POST' && path[0] === 'submit') {
    const { data: guide } = await supabase.from('guides').select('*').eq('user_id', user.id).single();
    if (!guide) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Guide profile not found' }) };
    if (guide.status === 'published') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Already published' }) };

    const { data, error } = await supabase.from('guides').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('user_id', user.id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      const html = `
        <h2>Guide Profile Ready for Review</h2>
        <p><strong>${guide.trading_name || 'Unnamed Guide'}</strong> has submitted their profile for review.</p>
        <table style="border-collapse:collapse;width:100%">
          ${[['Name', guide.trading_name], ['Location', guide.location],
             ['Price', guide.price ? '$' + guide.price : '—'],
             ['Languages', Array.isArray(guide.languages) ? guide.languages.join(', ') : guide.languages],
             ['Experience', guide.experience + ' years'],
             ['Routes', (guide.routes || []).length]].map(([k, v]) =>
            `<tr style="border:1px solid #ddd"><td style="padding:6px;font-weight:700">${k}</td><td style="padding:6px">${v || '—'}</td></tr>`
          ).join('')}
        </table>
        <p><a href="https://bucketlistspots.com/admin/applications" style="background:#2A9D8F;color:#FFF;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">Review in Dashboard</a></p>
        <p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>
      `;

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

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
