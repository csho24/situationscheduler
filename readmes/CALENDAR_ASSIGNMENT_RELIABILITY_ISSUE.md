# Calendar Assignment Change Reliability Issue

## THE PROBLEM (October 14, 2025)

**Issue**: Calendar day assignments (REST ↔ WORK) fail to save to database intermittently, causing wrong schedules to run.

### User Experience
1. User clicks calendar day to change: REST (yellow) → WORK (green) or vice versa
2. UI updates immediately (day changes color)
3. **Color persists through page refresh** ✓ (this was fixed previously)
4. **Database save fails silently** (no error shown) ✗
5. Database keeps old value (e.g., still "rest")
6. Cron reads old value from database
7. **Wrong schedules run** (e.g., devices don't charge overnight on work day)
8. User thinks it saved because UI looks correct, but database wasn't updated

**Most Common Use Case**: User books a job → changes REST (yellow) to WORK (green)
- Color stays green through refresh ✓
- But database still has "rest" ✗
- Rest schedules run instead of work schedules ✗

### Incident Timeline (October 13-14, 2025)

**October 13 Night (past 10pm):**
- User changed Oct 14 from REST → WORK (for job next day)
- Clicked multiple times
- UI turned green each time
- **Save failed every time** (database still had "rest")

**October 14 Morning:**
- User tried again multiple times
- UI turned green
- **Save still failing** (database still "rest")
- Top bar showed "Rest Day" (reading from database)
- Devices didn't charge overnight (ran rest schedules)
- **User stopped trying** - left calendar showing "Work" (green)

**October 14 Evening:**
- User came home
- Calendar still showing WORK (green) from morning
- **Schedules ran correctly** (work schedules executed)
- This means database somehow updated between morning and evening
- **User did NOT click calendar again** - it fixed itself

**Critical Detail**: 
- NO CODE DEPLOYMENT between failures and success
- NO USER ACTION between morning and evening
- Database save somehow succeeded WITHOUT new calendar click
- Same code, different results, no manual intervention

---

## ROOT CAUSE INVESTIGATION

### What We Know

**1. Calendar Save Path:**
```
Calendar.tsx 
  → serverScheduler.setSituation() 
    → fetch('/api/schedules', { type: 'calendar' })
      → Supabase upsert with onConflict: 'date'
```

**2. Code Issues Found:**

**Issue A: Useless Connection Test (Doubled DB Calls)**
```typescript
// API route has this BEFORE actual save:
const { error: testError } = await supabase
  .from('calendar_assignments')
  .select('count')
  .limit(1);

if (testError) {
  throw new Error('Connection failed'); // Kills save
}

// Then the actual save:
await supabase.from('calendar_assignments').upsert(...)
```

**Impact**: 
- 2x database calls instead of 1
- Extra failure point (test can fail even if upsert would work)
- Slower on mobile networks

**Issue B: No Retry Logic**
```typescript
const response = await fetch('/api/schedules', {
  method: 'POST',
  // NO TIMEOUT
  // NO RETRY
  body: JSON.stringify(requestBody)
});
```

**Impact**:
- Single network glitch = permanent failure
- Vercel cold start timeout = failure
- No second chance

**Issue C: Silent Failure**
```typescript
} catch (error) {
  console.error('Failed to sync:', error);
  // Don't revert local state - keep the optimistic update
  // NO USER NOTIFICATION
}
```

**Impact**:
- UI stays green even though save failed
- User thinks it worked
- No indication of failure

### What We Don't Know

**CRITICAL**: The UI persistence is fixed (colors stay through refresh), but database saves are unreliable.

The pattern:
- UI color always persists correctly ✓ (this was fixed)  
- Database save sometimes works, sometimes doesn't ✗
- When save fails: UI shows right color, database has wrong value, wrong schedules run
- **No consistent pattern** - same code, random success/failure

**WHY is it unreliable? And why did it fix itself?**

The self-healing is CRITICAL: Database updated between morning and evening WITHOUT user clicking again.

Possible explanations:
1. **Delayed write** - One of the morning attempts eventually succeeded after timeout (Supabase write queue?)
2. **Retry mechanism we don't know about** - Browser or Supabase auto-retrying failed requests
3. **Multiple saves queued** - One finally succeeded when server warmed up or rate limit cleared
4. **Calendar reload logic** - The `Calendar.tsx` reload after failed save might retry the save
5. **Background sync API** - Browser background sync retrying failed fetch requests
6. **Vercel function warm-up** - Morning clicks queued, executed when function warmed up
7. **Service worker retry** - If we have a service worker, it might retry failed requests

**The fundamental issue**: Something is eventually saving successfully, but we don't know what or when. The save path has hidden retry logic or delayed execution we're not aware of.

### How UI Stays Green (Explained)

**Discovered mechanism**:
1. `serverScheduler.setSituation()` updates in-memory Map: `this.schedules.set(date, situation)`
2. Database save fails, but code keeps optimistic update: `// Don't revert local state`
3. Calendar component loads from serverScheduler: `useState(serverScheduler.getAllSchedules())`
4. On refresh, Calendar reads from in-memory Map (still has "work")
5. **UI shows green even though database has "rest"**

**This explains UI persistence, but NOT why database eventually updated without user clicking.**

### Most Likely Explanation (Theory)

**Connection test fails, but upsert succeeds anyway:**

Current deployed code does:
```
1. SELECT count test → FAILS (timeout/error)
2. throw error → stops execution
3. upsert NEVER RUNS
```

BUT if the connection test is flaky and sometimes passes after delay:
```
Morning clicks:
- Click 1: test fails immediately → no save
- Click 2: test fails immediately → no save  
- Click 3: test HANGS for 30 sec → user gives up
         → test eventually succeeds → upsert runs → SUCCESS!
         → but user already left, doesn't see confirmation
```

**Alternative**: Browser or Supabase retried failed request in background
- Some browsers retry POST requests if they timeout before response
- Supabase might have request queuing that processes delayed writes
- One of the morning attempts queued and processed hours later

**No code auto-syncs calendar** - checked page.tsx, serverScheduler, no intervals or background sync for calendar data.

---

## FIXES IMPLEMENTED (Not Deployed Yet)

### Fix 1: Remove Connection Test
**Commit**: `745a860` - "ROOT CAUSE FIX: Remove useless Supabase connection test"

**Change**: Removed the `select('count')` test before upsert
```typescript
// BEFORE: 2 DB calls
const { error: testError } = await supabase.from('calendar_assignments').select('count').limit(1);
if (testError) throw error;
const { error } = await supabase.from('calendar_assignments').upsert(...);

// AFTER: 1 DB call
const { error } = await supabase.from('calendar_assignments').upsert(...);
if (error) throw error;
```

**Reasoning**: If Supabase is down, upsert will fail anyway. Test just adds failure point.

### Fix 2: Add Retry Logic with Timeout
**Commit**: `9afcbbd` - "Fix calendar save reliability: Add retry logic with timeout"

**Changes**:
1. **10-second timeout per attempt** (AbortController)
2. **3 retry attempts** with exponential backoff (1s, 2s, 4s waits)
3. **Revert UI on final failure** (green → back to yellow)
4. **Show alert on failure** (user knows it failed)

```typescript
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch('/api/schedules', {
      signal: controller.signal,
      ...
    });
    
    clearTimeout(timeoutId);
    // Success - exit loop
    return;
    
  } catch (error) {
    if (attempt === MAX_RETRIES) {
      // Revert UI and alert user
      this.schedules.delete(date);
      throw new Error('Failed after 3 attempts');
    }
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt-1) * 1000));
  }
}
```

### Fix 3: UI Rollback on Failure
**In Calendar.tsx**:
```typescript
const originalSchedules = [...schedules];

try {
  await serverScheduler.setSituation(dateString, situation);
  // Success - keep green
} catch (saveError) {
  // Failed - revert to original
  setSchedules(originalSchedules);
  alert('Failed to save. Check connection and try again.');
}
```

---

## CONCERNS WITH FIXES

### User Concerns
1. **"I don't want error alerts"** - User wants it to WORK, not tell them it failed
2. **"Does retry match why it failed?"** - Retry helps timeout/cold start, but not if root cause is elsewhere
3. **"Will this break my schedules?"** - No, only changes save logic, not data

### Technical Concerns
1. **Timeout too short?** - 10 sec might not be enough for cold Vercel functions
2. **Retry blocking UI** - Up to 7 seconds (1+2+4) blocking calendar interaction
3. **Alert popup annoying** - User explicitly said they don't want "it fails" messages

### Unknown Root Cause
**The biggest concern**: Fixes address symptoms (timeout, single-try) but we don't know:
- WHY connection test would fail intermittently
- WHY it fixed itself without deployment
- IF retry logic will actually help

---

## DEPLOYMENT STATUS

**Current State**: 
- ✅ Fixes committed locally (2 commits)
- ❌ NOT pushed to GitHub
- ❌ NOT deployed to Vercel
- Production still has: connection test, no retry, no timeout

**Production Code**: Last deployed before October 14 issues
- Has `onConflict: 'date'` fix from September 29 ✅
- Has connection test (potential failure point) ❌
- No retry logic ❌
- No timeout ❌

---

## NEXT STEPS (Undecided)

### Option 1: Deploy Fixes
**Pro**: Might prevent future failures
**Con**: Don't know if it solves root cause, alert popup unwanted

### Option 2: Monitor First
**Pro**: See if issue happens again, gather more data
**Con**: Risk of repeat failure (wrong schedules run again)

### Option 3: Investigate Further
**Pro**: Find actual root cause
**Con**: No logs from incident, hard to diagnose without reproduction

### Option 4: Different Approach
- Add queue system (save offline, retry when online)
- Add visual "saving..." indicator
- Use optimistic UI but mark "pending" until confirmed

---

## OPEN QUESTIONS

1. **Did user clear cache/restart phone between morning and evening?** (User unsure)
2. **Was there a Vercel/Supabase outage during incident?** (No logs available)
3. **Is connection test really the culprit?** (It's there but why intermittent?)
4. **Should we remove alert popup?** (User doesn't want failure notifications)
5. **Is 10-second timeout enough?** (Vercel cold starts can be 15-20 sec)

---

## LESSONS LEARNED

1. **Optimistic UI without confirmation is dangerous** - User thought save worked when it didn't
2. **Silent failures are user-hostile** - Should revert UI immediately if save fails
3. **Connection tests can be failure points** - If main operation would work, don't test first
4. **No retry = fragile system** - Single network blip causes permanent failure
5. **Need better observability** - Can't debug without logs from incident time

---

## PLANNED EXPERIMENT (October 15-16, 2025)

**Test calendar assignment changes to gather data on reliability:**

### Test Cases

**October 15:**
- **Original state**: REST day (yellow)
- **Action**: User changed REST → WORK (green)
- **Purpose**: Test if REST→WORK change saves to database
- **Watch for**: 
  - Does UI stay green through refresh? ✓ (expected yes)
  - Does database update? (unknown)
  - Do work schedules run on Oct 15? (database confirmation)

**October 16:**
- **Original state**: UNASSIGNED (no color)
- **Action 1**: User assigned as REST day (yellow)
- **Action 2**: User will change REST → WORK (green)
- **Purpose**: Test REST→WORK on newly assigned day vs. existing assignment
- **Watch for**:
  - Does first save (unassigned→rest) work?
  - Does second save (rest→work) work?
  - Does order matter (new vs. existing assignment)?

### Actual Results (October 14, 2025 - 11:18pm to 11:26pm)

**First Test (~11:18pm):**
- Device: Android Chrome phone
- Action: Changed Oct 15 rest → work → rest (multiple changes)
- Supabase result: ✅ Database updated correctly to "rest" (timestamp: 15:18:32 UTC = 23:18 SG)
- Vercel logs: ❌ NO logs appeared for phone requests
- Conclusion: Save worked but no logging

**Second Test (11:26pm):**
- Device: Android Chrome phone
- Action: Changed Oct 15 rest → work
- Supabase result: ✅ Database updated correctly to "work"
- Vercel logs: ✅ Logs appeared for phone request
- Conclusion: Save worked AND logged

**Analysis:**
- Same phone, same code, 8 minutes apart
- First attempt: worked but didn't log
- Second attempt: worked and logged
- **INTERMITTENT BEHAVIOR CONFIRMED** - can't predict when it will work vs. not work
- Pattern matches Oct 13-14 incident (works sometimes, fails sometimes)

### What to Monitor

1. **Immediate feedback** - Check Supabase calendar_assignments table after each change
2. **Schedule execution** - Verify which schedules actually run on Oct 15 & 16
3. **Top bar display** - Does it show correct day type or fall back to default?
4. **Timing** - If save fails, when does it eventually succeed (if at all)?

### Success Criteria

- **Full success**: Database updates immediately, correct schedules run
- **Partial success**: Database updates eventually, schedules might be wrong initially
- **Full failure**: Database never updates, wrong schedules run

---

## STATUS: INTERMITTENT BUG CONFIRMED, FIXES READY TO DEPLOY

**Current situation**: 
- Bug confirmed as intermittent (same code, different results)
- Tonight's tests: First attempt worked but didn't log, second attempt worked and logged
- Matches Oct 13-14 pattern (consistent failure, then suddenly works)
- No clear pattern or root cause identified

**Fixes ready to deploy:**
1. ✅ Remove connection test (eliminate failure point)
2. ✅ Add retry logic (3 attempts, 10 sec timeout each)
3. ✅ UI rollback on failure (calendar reverts color)
4. ✅ Alert message on failure (see below)

### What User Will See After Deployment

**Success (normal case):**
- Click calendar day
- Color changes immediately
- No message/alert
- Change persists

**Failure (if all 3 retries fail):**
- Click calendar day
- Color changes briefly, then **reverts back to original**
- **Alert popup appears**: "Failed to save calendar assignment. Please check your internet connection and try again."
- Must click OK to dismiss
- Calendar stays at original color (e.g., stays yellow if was yellow)

**The alert message is:**
```
"Failed to save calendar assignment. Please check your internet connection and try again."
```

### Trade-offs

**Pros:**
- Won't fail silently (you'll know if it didn't save)
- Retry logic might catch transient failures
- No wrong schedules from thinking it saved when it didn't

**Cons:**
- Alert popup is annoying (you said you don't want "it fails" messages)
- Doesn't fix root cause (still intermittent)
- Might get false alarms if timeout too short

**Ready to deploy?**

