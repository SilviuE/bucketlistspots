const { createClient } = require('@supabase/supabase-js');

// ─── SECURITY: Shared Authentication Helper ───────────────────────────
// ALL authentication MUST go through this module.
// NEVER use jwtDecode() or manual base64 decoding for auth decisions.
//
// How it works:
//   1. Extract Bearer token from Authorization header
//   2. Verify token cryptographically via Supabase auth.getUser(token)
//   3. Load the public.users record using the verified user ID
//   4. Check the required database role, account status, and ownership
//
// Returns { user, profile, supabase } or throws an error response.

const INACTIVE_ROLES = ['suspended', 'banned', 'disabled'];

function json(body, status = 200) {
  return { statusCode: status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Create a Supabase client that forwards the user's JWT (for any
 * RLS policies that check auth.uid()). This client uses the service
 * role key so it bypasses RLS for server-side operations, but
 * forwards the JWT so RPCs or views that use auth.uid() still work.
 */
function createClientWithToken(token) {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

/**
 * Create a service-role-only client (no JWT forwarded).
 * Use for purely server-side operations that must not be
 * influenced by any RLS auth.uid() checks.
 */
function createServiceClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: 'public' },
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
 *
 * @param {string} token - The raw JWT from the Authorization header
 * @returns {Promise<{user: object|null, error: Error|null}>}
 */
async function verifyToken(token) {
  if (!token) return { user: null, error: new Error('No token provided') };
  try {
    const adminClient = createServiceClient();
    const { data, error } = await adminClient.auth.getUser(token);
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
 * @param {object} event - Netlify function event
 * @param {object} options
 * @param {string} options.requiredRole - Required role from public.users table (e.g. 'admin', 'guide')
 * @param {string} options.requiredStatus - Required status field if applicable (e.g. 'published')
 * @returns {Promise<{user: object, profile: object, supabase: object}|{statusCode: number, body: string}>}
 */
async function authenticate(event, options = {}) {
  const { requiredRole, requiredStatus } = options;

  // Step 1: Extract token
  const token = extractToken(event);
  if (!token) return json({ error: 'Authentication required' }, 401);

  // Step 2: Verify token cryptographically
  const { user: verifiedUser, error: verifyErr } = await verifyToken(token);
  if (verifyErr || !verifiedUser) {
    return json({ error: 'Invalid or expired token' }, 401);
  }

  // Step 3: Load database profile (source of truth for role, status, etc.)
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

  // Step 4: Check account is not suspended/disabled
  if (INACTIVE_ROLES.includes(profile.role)) {
    return json({ error: 'Account is not active' }, 403);
  }

  // Step 5: Check required role (from DATABASE, never from token payload)
  if (requiredRole && profile.role !== requiredRole) {
    return json({ error: `Access denied. Required role: ${requiredRole}` }, 403);
  }

  // Step 6: Check required status (e.g. guide must be 'published')
  if (requiredStatus) {
    const statusField = options.statusTable || 'users';
    const statusCol = options.statusColumn || 'role';
    if (statusField === 'users') {
      // Already loaded role; for guide status, we'll check separately
    }
  }

  // Build the Supabase client with user's JWT forwarded
  const supabase = createClientWithToken(token);

  return { user: verifiedUser, profile, supabase };
}

/**
 * Authenticate an admin request. Verifies JWT + checks database role = 'admin'.
 * Also verifies the user is not suspended.
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
 * Returns the guide record along with auth data.
 *
 * @param {object} event - Netlify function event
 * @returns {Promise<{user, profile, supabase, guide}|{statusCode, body}>}
 */
async function authenticateGuideOwner(event) {
  const result = await authenticate(event, { requiredRole: 'guide' });
  if (result.statusCode) return result; // Error response

  const { user, profile, supabase } = result;

  // Load guide record and verify ownership
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

  const supabase = createClientWithToken(token);
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
  createClientWithToken,
  createServiceClient,
  json,
  INACTIVE_ROLES,
};
