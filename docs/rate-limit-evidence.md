## Rate Limiting Evidence — 2026-07-22 22:41 UTC

### Deploy
- Commit: 1711c19 (Netlify-native rate limiting + Terms)
- Branch: main
- Bundle: index-B0H2Knxb.js (1017KB)

### Netlify-Native Rate Limit (Layer 1 — Primary)
- Config: 120 req/min per IP, platform-enforced
- Applied via `exports.config` in api.cjs
- Platform-level, survives cold starts and function scaling
- Returns HTTP 429 before function code executes

### In-Memory Rate Limit (Layer 2 — Defence-in-Depth)
- Per-route granularity:
  - pricing-preview: 30 req/min
  - apply-guide: 5 req/15min
  - public-platform-settings: 60 req/min
  - public-testimonials: 30 req/min
- Tested: 35 rapid sequential requests to pricing-preview
- Result: BLOCKED at request 16 with HTTP 429
- Response body: `{"error":"Too many requests. Please wait a moment."}`
- Confirmed: in-memory Map catches per-route abuse on same function instance

### 429 Response Format
- HTTP 429 status code
- JSON body with error message
- Platform-enforced 429s handled by Netlify edge before function invocation

### Limitations Acknowledged
- In-memory Map is per-instance; different scaled instances may not share counters
- Netlify-native blanket limit (120/min) is the reliable global enforcement layer
- Cloudflare or CDN edge rate limiting recommended as Layer 0 before paid traffic begins
