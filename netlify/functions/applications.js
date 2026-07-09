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
  if (!profile || profile.role !== 'admin') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

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
      return { statusCode: 200, headers, body: JSON.stringify(results) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'PATCH') {
    const { id, status, type } = JSON.parse(event.body);
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };

    if (type === 'pending-guide') {
      if (!['published', 'draft'].includes(status)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status for guide' }) };
      }
      const { data, error } = await supabase.from('guides').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ...data, _type: 'pending-guide' }) };
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status' }) };
    }
    const table = type === 'ambassador' ? 'ambassador_applications' : 'guide_applications';
    const { data, error } = await supabase.from(table).update({ status }).eq('id', id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
