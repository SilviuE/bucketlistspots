// Trust & claims helpers.
//
// Rules (DECISION-010, DMCC Act 2024 / CPUTR):
// - Never show ratings or review counts unless they come from a real,
//   auditable review source. BLS has no review system yet, so none are shown.
// - Never show "Save X% vs agency" comparisons without a published methodology.
// - "Verified" is shown only when every Trust Gate check is recorded as passed.

export const TRUST_CHECKS = ['identityVerified', 'licenseVerified', 'safetyVerified', 'fairPayVerified'];

export function isTrustVerified(guide) {
  return !!guide && TRUST_CHECKS.every(k => guide[k] === true);
}

// DB columns such as promise / certifications / languages may be TEXT, JSON
// arrays or null. Normalise to an array so profile rendering never crashes.
export function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    const s = value.trim();
    if (s.startsWith('[')) {
      try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) return parsed.filter(Boolean); } catch { /* fall through */ }
    }
    return s.split(/\n|;|,(?=\s*[A-Z])/).map(x => x.trim()).filter(Boolean);
  }
  return [];
}

// Lowest bookable trip price (ignores add-ons such as day excursions under $500).
export function fromPrice(guide) {
  const prices = toArray(guide?.routes)
    .map(r => Number(r?.price))
    .filter(p => Number.isFinite(p) && p >= 500);
  if (prices.length) return Math.min(...prices);
  const p = Number(guide?.price);
  return Number.isFinite(p) && p > 0 ? p : null;
}

// Read campaign attribution from the current URL (utm_* and ?ref=CODE).
export function getAttribution() {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const pick = k => (q.get(k) || '').slice(0, 100);
  const attribution = {
    ref: pick('ref'),
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
  };
  try {
    if (attribution.ref) sessionStorage.setItem('bls_ref', attribution.ref);
    else attribution.ref = sessionStorage.getItem('bls_ref') || '';
  } catch { /* storage unavailable */ }
  return attribution;
}

export function attributionLabel(a) {
  return [a.utm_source && `src:${a.utm_source}`, a.utm_medium && `med:${a.utm_medium}`, a.utm_campaign && `cmp:${a.utm_campaign}`, a.ref && `ref:${a.ref}`]
    .filter(Boolean).join(' ');
}
