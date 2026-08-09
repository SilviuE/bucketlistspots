const rates = { usd: 1, gbp: 0.78, eur: 0.92 };
const locales = { usd: 'en-US', gbp: 'en-GB', eur: 'de-DE' };

const currencyAliases = {
  'usd': 'usd', 'USD': 'usd', '$': 'usd',
  'gbp': 'gbp', 'GBP': 'gbp', '£': 'gbp',
  'eur': 'eur', 'EUR': 'eur', '€': 'eur',
};

function normalizeCurrency(raw) {
  if (!raw) return null;
  const key = raw.toString().trim();
  return currencyAliases[key] || null;
}

export function convert(amountUSD, currency) {
  return Math.round(amountUSD * (rates[currency] || 1));
}

export function formatPrice(amountUSD, currency) {
  if (amountUSD == null || isNaN(amountUSD)) return '';
  const converted = convert(amountUSD, currency);
  const locale = locales[currency] || 'en-US';
  const code = currency.toUpperCase();
  if (currency === 'usd') return `$${converted.toLocaleString(locale)}`;
  if (currency === 'gbp') return `£${converted.toLocaleString(locale)}`;
  if (currency === 'eur') return `€${converted.toLocaleString(locale)}`;
  return `${converted.toLocaleString(locale)} ${code}`;
}

export function convertGuidePrice(amount, sourceCurrency, targetCurrency) {
  const src = normalizeCurrency(sourceCurrency);
  const tgt = normalizeCurrency(targetCurrency);
  if (!src) throw new Error('Unrecognized source currency: ' + sourceCurrency);
  if (!tgt) throw new Error('Unrecognized target currency: ' + targetCurrency);
  if (amount == null || isNaN(Number(amount))) return NaN;
  if (src === tgt) return Number(amount);
  return (Number(amount) * rates[tgt]) / rates[src];
}

export function formatGuidePrice(amount, sourceCurrency, displayCurrency) {
  if (amount == null || isNaN(Number(amount))) return '';
  const src = normalizeCurrency(sourceCurrency);
  const tgt = normalizeCurrency(displayCurrency);
  if (!src || !tgt) return '';
  const converted = convertGuidePrice(amount, src, tgt);
  if (isNaN(converted)) return '';
  const ceil = Math.ceil(converted);
  if (tgt === 'gbp') return `£${ceil.toLocaleString('en-US')}`;
  if (tgt === 'eur') return `€${ceil.toLocaleString('en-US')}`;
  return `$${ceil.toLocaleString('en-US')}`;
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
