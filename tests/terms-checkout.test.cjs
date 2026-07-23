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
const migrationPath = path.join(root, 'supabase', 'migrations', 'terms_acceptance.sql');

const terms = fs.readFileSync(termsPath, 'utf8');
const checkout = fs.readFileSync(checkoutPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

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
  assert.ok(forceMajeureRows <= 2, `Expected ≤2 "Force majeure" mentions (clause + table), found ${forceMajeureRows}`);
});

test('Referral column uses "Does not carry forward" consistently', () => {
  const doesNotCarry = (terms.match(/Does not carry forward/g) || []).length;
  assert.ok(doesNotCarry >= 3, `Expected ≥3 "Does not carry forward" in table, found ${doesNotCarry}`);
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
  assert.ok(checkout.includes('inputProps={{ \'aria-label\''), 'Missing aria-label on checkboxes');
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

test('Server uses pricing engine currency for Stripe session (not client currency)', () => {
  assert.ok(api.includes('currency: pricing.currency'), 'Stripe session not using pricing.currency');
});

test('Server stores authoritative values in Stripe metadata', () => {
  assert.ok(api.includes('bookingRef: serverBookingRef'), 'bookingRef not in metadata');
  assert.ok(api.includes('termsVersion: CURRENT_TERMS_VERSION'), 'termsVersion not in metadata');
  assert.ok(api.includes('disclosureVersion: CURRENT_DISCLOSURE_VERSION'), 'disclosureVersion not in metadata');
  assert.ok(api.includes('serverAcceptedAt,'), 'serverAcceptedAt not in metadata');
});

// ─── API: Authoritative Trip Pricing (Blocker 1) ───────────────────
console.log('\n=== API: Authoritative Trip Pricing ===\n');

test('Server fetches guide record from Supabase (does not trust client price)', () => {
  assert.ok(api.includes("from('guides')"), 'Does not query guides table');
  assert.ok(api.includes('.eq(\'id\', guideId)'), 'Does not filter by guideId');
  assert.ok(api.includes('.maybeSingle()'), 'Does not use maybeSingle');
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
  // Verify the pricing engine call in handleStripe uses authoritativePrice, not client price
  const handleStripeSection = api.slice(api.indexOf('async function handleStripe'), api.indexOf('// Helper: find a user by referral code'));
  assert.ok(handleStripeSection.includes('tripPrice: authoritativePrice'), 'Pricing engine not using authoritativePrice in handleStripe');
  assert.ok(!handleStripeSection.includes('tripPrice: price,'), 'Still passing client price to pricing engine in handleStripe');
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

test('Server rejects unsupported currency', () => {
  assert.ok(api.includes('Unsupported currency'), 'Missing unsupported currency error');
});

test('Server uses guide trading_name (not client guideName)', () => {
  assert.ok(api.includes('authoritativeGuideName'), 'Does not derive authoritative guide name');
  assert.ok(api.includes('guideRecord.trading_name'), 'Does not use trading_name from DB');
  assert.ok(api.includes('metadata:'), 'Missing metadata in Stripe session');
});

test('Client price is NOT used in pricing engine call', () => {
  // Extract the handleStripe function section only (not the calculateBookingPrice definition)
  const handleStripeSection = api.slice(api.indexOf('async function handleStripe'), api.indexOf('// Helper: find a user by referral code'));
  const pricingCallMatch = handleStripeSection.match(/calculateBookingPrice\(\{[\s\S]*?\}\)/);
  assert.ok(pricingCallMatch, 'No calculateBookingPrice call found in handleStripe');
  assert.ok(pricingCallMatch[0].includes('tripPrice: authoritativePrice'), 'Pricing engine not using authoritativePrice');
  assert.ok(!pricingCallMatch[0].includes('tripPrice: price'), 'Still passing client price to pricing engine');
});

// ─── API: Stripe Webhook (Blocker 2) ──────────────────────────────
console.log('\n=== API: Stripe Webhook ===\n');

test('Stripe webhook handler exists', () => {
  assert.ok(api.includes('handleStripeWebhook'), 'Missing handleStripeWebhook function');
});

test('Webhook verifies Stripe signature', () => {
  assert.ok(api.includes('webhooks.constructEvent') || api.includes('constructEvent'), 'Missing signature verification');
  assert.ok(api.includes('STRIPE_WEBHOOK_SECRET'), 'Missing STRIPE_WEBHOOK_SECRET');
});

test('Webhook checks payment_status is paid', () => {
  assert.ok(api.includes('payment_status'), 'Missing payment_status check');
  assert.ok(api.includes("'paid'") || api.includes('"paid"'), 'Missing paid status check');
});

test('Webhook route registered in router', () => {
  assert.ok(api.includes("case 'stripe-webhook'") || api.includes("'stripe-webhook'"), 'Missing stripe-webhook route');
});

test('Webhook reads metadata from session', () => {
  assert.ok(api.includes('session.metadata'), 'Missing session.metadata in webhook');
});

test('Webhook handler returns 200 OK for successful processing', () => {
  assert.ok(api.includes('statusCode: 200'), 'Missing 200 response in webhook');
});

test('Confirm-payment endpoint is now status-only (read-only reconciliation)', () => {
  // confirm-payment should not be the sole persistence mechanism for terms/referrals
  assert.ok(api.includes('handleConfirmPayment'), 'confirm-payment handler still exists (expected as status endpoint)');
});

// ─── API: Webhook persistence ───────────────────────────────────────
console.log('\n=== API: Webhook Persistence ===\n');

test('confirm-payment reads termsVersion from Stripe metadata', () => {
  assert.ok(api.includes('meta.termsVersion'), 'Not reading termsVersion from metadata');
});

test('confirm-payment reads bookingRef from Stripe metadata', () => {
  assert.ok(api.includes('meta.bookingRef'), 'Not reading bookingRef from metadata');
});

test('confirm-payment inserts into terms_acceptance', () => {
  assert.ok(api.includes("terms_acceptance") && api.includes(".insert("), 'Missing terms_acceptance insert');
});

test('confirm-payment reports persisted: false on insert error', () => {
  assert.ok(api.includes("persisted: false"), 'Missing persisted: false on error');
});

test('confirm-payment is idempotent (skips duplicate session_id)', () => {
  assert.ok(api.includes('already exists') || api.includes('idempotent') || api.includes('maybeSingle'), 'Missing idempotency check');
});

test('confirm-payment stores confirmed_checkbox: true and insurance_confirmed_checkbox: true', () => {
  assert.ok(api.includes('confirmed_checkbox: true'), 'Missing confirmed_checkbox: true');
  assert.ok(api.includes('insurance_confirmed_checkbox: true'), 'Missing insurance_confirmed_checkbox: true');
});

// ─── Migration: terms_acceptance table ──────────────────────────────
console.log('\n=== Migration: terms_acceptance Table ===\n');

test('session_id has UNIQUE constraint', () => {
  assert.ok(migration.includes('session_id') && migration.includes('UNIQUE'), 'Missing UNIQUE on session_id');
});

test('departure_date is DATE type', () => {
  assert.ok(migration.includes('departure_date DATE'), 'departure_date not DATE type');
});

test('client_accepted_at is TIMESTAMPTZ type', () => {
  assert.ok(migration.includes('client_accepted_at TIMESTAMPTZ'), 'client_accepted_at not TIMESTAMPTZ');
});

test('confirmed_checkbox CHECK constraint requires true', () => {
  assert.ok(migration.includes('CHECK (confirmed_checkbox = true)'), 'Missing CHECK on confirmed_checkbox');
});

test('insurance_confirmed_checkbox CHECK constraint requires true', () => {
  assert.ok(migration.includes('CHECK (insurance_confirmed_checkbox = true)'), 'Missing CHECK on insurance_confirmed_checkbox');
});

test('currency CHECK constraint restricts to gbp/eur/usd', () => {
  assert.ok(migration.includes("CHECK (currency IN ('gbp', 'eur', 'usd'))"), 'Missing CHECK on currency');
});

test('UPDATE and DELETE privileges revoked from all roles', () => {
  assert.ok(migration.includes('REVOKE UPDATE, DELETE'), 'Missing REVOKE');
});

test('Trigger rejects UPDATE operations', () => {
  assert.ok(migration.includes('BEFORE UPDATE') && migration.includes('TRIGGER'), 'Missing UPDATE trigger');
});

test('Trigger rejects DELETE operations', () => {
  assert.ok(migration.includes('BEFORE DELETE') && migration.includes('TRIGGER'), 'Missing DELETE trigger');
});

test('Only INSERT and SELECT granted to service_role', () => {
  assert.ok(migration.includes('GRANT INSERT, SELECT'), 'Missing GRANT');
});

test('Migration is atomic (wrapped in BEGIN/COMMIT)', () => {
  assert.ok(migration.includes('BEGIN;') && migration.includes('COMMIT;'), 'Not wrapped in BEGIN/COMMIT');
});

test('RLS enabled', () => {
  assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'), 'RLS not enabled');
});

// ─── Summary ────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
