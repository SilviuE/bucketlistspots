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

const terms = fs.readFileSync(termsPath, 'utf8');
const checkout = fs.readFileSync(checkoutPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');

// ─── Terms.jsx: Prohibited wording ──────────────────────────────────
console.log('\n=== Terms.jsx: Prohibited Wording ===\n');

test('"Lifetime Deposit Credit" is NOT displayed in Terms.jsx', () => {
  assert.ok(!terms.includes('Lifetime Deposit Credit'), 'Found "Lifetime Deposit Credit" — must use "Deposit Credit" only');
});

test('"Lifetime Deposit Credit" is NOT in the checkout warning', () => {
  assert.ok(!checkout.includes('Lifetime Deposit Credit'), 'Checkout contains "Lifetime Deposit Credit"');
});

test('The unapproved 30-day condition is NOT customer-facing in Terms.jsx', () => {
  const lines = terms.split('\n');
  const inClause71 = lines.findIndex(l => l.includes('7.1'));
  const inClause72 = lines.findIndex(l => l.includes('7.2'));
  const section7 = lines.slice(inClause71, inClause72 > 0 ? inClause72 : undefined).join('\n');
  assert.ok(!section7.includes('more than 30 days'), '30-day condition appears in customer-facing clause 7.1');
});

test('The unapproved 30-day condition is NOT customer-facing in checkout warning', () => {
  const warningMatch = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(warningMatch, 'No warning alert found in checkout');
  assert.ok(!warningMatch[0].includes('more than 30 days'), 'Checkout warning references 30-day condition');
});

// ─── Terms.jsx: Required wording ────────────────────────────────────
console.log('\n=== Terms.jsx: Required Wording ===\n');

test('Terms uses "Deposit Credit" (not "Lifetime")', () => {
  assert.ok(terms.includes('Deposit Credit'), 'Missing "Deposit Credit" in Terms');
});

test('Terms includes cancellation-outcomes matrix (Table 1)', () => {
  assert.ok(terms.includes('Cancellation Outcomes Summary') || terms.includes('cancellation-outcomes matrix'), 'Missing cancellation matrix');
  assert.ok(terms.includes('Traveler cancels within 48h grace period'), 'Missing grace period scenario in matrix');
});

test('Terms references Consumer Rights Act 2015', () => {
  assert.ok(terms.includes('Consumer Rights Act 2015'), 'Missing Consumer Rights Act reference');
});

test('Terms references Package Travel Regulations 2018', () => {
  assert.ok(terms.includes('Package Travel') && terms.includes('2018'), 'Missing PTR 2018 reference');
});

test('Insurance is described as "additional protection"', () => {
  assert.ok(terms.includes('additional protection'), 'Insurance not described as additional protection');
});

test('Payment 1 monetary refund where law requires', () => {
  assert.ok(terms.includes('monetary refund'), 'Missing monetary refund provision');
});

test('Terms DRAFT banner is present', () => {
  assert.ok(terms.includes('Draft') || terms.includes('DRAFT'), 'Missing draft banner');
  assert.ok(terms.includes('pending legal review'), 'Missing legal review notice in draft banner');
  assert.ok(!terms.includes('founder approval'), 'DRAFT banner contains internal founder-approval language');
});

// ─── Terms.jsx: Version consistency ─────────────────────────────────
console.log('\n=== Terms.jsx: Version Consistency ===\n');

test('TERMS_VERSION is defined in Terms.jsx', () => {
  assert.ok(terms.includes("TERMS_VERSION"), 'TERMS_VERSION constant not found');
});

test('TERMS_VERSION value is draft-0.3', () => {
  assert.ok(terms.includes("'draft-0.3'") || terms.includes('"draft-0.3"'), 'TERMS_VERSION is not draft-0.3');
});

test('Acceptance record schema in checkout and API includes version and timestamp', () => {
  // Checkout sends termsVersion, disclosureVersion, acceptedAt
  assert.ok(checkout.includes('termsVersion:'), 'Checkout missing termsVersion');
  assert.ok(checkout.includes('disclosureVersion:'), 'Checkout missing disclosureVersion');
  assert.ok(checkout.includes('acceptedAt:'), 'Checkout missing acceptedAt');
  // API stores terms_version, disclosure_version, server_accepted_at, client_accepted_at
  assert.ok(api.includes('terms_version:'), 'API missing terms_version column insert');
  assert.ok(api.includes('disclosure_version:'), 'API missing disclosure_version column insert');
  assert.ok(api.includes('client_accepted_at:'), 'API missing client_accepted_at insert');
});

// ─── Checkout.jsx: Warning alert wording ────────────────────────────
console.log('\n=== Checkout.jsx: Warning Alert Wording ===\n');

test('Checkout warning uses "Deposit Credit" (not "Lifetime")', () => {
  const warningMatch = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(warningMatch, 'No warning alert found');
  assert.ok(warningMatch[0].includes('Deposit Credit'), 'Warning does not use "Deposit Credit"');
  assert.ok(!warningMatch[0].includes('Lifetime'), 'Warning still contains "Lifetime"');
});

test('Checkout warning references 48-hour grace period', () => {
  const warningMatch = checkout.match(/<Alert severity="warning"[\s\S]*?<\/Alert>/);
  assert.ok(warningMatch, 'No warning alert found');
  assert.ok(warningMatch[0].includes('48'), 'Warning does not reference 48-hour grace period');
});

// ─── Checkout.jsx: Required acknowledgements ────────────────────────
console.log('\n=== Checkout.jsx: Required Acknowledgements ===\n');

test('Checkout requires both confirmed and insuranceConfirmed to enable Pay button', () => {
  assert.ok(checkout.includes('!confirmed || !insuranceConfirmed'), 'Pay button does not require both checkboxes');
});

test('Checkout acknowledgement references Terms sections 6 and 7', () => {
  assert.ok(checkout.includes('sections 6 and 7') || checkout.includes('section 6') && checkout.includes('section 7'), 'Acknowledgement does not reference sections 6 and 7');
});

// ─── Checkout.jsx: termsAccepted object ─────────────────────────────
console.log('\n=== Checkout.jsx: termsAccepted Persistence ===\n');

test('Checkout sends termsAccepted to create-checkout endpoint', () => {
  assert.ok(checkout.includes('termsAccepted:'), 'termsAccepted not sent in create-checkout request body');
});

test('termsAccepted includes termsVersion', () => {
  assert.ok(checkout.includes('termsVersion:'), 'termsAccepted missing termsVersion');
});

test('termsAccepted includes disclosureVersion', () => {
  assert.ok(checkout.includes('disclosureVersion:'), 'termsAccepted missing disclosureVersion');
});

test('termsAccepted includes acceptedAt', () => {
  assert.ok(checkout.includes('acceptedAt:'), 'termsAccepted missing acceptedAt timestamp');
});

test('termsAccepted includes bookingRef', () => {
  assert.ok(checkout.includes('bookingRef:'), 'termsAccepted missing bookingRef');
});

test('termsAccepted includes departureDate', () => {
  assert.ok(checkout.includes('departureDate:'), 'termsAccepted missing departureDate');
});

test('termsAccepted includes depositAmount and currency', () => {
  assert.ok(checkout.includes('depositAmount:'), 'termsAccepted missing depositAmount');
  assert.ok(checkout.includes('currency,'), 'termsAccepted missing currency');
});

test('termsAccepted includes confirmed and insuranceConfirmed checkboxes', () => {
  assert.ok(checkout.includes('confirmed,'), 'termsAccepted missing confirmed checkbox state');
  assert.ok(checkout.includes('insuranceConfirmed,'), 'termsAccepted missing insuranceConfirmed checkbox state');
});

test('termsAccepted versions match TERMS_VERSION (draft-0.3)', () => {
  const match = checkout.match(/termsVersion:\s*['"]([^'"]+)['"]/);
  assert.ok(match, 'Could not extract termsVersion from checkout');
  assert.strictEqual(match[1], 'draft-0.3', `termsVersion is "${match[1]}" not "draft-0.3"`);
});

// ─── API: terms acceptance server-side persistence ──────────────────
console.log('\n=== API: Terms Acceptance Persistence ===\n');

test('create-checkout accepts termsAccepted from request body', () => {
  assert.ok(api.includes("termsAccepted") && api.includes("reqBody(event)"), 'handleStripe does not extract termsAccepted from request body');
});

test('Stripe session metadata includes termsAccepted', () => {
  assert.ok(api.includes("termsAccepted: JSON.stringify(termsAccepted"), 'termsAccepted not stored in Stripe session metadata');
});

test('confirm-payment persists to terms_acceptance table', () => {
  assert.ok(api.includes("terms_acceptance") && api.includes(".insert("), 'confirm-payment does not insert into terms_acceptance');
});

test('Server uses server-generated timestamp (server_accepted_at)', () => {
  assert.ok(api.includes('server_accepted_at') || api.includes('DEFAULT NOW()') || api.includes('server timestamp'), 'terms_acceptance does not use server-generated timestamp');
});

test('confirm-payment reads termsAccepted from Stripe metadata', () => {
  assert.ok(api.includes('meta.termsAccepted') || api.includes("termsAccepted"), 'confirm-payment does not read termsAccepted from metadata');
});

test('confirm-payment stores confirmed and insuranceConfirmed checkbox states', () => {
  assert.ok(api.includes('confirmed_checkbox'), 'confirm-payment does not store confirmed checkbox state');
  assert.ok(api.includes('insurance_confirmed_checkbox'), 'confirm-payment does not store insurance confirmed checkbox state');
});

// ─── Migration: terms_acceptance table ──────────────────────────────
console.log('\n=== Migration: terms_acceptance Table ===\n');

const migrationPath = path.join(root, 'supabase', 'migrations', 'terms_acceptance.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

test('terms_acceptance table has session_id column', () => {
  assert.ok(migration.includes('session_id'), 'Missing session_id column');
});

test('terms_acceptance has terms_version and disclosure_version columns', () => {
  assert.ok(migration.includes('terms_version'), 'Missing terms_version column');
  assert.ok(migration.includes('disclosure_version'), 'Missing disclosure_version column');
});

test('terms_acceptance has server_accepted_at with DEFAULT NOW()', () => {
  assert.ok(migration.includes('server_accepted_at'), 'Missing server_accepted_at column');
  assert.ok(migration.includes('NOW()'), 'server_accepted_at does not default to NOW()');
});

test('terms_acceptance has confirmed_checkbox and insurance_confirmed_checkbox', () => {
  assert.ok(migration.includes('confirmed_checkbox'), 'Missing confirmed_checkbox column');
  assert.ok(migration.includes('insurance_confirmed_checkbox'), 'Missing insurance_confirmed_checkbox column');
});

test('terms_acceptance has RLS enabled', () => {
  assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'), 'RLS not enabled');
});

test('terms_acceptance prevents UPDATE (append-only)', () => {
  assert.ok(migration.includes('FOR UPDATE') && migration.includes('USING (false)'), 'UPDATE not blocked');
});

test('terms_acceptance prevents DELETE (append-only)', () => {
  assert.ok(migration.includes('FOR DELETE') && migration.includes('USING (false)'), 'DELETE not blocked');
});

// ─── Summary ────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
