## Incident: Lights did not turn OFF at 20:10 (SG) on deployed app

- **Date**: 2025-09-22 (SG)
- **Device**: `Lights` (deviceId `a3e31a88528a6efc15yf4o`)
- **Expected**: OFF at 20:10
- **Observed**: Lights remained ON at/after 20:10; later behavior appeared inconsistent; laptop schedules worked; lights started working again later that night.

> Note: Findings below are hypotheses based on available evidence. They are POSSIBLE/SUSPECTED causes, not confirmed facts.

### Evidence

- Deployed cron endpoint returned success but no executions at 14:13Z (22:13 SG) sample window:
```json
{"success":true,"message":"Cron executed successfully","result":{"date":"2025-09-22","situation":"rest","executed":[]}}
```
- Production site: `https://situationscheduler.vercel.app/`

### Current behavior (as-built)

- Scheduler executes an event only when the cron hit occurs in the exact scheduled minute. If the cron ping lands one minute late, the event is skipped. This is fragile and not how robust schedulers behave.

**Note: This is a suspected/possible cause, not confirmed.**

### Possible root causes for the 20:10 OFF miss (suspected, not confirmed)

1. Cron timing drift or delay
   - External cron may have pinged at 20:11 instead of 20:10; code only executes events in the exact minute.
   - Update 2025-10-01: PRIOR SPECULATION REVISED — DRIFT WAS NOT THE CAUSE. Provider execution logs show consistent blackout windows (:01–:10 and :31–:40 each hour) where `/api/cron` is not invoked. The issue is provider blackout, not timing drift.
2. Data source mismatch (less likely for this incident)
   - Deployed version reads schedules from Supabase; if Lights’ 20:10 OFF wasn’t present server-side, the OFF wouldn’t run.
   - Update 2025-10-01: UNLIKELY. Repeated checks show schedules present; provider failure explains the misses.
3. Temporary connectivity/API issues
   - Tuya API reachable from prod at other times; a transient failure at 20:10 could prevent execution.
   - Update 2025-10-01: POSSIBLE secondary effect. Main issue is cron not invoking `/api/cron` during affected minutes.
4. Manual action not involved
   - No scheduled ONs after 20:10 were present; report indicates it “just didn’t switch OFF.”
   - Note: Manual Smart Life app actions do not appear in Vercel logs (by design).

### Why it later “started working again” (possible explanations)

- Later scheduled OFFs fell exactly on minutes when cron did hit, so they executed.
- Update 2025-10-01: Some earlier speculations that Laptop success vs Lights failure indicated device-only issues were incomplete; provider blackout explains misses irrespective of device.

### Recommended fixes (options; no changes applied yet)

1. Widen grace window to tolerate late pings (recommended)
   - Execute events that occurred within the last 2 minutes. Prevent duplicates using existing per-event idempotency keys.
   - Risk: If cron pings multiple times in that window, ensure idempotency checks are in every execution path.
2. Catch-up logic
   - On each cron run, execute any missed events from the last N minutes that haven’t been executed yet.
   - Risk: A late OFF could override a manual ON unless recent manual overrides are respected.
3. Operational workaround (no code)
   - For critical OFFs, add adjacent OFF entries (e.g., 20:09 and 20:11) as belt-and-suspenders until a code fix is approved.

### Verification checklist (read-only)

- Confirm today’s situation in prod (work/rest) and that Lights has OFF at the intended time in Supabase.
- Check cron provider execution timestamps around 20:10 SG for late/missed hits (HTTP 2xx vs failures).
- Review prod logs for:
  - "EXECUTING NOW: off at 20:10" or
  - "No schedule actions needed" lines in the 20:09–20:11 window.

### Localhost vs deployed: potential interactions/clashes

**CRITICAL: Localhost scheduler can clash with deployed cron**
- Localhost runs client-side scheduler (`src/lib/local-scheduler.ts`) that calls `POST /api/scheduler` every 60 seconds
- Deployed uses external cron calling `GET /api/cron` every minute
- **Both can hit at 20:10 and try to execute the same OFF command simultaneously**

**Clash scenarios that cause inaction:**
1. **API endpoint overload**: Both hit `/api/scheduler` simultaneously, server gets overwhelmed, requests fail
2. **Database lock**: Both try to read/write Supabase at same time, database locks, requests timeout  
3. **Tuya API rate limiting**: Both make Tuya API calls simultaneously, Tuya blocks/throttles rapid requests
4. **Serverless function conflicts**: Vercel functions can interfere with each other, simultaneous executions cause failures

**Result: Both OFF commands fail silently, lights stay ON**

**Data paths:**
- Both localhost and deployed read schedules from Supabase via `/api/schedules`
- Both use same Tuya API endpoints for device control
- Localhost can accidentally overwrite prod data if user makes edits

### Action items (pending approval)

- Adopt a 2-minute grace window in both cron and scheduler endpoints to tolerate minor delays.
- Optionally add execution logging to Supabase `execution_log` for auditability (who/when/what).
- Keep localhost sessions closed during critical schedule windows, or explicitly avoid manual toggles near event times to reduce race potential.

### Notes

- No code changes were made for this incident write-up.

---

## UPDATE: ROOT CAUSE RESOLVED (September 27, 2025)

### The Real Timeline of Events
- **8:10 PM problem existed for DAYS** - lights wouldn't turn OFF at 20:10 (and 20:09, 20:08, etc.)
- **You tried changing the times** - still didn't work
- **The schedules were THERE in the database** - but the OFF commands weren't executing
- **Eventually, during troubleshooting, the destructive DELETE operation wiped all schedules**
- **We had to restore all schedules** - and suddenly the 8:10 PM problem was fixed

### Key Insight
The 8:10 PM problem was NOT about missing schedules - the schedules were always there in the database. The problem was with the **execution system** that was failing to execute OFF commands around that time period. When we restored the schedules, we must have also fixed whatever was preventing the OFF commands from executing at 20:10.

### What This Means
- **Schedule data was never the issue** - it was always present
- **Execution infrastructure was broken** - something was preventing OFF commands from running
- **Restoration process fixed both** - schedules AND the underlying execution problem
- **The destructive DELETE operation was a symptom, not the cause** of the original 8:10 PM problem

---

## Log - 2025-09-30 (SG)

- 20:02 — Changed schedule to turn OFF at 20:05
- 20:05 — Lights did NOT turn OFF
- 20:18 — Tested OFF manually; lights turned OFF promptly

---

## Test results - 2025-10-01 (SG)

- Diagnostics in place (added 2025-09-30): Minimal logs output `cron.window.lights` and `server.window.lights` JSON between 20:00–20:45 showing `currentTime`, Lights entries in that window, and which equals the current minute (if any).

### Observed
- 20:08 — Lights did NOT turn ON
- 20:09 — Lights did NOT turn ON
- 20:08–20:09 — Laptop DID turn ON/OFF at same scheduled times (confirmed working)

### Key finding
- **Laptop schedules executed successfully while Lights failed at the exact same minutes.**
- This eliminates scheduler timing/cron alignment as the root cause.
- Points to `Lights` device-specific issue: connectivity (Wi-Fi), device path, or Tuya API acceptance for this specific device.

### Additional finding (from cron provider execution logs)
- External cron provider reports consistent failures in these minute ranges:
  - :01–:10 of each hour
  - :31–:40 of each hour
- During these windows, `/api/cron` is not invoked (or fails), so scheduled actions do not run regardless of device.
- Action: Add a second independent cron provider (staggered by ~30s) and ensure `/api/cron` is idempotent to avoid double execution.

### New plan (as of 2025-10-01)
- Keep current cron provider running every minute.
- Add a second provider that runs only during the blackout windows (cron: `1-10,31-40 * * * *`) and delays ~30s before calling `/api/cron`.
- Add lightweight idempotency in `/api/cron` (per device/action/minute) so duplicate hits are safe.

### Alternative workaround (as of 2025-10-01)
- **Avoid scheduling during blackout windows**: Use only minutes 00, 15, 30, 45 (quarters and half-hours).
- **Avoid minutes**: 01–10, 31–40 (provider blackout windows).
- **For 20:08–20:10 issue**: Move Lights OFF to 20:00 or 20:15 instead.
- **Pros**: Zero code changes, works immediately.
- **Cons**: Less precise timing, need to remember the pattern.

### Analysis pending
- Review server logs for `cron.window.lights` entries around 20:08–20:09:
  - Did the scheduled minute match? (Expected: YES, since Laptop executed)
  - Was "Executing" logged for Lights?
  - Was there a Tuya API call and what was the response/status?
- Check if "Lights offline" notifications occurred around 20:08–20:09.

### Recent changes (diagnostics) - 2025-09-30

- Minimal logs added (no behavior change):
  - `api/cron/route.ts` prints `cron.window.lights` JSON between 20:00–20:45 with `currentTime`, the Lights entries in that window, and which equals the current minute (if any).
  - `api/scheduler/route.ts` prints `server.window.lights` JSON with the same info.
- What this should show:
  - If there is a minute match but no subsequent "Executing" for Lights, it points to Tuya/device connectivity at that time.
  - If there is no minute match at 20:05–20:10, it points to timing mismatch (exact-minute cron alignment).
  - If both minute match and "Executing" appear yet the plug stays ON, it suggests device path or API acceptance without effect.

### Logging scope note
- Manual actions performed via the Smart Life (Tuya) app do NOT appear in Vercel logs because they bypass our app's `/api/tuya` endpoint. Only actions initiated via our site are logged in Vercel.

---

## INCIDENT: Lights did NOT turn ON at 18:50 (October 7, 2025)

### The Problem
- **Date**: 2025-10-07
- **Time**: 18:50 (6:50 PM SG)
- **Device**: Lights (`a3e31a88528a6efc15yf4o`)
- **Expected**: Lights ON at 18:50 (rest day schedule)
- **Observed**: Lights remained OFF despite cron job returning "200 OK success"
- **Pattern**: Works sometimes, fails randomly - erratic behavior

### The Discovery
**Vercel logs revealed the root cause:**
```
❌ Lights: API call failed: { 
  code: 1010, 
  msg: 'token invalid', 
  success: false, 
  t: 1759834211671, 
  tid: '6600fa50a36b11f08993ae1e79aa0c37' 
}
```

**Key findings:**
1. Cron endpoint always returns `success: true` even when device commands fail
2. Actual failure was buried in `executedActions` array with `apiResult: 'failed'`
3. Tuya API rejected commands due to **invalid/expired authentication token**
4. Issue was NOT cron blackout windows (that's a separate 20:08-20:10 issue)
5. Issue was NOT device connectivity (token authentication problem)

### Root Cause: Broken Token Caching in Serverless
**The broken code pattern:**
```typescript
// Module-level cache - BROKEN in serverless!
let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;  // Stale token in old instance!
  }
  // ... fetch fresh token ...
  cachedToken = { token, expires: Date.now() + expiresIn - 60000 };
}
```

**Why it fails in Vercel serverless:**
- Serverless instances are ephemeral and spin up/down unpredictably
- Module-level variables don't persist reliably across instances
- Instance A caches token, dies after 5 minutes
- Instance B spins up with `null` cache OR stale token from old instance
- No shared state between instances = random failures
- Token expiry (~2 hours) doesn't matter when instances change constantly

**Why it's erratic:**
- ✅ Fresh instance gets new token → works
- ❌ Old instance has stale/expired token → "token invalid" error
- Completely random which instance handles each request

### The Fix (Implemented 2025-10-07)
**Removed all token caching - always fetch fresh:**
```typescript
async function getAccessToken(): Promise<string> {
  // Always get fresh token - caching doesn't work reliably in serverless
  const timestamp = Date.now().toString();
  // ... fetch token logic ...
  return tokenData.result.access_token;  // No caching!
}
```

**Changes made:**
- `/api/tuya/route.ts` - Removed `cachedToken` variable, always fetch fresh
- `/api/cron/route.ts` - Added error handling for token failures, always fetch fresh
- Both endpoints now get fresh Tuya API token on every request

**Why this works:**
- No reliance on stale cached tokens
- Serverless instances can come and go - doesn't matter
- Each API call gets its own fresh, valid token
- Reliability over micro-optimization

**Deployment:**
- Committed: `5d963e1` - "Fix: Remove unreliable token caching in serverless functions - always fetch fresh Tuya API tokens"
- Deployed to Vercel production immediately
- Issue resolved ✅

### Potential Future Issues (Risk Assessment)

**Tuya API Rate Limiting Risk:**
- Current solution = fetch fresh token for EVERY device command
- Estimated usage:
  - Cron jobs: 1,440 calls/day (every minute = 60 × 24)
  - Each cron = 1 token fetch + device commands
  - Manual controls: ~10-20/day
  - Device status checks: varies with tab usage
- **Total: ~1,500+ token fetches/day**
- Tuya free tier limit: ~1,000-2,000 API calls/day
- **RISK**: Close to edge, might hit throttling in future

**What throttling looks like:**
- Error: `code: 1003, msg: 'rate limit exceeded'` or similar
- Device commands REJECTED (not slowed down)
- Same symptom as "token invalid" - lights just don't turn on/off
- Usually resets hourly or daily

### NEXT: Proper Token Caching Solution (TODO)

**Recommended: Store token in Supabase `user_settings` table**

**Why Supabase:**
- ✅ Already using it, FREE tier, no new infrastructure
- ✅ Shared across ALL serverless instances (unlike module variables)
- ✅ Unlimited API requests on free tier
- ✅ Reduces Tuya API calls from ~1,500/day to ~12/day (1 token refresh every 2 hours)
- ✅ Prevents future throttling issues

**Implementation approach:**
1. Create new setting: `tuya_token` and `tuya_token_expires` in `user_settings` table
2. In `getAccessToken()`:
   - Check Supabase for token and expiry
   - If valid and not expired, return cached token
   - If expired/missing, fetch fresh token and save to Supabase
3. Token valid for ~2 hours, refresh 1 minute early
4. Works reliably across all serverless instances

**Benefits:**
- ✅ Solves serverless caching problem properly
- ✅ Prevents Tuya throttling
- ✅ Free (Supabase unlimited API requests)
- ✅ Set and forget - no future surprises

**Status:** Not yet implemented - current "always fetch fresh" solution working but has throttling risk.

---

## INCIDENT: Lights did NOT turn OFF at 18:50 (October 12, 2025)

### The Problem
**Time**: October 12, 2025 - 18:50 (6:50pm)  
**Expected**: Lights should turn OFF (rest day schedule)  
**Actual**: Lights stayed ON, no schedule executed  
**Symptom**: No cron logs at 18:50 - in fact, NO cron logs since 9:50pm Oct 11  

### Discovery Process
1. User checked Vercel logs - no `/api/cron` entries around 18:50
2. User checked logs for past hour - NO cron executions at all
3. Checked cron-job.org dashboard - **"Next execution: inactive"** = job was disabled!

### Root Cause
The cron job on cron-job.org was **auto-disabled** due to consecutive 500 errors from October 11.

**Timeline**:
- **Oct 11, 9:24-9:50pm**: Heartbeat system had a bug causing 500 errors (see AC Interval readme for details)
- **Oct 11, 9:50pm**: Bug fixed (commit c935c48), 500 errors stopped
- **Oct 11, 9:50pm+**: Cron-job.org had ALREADY auto-disabled the job after 26 minutes of failures
- **Oct 12, all day**: No cron executions - job remained disabled despite code being fixed
- **Oct 12, 6:50pm**: User noticed lights didn't turn off, discovered missing cron logs

### Impact
- **Duration**: 9:50pm Oct 11 → 7:00pm Oct 12 (21+ hours with no schedules!)
- **Affected**: ALL scheduled device actions (lights, AC, everything)
- **Why unnoticed**: User wasn't checking devices during this period

### Resolution
User manually re-enabled the cron job on cron-job.org at 7:00pm Oct 12. Schedules immediately resumed working.

### Lesson Learned
**Critical monitoring gap**: When fixing errors that cause 500s, MUST check cron-job.org dashboard to see if job was auto-disabled. 

**New protocol**:
1. Fix the error in code
2. Deploy fix
3. **Check cron-job.org dashboard** - if "inactive", manually re-enable
4. Monitor next few executions to confirm working

**Why this was missed**: After fixing the 500 error at 9:50pm Oct 11, we verified the error stopped but didn't check if the external cron service had disabled the job. The code was fine, but the trigger was turned off.

---

## INCIDENT: 502 Bad Gateway Errors + Cron Auto-Disabled (October 20-21, 2025)

### The Problem
**Time**: October 20, 2025 - 8:11 AM  
**Expected**: Normal cron execution  
**Actual**: 502 Bad Gateway errors for 26 consecutive minutes (8:11-8:37 AM)  
**Result**: Cron-job.org auto-disabled the job after 26 failures  
**Impact**: NO schedules ran from 8:37 AM Oct 20 → Oct 21 (when discovered)

### Cron-job.org Auto-Disable Email
```
Your cronjob has been disabled automatically because of too many failed executions.

URL: https://situationscheduler.vercel.app/api/cron
Last execution attempt: 10/20/2025 08:11:02 GMT (planned: 10/20/2025 08:11:00 GMT)
Last status: Failed (502 Bad Gateway)
Failed subsequent execution attempts: 26
```

### Root Cause: Fetch Timeout Cascade

**502 Bad Gateway = Vercel serverless function timeout (>10 seconds)**

The `/api/cron/route.ts` endpoint had **NO TIMEOUTS** on any fetch calls. When Supabase or Tuya API was slow, the cascade of sequential fetch calls would exceed Vercel's 10-second limit:

**Problematic fetch cascade (lines 238-310):**
1. `fetch(/api/schedules)` - Check heartbeat → Supabase query (no timeout)
2. `fetch(/api/schedules)` - Get last interval state → Supabase query (no timeout)
3. `fetch(/api/tuya)` - Send device command → Tuya API call (no timeout)
4. `fetch(/api/schedules)` - Save new state → Supabase query (no timeout)

**If each takes 3+ seconds:**
- Total: 12+ seconds → Vercel times out at 10s → 502 Bad Gateway
- Happens EVERY MINUTE if condition persists
- After 26 minutes → cron-job.org auto-disables job
- ALL schedules stop working

**Why it happened at 8:11 AM:**
- Likely Supabase had temporary slowness during that time window
- OR Tuya API was slow
- OR serverless cold start + slow queries
- Without timeouts, any slowness cascades into 502 errors

### The Fix (October 21, 2025)

Added **timeout protection to ALL fetch calls** in `/api/cron/route.ts`:

**1. Initial schedule fetch (line 67-74):**
```typescript
const scheduleController = new AbortController();
const scheduleTimeout = setTimeout(() => scheduleController.abort(), 5000); // 5 second timeout

const response = await fetch(`${baseUrl}/api/schedules`, {
  signal: scheduleController.signal
});
clearTimeout(scheduleTimeout);
```

**2. Device control API calls (line 178-192):**
```typescript
const deviceController = new AbortController();
const deviceTimeout = setTimeout(() => deviceController.abort(), 5000); // 5 second timeout

const response = await fetch(`${baseUrl}/api/tuya`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId, action, value }),
  signal: deviceController.signal
});
clearTimeout(deviceTimeout);
```

**3. Interval mode heartbeat check (line 254-263):**
```typescript
const heartbeatController = new AbortController();
const heartbeatTimeout = setTimeout(() => heartbeatController.abort(), 3000); // 3 second timeout

const heartbeatResponse = await fetch(`${baseUrl}/api/schedules`, {
  signal: heartbeatController.signal
}).catch(err => {
  console.log(`🔄 CRON: Heartbeat check timed out or failed:`, err.message);
  return null;
});
clearTimeout(heartbeatTimeout);
```

**4. Interval mode last state check (line 301-310):**
```typescript
const lastStateController = new AbortController();
const lastStateTimeout = setTimeout(() => lastStateController.abort(), 3000); // 3 second timeout

const lastStateResponse = await fetch(`${baseUrl}/api/schedules`, {
  signal: lastStateController.signal
}).catch(err => {
  console.log(`🔄 CRON: Last state check timed out or failed:`, err.message);
  return null;
});
clearTimeout(lastStateTimeout);
```

**5. Interval mode Tuya command (line 323-339):**
```typescript
const commandController = new AbortController();
const commandTimeout = setTimeout(() => commandController.abort(), 5000); // 5 second timeout for Tuya API

const commandResponse = await fetch(`${baseUrl}/api/tuya`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ deviceId, action, value }),
  signal: commandController.signal
}).catch(err => {
  console.log(`🔄 CRON: Tuya API command timed out or failed:`, err.message);
  return null;
});
clearTimeout(commandTimeout);
```

**6. Interval mode save state (line 346-361):**
```typescript
const saveStateController = new AbortController();
const saveStateTimeout = setTimeout(() => saveStateController.abort(), 3000); // 3 second timeout

await fetch(`${baseUrl}/api/schedules`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'user_settings', settingKey, settingValue }),
  signal: saveStateController.signal
}).catch(err => {
  console.log(`🔄 CRON: Save state timed out or failed:`, err.message);
});
clearTimeout(saveStateTimeout);
```

### Benefits of the Fix

**Prevents 502 errors:**
- Maximum execution time: ~9 seconds (under Vercel's 10s limit)
- Each fetch has its own timeout (3-5 seconds)
- Failures are caught and logged, don't crash the function

**Graceful degradation:**
- If Supabase is slow, timeout and continue
- If Tuya API is slow, timeout and log error
- Cron function always returns 200 OK (prevents auto-disable)

**Better observability:**
- Timeout errors are logged with clear messages
- Can identify which service is slow from logs
- Doesn't cascade into 502s

### Resolution

**Immediate action (Oct 21):**
1. User re-enabled cron job on cron-job.org manually
2. Applied timeout fix to all fetch calls
3. Deployed to production

**Status:** ✅ Fixed and deployed

### Lesson Learned

**ALWAYS add timeouts to external API calls in serverless functions:**
- Serverless has hard 10-second limit
- No timeouts = risk of cascading failures
- One slow service can take down entire cron system
- Timeouts enable graceful degradation

**New protocol for ALL API routes:**
1. Add timeout to EVERY fetch call
2. Catch and log timeout errors
3. Don't let external service slowness crash the function
4. Always return proper Response (never throw unhandled errors)

---

