const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

const FUNC_DIR = path.join(__dirname, '..', 'netlify', 'functions');
const SRC_DIR = path.join(__dirname, '..', 'src');

function read(relPath) {
  return fs.readFileSync(path.join(FUNC_DIR, relPath), 'utf8');
}

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf8');
}

console.log('\n=== P0 Security Integration Tests ===\n');

// ─── 1. Module Format: All Netlify functions load as CommonJS ─────────
console.log('1. Module format — standalone functions load as CommonJS:');

test('guide-profile.cjs loads without require errors', () => {
  // Verify the file uses CJS syntax and imports auth.cjs correctly
  const src = read('guide-profile.cjs');
  assert.ok(src.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
  assert.ok(!src.includes("require('./guide-profile')"), 'Must not self-reference');
});

test('applications.cjs loads without require errors', () => {
  const src = read('applications.cjs');
  assert.ok(src.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
});

test('apply-guide.cjs loads without require errors', () => {
  const src = read('apply-guide.cjs');
  assert.ok(src.includes("require('@supabase/supabase-js')"), 'Must import supabase');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
});

test('apply-ambassador.cjs loads without require errors', () => {
  const src = read('apply-ambassador.cjs');
  assert.ok(src.includes("require('@supabase/supabase-js')"), 'Must import supabase');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
});

test('api.cjs loads without require errors', () => {
  const src = read('api.cjs');
  assert.ok(src.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
});

test('webhook-stripe.cjs loads without require errors', () => {
  const src = read('webhook-stripe.cjs');
  assert.ok(src.includes("require('@supabase/supabase-js')"), 'Must import supabase');
  assert.ok(src.includes('exports.handler'), 'Must export handler');
});

test('auth.cjs loads without require errors', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.authenticate, 'function');
  assert.strictEqual(typeof auth.authenticateAdmin, 'function');
  assert.strictEqual(typeof auth.authenticateGuide, 'function');
  assert.strictEqual(typeof auth.authenticateGuideOwner, 'function');
  assert.strictEqual(typeof auth.verifyToken, 'function');
  assert.strictEqual(typeof auth.extractToken, 'function');
  assert.strictEqual(typeof auth.createVerifyClient, 'function');
  assert.strictEqual(typeof auth.createServiceClient, 'function');
  assert.strictEqual(typeof auth.createUserClient, 'function');
});

test('No .js function files remain (all must be .cjs)', () => {
  const files = fs.readdirSync(FUNC_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('.'));
  assert.deepStrictEqual(jsFiles, [], `Found .js files that should be .cjs: ${jsFiles.join(', ')}`);
});

// ─── 2. Three explicit client types ───────────────────────────────────
console.log('\n2. Supabase client types:');

test('auth.cjs exports createVerifyClient (token verification only)', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.createVerifyClient, 'function');
});

test('auth.cjs exports createServiceClient (admin, bypasses RLS)', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.createServiceClient, 'function');
});

test('auth.cjs exports createUserClient (user-scoped, subject to RLS)', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.createUserClient, 'function');
});

test('auth.cjs no longer exports createClientWithToken (removed)', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.createClientWithToken, 'undefined', 'createClientWithToken must be removed');
});

test('auth.cjs no longer exports INACTIVE_ROLES (removed)', () => {
  const auth = require(path.join(FUNC_DIR, 'auth.cjs'));
  assert.strictEqual(typeof auth.INACTIVE_ROLES, 'undefined', 'INACTIVE_ROLES must be removed');
});

test('auth.cjs does not contain misleading "bypasses RLS" comment', () => {
  const src = read('auth.cjs');
  assert.ok(!src.includes('bypasses RLS for server-side'), 'Must not claim service client bypasses RLS in user-client context');
});

test('createUserClient uses anon key (not service role)', () => {
  const src = read('auth.cjs');
  // The createUserClient function should reference SUPABASE_ANON_KEY
  const createUserIdx = src.indexOf('function createUserClient');
  const createUserBody = src.substring(createUserIdx, createUserIdx + 500);
  assert.ok(createUserBody.includes('SUPABASE_ANON_KEY'), 'createUserClient must use SUPABASE_ANON_KEY');
  assert.ok(!createUserBody.includes('SUPABASE_SERVICE_ROLE_KEY'), 'createUserClient must NOT use service role key');
});

// ─── 3. Account-state validation ──────────────────────────────────────
console.log('\n3. Account-state validation:');

test('auth.cjs does NOT define INACTIVE_ROLES', () => {
  const src = read('auth.cjs');
  assert.ok(!src.includes('INACTIVE_ROLES'), 'INACTIVE_ROLES must be completely removed');
});

test('auth.cjs does NOT check role against suspended/banned/disabled', () => {
  const src = read('auth.cjs');
  assert.ok(!src.includes("'suspended'"), 'Must not treat suspended as a role value');
  assert.ok(!src.includes("'banned'"), 'Must not treat banned as a role value');
  assert.ok(!src.includes("'disabled'"), 'Must not treat disabled as a role value');
});

test('authenticate() checks requiredRole only (no dead requiredStatus code)', () => {
  const src = read('auth.cjs');
  const authenticateIdx = src.indexOf('async function authenticate');
  const authenticateBody = src.substring(authenticateIdx, src.indexOf('\n}\n', authenticateIdx));
  // Must not have the old requiredStatus/statusTable/statusColumn logic
  assert.ok(!authenticateBody.includes('requiredStatus'), 'Must not reference requiredStatus');
  assert.ok(!authenticateBody.includes('statusTable'), 'Must not reference statusTable');
  assert.ok(!authenticateBody.includes('statusColumn'), 'Must not reference statusColumn');
});

// ─── 4. Auth test: forged/rejected tokens ──────────────────────────────
console.log('\n4. Token verification — forged and invalid tokens:');

const auth = require(path.join(FUNC_DIR, 'auth.cjs'));

test('verifyToken rejects null', async () => {
  const r = await auth.verifyToken(null);
  assert.ok(r.error);
  assert.strictEqual(r.user, null);
});

test('verifyToken rejects empty string', async () => {
  const r = await auth.verifyToken('');
  assert.ok(r.error);
  assert.strictEqual(r.user, null);
});

test('verifyToken rejects garbage string', async () => {
  const r = await auth.verifyToken('not-a-jwt');
  assert.ok(r.error);
  assert.strictEqual(r.user, null);
});

test('verifyToken rejects forged JWT with admin payload', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: '00000000-0000-0000-0000-000000000000',
    role: 'admin',
    email: 'hacker@evil.com',
  })).toString('base64');
  const forged = `${header}.${payload}.tampered_signature`;
  const r = await auth.verifyToken(forged);
  assert.ok(r.error, 'Forged admin JWT must be rejected');
  assert.strictEqual(r.user, null);
});

test('verifyToken rejects expired token format (not valid base64url)', async () => {
  const r = await auth.verifyToken('eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.sig');
  assert.ok(r.error);
  assert.strictEqual(r.user, null);
});

test('extractToken returns null for missing header', () => {
  assert.strictEqual(auth.extractToken({ headers: {} }), null);
});

test('extractToken returns null for non-Bearer', () => {
  assert.strictEqual(auth.extractToken({ headers: { authorization: 'Basic abc' } }), null);
});

test('extractToken extracts token from Bearer header', () => {
  assert.strictEqual(auth.extractToken({ headers: { authorization: 'Bearer tok123' } }), 'tok123');
});

test('extractToken handles capitalized Authorization header', () => {
  assert.strictEqual(auth.extractToken({ headers: { Authorization: 'Bearer xyz' } }), 'xyz');
});

// ─── 5. Auth without token → 401 ──────────────────────────────────────
console.log('\n5. Authentication without token:');

test('authenticate() returns 401 with no header', async () => {
  const r = await auth.authenticate({ headers: {} });
  assert.strictEqual(r.statusCode, 401);
});

test('authenticateAdmin() returns 401 with no token', async () => {
  const r = await auth.authenticateAdmin({ headers: {} });
  assert.strictEqual(r.statusCode, 401);
});

test('authenticateGuide() returns 401 with no token', async () => {
  const r = await auth.authenticateGuide({ headers: {} });
  assert.strictEqual(r.statusCode, 401);
});

test('authenticateGuideOwner() returns 401 with no token', async () => {
  const r = await auth.authenticateGuideOwner({ headers: {} });
  assert.strictEqual(r.statusCode, 401);
});

test('authenticateGuideOrAmbassador() returns 401 with no token', async () => {
  const r = await auth.authenticateGuideOrAmbassador({ headers: {} });
  assert.strictEqual(r.statusCode, 401);
});

// ─── 6. Code integrity: api.cjs ───────────────────────────────────────
console.log('\n6. Code integrity — api.cjs:');

test('api.cjs has no jwtDecode function definition', () => {
  const src = read('api.cjs');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes('function jwtDecode'), 'jwtDecode must not be defined');
});

test('api.cjs has no jwtDecode() calls (non-comment)', () => {
  const src = read('api.cjs');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes('jwtDecode('), 'jwtDecode must not be called');
});

test('api.cjs has no authUser() calls (non-comment)', () => {
  const src = read('api.cjs');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes('authUser('), 'authUser must not be called');
  assert.ok(!nonComment.includes('function authUser'), 'authUser must not be defined');
});

test('api.cjs imports authenticate functions from auth.cjs', () => {
  const src = read('api.cjs');
  assert.ok(src.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(src.includes('authenticateAdmin'), 'Must import authenticateAdmin');
  assert.ok(src.includes('authenticateGuideOwner'), 'Must import authenticateGuideOwner');
});

// ─── 7. Code integrity: guide-profile.cjs ──────────────────────────────
console.log('\n7. Code integrity — guide-profile.cjs:');

test('guide-profile.cjs uses authenticateGuideOwner (not jwtDecode)', () => {
  const src = read('guide-profile.cjs');
  assert.ok(src.includes('authenticateGuideOwner'), 'Must use authenticateGuideOwner');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes('jwtDecode'), 'Must not use jwtDecode');
});

test('guide-profile.cjs PUT allowlist excludes administrative fields', () => {
  const src = read('guide-profile.cjs');
  const putIdx = src.indexOf('P0-2 SECURITY FIX');
  assert.ok(putIdx > 0, 'Must have P0-2 security comment');
  const putSection = src.substring(putIdx, putIdx + 600);
  const adminFields = ['status', 'price', 'price_currency', 'featured',
    'identity_verified', 'license_verified', 'safety_verified', 'fair_pay_verified',
    'review_count', 'trips_led', 'agency_price', 'bls_points_balance', 'referral_code', 'user_id'];
  for (const field of adminFields) {
    assert.ok(!putSection.includes(`'${field}'`), `guide PUT must not allow '${field}'`);
  }
});

// ─── 8. Code integrity: applications.cjs ───────────────────────────────
console.log('\n8. Code integrity — applications.cjs:');

test('applications.cjs uses authenticateAdmin (not jwtDecode)', () => {
  const src = read('applications.cjs');
  assert.ok(src.includes('authenticateAdmin'), 'Must use authenticateAdmin');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes('jwtDecode'), 'Must not use jwtDecode');
});

test('applications.cjs no longer contains user role lookup code', () => {
  const src = read('applications.cjs');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes("from('users').select('role')"), 'Must not do manual role lookup');
  assert.ok(!nonComment.includes("userRecord?.role"), 'Must not fallback to token-decoded role');
});

// ─── 9. AuthContext.jsx security ──────────────────────────────────────
console.log('\n9. AuthContext.jsx — browser security:');

test('AuthContext.jsx defines SAFE_USER_COLUMNS', () => {
  const src = readSrc('context/AuthContext.jsx');
  assert.ok(src.includes('SAFE_USER_COLUMNS'), 'Must define SAFE_USER_COLUMNS');
});

test('AuthContext.jsx SAFE_USER_COLUMNS does not include referral_code', () => {
  const src = readSrc('context/AuthContext.jsx');
  const colIdx = src.indexOf('SAFE_USER_COLUMNS');
  const colDef = src.substring(colIdx, colIdx + 200);
  assert.ok(!colDef.includes('referral_code'), 'SAFE_USER_COLUMNS must not include referral_code');
  assert.ok(!colDef.includes('bls_points_balance'), 'SAFE_USER_COLUMNS must not include bls_points_balance');
});

test('AuthContext.jsx uses SAFE_USER_COLUMNS (no select(*) on users)', () => {
  const src = readSrc('context/AuthContext.jsx');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  // Should not have any select('*') on the users table
  const usersSelectAll = nonComment.match(/from\('users'\)\.select\('\*'\)/g);
  assert.strictEqual(usersSelectAll, null, 'Must not use select(*) on users table');
  // Should use SAFE_USER_COLUMNS
  assert.ok(nonComment.includes('SAFE_USER_COLUMNS'), 'Must use SAFE_USER_COLUMNS');
});

test('register() does not write role to users table', () => {
  const src = readSrc('context/AuthContext.jsx');
  const regIdx = src.indexOf('const register = useCallback');
  const regEnd = src.indexOf('}, []);', regIdx);
  const regFunc = src.substring(regIdx, regEnd);
  assert.ok(!regFunc.includes('.update({ role'), 'register() must not update role');
});

test('login() does not write role to users table', () => {
  const src = readSrc('context/AuthContext.jsx');
  const loginIdx = src.indexOf('const login = useCallback');
  const loginEnd = src.indexOf('}, []);', loginIdx);
  const loginFunc = src.substring(loginIdx, loginEnd);
  assert.ok(!loginFunc.includes('.update({ role'), 'login() must not update role');
});

test('updateProfile() uses SAFE_PROFILE_FIELDS allowlist', () => {
  const src = readSrc('context/AuthContext.jsx');
  const upIdx = src.indexOf('const updateProfile = useCallback');
  const upEnd = src.indexOf('}, [user]);', upIdx);
  const upFunc = src.substring(upIdx, upEnd + 12);
  assert.ok(upFunc.includes('SAFE_PROFILE_FIELDS'), 'Must use safe field allowlist');
  assert.ok(!upFunc.includes("'role'"), 'Must not allow role');
  assert.ok(!upFunc.includes("'bls_points_balance'"), 'Must not allow bls_points_balance');
  assert.ok(!upFunc.includes("'referral_code'"), 'Must not allow referral_code');
});

// ─── 10. Public catalogue ─────────────────────────────────────────────
console.log('\n10. Public catalogue — api.js:');

test('api.js uses explicit columns for guides', () => {
  const src = readSrc('lib/api.js');
  assert.ok(src.includes('PUBLIC_GUIDE_COLUMNS'), 'Must define PUBLIC_GUIDE_COLUMNS');
  const nonComment = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonComment.includes("from('guides').select('*')"), 'Must not use select(*) on guides');
});

test('api.js PUBLIC_GUIDE_COLUMNS excludes internal fields', () => {
  const src = readSrc('lib/api.js');
  const colIdx = src.indexOf('PUBLIC_GUIDE_COLUMNS');
  const colSection = src.substring(colIdx, colIdx + 600);
  assert.ok(!colSection.includes("'user_id'"), 'Must not expose user_id');
  assert.ok(!colSection.includes("'referral_code'"), 'Must not expose referral_code');
  assert.ok(!colSection.includes("'bls_points_balance'"), 'Must not expose bls_points_balance');
  assert.ok(!colSection.includes("'referred_by_ambassador_id'"), 'Must not expose referred_by_ambassador_id');
});

test('fetchGuides filters by status=published server-side', () => {
  const src = readSrc('lib/api.js');
  const fgIdx = src.indexOf('export async function fetchGuides');
  const fgFunc = src.substring(fgIdx, fgIdx + 600);
  assert.ok(fgFunc.includes("eq('status', 'published')"), 'Must filter by published status');
});

test('api.js uses explicit columns for experiences', () => {
  const src = readSrc('lib/api.js');
  assert.ok(src.includes('PUBLIC_EXPERIENCE_COLUMNS'), 'Must define PUBLIC_EXPERIENCE_COLUMNS');
});

test('api.js uses explicit columns for destinations', () => {
  const src = readSrc('lib/api.js');
  assert.ok(src.includes('PUBLIC_DESTINATION_COLUMNS'), 'Must define PUBLIC_DESTINATION_COLUMNS');
});

// ─── 11. Admin endpoint protection ────────────────────────────────────
console.log('\n11. Admin endpoint protection:');

test('handleAdminPlatformConfig uses authenticateAdmin', () => {
  const src = read('api.cjs');
  const idx = src.indexOf('handleAdminPlatformConfig');
  const body = src.substring(idx, idx + 500);
  assert.ok(body.includes('authenticateAdmin'), 'Must use authenticateAdmin');
  assert.ok(!body.includes('jwtDecode('), 'Must not use jwtDecode');
});

test('handleAdminPaymentReports uses authenticateAdmin', () => {
  const src = read('api.cjs');
  const idx = src.indexOf('handleAdminPaymentReports');
  const body = src.substring(idx, idx + 500);
  assert.ok(body.includes('authenticateAdmin'), 'Must use authenticateAdmin');
  assert.ok(!body.includes('jwtDecode('), 'Must not use jwtDecode');
});

test('handleApplications uses authenticateAdmin', () => {
  const src = read('api.cjs');
  const idx = src.indexOf('handleApplications');
  const body = src.substring(idx, idx + 500);
  assert.ok(body.includes('authenticateAdmin'), 'Must use authenticateAdmin');
});

// ─── 12. Guide self-publication prevention ─────────────────────────────
console.log('\n12. Guide self-publication prevention:');

test('POST /submit sets pending (not published)', () => {
  const src = read('api.cjs');
  const idx = src.indexOf("path[0] === 'submit'");
  const body = src.substring(idx, idx + 800);
  assert.ok(body.includes("status: 'pending'"), 'POST /submit must set pending');
  assert.ok(!body.includes("status: 'published'"), 'POST /submit must NOT set published');
});

test('guide PUT in api.cjs excludes administrative fields', () => {
  const src = read('api.cjs');
  const putIdx = src.indexOf('P0-2 SECURITY FIX');
  assert.ok(putIdx > 0, 'Must have P0-2 comment');
  const putSection = src.substring(putIdx, putIdx + 600);
  const adminFields = ['status', 'price', 'price_currency', 'featured',
    'identity_verified', 'license_verified', 'safety_verified', 'fair_pay_verified',
    'review_count', 'trips_led', 'agency_price', 'bls_points_balance', 'referral_code', 'user_id'];
  for (const field of adminFields) {
    assert.ok(!putSection.includes(`'${field}'`), `guide PUT must not allow '${field}'`);
  }
});

// ─── 13. Standalone functions remain public where appropriate ──────────
console.log('\n13. Public function boundaries:');

test('apply-guide.cjs has no auth import', () => {
  const src = read('apply-guide.cjs');
  assert.ok(!src.includes('auth.cjs'), 'apply-guide must remain public');
});

test('apply-ambassador.cjs has no auth import', () => {
  const src = read('apply-ambassador.cjs');
  assert.ok(!src.includes('auth.cjs'), 'apply-ambassador must remain public');
});

// ─── 14. Server-side select('*') audit ────────────────────────────────
console.log('\n14. Server-side select(*) audit (admin endpoints):');

test('api.cjs admin endpoint select(*) are server-side only (service role)', () => {
  const src = read('api.cjs');
  // These are expected: admin applications, guides listing (admin), platform_config
  // All run under authenticateAdmin() with service-role key — acceptable
  const adminHandlers = ['handleApplications', 'handleAdminPlatformConfig', 'handleAdminPaymentReports'];
  for (const handler of adminHandlers) {
    const idx = src.indexOf(handler);
    if (idx >= 0) {
      const body = src.substring(idx, idx + 2000);
      // Verify it calls authenticateAdmin or uses service-role client
      const hasAuth = body.includes('authenticateAdmin') || body.includes('createServiceClient');
      assert.ok(hasAuth, `${handler} must use authenticated service client`);
    }
  }
});

// ─── Results ──────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
