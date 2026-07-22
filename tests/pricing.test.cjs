const assert = require('assert');
const { calculateBookingPrice, calculateReferralDiscount } = require('./pricing-engine.cjs');

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

console.log('\n=== Pricing Engine v2.0 Unit Tests ===\n');

// ─── Core 20/80 Split ──────────────────────────────────────────────
console.log('Core 20/80 Split:');

test('£2,500 single traveler → BLS £500, Guide £2,000', () => {
  const r = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.grossPlatformFee, 500);
  assert.strictEqual(r.localPartnerBalance, 2000);
  assert.strictEqual(r.platformFeePercentage, 20);
  assert.strictEqual(r.localPartnerPercentage, 80);
});

test('£1,000 single traveler → BLS £200, Guide £800', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.grossPlatformFee, 200);
  assert.strictEqual(r.localPartnerBalance, 800);
});

test('$1,000 single traveler → BLS $200, Guide $800', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'usd', travelers: 1 });
  assert.strictEqual(r.grossPlatformFee, 200);
  assert.strictEqual(r.localPartnerBalance, 800);
});

test('€1,000 single traveler → BLS €200, Guide €800', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'eur', travelers: 1 });
  assert.strictEqual(r.grossPlatformFee, 200);
  assert.strictEqual(r.localPartnerBalance, 800);
});

test('Multi-traveler: £1,000 × 2 → BLS £400, Guide £1,600', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 2 });
  assert.strictEqual(r.totalGrossPlatformFee, 400);
  assert.strictEqual(r.totalLocalPartnerBalance, 1600);
  assert.strictEqual(r.travelers, 2);
});

// ─── Booking Lock (Deposit) ────────────────────────────────────────
console.log('\nBooking Lock (Deposit):');

test('£2,500 promotional Booking Lock → £500', () => {
  const r = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.totalBookingLock, 500); // 20% of 2500
});

test('£1,000 promotional Booking Lock → £200', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.totalBookingLock, 200); // 20% of 1000
});

test('Platform Fee Balance = Gross Platform Fee - Booking Lock', () => {
  const r = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.totalPlatformFeeBalance, r.totalGrossPlatformFee - r.totalBookingLock);
  assert.strictEqual(r.totalPlatformFeeBalance, 0); // 500 - 500 = 0 when 20% deposit = 20% fee
});

// ─── Referral Discount ─────────────────────────────────────────────
console.log('\nReferral Discount:');

test('£1,000 referral → £30 (capped at 15% of £200)', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 1, referralCode: 'TEST' });
  assert.strictEqual(r.effectiveReferralDiscount, 30); // 15% of 200 = 30
});

test('£2,500 referral → £50 (flat cap reached)', () => {
  const r = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1, referralCode: 'TEST' });
  assert.strictEqual(r.effectiveReferralDiscount, 50); // 15% of 500 = 75, but flat cap is 50
});

test('$500 referral → $15 (15% of $100 platform fee)', () => {
  const r = calculateBookingPrice({ tripPrice: 500, currency: 'usd', travelers: 1, referralCode: 'TEST' });
  assert.strictEqual(r.effectiveReferralDiscount, 15); // 15% of 100 = 15
});

test('Referral never changes Local Partner Balance', () => {
  const without = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1 });
  const withRef = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1, referralCode: 'TEST' });
  assert.strictEqual(without.localPartnerBalance, withRef.localPartnerBalance);
  assert.strictEqual(without.totalLocalPartnerBalance, withRef.totalLocalPartnerBalance);
});

test('No referral code → discount is 0', () => {
  const r = calculateBookingPrice({ tripPrice: 2500, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.effectiveReferralDiscount, 0);
});

// ─── Porter Training ───────────────────────────────────────────────
console.log('\nPorter Training:');

test('Porter training adds $10 to final deposit', () => {
  const without = calculateBookingPrice({ tripPrice: 1000, currency: 'usd', travelers: 1 });
  const withPT = calculateBookingPrice({ tripPrice: 1000, currency: 'usd', travelers: 1, porterTraining: true });
  assert.strictEqual(withPT.finalDeposit, without.finalDeposit + 10);
  assert.strictEqual(withPT.porterTrainingAmount, 10);
});

// ─── Edge Cases ────────────────────────────────────────────────────
console.log('\nEdge Cases:');

test('Zero price → all zeros, no errors', () => {
  const r = calculateBookingPrice({ tripPrice: 0, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.grossPlatformFee, 0);
  assert.strictEqual(r.localPartnerBalance, 0);
  assert.strictEqual(r.totalBookingLock, 0);
  assert.strictEqual(r.finalDeposit, 0);
});

test('Negative price → treated as zero', () => {
  const r = calculateBookingPrice({ tripPrice: -500, currency: 'gbp', travelers: 1 });
  assert.strictEqual(r.listedTripPrice, 0);
});

test('Zero travelers → treated as 1', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 0 });
  assert.strictEqual(r.travelers, 1);
});

test('Missing currency → defaults to usd', () => {
  const r = calculateBookingPrice({ tripPrice: 1000 });
  assert.strictEqual(r.currency, 'usd');
});

test('Calculation version is 2.0', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp' });
  assert.strictEqual(r.calculationVersion, '2.0');
});

test('Porter training + referral both apply', () => {
  const r = calculateBookingPrice({ tripPrice: 1000, currency: 'gbp', travelers: 1, referralCode: 'TEST', porterTraining: true });
  assert.strictEqual(r.effectiveReferralDiscount, 30);
  assert.strictEqual(r.porterTrainingAmount, 10);
  // finalDeposit = max(0, 200 - 30) + 10 = 180
  assert.strictEqual(r.finalDeposit, 180);
});

// ─── calculateReferralDiscount Unit Tests ───────────────────────────
console.log('\nReferral Discount Function:');

test('Flat discount: min(50, 15% cap, remaining)', () => {
  // $2500 trip, 20% = $500 fee, 15% = $75 cap, flat = $50 → result = 50
  const d = calculateReferralDiscount({ currency: 'usd', grossPlatformFee: 500, eligiblePlatformFeeRemaining: 500 });
  assert.strictEqual(d, 50);
});

test('15% cap applies for smaller fees', () => {
  // $1000 trip, 20% = $200 fee, 15% = $30 cap, flat = $50 → result = 30
  const d = calculateReferralDiscount({ currency: 'usd', grossPlatformFee: 200, eligiblePlatformFeeRemaining: 200 });
  assert.strictEqual(d, 30);
});

test('Remaining cap applies when prior discounts exist', () => {
  // If only $10 of platform fee remains eligible
  const d = calculateReferralDiscount({ currency: 'usd', grossPlatformFee: 200, eligiblePlatformFeeRemaining: 10 });
  assert.strictEqual(d, 10); // capped at remaining
});

test('Zero fee → zero discount', () => {
  const d = calculateReferralDiscount({ currency: 'usd', grossPlatformFee: 0, eligiblePlatformFeeRemaining: 0 });
  assert.strictEqual(d, 0);
});

// ─── Summary ───────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
