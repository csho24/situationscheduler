# Cronjob Auto-Disable Incidents and Fixes

This document tracks all incidents where cron-job.org automatically disabled the scheduled job due to consecutive failures, and the fixes applied.

---

## INCIDENT 1: Heartbeat System 500 Errors (October 11-12, 2025)

### The Problem
**Date**: October 11, 2025 - 9:24-9:50 PM  
**Symptom**: Cron endpoint returning 500 Internal Server Error every minute  
**Failures**: 26 consecutive failures over 26 minutes  
**Auto-disabled**: 9:50 PM Oct 11  
**Impact**: No schedules ran from 9:50 PM Oct 11 → 7:00 PM Oct 12 (21+ hours)

### Root Cause
In `/api/cron/route.ts`, the heartbeat check had an early return that returned `undefined` instead of a proper `Response` object:

```typescript
if (heartbeatAge < 120000) {
  console.log('Web Worker is active, skipping');
  return;  // ← Returns undefined, causes 500 error!
}
```

Next.js API routes MUST return a `Response` object. When the browser window was open and Web Worker sent heartbeats, cron detected the heartbeat and tried to exit early, causing 500 errors every minute.

### The Fix (October 11, 2025 - 9:50 PM)
**Commit**: c935c48

Changed to use a flag instead of early return:

```typescript
let shouldSkipIntervalMode = false;
if (heartbeatAge < 120000) {
  console.log('Web Worker is active, skipping interval mode control');
  shouldSkipIntervalMode = true;  // ← Set flag instead
}
// ... rest of code runs ...
if (!shouldSkipIntervalMode) {
  // Interval mode logic here
}
// Always reaches end and returns proper Response
return NextResponse.json({ success: true, ... });
```

### Resolution
- 500 errors stopped immediately after deployment at 9:50 PM
- User manually re-enabled cron job on cron-job.org at 7:00 PM Oct 12
- System resumed normal operation

### Lesson Learned
1. Always return proper Response objects in Next.js API routes
2. **Check cron-job.org dashboard after fixing errors** - auto-disable may have occurred
3. Monitor for missing cron logs, not just error logs

---

## INCIDENT 2: 502 Bad Gateway - Fetch Timeout Cascade (October 20-21, 2025)

### The Problem
**Date**: October 20, 2025 - 8:11 AM  
**Symptom**: 502 Bad Gateway errors  
**Failures**: 26 consecutive failures over 26 minutes  
**Auto-disabled**: ~8:37 AM Oct 20  
**Impact**: No schedules ran from 8:37 AM Oct 20 → discovered Oct 21

### Cron-job.org Auto-Disable Email
```
Your cronjob has been disabled automatically because of too many failed executions.

URL: https://situationscheduler.vercel.app/api/cron
Last execution attempt: 10/20/2025 08:11:02 GMT (planned: 10/20/2025 08:11:00 GMT)
Last status: Failed (502 Bad Gateway)
Failed subsequent execution attempts: 26
```

### Root Cause
**502 Bad Gateway = Vercel serverless function timeout (>10 seconds)**

The `/api/cron/route.ts` endpoint had **NO TIMEOUTS** on any fetch calls. When Supabase or Tuya API was slow, the cascade of sequential fetch calls would exceed Vercel's 10-second limit:

**Problematic fetch cascade:**
1. `fetch(/api/schedules)` - Initial schedule load → Supabase query (no timeout)
2. `fetch(/api/tuya)` - Device control → Tuya API call (no timeout)
3. `fetch(/api/schedules)` - Heartbeat check → Supabase query (no timeout)
4. `fetch(/api/schedules)` - Last state check → Supabase query (no timeout)
5. `fetch(/api/tuya)` - Interval mode command → Tuya API call (no timeout)
6. `fetch(/api/schedules)` - Save state → Supabase query (no timeout)

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
**Commit**: 0737b11

Added **timeout protection to ALL 6 fetch calls** in `/api/cron/route.ts`:

**1. Initial schedule fetch:**
```typescript
const scheduleController = new AbortController();
const scheduleTimeout = setTimeout(() => scheduleController.abort(), 5000); // 5 second timeout

const response = await fetch(`${baseUrl}/api/schedules`, {
  signal: scheduleController.signal
});
clearTimeout(scheduleTimeout);
```

**2. Device control API calls:**
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

**3-6. Interval mode checks (heartbeat, last state, command, save state):**
- Each with 3-5 second timeouts
- Graceful error handling with `.catch()` blocks
- Logging on timeout for debugging

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

### Trade-offs

**Potential missed schedules:**
- If timeout occurs during schedule execution, that minute's schedule may be missed
- Next minute (60 seconds later) tries again normally
- Better to miss ONE schedule attempt than kill the ENTIRE SYSTEM for 24 hours

**Reality check:**
- 5 seconds is generous for most API calls
- Timeouts should rarely trigger under normal conditions
- When they do, system stays alive instead of crashing

### Resolution
- User re-enabled cron job on cron-job.org manually
- Applied timeout fix to all fetch calls
- Deployed to production
- System resumed normal operation

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

## Pattern Recognition

**Common Thread Across Both Incidents:**
1. Code works fine under normal conditions
2. Edge case (heartbeat detected, slow API) triggers error
3. Error repeats every minute (cron frequency)
4. After 26 consecutive failures → auto-disable
5. System completely stops working
6. Manual re-enable required

**Prevention Strategy:**
1. **Defensive coding**: Always handle edge cases gracefully
2. **Timeout protection**: Never wait indefinitely for external services
3. **Error handling**: Catch and log errors, don't let them crash the function
4. **Response validation**: Always return proper Response objects
5. **Monitoring**: Check cron-job.org dashboard after deploying fixes

**Post-Incident Checklist:**
1. Fix the error in code
2. Deploy fix
3. **Check cron-job.org dashboard** - if "inactive", manually re-enable
4. Monitor next few executions to confirm working
5. Document incident and fix in this README

---

## Status

**Current Status**: ✅ All fixes deployed and working
- Heartbeat system: Fixed (Oct 11, 2025)
- Timeout protection: Fixed (Oct 21, 2025)
- Cron job: Active and running normally

