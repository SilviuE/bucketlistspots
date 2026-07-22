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

const API = process.env.API_URL || 'http://localhost:3002';

console.log('\n=== API Endpoint Tests ===\n');
console.log(`Target: ${API}\n`);

async function run() {
  // ─── Pricing Preview ────────────────────────────────────────────
  console.log('POST /api/pricing-preview:');

  await testAsync('Valid request returns pricing breakdown', async () => {
    const res = await fetch(`${API}/api/pricing-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripPrice: 2500, currency: 'gbp', travelers: 1 }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.platformFeePercentage, 20);
    assert.strictEqual(data.localPartnerPercentage, 80);
    assert.strictEqual(data.grossPlatformFee, 500);
    assert.strictEqual(data.localPartnerBalance, 2000);
    assert.strictEqual(data.calculationVersion, '2.0');
  });

  await testAsync('GBP, EUR, USD all work', async () => {
    for (const cur of ['gbp', 'eur', 'usd']) {
      const res = await fetch(`${API}/api/pricing-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripPrice: 1000, currency: cur }),
      });
      const data = await res.json();
      assert.strictEqual(data.currency, cur, `Failed for ${cur}`);
      assert.strictEqual(data.grossPlatformFee, 200, `Wrong fee for ${cur}`);
    }
  });

  await testAsync('Negative price rejected', async () => {
    const res = await fetch(`${API}/api/pricing-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripPrice: -500, currency: 'gbp' }),
    });
    assert.strictEqual(res.status, 400);
  });

  await testAsync('Unsupported currency rejected', async () => {
    const res = await fetch(`${API}/api/pricing-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripPrice: 1000, currency: 'jpy' }),
    });
    assert.strictEqual(res.status, 400);
  });

  await testAsync('Referral discount never changes guide balance', async () => {
    const without = await fetch(`${API}/api/pricing-preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripPrice: 1000, currency: 'gbp' }),
    }).then(r => r.json());
    const withRef = await fetch(`${API}/api/pricing-preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripPrice: 1000, currency: 'gbp', referralCode: 'TEST' }),
    }).then(r => r.json());
    assert.strictEqual(without.localPartnerBalance, withRef.localPartnerBalance);
  });

  // ─── Public Platform Settings ───────────────────────────────────
  console.log('\nGET /api/public-platform-settings:');

  await testAsync('Returns allowlisted fields only', async () => {
    const res = await fetch(`${API}/api/public-platform-settings`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Should have these fields
    assert.ok('platformFeePercentage' in data, 'Missing platformFeePercentage');
    assert.ok('localPartnerPercentage' in data, 'Missing localPartnerPercentage');
    assert.ok('referralMaximums' in data, 'Missing referralMaximums');
    assert.ok('guideStatusNames' in data, 'Missing guideStatusNames');
    assert.ok('trustGateChecks' in data, 'Missing trustGateChecks');
    assert.ok('foundingGuideActive' in data, 'Missing foundingGuideActive');
    // Should NOT have internal fields
    assert.ok(!('saas_monthly_fee_gbp' in data), 'Should not expose saas_monthly_fee_gbp');
    assert.ok(!('standard_commission_pct' in data), 'Should not expose standard_commission_pct');
  });

  await testAsync('Platform fee is 20%', async () => {
    const res = await fetch(`${API}/api/public-platform-settings`);
    const data = await res.json();
    assert.strictEqual(data.platformFeePercentage, 20);
    assert.strictEqual(data.localPartnerPercentage, 80);
  });

  // ─── Public Testimonials ────────────────────────────────────────
  console.log('\nGET /api/public-testimonials:');

  await testAsync('Returns array (may be empty)', async () => {
    const res = await fetch(`${API}/api/public-testimonials`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.testimonials), 'Expected testimonials array');
  });

  await testAsync('Draft testimonials not returned', async () => {
    const res = await fetch(`${API}/api/public-testimonials`);
    const data = await res.json();
    for (const t of data.testimonials) {
      assert.strictEqual(t.consent_status || 'granted', 'granted');
    }
  });

  // ─── Summary ────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Test runner error:', e.message);
  console.log('\nNote: API tests require the dev server to be running on port 3002.');
  console.log('Start with: npm run dev\n');
  process.exit(1);
});
