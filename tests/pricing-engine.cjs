// Pricing Engine v2.0 — Shared logic for tests and server
// This file mirrors the calculateBookingPrice() function in api.cjs
// Used for unit testing the pricing math independently

const REFERRAL_FLAT_DISCOUNT = { gbp: 50, eur: 50, usd: 50 };
const REFERRAL_DISCOUNT_CAP_PCT = 0.15;

function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

function calculateReferralDiscount({ currency, grossPlatformFee, eligiblePlatformFeeRemaining }) {
  const cur = (currency || 'usd').toLowerCase();
  const flatDiscount = REFERRAL_FLAT_DISCOUNT[cur] || REFERRAL_FLAT_DISCOUNT.usd;
  const percentageCap = roundCurrency(grossPlatformFee * REFERRAL_DISCOUNT_CAP_PCT);
  const cap = eligiblePlatformFeeRemaining !== undefined ? eligiblePlatformFeeRemaining : grossPlatformFee;
  return Math.max(0, Math.min(flatDiscount, percentageCap, cap));
}

function calculateBookingPrice({
  tripPrice,
  currency = 'usd',
  travelers = 1,
  platformFeePct = 0.20,
  referralCode = null,
  porterTraining = false,
  promoActive = true,
}) {
  const cur = currency.toLowerCase();
  const price = Math.max(0, parseFloat(tripPrice) || 0);
  const travelersCount = Math.max(1, parseInt(travelers) || 1);

  const grossPlatformFee = roundCurrency(price * platformFeePct);
  const localPartnerBalance = roundCurrency(price - grossPlatformFee);

  const totalTrip = roundCurrency(price * travelersCount);
  const totalGrossPlatformFee = roundCurrency(grossPlatformFee * travelersCount);
  const totalLocalPartnerBalance = roundCurrency(localPartnerBalance * travelersCount);

  const bookingLockPerPerson = roundCurrency(price * 0.20);
  const platformFeeBalancePerPerson = roundCurrency(Math.max(0, grossPlatformFee - bookingLockPerPerson));
  const totalBookingLock = roundCurrency(bookingLockPerPerson * travelersCount);
  const totalPlatformFeeBalance = roundCurrency(platformFeeBalancePerPerson * travelersCount);

  let effectiveReferralDiscount = 0;
  if (referralCode) {
    effectiveReferralDiscount = calculateReferralDiscount({
      currency: cur,
      grossPlatformFee: totalGrossPlatformFee,
      eligiblePlatformFeeRemaining: totalGrossPlatformFee,
    });
  }

  const porterTrainingAmount = porterTraining ? 10 : 0;
  const discountedBookingLock = Math.max(0, roundCurrency(totalBookingLock - effectiveReferralDiscount));
  const finalDeposit = roundCurrency(discountedBookingLock + porterTrainingAmount);

  return {
    currency: cur,
    listedTripPrice: price,
    travelers: travelersCount,
    platformFeePercentage: platformFeePct * 100,
    localPartnerPercentage: (1 - platformFeePct) * 100,
    grossPlatformFee,
    totalGrossPlatformFee,
    localPartnerBalance,
    totalLocalPartnerBalance,
    bookingLockPerPerson,
    platformFeeBalancePerPerson,
    totalBookingLock,
    totalPlatformFeeBalance,
    effectiveReferralDiscount,
    porterTrainingAmount,
    discountedBookingLock,
    finalDeposit,
    calculationVersion: '2.0',
  };
}

module.exports = { calculateBookingPrice, calculateReferralDiscount, roundCurrency, REFERRAL_FLAT_DISCOUNT, REFERRAL_DISCOUNT_CAP_PCT };
