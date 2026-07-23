const assert = require('assert');

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

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('\n=== P0 Security Hotfix Tests ===\n');

// ─── Test Group 1: Auth Helper Module Exports ────────────────────────
console.log('Auth helper module exports:');

const auth = require('../netlify/functions/auth.cjs');

test('auth module exports authenticate', () => {
  assert.strictEqual(typeof auth.authenticate, 'function');
});

test('auth module exports authenticateAdmin', () => {
  assert.strictEqual(typeof auth.authenticateAdmin, 'function');
});

test('auth module exports authenticateGuide', () => {
  assert.strictEqual(typeof auth.authenticateGuide, 'function');
});

test('auth module exports authenticateGuideOwner', () => {
  assert.strictEqual(typeof auth.authenticateGuideOwner, 'function');
});

test('auth module exports verifyToken', () => {
  assert.strictEqual(typeof auth.verifyToken, 'function');
});

test('auth module exports extractToken', () => {
  assert.strictEqual(typeof auth.extractToken, 'function');
});

test('auth module exports createClientWithToken', () => {
  assert.strictEqual(typeof auth.createClientWithToken, 'function');
});

test('auth module exports createServiceClient', () => {
  assert.strictEqual(typeof auth.createServiceClient, 'function');
});

test('INACTIVE_ROLES includes suspended, banned, disabled', () => {
  assert.deepStrictEqual(auth.INACTIVE_ROLES, ['suspended', 'banned', 'disabled']);
});

// ─── Test Group 2: Token Extraction ──────────────────────────────────
console.log('\nToken extraction:');

test('extractToken returns null when no Authorization header', () => {
  const result = auth.extractToken({ headers: {} });
  assert.strictEqual(result, null);
});

test('extractToken returns null for non-Bearer token', () => {
  const result = auth.extractToken({ headers: { authorization: 'Basic abc123' } });
  assert.strictEqual(result, null);
});

test('extractToken extracts token from Bearer header', () => {
  const result = auth.extractToken({ headers: { authorization: 'Bearer mytoken123' } });
  assert.strictEqual(result, 'mytoken123');
});

test('extractToken handles case-insensitive Authorization header', () => {
  const result = auth.extractToken({ headers: { Authorization: 'Bearer xyz789' } });
  assert.strictEqual(result, 'xyz789');
});

test('extractToken returns null for empty Bearer value', () => {
  const result = auth.extractToken({ headers: { authorization: 'Bearer ' } });
  assert.strictEqual(result, '');
});

// ─── Test Group 3: Forged/Invalid Token Rejection ────────────────────
console.log('\nForged/invalid token rejection:');

test('verifyToken rejects null token', async () => {
  const result = await auth.verifyToken(null);
  assert.ok(result.error);
  assert.strictEqual(result.user, null);
});

test('verifyToken rejects empty string token', async () => {
  const result = await auth.verifyToken('');
  assert.ok(result.error);
  assert.strictEqual(result.user, null);
});

test('verifyToken rejects garbage string', async () => {
  const result = await auth.verifyToken('not-a-jwt-token');
  assert.ok(result.error);
  assert.strictEqual(result.user, null);
});

test('verifyToken rejects base64-encoded nonsense', async () => {
  const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: 'fake', role: 'admin' })).toString('base64') + '.fakesignature';
  const result = await auth.verifyToken(fakeJwt);
  assert.ok(result.error);
  assert.strictEqual(result.user, null);
});

test('verifyToken rejects a JWT with tampered payload', async () => {
  // Construct a valid-looking JWT with a bad signature
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub: '00000000-0000-0000-0000-000000000000', role: 'admin', email: 'admin@test.com' })).toString('base64');
  const fakeJwt = `${header}.${payload}.tampered_signature_value`;
  const result = await auth.verifyToken(fakeJwt);
  assert.ok(result.error);
  assert.strictEqual(result.user, null);
});

// ─── Test Group 4: Authentication Without Token ──────────────────────
console.log('\nAuthentication without token:');

test('authenticate returns 401 when no Authorization header', async () => {
  const event = { headers: {} };
  const result = await auth.authenticate(event);
  assert.strictEqual(result.statusCode, 401);
  const body = JSON.parse(result.body);
  assert.ok(body.error.includes('Authentication required'));
});

test('authenticateAdmin returns 401 when no token', async () => {
  const event = { headers: {} };
  const result = await auth.authenticateAdmin(event);
  assert.strictEqual(result.statusCode, 401);
});

test('authenticateGuide returns 401 when no token', async () => {
  const event = { headers: {} };
  const result = await auth.authenticateGuide(event);
  assert.strictEqual(result.statusCode, 401);
});

test('authenticateGuideOwner returns 401 when no token', async () => {
  const event = { headers: {} };
  const result = await auth.authenticateGuideOwner(event);
  assert.strictEqual(result.statusCode, 401);
});

// ─── Test Group 5: verifyToken Rejection of Forged Admin JWT ─────────
console.log('\nForged admin JWT rejection:');

test('verifyToken rejects JWT with admin role in payload', async () => {
  // A forged JWT claiming admin access
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    email: 'hacker@evil.com',
    role: 'admin',
    user_metadata: { role: 'admin' },
    app_metadata: { role: 'admin' },
  })).toString('base64');
  const forged = `${header}.${payload}.this_is_not_a_valid_signature`;
  const result = await auth.verifyToken(forged);
  assert.ok(result.error, 'Forged admin JWT should be rejected');
  assert.strictEqual(result.user, null);
});

// ─── Test Group 6: api.cjs No Longer Contains jwtDecode ──────────────
console.log('\napi.cjs code integrity:');

test('api.cjs does not define or export jwtDecode', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  // Should not contain function definition (only comments referencing it)
  assert.ok(!content.includes('function jwtDecode'), 'jwtDecode function must be removed from api.cjs');
});

test('api.cjs does not use jwtDecode for auth decisions', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  // Should not contain jwtDecode( calls (only comments)
  const lines = content.split('\n').filter(l => l.trim().startsWith('//'));
  const nonCommentContent = content.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonCommentContent.includes('jwtDecode('), 'jwtDecode must not be called in api.cjs');
});

test('api.cjs does not define or call authUser', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  const nonCommentContent = content.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.ok(!nonCommentContent.includes('function authUser'), 'authUser function must be removed');
  assert.ok(!nonCommentContent.includes('authUser('), 'authUser must not be called');
});

test('api.cjs imports authenticate functions from auth.cjs', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  assert.ok(content.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(content.includes('authenticateAdmin'), 'Must import authenticateAdmin');
  assert.ok(content.includes('authenticateGuideOwner'), 'Must import authenticateGuideOwner');
  assert.ok(content.includes('authenticateGuideOrAmbassador'), 'Must import authenticateGuideOrAmbassador');
});

// ─── Test Group 7: Guide Profile Allowlist ────────────────────────────
console.log('\nGuide profile allowlist (P0-2):');

test('api.cjs guide PUT allowlist excludes status', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  // Find the guide PUT allowlist — look for the pattern near "P0-2 SECURITY FIX"
  const p02Section = content.substring(content.indexOf('P0-2 SECURITY FIX'));
  const allowlistEnd = p02Section.indexOf(']');
  const allowlistStr = p02Section.substring(0, allowlistEnd + 1);
  assert.ok(!allowlistStr.includes("'status'"), 'status must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'price'"), 'price must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'price_currency'"), 'price_currency must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'featured'"), 'featured must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'identity_verified'"), 'identity_verified must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'license_verified'"), 'license_verified must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'safety_verified'"), 'safety_verified must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'fair_pay_verified'"), 'fair_pay_verified must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'review_count'"), 'review_count must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'trips_led'"), 'trips_led must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'agency_price'"), 'agency_price must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'bls_points_balance'"), 'bls_points_balance must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'referral_code'"), 'referral_code must NOT be in guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'user_id'"), 'user_id must NOT be in guide PUT allowlist');
});

test('guide-profile.js allowlist excludes status', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'guide-profile.js'), 'utf8');
  // Find the PUT allowlist
  const putSection = content.substring(content.indexOf('P0-2 SECURITY FIX'));
  const allowlistEnd = putSection.indexOf(']');
  const allowlistStr = putSection.substring(0, allowlistEnd + 1);
  assert.ok(!allowlistStr.includes("'status'"), 'status must NOT be in standalone guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'price'"), 'price must NOT be in standalone guide PUT allowlist');
  assert.ok(!allowlistStr.includes("'price_currency'"), 'price_currency must NOT be in standalone guide PUT allowlist');
});

test('POST /submit correctly sets status to pending (not published)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  // Find the submit handler
  const submitIdx = content.indexOf("path[0] === 'submit'");
  assert.ok(submitIdx > 0, 'POST /submit handler must exist');
  const submitSection = content.substring(submitIdx, submitIdx + 1000);
  assert.ok(submitSection.includes("status: 'pending'"), 'POST /submit must set status to pending');
  assert.ok(!submitSection.includes("status: 'published'"), 'POST /submit must NOT set status to published');
});

// ─── Test Group 8: AuthContext.jsx Security ──────────────────────────
console.log('\nAuthContext.jsx security:');

test('register() does not write role to users table', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'context', 'AuthContext.jsx'), 'utf8');
  // Find register function
  const registerIdx = content.indexOf('const register = useCallback');
  const registerEnd = content.indexOf('}, []);', registerIdx);
  const registerFunc = content.substring(registerIdx, registerEnd);
  // Should NOT contain .update({ role }) or .update({ role:
  assert.ok(!registerFunc.includes('.update({ role'), 'register() must not update role on users table');
  assert.ok(!registerFunc.includes("role: userData.role"), 'register() must not send role from form data');
});

test('login() does not write role to users table', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'context', 'AuthContext.jsx'), 'utf8');
  const loginIdx = content.indexOf('const login = useCallback');
  const loginEnd = content.indexOf('}, []);', loginIdx);
  const loginFunc = content.substring(loginIdx, loginEnd);
  assert.ok(!loginFunc.includes('.update({ role'), 'login() must not update role on users table');
});

test('updateProfile() uses safe field allowlist', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'context', 'AuthContext.jsx'), 'utf8');
  const updateIdx = content.indexOf('const updateProfile = useCallback');
  const updateEnd = content.indexOf('}, [user]);', updateIdx);
  const updateFunc = content.substring(updateIdx, updateEnd + 12);
  // Must have SAFE_PROFILE_FIELDS
  assert.ok(updateFunc.includes('SAFE_PROFILE_FIELDS'), 'updateProfile must define a safe field allowlist');
  // Must NOT allow role
  assert.ok(!updateFunc.includes("'role'"), 'updateProfile must not allow role field');
  // Must NOT allow bls_points_balance
  assert.ok(!updateFunc.includes("'bls_points_balance'"), 'updateProfile must not allow bls_points_balance');
  assert.ok(!updateFunc.includes("'referral_code'"), 'updateProfile must not allow referral_code');
});

// ─── Test Group 9: Public Catalogue Security ─────────────────────────
console.log('\nPublic catalogue security (api.js):');

test('api.js fetchGuides uses explicit columns, not select(*)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  assert.ok(content.includes('PUBLIC_GUIDE_COLUMNS'), 'Must define PUBLIC_GUIDE_COLUMNS');
  assert.ok(!content.includes("from('guides').select('*')"), 'Must not use select(*) on guides');
});

test('api.js fetchGuideById uses explicit columns', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  assert.ok(!content.includes("from('guides').select('*')"), 'Must not use select(*) on guides');
});

test('api.js fetchExperiences uses explicit columns', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  assert.ok(content.includes('PUBLIC_EXPERIENCE_COLUMNS'), 'Must define PUBLIC_EXPERIENCE_COLUMNS');
  assert.ok(!content.includes("from('experiences').select('*')"), 'Must not use select(*) on experiences');
});

test('api.js fetchDestinations uses explicit columns', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  assert.ok(content.includes('PUBLIC_DESTINATION_COLUMNS'), 'Must define PUBLIC_DESTINATION_COLUMNS');
  assert.ok(!content.includes("from('destinations').select('*')"), 'Must not use select(*) on destinations');
});

test('Public guide columns do NOT include user_id, referral_code, bls_points_balance', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  const guideColSection = content.substring(content.indexOf('PUBLIC_GUIDE_COLUMNS'), content.indexOf('].join'));
  assert.ok(!guideColSection.includes("'user_id'"), 'PUBLIC_GUIDE_COLUMNS must not include user_id');
  assert.ok(!guideColSection.includes("'referral_code'"), 'PUBLIC_GUIDE_COLUMNS must not include referral_code');
  assert.ok(!guideColSection.includes("'bls_points_balance'"), 'PUBLIC_GUIDE_COLUMNS must not include bls_points_balance');
  assert.ok(!guideColSection.includes("'referred_by_ambassador_id'"), 'PUBLIC_GUIDE_COLUMNS must not include referred_by_ambassador_id');
});

test('fetchGuides filters by status=published only', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'api.js'), 'utf8');
  const fetchGuidesIdx = content.indexOf('export async function fetchGuides');
  const fetchGuidesFunc = content.substring(fetchGuidesIdx, content.indexOf('}', fetchGuidesIdx + 200) + 200);
  assert.ok(fetchGuidesFunc.includes("eq('status', 'published')"), 'fetchGuides must filter by published status');
});

// ─── Test Group 10: Standalone Function Security ─────────────────────
console.log('\nStandalone function security:');

test('guide-profile.js uses authenticateGuideOwner', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'guide-profile.js'), 'utf8');
  assert.ok(content.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(content.includes('authenticateGuideOwner'), 'Must use authenticateGuideOwner');
  assert.ok(!content.includes('jwtDecode'), 'Must not use jwtDecode');
});

test('applications.js uses authenticateAdmin', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'applications.js'), 'utf8');
  assert.ok(content.includes("require('./auth.cjs')"), 'Must import auth.cjs');
  assert.ok(content.includes('authenticateAdmin'), 'Must use authenticateAdmin');
  assert.ok(!content.includes('jwtDecode'), 'Must not use jwtDecode');
});

test('apply-guide.js remains public (no auth required)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'apply-guide.js'), 'utf8');
  assert.ok(!content.includes('auth.cjs'), 'apply-guide must remain public (no auth import)');
});

test('apply-ambassador.js remains public (no auth required)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'apply-ambassador.js'), 'utf8');
  assert.ok(!content.includes('auth.cjs'), 'apply-ambassador must remain public (no auth import)');
});

// ─── Test Group 11: Admin Endpoint Verification ──────────────────────
console.log('\nAdmin endpoint verification:');

test('handleAdminPlatformConfig uses authenticateAdmin (not jwtDecode)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  const adminConfigIdx = content.indexOf('handleAdminPlatformConfig');
  const adminConfigFunc = content.substring(adminConfigIdx, adminConfigIdx + 500);
  assert.ok(adminConfigFunc.includes('authenticateAdmin'), 'handleAdminPlatformConfig must use authenticateAdmin');
  assert.ok(!adminConfigFunc.includes('jwtDecode('), 'handleAdminPlatformConfig must not use jwtDecode');
});

test('handleAdminPaymentReports uses authenticateAdmin (not jwtDecode)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  const paymentIdx = content.indexOf('handleAdminPaymentReports');
  const paymentFunc = content.substring(paymentIdx, paymentIdx + 500);
  assert.ok(paymentFunc.includes('authenticateAdmin'), 'handleAdminPaymentReports must use authenticateAdmin');
  assert.ok(!paymentFunc.includes('jwtDecode('), 'handleAdminPaymentReports must not use jwtDecode');
});

test('handleApplications uses authenticateAdmin (not jwtDecode)', () => {
  const fs = require('fs');
  const content = fs.readFileSync(require('path').join(__dirname, '..', 'netlify', 'functions', 'api.cjs'), 'utf8');
  const appsIdx = content.indexOf('handleApplications');
  const appsFunc = content.substring(appsIdx, appsIdx + 500);
  assert.ok(appsFunc.includes('authenticateAdmin'), 'handleApplications must use authenticateAdmin');
  assert.ok(!appsFunc.includes('jwtDecode('), 'handleApplications must not use jwtDecode');
});

// ─── Results ──────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
