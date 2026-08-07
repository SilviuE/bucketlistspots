# Security Hardening — Netlify Serving Layer

Source: `netlify.toml` `[[headers]]` blocks.
Target: staging first (`tqooyiyqsidbemzlcsfp`), then production
(`nmyhytrnzfhdstqazttb`) after staging validation.

**Status:** NOT YET APPLIED. Do not deploy without staging CSP test.

## Current State

| Header | Value | Source |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000` | Netlify default |
| `X-Content-Type-Options` | `nosniff` | `netlify.toml` L36 |
| `X-Robots-Tag` | `index, follow` | `netlify.toml` L35 |

## Proposed Additions (staging only until validated)

### 1. Framing Protection

Add to the existing `/*` header block in `netlify.toml`:

```toml
X-Frame-Options = "DENY"
Content-Security-Policy = "frame-ancestors 'none'"
```

`frame-ancestors 'none'` in CSP is preferred over X-Frame-Options, but
including both covers older browsers. Only `frame-ancestors` needs
CSP testing.

### 2. Referrer Policy

```toml
Referrer-Policy = "strict-origin-when-cross-origin"
```

### 3. XSS Auditor (legacy browsers, informational)

```toml
X-XSS-Protection = "0"
```

Setting to `0` disables the legacy auditor which can introduce its
own vulnerabilities in modern browsers. This signals intentional
disablement (no auditor, no false sense of security).

### 4. Content-Security-Policy — MUST TEST ON STAGING FIRST

Initial proposal for testing:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://*.supabase.co;
frame-src https://js.stripe.com;
form-action 'self';
base-uri 'self';
```

**Must verify no breakage with:**
- Supabase REST API calls (connect-src)
- Supabase Realtime/WebSocket connections
- Stripe Checkout (frame-src, script-src)
- Google Fonts (style-src, font-src)
- Supabase Storage images (img-src)
- Any analytics or third-party scripts on production
- Inline scripts in the React SPA (unsafe-inline requirement)

### 5. HSTS Review

Current: `max-age=31536000` (1 year). Consider `includeSubDomains`
for `bucketlistspots.com` and `www.bucketlistspots.com`:

```toml
Strict-Transport-Security = "max-age=31536000; includeSubDomains"
```

Netlify may already add HSTS. If the header is already present from
Netlify, adding `includeSubDomains` should be tested for the
`www.` subdomain redirect.

## Deployment Order

1. Add headers to `netlify.toml` on review branch
2. Deploy to staging Deploy Preview
3. Test CSP in browser DevTools Console for violations
4. Test all third-party integrations (Supabase, Stripe, fonts)
5. Fix any CSP violations, iterate
6. Once staging CSP is clean, merge for production deployment
7. Monitor production for CSP reports

## Production Headers (netlify.toml)

After staging validation, the `[[headers]]` block for `/*` becomes:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Robots-Tag = "index, follow"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "0"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "TBD_AFTER_STAGING_TEST"
```
