const rates = { usd: 1, gbp: 0.78, eur: 0.92 };
const symbols = { usd: '$', gbp: '£', eur: '€' };
const locales = { usd: 'en-US', gbp: 'en-GB', eur: 'de-DE' };

export function convert(amountUSD, currency) {
  return Math.round(amountUSD * (rates[currency] || 1));
}

export function formatPrice(amountUSD, currency) {
  const converted = convert(amountUSD, currency);
  const locale = locales[currency] || 'en-US';
  const code = currency.toUpperCase();
  if (currency === 'usd') return `$${converted.toLocaleString(locale)}`;
  if (currency === 'gbp') return `£${converted.toLocaleString(locale)}`;
  if (currency === 'eur') return `€${converted.toLocaleString(locale)}`;
  return `${converted.toLocaleString(locale)} ${code}`;
}

export function stripeCurrency(currency) {
  return currency.toLowerCase();
}

export function getStoredCurrency() {
  if (typeof window === 'undefined') return 'usd';
  return localStorage.getItem('bls_currency') || 'usd';
}

export function setStoredCurrency(c) {
  localStorage.setItem('bls_currency', c);
}
