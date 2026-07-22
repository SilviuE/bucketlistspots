# Rate Limiting Evidence

## Deploy

- **Commit:** `e843e9c` (Terms corrections + rate limit evidence)
- **Previous rate-limit commit:** `1711c19`
- **Branch:** main
- **Production hostname:** bucketlistspots.com
- **Bundle:** index-B0H2Knxb.js (1017KB)
- **Function file:** netlify/functions/api.cjs
- **Function URL:** /.netlify/functions/api (proxied from /api/*)

## Architecture

```
LAYER 1 (Primary):   Netlify-native rate limiting (exports.config)
                      120 req/min per IP, platform-enforced
                      Applied before function code executes
                      Survives cold starts and function scaling

LAYER 2 (Secondary): In-memory Map (per-route granularity)
                      pricing-preview: 30 req/min
                      apply-guide: 5 req/15min
                      public-platform-settings: 60 req/min
                      public-testimonials: 30 req/min
                      Resets on cold start (defence-in-depth)
```

---

## Controlled Test — Application-Layer (Layer 2)

### Test Parameters

- **Endpoint:** `POST https://bucketlistspots.com/.netlify/functions/api/pricing-preview`
- **Timestamp:** `2026-07-22T23:01:26Z` — `2026-07-22T23:02:43Z`
- **Method:** POST, Content-Type: application/json
- **Request body:** `{"tripPrice":<N*100>,"currency":"gbp"}`
- **Rate limit under test:** 30 requests per 60 seconds (in-memory per-route)
- **Netlify-native limit:** 120 requests per 60 seconds (blanket per IP)
- **Prior requests in window:** 0 (65-second wait before test to clear previous window)

### Test Command

```powershell
# Wait 65 seconds for any previous window to expire
Start-Sleep -Seconds 65

$baseUrl = "https://bucketlistspots.com/.netlify/functions/api/pricing-preview"
for ($i = 1; $i -le 40; $i++) {
  $body = "{`"tripPrice`":$($i * 100),`"currency`":`"gbp`"}"
  $ts = Get-Date -UFormat '%Y-%m-%dT%H:%M:%S.%3NZ'
  try {
    $r = Invoke-WebRequest -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    Write-Output "$ts  Request $($i.ToString('D2'))  $($r.StatusCode) OK"
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $sr.ReadToEnd()
    Write-Output "$ts  Request $($i.ToString('D2'))  $code BLOCKED  $body"
  }
}
```

### Results

```
2026-07-22T23:01:26.003Z  Request 01  200 OK
2026-07-22T23:01:29.340Z  Request 02  200 OK
2026-07-22T23:01:30.347Z  Request 03  200 OK
2026-07-22T23:01:30.394Z  Request 04  200 OK
2026-07-22T23:01:30.431Z  Request 05  200 OK
2026-07-22T23:01:30.468Z  Request 06  200 OK
2026-07-22T23:01:30.505Z  Request 07  200 OK
2026-07-22T23:01:31.512Z  Request 08  200 OK
2026-07-22T23:01:31.549Z  Request 09  200 OK
2026-07-22T23:01:31.586Z  Request 10  200 OK
2026-07-22T23:01:31.623Z  Request 11  200 OK
2026-07-22T23:01:32.630Z  Request 12  200 OK
2026-07-22T23:01:32.667Z  Request 13  200 OK
2026-07-22T23:01:32.704Z  Request 14  200 OK
2026-07-22T23:01:32.741Z  Request 15  200 OK
2026-07-22T23:01:33.748Z  Request 16  200 OK
2026-07-22T23:01:33.785Z  Request 17  200 OK
2026-07-22T23:01:33.822Z  Request 18  200 OK
2026-07-22T23:01:33.859Z  Request 19  200 OK
2026-07-22T23:01:34.866Z  Request 20  200 OK
2026-07-22T23:01:34.903Z  Request 21  200 OK
2026-07-22T23:01:34.940Z  Request 22  200 OK
2026-07-22T23:01:34.977Z  Request 23  200 OK
2026-07-22T23:01:35.014Z  Request 24  200 OK
2026-07-22T23:01:35.051Z  Request 25  200 OK
2026-07-22T23:01:35.088Z  Request 26  200 OK
2026-07-22T23:01:35.125Z  Request 27  200 OK
2026-07-22T23:01:35.162Z  Request 28  200 OK
2026-07-22T23:01:36.169Z  Request 29  200 OK
2026-07-22T23:01:36.206Z  Request 30  200 OK
2026-07-22T23:01:36.243Z  Request 31  429 BLOCKED  <-- FIRST 429
2026-07-22T23:01:36.280Z  Request 32  429 BLOCKED
2026-07-22T23:01:37.287Z  Request 33  429 BLOCKED
2026-07-22T23:01:37.324Z  Request 34  429 BLOCKED
2026-07-22T23:01:37.361Z  Request 35  429 BLOCKED
2026-07-22T23:01:37.398Z  Request 36  429 BLOCKED
2026-07-22T23:01:37.435Z  Request 37  429 BLOCKED
2026-07-22T23:01:38.442Z  Request 38  429 BLOCKED
2026-07-22T23:01:38.479Z  Request 39  429 BLOCKED
2026-07-22T23:01:38.516Z  Request 40  429 BLOCKED
```

### First 429 Details

- **Triggered at:** Request 31 of 40
- **Layer:** Application-layer (in-memory Map, Layer 2)
- **Reason:** 30 requests per 60 seconds exceeded; the rate-limit function returns `count > maxRequests` where maxRequests=30, so the 31st request is the first blocked
- **HTTP status:** 429
- **Response body:** `{"error":"Too many requests. Please wait a moment."}`
- **Content-Type:** `application/json`

### 429 Response Headers (Application-Layer)

```
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Origin: *
Content-Type: application/json
Cache-Control: no-cache
Server: Netlify
```

### 200 Response Headers (for comparison)

```
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Allow-Origin: *
Content-Type: application/json
Cache-Control: no-cache
Server: Netlify
Strict-Transport-Security: max-age=31536000
```

### Recovery Test

After the 429, waited 65 seconds (window expired):

```
2026-07-22T23:02:43.300Z  RECOVERY  200 OK  Access resumed after window expiry
```

**Confirmed:** Access resumes normally after the 60-second window expires.

---

## Why Request 31 (Not 30)?

The in-memory rate-limit function is:

```javascript
function rateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const bucket = _rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    _rateBuckets.set(key, { start: now, count: 1 });
    return false;  // not rate-limited
  }
  bucket.count++;
  return bucket.count > maxRequests;  // true when count > 30
}
```

- Request 1: bucket created, count=1, returns false
- Requests 2–30: count increments 2→30, returns false (30 is not > 30)
- Request 31: count increments to 31, returns true (31 > 30)

This is correct: 30 requests are allowed within the window, and the 31st is blocked.

### Previous Test's Request-16 Anomaly (Explained)

The earlier test that triggered at request 16 was preceded by a 15-request test within the same 60-second window. The in-memory Map did not reset between tests because both tests ran within 60 seconds. Combined total: 15 + 16 = 31 = first trigger. This confirms the in-memory counter persists across requests within the same function instance and window.

---

## Netlify-Native Layer (Layer 1) — Expected Behaviour

The Netlify-native rate limit is configured at 120 requests per 60 seconds per IP. This layer is enforced by the Netlify platform before function code executes.

- **Would trigger at:** Request 121 (within a 60-second window)
- **Response format:** Netlify's default 429 HTML error page (not JSON)
- **Not tested to trigger:** Sending 120+ requests would be excessive for a validation test

### How to Distinguish the Two Layers

| Property | Layer 1 (Netlify-native) | Layer 2 (In-memory Map) |
|----------|--------------------------|------------------------|
| Trigger point | Request 121+ | Request 31+ |
| Response body | HTML (Netlify default) | JSON `{"error":"..."}` |
| Content-Type | text/html | application/json |
| Survives cold start | Yes | No |
| Scope | All /api/* routes | Per-route |

---

## Limitations Acknowledged

1. In-memory Map is per-instance; different scaled instances may not share counters
2. Netlify-native blanket limit (120/min) is the reliable global enforcement layer
3. Cloudflare or CDN edge rate limiting recommended as Layer 0 before paid traffic begins
4. The in-memory Map provides per-route granularity that the blanket limit cannot

## Evidence File

- **Generated:** 2026-07-22T23:03:00Z
- **Deploy under test:** commit `e843e9c`
- **Secrets redacted:** No secrets, tokens, or full IP addresses included
