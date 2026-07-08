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
    const { data, error } = await supabase.from('guide_applications').select('*').order('created_at', { ascending: false });
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'PATCH') {
    const { id, status } = JSON.parse(event.body);
    if (!id || !['pending', 'approved', 'rejected'].includes(status)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid id or status' }) };
    }
    const { data, error } = await supabase.from('guide_applications').update({ status }).eq('id', id).select().single();
    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
