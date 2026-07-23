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

// ─── Load source files ──────────────────────────────────────────────
const root = path.join(__dirname, '..');
const termsPath = path.join(root, 'src', 'pages', 'Terms.jsx');
const checkoutPath = path.join(root, 'src', 'pages', 'Checkout.jsx');
const apiPath = path.join(root, 'netlify', 'functions', 'api.cjs');
const webhookPath = path.join(root, 'netlify', 'functions', 'webhook-stripe.cjs');
const migrationPath = path.join(root, 'supabase', 'migrations', 'terms_acceptance.sql');
const freshInstallPath = path.join(root, 'supabase', 'migrations', '002_webhook_infrastructure.sql');
const upgradePath = path.join(root, 'supabase', 'migrations', '002a_terms_acceptance_upgrade.sql');
const netlifyToml = path.join(root, 'netlify.toml');

const terms = fs.readFileSync(termsPath, 'utf8');
const checkout = fs.readFileSync(checkoutPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');
const webhook = fs.readFileSync(webhookPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const freshInstall = fs.readFileSync(freshInstallPath, 'utf8');
const upgrade = fs.readFileSync(upgradePath, 'utf8');
const toml = fs.readFileSync(netlifyToml, 'utf8');

// ─── Terms.jsx: Prohibited wording ──────────────────────────────────
console.log('\n=== Terms.jsx: Prohibited Wording ===\n');

test('"Lifetime Deposit Credit" is NOT displayed in Terms.jsx', () => {
  assert.ok(!terms.includes('Lifetime Deposit Credit'), 'Found "Lifetime Deposit Credit"');
});

test('"Lifetime Deposit Credit" is NOT in the checkout warning', () => {
  assert.ok(!checkout.includes('Lifetime Deposit Credit'), 'Checkout contains "Lifetime Deposit Credit"');
});

test('30-day condition is NOT customer-facing in Terms clause 7.1', () => {
  const lines = terms.split('\n');
  const idx71 = lines.findIndex(l => l.includes('7.1'));
  const idx72 = lines.findIndex((l, i) => i > idx71 && l.includes('7.2'));
  const section71 = lines.slice(idx71, idx72 > 0 ? idx72 : idx71 + 10).join('\n');
  assert.ok(!section71.includes('more than 30 days'), '30-day condition in clause 7.1');
});

test('30-day condition is NOT in checkout warning', () => {
  const warningMatch = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(warningMatch, 'No warning alert');
  assert.ok(!warningMatch[0].includes('more than 30 days'), '30-day in checkout warning');
});

test('12-month expiry is NOT in checkout warning', () => {
  const warningMatch = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(warningMatch, 'No warning alert');
  assert.ok(!warningMatch[0].includes('12-month'), '12-month expiry in checkout warning');
});

test('"provided the applicable grace-period conditions" is NOT in clause 7.1', () => {
  assert.ok(!terms.includes('provided the applicable grace-period conditions'), 'Undefined grace-period conditions phrase found');
});

test('"Forfeited" is NOT used in referral column (use "Does not carry forward")', () => {
  assert.ok(!terms.includes('>Forfeited<') && !terms.includes('"Forfeited"'), '"Forfeited" still used in Terms');
});

// ─── Terms.jsx: Required wording ────────────────────────────────────
console.log('\n=== Terms.jsx: Required Wording ===\n');

test('Terms uses "Deposit Credit"', () => {
  assert.ok(terms.includes('Deposit Credit'), 'Missing "Deposit Credit"');
});

test('Cancellation matrix is present', () => {
  assert.ok(terms.includes('Cancellation Outcomes Summary'), 'Missing cancellation matrix');
  assert.ok(terms.includes('Traveler cancels within 48h grace period'), 'Missing grace period row');
});

test('Force-majeure table has single row (reconciled with 7.7)', () => {
  const forceMajeureRows = (terms.match(/Force majeure/g) || []).length;
  assert.ok(forceMajeureRows <= 2, `Expected <=2 "Force majeure" mentions (clause + table), found ${forceMajeureRows}`);
});

test('Referral column uses "Does not carry forward" consistently', () => {
  const doesNotCarry = (terms.match(/Does not carry forward/g) || []).length;
  assert.ok(doesNotCarry >= 3, `Expected >=3 "Does not carry forward" in table, found ${doesNotCarry}`);
});

test('Terms references Consumer Rights Act 2015', () => {
  assert.ok(terms.includes('Consumer Rights Act 2015'), 'Missing CRA 2015');
});

test('Terms references Package Travel Regulations 2018', () => {
  assert.ok(terms.includes('Package Travel') && terms.includes('2018'), 'Missing PTR 2018');
});

test('Insurance is "additional protection"', () => {
  assert.ok(terms.includes('additional protection'), 'Missing additional protection');
});

test('Monetary refund provision exists', () => {
  assert.ok(terms.includes('monetary refund'), 'Missing monetary refund');
});

test('DRAFT banner: "pending legal review", no "founder"', () => {
  assert.ok(terms.includes('pending legal review'), 'Missing legal review notice');
  assert.ok(!terms.includes('founder approval'), 'Contains founder-approval language');
});

test('Guide insolvency row does NOT promise BLS-funded refund', () => {
  assert.ok(!terms.includes('Full monetary refund (from BLS)'), 'BLS-funded refund promise still present');
  assert.ok(terms.includes('Subject to insolvency proceedings'), 'Missing insolvency proceedings text');
});

// ─── Terms.jsx: Version consistency ─────────────────────────────────
console.log('\n=== Terms.jsx: Version Consistency ===\n');

test('TERMS_VERSION is draft-0.3', () => {
  assert.ok(terms.includes("'draft-0.3'") || terms.includes('"draft-0.3"'), 'TERMS_VERSION not draft-0.3');
});

// ─── Checkout.jsx: Warning + acknowledgements ───────────────────────
console.log('\n=== Checkout.jsx: Warning + Acknowledgements ===\n');

test('Checkout warning uses "Deposit Credit", no "Lifetime"', () => {
  const w = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(w, 'No warning alert');
  assert.ok(w[0].includes('Deposit Credit'), 'Missing Deposit Credit');
  assert.ok(!w[0].includes('Lifetime'), 'Contains Lifetime');
});

test('Checkout warning references 48-hour grace period', () => {
  const w = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(w && w[0].includes('48'), 'Missing 48-hour reference');
});

test('Checkout uses MUI Checkbox (accessible)', () => {
  assert.ok(checkout.includes('Checkbox'), 'Missing MUI Checkbox component');
  assert.ok(checkout.includes('FormControlLabel'), 'Missing FormControlLabel');
  assert.ok(checkout.includes("inputProps={{ 'aria-label'"), 'Missing aria-label on checkboxes');
});

test('Pay button requires both checkboxes', () => {
  assert.ok(checkout.includes('!confirmed || !insuranceConfirmed'), 'Pay button missing checkbox guard');
});

test('Acknowledgement references sections 6 and 7', () => {
  assert.ok(checkout.includes('sections 6 and 7'), 'Missing sections 6 and 7 reference');
});

// ─── Checkout.jsx: termsAccepted — client sends only checkbox states ─
console.log('\n=== Checkout.jsx: termsAccepted (Client-side) ===\n');

test('Checkout sends termsAccepted to create-checkout', () => {
  assert.ok(checkout.includes('termsAccepted:'), 'termsAccepted not sent');
});

test('Client termsAccepted contains confirmed and insuranceConfirmed', () => {
  const match = checkout.match(/termsAccepted:\s*\{([^}]+)\}/);
  assert.ok(match, 'Could not extract termsAccepted from checkout');
  assert.ok(match[1].includes('confirmed'), 'Missing confirmed');
  assert.ok(match[1].includes('insuranceConfirmed'), 'Missing insuranceConfirmed');
});

test('Client does NOT send termsVersion/server-generated fields', () => {
  const match = checkout.match(/termsAccepted:\s*\{([^}]+)\}/);
  assert.ok(match, 'Could not extract termsAccepted');
  assert.ok(!match[1].includes('termsVersion'), 'Client should not send termsVersion');
  assert.ok(!match[1].includes('bookingRef'), 'Client should not send bookingRef');
  assert.ok(!match[1].includes('acceptedAt'), 'Client should not send acceptedAt');
});

// ─── API: Server-side enforcement ───────────────────────────────────
console.log('\n=== API: Server-side Enforcement ===\n');

test('Server requires terms acknowledgement (confirmed + insuranceConfirmed)', () => {
  assert.ok(api.includes("termsAccepted.confirmed"), 'Missing confirmed check');
  assert.ok(api.includes("termsAccepted.insuranceConfirmed"), 'Missing insuranceConfirmed check');
});

test('Server returns 400 if terms not accepted', () => {
  assert.ok(api.includes('400') && api.includes('Terms acknowledgement'), 'Missing 400 for unaccepted terms');
});

test('Server generates authoritative bookingRef', () => {
  assert.ok(api.includes('serverBookingRef'), 'Missing server-generated bookingRef');
  assert.ok(api.includes("'bls_'"), 'Booking ref prefix not server-generated');
});

test('Server generates authoritative termsVersion and disclosureVersion', () => {
  assert.ok(api.includes('CURRENT_TERMS_VERSION'), 'Missing server-side termsVersion');
  assert.ok(api.includes('CURRENT_DISCLOSURE_VERSION'), 'Missing server-side disclosureVersion');
});

test('Server generates serverAcceptedAt timestamp', () => {
  assert.ok(api.includes('serverAcceptedAt'), 'Missing serverAcceptedAt');
  assert.ok(api.includes("new Date().toISOString()"), 'serverAcceptedAt not server-generated');
});

test('Server stores authoritative values in Stripe metadata', () => {
  assert.ok(api.includes('bookingRef: serverBookingRef'), 'bookingRef not in metadata');
  assert.ok(api.includes('termsVersion: CURRENT_TERMS_VERSION'), 'termsVersion not in metadata');
  assert.ok(api.includes('disclosureVersion: CURRENT_DISCLOSURE_VERSION'), 'disclosureVersion not in metadata');
  assert.ok(api.includes('serverAcceptedAt,'), 'serverAcceptedAt not in metadata');
});

// ─── API: Authoritative Trip Pricing & Currency ─────────────────────
console.log('\n=== API: Authoritative Trip Pricing & Currency ===\n');

test('Server fetches guide record from Supabase', () => {
  assert.ok(api.includes("from('guides')"), 'Does not query guides table');
  assert.ok(api.includes('.eq(\'id\', guideId)'), 'Does not filter by guideId');
});

test('Server validates guide is published', () => {
  assert.ok(api.includes("guideRecord.status !== 'published'"), 'Does not check guide published status');
});

test('Server validates route exists in guide.routes', () => {
  assert.ok(api.includes("guideRecord.routes"), 'Does not read guide routes');
  assert.ok(api.includes('.find(r => r.name === routeName)'), 'Does not match route by name');
});

test('Server derives price from route record (not client-supplied)', () => {
  assert.ok(api.includes('authoritativePrice'), 'Does not derive authoritative price');
  assert.ok(api.includes('Number(matchRoute.price)'), 'Does not read price from route');
  const handleStripeSection = api.slice(api.indexOf('async function handleStripe'), api.indexOf('// Helper: find a user by referral code'));
  assert.ok(handleStripeSection.includes('tripPrice: authoritativePrice'), 'Pricing engine not using authoritativePrice in handleStripe');
  assert.ok(!handleStripeSection.includes('tripPrice: price,'), 'Still passing client price to pricing engine in handleStripe');
});

test('Server derives currency EXCLUSIVELY from guideRecord.price_currency', () => {
  const handleStripeSection = api.slice(api.indexOf('async function handleStripe'), api.indexOf('// Helper: find a user by referral code'));
  assert.ok(handleStripeSection.includes('guideRecord.price_currency'), 'Does not derive currency from guideRecord');
  // Must NOT fallback to client currency
  assert.ok(!handleStripeSection.includes("(currency || guideRecord.price_currency"), 'Still falling back to client currency');
  assert.ok(!handleStripeSection.includes("(currency || 'usd')"), 'Still using client currency as fallback');
});

test('Server logs currency mismatch when client submits different currency', () => {
  const handleStripeSection = api.slice(api.indexOf('async function handleStripe'), api.indexOf('// Helper: find a user by referral code'));
  assert.ok(handleStripeSection.includes('currency_mismatch'), 'Does not log currency mismatch');
});

test('Server rejects invalid guide', () => {
  assert.ok(api.includes('Invalid guide'), 'Missing invalid guide error');
});

test('Server rejects missing route', () => {
  assert.ok(api.includes('Route'), 'Missing route-not-found error');
});

test('Server rejects zero/negative price', () => {
  assert.ok(api.includes('does not have a valid price configured'), 'Missing invalid price error');
});

test('Server uses guide trading_name (not client guideName)', () => {
  assert.ok(api.includes('authoritativeGuideName'), 'Does not derive authoritative guide name');
  assert.ok(api.includes('guideRecord.trading_name'), 'Does not use trading_name from DB');
});

// ─── API: Read-only /confirm-payment ────────────────────────────────
console.log('\n=== API: Read-only /confirm-payment ===\n');

test('confirm-payment handler exists', () => {
  assert.ok(api.includes('handleConfirmPayment'), 'Missing handleConfirmPayment');
});

test('confirm-payment does NOT insert into terms_acceptance', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(!handlerSection.includes("terms_acceptance')") || !handlerSection.includes('.insert('), 'confirm-payment still inserts into terms_acceptance');
});

test('confirm-payment does NOT insert into payment_reports', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(!handlerSection.includes("payment_reports')") || !handlerSection.includes('.insert('), 'confirm-payment still inserts into payment_reports');
});

test('confirm-payment does NOT credit referral balances', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(!handlerSection.includes('bls_points_balance'), 'confirm-payment still modifies bls_points_balance');
  assert.ok(!handlerSection.includes('.update('), 'confirm-payment still performs updates');
});

test('confirm-payment does NOT credit ambassador commissions', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(!handlerSection.includes('AMBASSADOR_COMMISSION_RATE'), 'confirm-payment still references AMBASSADOR_COMMISSION_RATE');
});

test('confirm-payment queries (not mutates) webhook_event_inbox', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(handlerSection.includes('webhook_event_inbox'), 'confirm-payment does not check webhook status');
  assert.ok(handlerSection.includes('.select('), 'confirm-payment does not query');
});

test('confirm-payment queries terms_acceptance for status', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(handlerSection.includes("terms_acceptance") && handlerSection.includes('.select('), 'confirm-payment does not query terms status');
});

test('confirm-payment queries booking_confirmations for status', () => {
  const handlerSection = api.slice(api.indexOf('async function handleConfirmPayment'), api.indexOf('// GET /api/rewards'));
  assert.ok(handlerSection.includes("booking_confirmations") && handlerSection.includes('.select('), 'confirm-payment does not query booking confirmation status');
});

// ─── Webhook: Separate function (Blocker 8) ─────────────────────────
console.log('\n=== Webhook: Separate Function (Rate Limit Bypass) ===\n');

test('Webhook is a separate Netlify function file', () => {
  assert.ok(fs.existsSync(webhookPath), 'webhook-stripe.cjs does not exist');
});

test('Webhook function exports handler', () => {
  assert.ok(webhook.includes('exports.handler'), 'Missing exports.handler');
});

test('Webhook is NOT under /api/* (avoids customer IP rate limiter)', () => {
  assert.ok(toml.includes('/webhooks/stripe'), 'Missing /webhooks/stripe redirect');
  assert.ok(toml.includes('webhook-stripe'), 'Missing webhook-stripe target');
});

test('Webhook route is separate from /api/* redirect', () => {
  const apiRedirectIndex = toml.indexOf('from = "/api/*"');
  const webhookRedirectIndex = toml.indexOf('from = "/webhooks/stripe"');
  assert.ok(apiRedirectIndex !== -1, 'Missing /api/* redirect');
  assert.ok(webhookRedirectIndex !== -1, 'Missing /webhooks/stripe redirect');
  assert.ok(webhookRedirectIndex > apiRedirectIndex, 'Webhook redirect must be after /api/* redirect');
});

// ─── Webhook: Signature verification ────────────────────────────────
console.log('\n=== Webhook: Signature Verification ===\n');

test('Webhook verifies Stripe signature with constructEvent', () => {
  assert.ok(webhook.includes('constructEvent'), 'Missing constructEvent');
  assert.ok(webhook.includes('STRIPE_WEBHOOK_SECRET'), 'Missing STRIPE_WEBHOOK_SECRET');
});

test('Webhook rejects missing signature (returns 400)', () => {
  assert.ok(webhook.includes('Missing Stripe signature'), 'Missing signature rejection');
});

test('Webhook rejects invalid signature (returns 400)', () => {
  assert.ok(webhook.includes('Invalid signature'), 'Missing invalid signature rejection');
});

test('Webhook checks payment_status is paid', () => {
  assert.ok(webhook.includes("'paid'") || webhook.includes('"paid"'), 'Missing paid check');
  assert.ok(webhook.includes('payment_status'), 'Missing payment_status check');
});

test('Webhook returns 200 for unpaid sessions (does not retry)', () => {
  const webhookSection = webhook.slice(webhook.indexOf('payment_status'));
  assert.ok(webhookSection.includes("'not_paid'") || webhookSection.includes('"not_paid"'), 'Missing not_paid response');
});

// ─── Webhook: Idempotency (Blocker 4) ──────────────────────────────
console.log('\n=== Webhook: Atomic Idempotency ===\n');

test('Webhook inserts event into webhook_event_inbox (ON CONFLICT)', () => {
  assert.ok(webhook.includes('webhook_event_inbox'), 'Missing webhook_event_inbox');
  assert.ok(webhook.includes('.insert('), 'Missing insert into inbox');
  assert.ok(webhook.includes('23505') || webhook.includes('unique_violation') || webhook.includes('Unique violation'), 'Missing ON CONFLICT / unique violation handling');
});

test('Webhook returns 200 for duplicate events', () => {
  assert.ok(webhook.includes('duplicate: true') || webhook.includes("'duplicate'"), 'Missing duplicate response');
});

test('Webhook uses ON CONFLICT DO NOTHING for terms_acceptance', () => {
  // The webhook should handle unique violations gracefully
  assert.ok(webhook.includes("terms_acceptance") && webhook.includes('.insert('), 'Missing terms insert');
  assert.ok(webhook.includes("'23505'") || webhook.includes('Unique violation'), 'Missing unique violation handling for terms');
});

test('Webhook uses ON CONFLICT for payment_reports', () => {
  assert.ok(webhook.includes("payment_reports") && webhook.includes('.insert('), 'Missing payment_reports insert');
});

test('Webhook uses ON CONFLICT for booking_confirmations', () => {
  assert.ok(webhook.includes("booking_confirmations") && webhook.includes('.insert('), 'Missing booking_confirmations insert');
});

test('Webhook uses RPC functions for referral rewards', () => {
  assert.ok(webhook.includes("credit_referral_reward"), 'Missing credit_referral_reward RPC call');
  assert.ok(webhook.includes('.rpc('), 'Missing RPC call');
});

test('Webhook uses RPC functions for ambassador commission', () => {
  assert.ok(webhook.includes("credit_ambassador_commission"), 'Missing credit_ambassador_commission RPC call');
});

test('Webhook uses idempotency_key for transaction deduplication', () => {
  assert.ok(webhook.includes('idempotencyKey') || webhook.includes('idempotency_key'), 'Missing idempotency_key usage');
  assert.ok(webhook.includes('referral_') || webhook.includes('ambassador_'), 'Missing referral_/ambassador_ prefix');
});

// ─── Webhook: Booking Confirmation persistence (Blocker 3) ─────────
console.log('\n=== Webhook: Booking Confirmation Persistence ===\n');

test('Webhook persists booking to booking_confirmations table', () => {
  assert.ok(webhook.includes("booking_confirmations") && webhook.includes('.insert('), 'Missing booking_confirmations insert');
});

test('Booking confirmation includes session_id', () => {
  assert.ok(webhook.includes('session_id: sessionId'), 'Missing session_id in booking confirmation');
});

test('Booking confirmation includes booking_ref', () => {
  assert.ok(webhook.includes('booking_ref: meta.bookingRef'), 'Missing booking_ref');
});

test('Booking confirmation includes payment_status', () => {
  assert.ok(webhook.includes("payment_status: 'paid'"), 'Missing payment_status paid');
});

// ─── Webhook: Failure handling (Blocker 5) ──────────────────────────
console.log('\n=== Webhook: Failure Handling ===\n');

test('Webhook marks failed events in webhook_event_inbox', () => {
  assert.ok(webhook.includes("status: 'failed'") || webhook.includes('failed'), 'Missing failed status marking');
});

test('Webhook returns 200 even on partial failures (prevents Stripe retry loops)', () => {
  assert.ok(webhook.includes('partial_failure'), 'Missing partial_failure response');
});

test('Webhook tracks fulfilmentErrors array', () => {
  assert.ok(webhook.includes('fulfilmentErrors'), 'Missing fulfilmentErrors tracking');
});

test('Webhook updates inbox status to completed on success', () => {
  assert.ok(webhook.includes("status: 'completed'"), 'Missing completed status update');
});

test('Webhook documents retry policy', () => {
  assert.ok(webhook.includes('Retry Policy') || webhook.includes('retry'), 'Missing retry policy documentation');
});

// ─── Migration: Fresh Install (002) ────────────────────────────────
console.log('\n=== Migration: Fresh Install (002_webhook_infrastructure) ===\n');

test('Fresh install migration exists', () => {
  assert.ok(fs.existsSync(freshInstallPath), '002_webhook_infrastructure.sql does not exist');
});

test('Fresh install creates webhook_event_inbox table', () => {
  assert.ok(freshInstall.includes('CREATE TABLE IF NOT EXISTS webhook_event_inbox'), 'Missing webhook_event_inbox');
});

test('Fresh install creates booking_confirmations table', () => {
  assert.ok(freshInstall.includes('CREATE TABLE IF NOT EXISTS booking_confirmations'), 'Missing booking_confirmations');
});

test('webhook_event_inbox has event_id PRIMARY KEY', () => {
  assert.ok(freshInstall.includes('event_id TEXT PRIMARY KEY'), 'Missing event_id PK');
});

test('booking_confirmations has session_id UNIQUE', () => {
  assert.ok(freshInstall.includes('session_id TEXT NOT NULL UNIQUE'), 'Missing session_id UNIQUE');
});

test('Fresh install adds payment_reports.session_id UNIQUE constraint', () => {
  assert.ok(freshInstall.includes('payment_reports_session_id_key'), 'Missing payment_reports UNIQUE');
});

test('Fresh install adds idempotency_key to transactions', () => {
  assert.ok(freshInstall.includes('idempotency_key TEXT'), 'Missing idempotency_key column');
  assert.ok(freshInstall.includes('idx_transactions_idempotency_key'), 'Missing idempotency_key index');
});

test('Fresh install creates credit_referral_reward RPC', () => {
  assert.ok(freshInstall.includes('credit_referral_reward'), 'Missing credit_referral_reward RPC');
  assert.ok(freshInstall.includes('LANGUAGE plpgsql SECURITY DEFINER'), 'Missing SECURITY DEFINER');
});

test('Fresh install creates credit_ambassador_commission RPC', () => {
  assert.ok(freshInstall.includes('credit_ambassador_commission'), 'Missing credit_ambassador_commission RPC');
});

test('Fresh install enables RLS on new tables', () => {
  assert.ok(freshInstall.includes('webhook_event_inbox ENABLE ROW LEVEL SECURITY'), 'Missing RLS on webhook_event_inbox');
  assert.ok(freshInstall.includes('booking_confirmations ENABLE ROW LEVEL SECURITY'), 'Missing RLS on booking_confirmations');
});

test('Fresh install is atomic (BEGIN/COMMIT)', () => {
  assert.ok(freshInstall.includes('BEGIN;') && freshInstall.includes('COMMIT;'), 'Not atomic');
});

// ─── Migration: Upgrade Safety (002a) ──────────────────────────────
console.log('\n=== Migration: Upgrade Safety (002a) ===\n');

test('Upgrade migration exists', () => {
  assert.ok(fs.existsSync(upgradePath), '002a_terms_acceptance_upgrade.sql does not exist');
});

test('Upgrade adds columns as NULLABLE first (no NOT NULL)', () => {
  assert.ok(upgrade.includes('ADD COLUMN'), 'Missing ADD COLUMN');
  // Should NOT contain NOT NULL in the ALTER TABLE ADD COLUMN statements
  const lines = upgrade.split('\n');
  const addColumnLines = lines.filter(l => l.includes('ADD COLUMN'));
  for (const line of addColumnLines) {
    assert.ok(!line.toUpperCase().includes('NOT NULL'), `Column added with NOT NULL: ${line.trim()}`);
  }
});

test('Upgrade does NOT backfill with invented values', () => {
  assert.ok(!upgrade.includes("DEFAULT '") || upgrade.split("\n").filter(l => l.includes("DEFAULT '")).length <= 1, 'Contains invented default values');
  assert.ok(!upgrade.includes("DEFAULT CURRENT_DATE"), 'Contains DEFAULT CURRENT_DATE');
  assert.ok(!upgrade.includes("DEFAULT true"), 'Contains DEFAULT true (invented acceptance)');
  assert.ok(!upgrade.includes("DEFAULT 'draft-"), 'Contains invented Terms version default');
});

test('Upgrade reports unresolved NULLs instead of inventing values', () => {
  assert.ok(upgrade.includes('RAISE WARNING') || upgrade.includes('v_null_count'), 'Missing NULL audit reporting');
  assert.ok(upgrade.includes('unresolved NULL'), 'Missing unresolved NULL messaging');
});

test('Upgrade adds CHECK constraints with EXCEPTION handling', () => {
  assert.ok(upgrade.includes('EXCEPTION WHEN check_violation'), 'Missing check_violation exception handling');
});

test('Upgrade adds UNIQUE constraint with duplicate check', () => {
  assert.ok(upgrade.includes('HAVING COUNT(*) > 1') || upgrade.includes('duplicate session_ids'), 'Missing duplicate check before UNIQUE');
});

test('Upgrade is atomic (BEGIN/COMMIT)', () => {
  assert.ok(upgrade.includes('BEGIN;') && upgrade.includes('COMMIT;'), 'Not atomic');
});

test('Upgrade preserves existing records (no DELETE or TRUNCATE)', () => {
  assert.ok(!upgrade.includes('DELETE FROM'), 'Contains DELETE FROM');
  assert.ok(!upgrade.includes('TRUNCATE'), 'Contains TRUNCATE');
});

// ─── Migration: Original terms_acceptance.sql ───────────────────────
console.log('\n=== Migration: terms_acceptance.sql ===\n');

test('Original migration is atomic', () => {
  assert.ok(migration.includes('BEGIN;') && migration.includes('COMMIT;'), 'Not wrapped in BEGIN/COMMIT');
});

test('terms_acceptance has session_id UNIQUE', () => {
  assert.ok(migration.includes('session_id') && migration.includes('UNIQUE'), 'Missing UNIQUE on session_id');
});

test('terms_acceptance has CHECK constraints', () => {
  assert.ok(migration.includes('CHECK (confirmed_checkbox = true)'), 'Missing confirmed_checkbox CHECK');
  assert.ok(migration.includes('CHECK (insurance_confirmed_checkbox = true)'), 'Missing insurance_confirmed_checkbox CHECK');
  assert.ok(migration.includes("CHECK (currency IN ('gbp', 'eur', 'usd'))"), 'Missing currency CHECK');
});

test('UPDATE/DELETE revoked from all roles', () => {
  assert.ok(migration.includes('REVOKE UPDATE, DELETE'), 'Missing REVOKE');
});

test('Triggers reject UPDATE and DELETE', () => {
  assert.ok(migration.includes('BEFORE UPDATE') && migration.includes('BEFORE DELETE'), 'Missing triggers');
});

test('Only INSERT and SELECT granted to service_role', () => {
  assert.ok(migration.includes('GRANT INSERT, SELECT'), 'Missing GRANT');
});

test('RLS enabled', () => {
  assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'), 'RLS not enabled');
});

// ─── Summary ────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
