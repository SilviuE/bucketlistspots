const express = require('express');
const cors = require('cors');
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) { /* Netlify: env vars come from dashboard */ }

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'https://bucketlistspots.com', 'https://www.bucketlistspots.com', process.env.URL].filter(Boolean) }));
app.use(express.json());

// Load the Netlify function handler
// Local dev fallback: ensure service role key exists
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
}
const apiHandler = require('./netlify/functions/api.cjs').handler;

// Proxy all /api/* requests through the Netlify function handler
app.all(/^\/api(\/.*)?$/, async (req, res) => {
  try {
    // Reconstruct full path for the Netlify function router
    const fullPath = '/api' + (req.params[0] || '');
    const queryString = Object.entries(req.query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const event = {
      httpMethod: req.method.toUpperCase(),
      path: fullPath,
      url: fullPath + (queryString ? '?' + queryString : ''),
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v])
      ),
      body: req.body ? JSON.stringify(req.body) : '{}',
      queryStringParameters: { ...req.query },
    };

    const result = await apiHandler(event);

    const body = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        if (key !== 'content-type') res.setHeader(key, value);
      }
    }
    res.status(result.statusCode || 200).send(body);
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3002, () => {
    console.log('Dev server running on http://localhost:3002');
  });
}

module.exports = app;
