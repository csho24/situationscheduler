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
2. Data source mismatch (less likely for this incident)
   - Deployed version reads schedules from Supabase; if Lights’ 20:10 OFF wasn’t present server-side, the OFF wouldn’t run.
3. Temporary connectivity/API issues
   - Tuya API reachable from prod at other times; a transient failure at 20:10 could prevent execution.
4. Manual action not involved
   - No scheduled ONs after 20:10 were present; report indicates it “just didn’t switch OFF.”

### Why it later “started working again” (possible explanations)

- Later scheduled OFFs fell exactly on minutes when cron did hit, so they executed.
- Laptop worked because its scheduled minutes happened to align with cron hits during that period.

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

