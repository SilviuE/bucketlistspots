const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { fullName, email, phone, country, experience, languages, specialties, message, heardFrom } = JSON.parse(event.body);

    if (!fullName || !email || !phone || !country) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error: dbError } = await supabase.from('guide_applications').insert({
      full_name: fullName, email, phone, country,
      experience: parseInt(experience) || 0, languages, specialties,
      message, heard_from: heardFrom, status: 'pending',
    });

    if (dbError) throw dbError;

    if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
      const html = `
        <h2>New Guide Application</h2>
        <table style="border-collapse:collapse;width:100%">
          ${[['Name', fullName], ['Email', email], ['Phone', phone], ['Country', country],
             ['Experience', experience + ' years'], ['Languages', languages],
             ['Specialties', specialties], ['Heard From', heardFrom],
             ['Message', message]].map(([k, v]) =>
            `<tr style="border:1px solid #ddd"><td style="padding:8px;font-weight:700">${k}</td><td style="padding:8px">${v || '—'}</td></tr>`
          ).join('')}
        </table>
        <p style="color:#666;font-size:12px">Sent from BucketListSpots.com</p>
      `;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BucketListSpots <notifications@bucketlistspots.com>',
          to: process.env.NOTIFICATION_EMAIL,
          subject: `New Guide Application: ${fullName} from ${country}`,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Resend error:', errText);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('apply-guide error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
