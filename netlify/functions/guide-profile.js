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

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
