const { createClient } = require('@supabase/supabase-js');

// ─── SECURITY: Shared Authentication Helper ───────────────────────────
// ALL authentication MUST go through this module.
// NEVER use jwtDecode() or manual base64 decoding for auth decisions.
//
// Three explicit client types:
//   1. createVerifyClient()  — used ONLY for auth.getUser(token) verification
//   2. createServiceClient() — service-role, no JWT, bypasses RLS
//   3. createUserClient(token) — user-scoped, JWT forwarded, subject to RLS
//
// After authentication:
//   - Admin handlers use the service client for authorised writes.
//   - Guide ownership is checked via verified user ID + explicit user_id filter.
//   - User-scoped clients are used ONLY where a tested RLS policy intentionally
//     permits the operation (not currently deployed).

function json(body, status = 200) {
  return { statusCode: status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// ─── Client Type 1: Token Verification ────────────────────────────────
// Used ONLY for auth.getUser(token). Never for data operations.
function createVerifyClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
  });
}

// ─── Client Type 2: Service/Admin (bypasses RLS) ─────────────────────
// Use for server-side operations after authentication is complete.
// All RLS is bypassed. Must only be called after verify + role check.
function createServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
  });
}

// ─── Client Type 3: User-Scoped (subject to RLS) ─────────────────────
// Forwards the user's JWT. Supabase JS client will send the Bearer
// token, so auth.uid() in RLS policies resolves to this user.
// IMPORTANT: This client does NOT bypass RLS. It is subject to any
// RLS policies defined on the target table. Use only where a tested
// RLS policy intentionally allows the operation.
function createUserClient(token) {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    db: { schema: 'public' },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

/**
 * Extract the Bearer token from the event's Authorization header.
 * Returns null if missing or malformed.
 */
function extractToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Verify the Supabase JWT token and return the authenticated user.
 * This is the ONLY acceptable way to verify a token in this codebase.
 * Uses the service-role key for getUser() — this is Supabase's recommended
 * server-side pattern for JWT verification.
 *
 * @param {string} token - The raw JWT from the Authorization header
 * @returns {Promise<{user: object|null, error: Error|null}>}
 */
async function verifyToken(token) {
  if (!token) return { user: null, error: new Error('No token provided') };
  try {
    const client = createVerifyClient();
    const { data, error } = await client.auth.getUser(token);
    if (error) return { user: null, error };
    if (!data?.user) return { user: null, error: new Error('No user returned from token verification') };
    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}

/**
 * Authenticate a request and return verified user + database profile.
 *
 * Authentication flow:
 *   1. Extract Bearer token from request
 *   2. Verify token cryptographically via auth.getUser()
 *   3. Load public.users record using verified user ID (via service client)
 *   4. Check required role from database (never from token payload)
 *
 * Returns { user, profile, supabase } on success,
 * or { statusCode, body } error response on failure.
 *
 * @param {object} event - Netlify function event
 * @param {object} options
 * @param {string} options.requiredRole - Required role from public.users table
 * @returns {Promise<{user, profile, supabase}|{statusCode, body}>}
 */
async function authenticate(event, options = {}) {
  const { requiredRole } = options;

  // Step 1: Extract token
  const token = extractToken(event);
  if (!token) return json({ error: 'Authentication required' }, 401);

  // Step 2: Verify token cryptographically
  const { user: verifiedUser, error: verifyErr } = await verifyToken(token);
  if (verifyErr || !verifiedUser) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  // Step 3: Load database profile (source of truth for role)
  const sr = createServiceClient();
  const { data: profile, error: profileErr } = await sr
    .from('users')
    .select('id, email, name, role')
    .eq('id', verifiedUser.id)
    .maybeSingle();

  if (profileErr) {
    console.error('[Auth] Failed to load user profile:', profileErr.message);
    return json({ error: 'Failed to verify account' }, 500);
  }
  if (!profile) {
    return json({ error: 'User account not found' }, 401);
  }

  // Step 4: Check required role (from DATABASE, never from token payload)
  if (requiredRole && profile.role !== requiredRole) {
    return json({ error: `Access denied. Required role: ${requiredRole}` }, 403);
  }

  // Return the service client for post-auth data operations.
  // Callers use this for authorised reads/writes after role verification.
  const supabase = createServiceClient();

  return { user: verifiedUser, profile, supabase };
}

/**
 * Authenticate an admin request. Verifies JWT + checks database role = 'admin'.
 */
async function authenticateAdmin(event) {
  return authenticate(event, { requiredRole: 'admin' });
}

/**
 * Authenticate a guide request. Verifies JWT + checks database role = 'guide'.
 */
async function authenticateGuide(event) {
  return authenticate(event, { requiredRole: 'guide' });
}

/**
 * Authenticate a request and verify guide ownership.
 * Verifies JWT → role = 'guide' → loads guide record with user_id check.
 *
 * @param {object} event - Netlify function event
 * @returns {Promise<{user, profile, supabase, guide}|{statusCode, body}>}
 */
async function authenticateGuideOwner(event) {
  const result = await authenticate(event, { requiredRole: 'guide' });
  if (result.statusCode) return result;

  const { user, profile, supabase } = result;

  // Load guide record — ownership verified via .eq('user_id', user.id)
  const { data: guide, error: guideErr } = await supabase
    .from('guides')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (guideErr) return json({ error: 'Failed to load guide profile' }, 500);
  if (!guide) return json({ error: 'Guide profile not found. Please create a profile first.' }, 404);

  return { user, profile, supabase, guide };
}

/**
 * Authenticate a guide or ambassador request (for posts, etc.)
 */
async function authenticateGuideOrAmbassador(event) {
  const token = extractToken(event);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { user: verifiedUser, error: verifyErr } = await verifyToken(token);
  if (verifyErr || !verifiedUser) return json({ error: 'Invalid or expired token' }, 401);

  const sr = createServiceClient();
  const { data: profile, error: profileErr } = await sr
    .from('users')
    .select('id, email, name, role')
    .eq('id', verifiedUser.id)
    .maybeSingle();

  if (profileErr || !profile) return json({ error: 'User account not found' }, 401);
  if (!['guide', 'ambassador'].includes(profile.role)) {
    return json({ error: 'Only guides and ambassadors can perform this action' }, 403);
  }

  const supabase = createServiceClient();
  return { user: verifiedUser, profile, supabase };
}

module.exports = {
  authenticate,
  authenticateAdmin,
  authenticateGuide,
  authenticateGuideOwner,
  authenticateGuideOrAmbassador,
  verifyToken,
  extractToken,
  createVerifyClient,
  createServiceClient,
  createUserClient,
  json,
};
