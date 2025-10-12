# Smart Situation Scheduler: Debugging Journey & Solutions

## Overview
This document chronicles the extensive debugging process for the Smart Situation Scheduler smart plug scheduler, focusing on the challenging "refresh issue" where manual device control would be overridden by automatic scheduling on page refreshes.

## Initial Problem Statement

### Core Requirements
1. **Scheduled Automation**: Lights turn on/off at specific times based on work/rest day schedules
2. **Manual Override**: User can manually control lights anytime  
3. **State Persistence**: Manual changes should stick until the next scheduled event
4. **No Refresh Interference**: Page refresh shouldn't change device state

### The Main Issue
- User would manually turn lights OFF
- Page refresh would immediately turn lights back ON
- Made manual control completely unreliable

## Debugging Journey

### Phase 1: Initial Tuya API Integration Issues

**Problem**: Wrong device endpoints and API format confusion
- Started with Spatial app device ID (`a34b0f81d957d06e4aojr1`) - non-functional
- Attempted REST-style endpoints instead of action-based API
- Got "uri path invalid" errors (`code:1108`)

**Solution**: 
- Switched to Smart Life device ID (`a3e31a88528a6efc15yf4o`) - working device
- Used action-based API format with POST requests
- Correct payload structure: `{ deviceId, action: 'switch_1', value: true/false }`

### Phase 2: Tuya Cloud Timer API Attempts

**Approach**: Tried using Tuya's server-side timer system for reliability

**Issues Encountered**:
1. **Incorrect Action Names**: Used `add-timer`, `query-timers` instead of `timer.add`, `timer.list`
2. **Permission Errors**: `code:28841101` - "No permissions. This API is not subscribed"
3. **Regional Endpoint Problems**: Singapore region vs default endpoints
4. **API Complexity**: Required group management, timezone handling, complex payload structures

**Attempted Solutions**:
- Updated to correct action names (`timer.add`, `timer.list`, `timer.edit`, `timer.delete`)
- Tried different regional endpoints
- Implemented group timer management
- Created comprehensive timer payload structures

**Final Decision**: Abandoned Tuya Cloud Timers due to:
- Subscription/permission barriers
- Overly complex implementation for simple use case
- User preference for working JavaScript solution

### Phase 3: JavaScript setTimeout System

**Initial Implementation**: 
- Used `setTimeout` for scheduling future device actions
- Created timeouts for each schedule entry
- Stored timeout IDs for cleanup

**The Refresh Problem Emerges**:
- Manual device control worked initially
- Page refresh would trigger device state changes
- Problem appeared to be "zombie timeouts" from previous page loads

### Phase 4: Extensive Timeout Debugging

**Round 1: Basic Timeout Management**
```javascript
private activeTimeouts: Set<NodeJS.Timeout> = new Set();
// Track and clear timeouts on page load
```
- **Result**: Issue persisted

**Round 2: Instance-Based Protection**
```javascript
private instanceId: string = Math.random().toString(36);
// Check instance ID in timeout callbacks
if (currentInstanceId !== this.instanceId) return;
```
- **Result**: Issue persisted

**Round 3: Global Versioning System**
```javascript
let globalSchedulerVersion = Date.now();
// Invalidate timeouts from previous versions
if (currentVersion !== globalSchedulerVersion) return;
```
- **Result**: Issue persisted

**Round 4: Timestamp-Based Protection**
```javascript
const createdAt = Date.now();
if (createdAt < globalSchedulerVersion) return;
```
- **Result**: Issue persisted

**Round 5: Nuclear Timeout Clearing**
```javascript
// Clear up to 100,000 timeout IDs on startup
for (let i = startId; i <= highestId; i++) {
  clearTimeout(i);
  clearInterval(i);
}
```
- **Result**: Issue persisted - proved timeouts weren't the root cause

### Phase 5: Discovery of the Real Culprit

**The Breakthrough**: Completely disabled timeout creation
```javascript
console.log(`🚫 TIMEOUT SYSTEM DISABLED`);
return; // Skip all timeout creation
```
- **Result**: Issue STILL persisted - proving timeouts were innocent

**Root Cause Found**: The `syncDeviceToCurrentSchedule` function
- Function designed to "correct" device state on page load
- Would analyze current schedule and decide what device state "should be"
- If current time was after a scheduled "ON" event, it would turn device ON
- Completely ignored manual user actions

**The Problem Logic**:
```javascript
// This logic was flawed for manual override scenarios
if (entryTime <= currentTime && entryTime > lastActionTime) {
  mostRecentEntry = entry; // Device "should" be in this state
}

if (mostRecentEntry.action === 'on') {
  await tuyaAPI.turnOn(deviceId); // Overrides manual control!
}
```

### Phase 6: The Final Solution - Professional State-Based Scheduler

**New Architecture**:
1. **State-Based Scheduling**: Check every 60 seconds instead of complex timeout management
2. **Manual Override System**: Manual actions pause automatic scheduling for a period
3. **State Comparison**: Only send commands when device state differs from target
4. **Separation of Concerns**: Clear distinction between manual and automatic control

**Key Components**:

```javascript
// Manual override tracking
private manualOverrideUntil: number = 0;

// State checking instead of timeout chaos
private async checkAndExecuteSchedule(): Promise<void> {
  // Skip if in manual override period
  if (Date.now() < this.manualOverrideUntil) return;
  
  // Get current device state to avoid unnecessary commands
  const deviceStatus = await tuyaAPI.getDeviceStatus(deviceId);
  const currentState = deviceStatus.result?.status?.find(s => s.code === 'switch_1')?.value;
  
  if (currentState === targetState) {
    console.log(`Device already in correct state - no action needed`);
    return;
  }
}

// Manual control triggers override
async turnOn(deviceId: string, isManual: boolean = false): Promise<boolean> {
  const result = this.controlDevice(deviceId, 'switch_1', true);
  if (isManual) {
    scheduler.setManualOverride(60); // 1 hour pause
  }
  return result;
}
```

## Final Working Solution

### Architecture
- **Interval-based scheduler**: Checks every 60 seconds
- **Manual override system**: 1-hour pause after manual control
- **State validation**: Only acts when device state differs from schedule
- **Enhanced debugging**: Comprehensive logging for troubleshooting

### Key Features
1. **Manual Control Priority**: Manual actions always take precedence
2. **Smart State Checking**: Avoids unnecessary device commands
3. **Automatic Recovery**: Resumes scheduling after override period
4. **Debug Transparency**: Clear logging of all decisions

### Code Structure
```
PlugScheduler
├── checkAndExecuteSchedule() - Main logic loop
├── setManualOverride() - Pause automation
├── startScheduleChecker() - Initialize interval
└── Enhanced logging throughout
```

## Lessons Learned

### Technical Insights
1. **Complex timeout management is error-prone** - Simple intervals are more reliable
2. **State synchronization without user context is dangerous** - Always consider manual overrides
3. **Debugging requires elimination methodology** - Systematically disable components to isolate issues
4. **Professional systems use state-based approaches** - Not event-driven timeout chaos

### Development Process
1. **User requirements trump technical elegance** - Working JavaScript > complex server-side timers
2. **Incremental debugging beats major rewrites** - Small changes help isolate problems  
3. **Logging is crucial for complex async systems** - Especially with device interactions
4. **Real-world testing reveals edge cases** - Page refresh scenarios often missed in development

## Current Status

### Working Features ✅
- Manual device control with override protection
- Scheduled automation respects manual changes  
- Page refresh doesn't interfere with device state
- Comprehensive debugging and logging
- Professional state-based architecture

### Technical Debt Resolved ✅
- Eliminated complex timeout management
- Removed Tuya Cloud Timer dependencies
- Simplified scheduler architecture
- Fixed refresh interference issues

## Future Considerations

### Potential Improvements
1. **Persistent manual override tracking** - Survive browser restarts
2. **Schedule conflict resolution** - Handle overlapping time ranges
3. **User notification system** - Alert when overrides expire
4. **Historical logging** - Track all device state changes

### Monitoring & Maintenance
1. **Device connectivity monitoring** - Handle network issues gracefully
2. **Schedule validation** - Prevent invalid time configurations
3. **Error recovery** - Automatic retry for failed device commands
4. **Performance optimization** - Reduce API calls when possible

---

**Final Note**: This debugging journey demonstrates the importance of systematic problem-solving and the value of simple, reliable solutions over complex architectures. The final state-based scheduler is not only more reliable but also easier to understand, debug, and maintain.

---

## POST-FOLDER RENAME ISSUES (September 17, 2025 - 5PM)

### Problem Return
After folder rename from original path to "Smart Situation Scheduler", the refresh issue returned:
- Lights manually turned OFF
- Lights automatically turned ON again (randomly, not just on refresh)
- Manual override system was NOT working as intended

### Failed Attempted Solutions by AI Assistant
1. **Manual Override Duration Change** (60min → 120min)
   - ❌ **FAILED**: Just delays the problem, doesn't fix it
   - ❌ **STUPID SOLUTION**: Lights still turn on after delay

2. **Removing Immediate Check** 
   - ❌ **FAILED**: Working version (commit 06b3db1) HAD the immediate check
   - ❌ **WRONG ASSUMPTION**: Immediate check wasn't the actual problem

3. **Added Debug Logging**
   - ❌ **USELESS**: More logs don't fix broken logic

4. **Disabling Scheduler Completely**
   - ❌ **BREAKS APP**: Not a solution, just avoidance

### Root Cause Analysis
The original "manual override for 60 minutes" solution was NOT a real fix:
- **Problem**: Lights turn on automatically after 60 minutes
- **Reality**: This is just delaying the problem, not solving it
- **Truth**: Manual control should be PERMANENT until next scheduled event

### Real Issue: Schedule Logic Fundamentally Flawed
The scheduler logic treats schedule as absolute truth:
```javascript
// This logic is WRONG for manual control scenarios
if (entryTime <= currentTime && entryTime > lastActionTime) {
  currentAction = entry.action; // "Device SHOULD be in this state"
}
```

**The problem**: If it's 5PM and rest schedule says "lights ON at 5PM", the scheduler will ALWAYS try to turn lights ON, regardless of manual control.

### The REAL Solution Needed
Manual control should be PERMANENT until:
1. Next scheduled event occurs, OR  
2. User explicitly chooses to resume automation

**60-minute override is a BANDAID, not a fix.**

---

## Status: ISSUE NOT ACTUALLY RESOLVED
- Manual override system is fundamentally flawed
- Lights still turn on automatically after override period
- Need proper manual control persistence system

---

## BREAKTHROUGH: The Actual Solution (September 17, 2025 - 5:30PM)

### The Real Problem Finally Identified
After 2+ hours of failed attempts, the core issue was crystal clear:

**The scheduler was treating past schedule events as "absolute truth"**
- Logic: `if (entryTime <= currentTime)` = "correct" device state
- At 5:30PM, scheduler sees "5PM event said ON", so forces lights ON
- **Completely ignores manual control** - treats it as "wrong state to fix"

### Failed AI Assistant Attempts (Final Round)
5. **Removing Immediate Check Only**
   - ❌ **PARTIALLY WRONG**: Fixed refresh issue but 60-second check still reverted manual control
   - ❌ **MISCONCEPTION**: Thought immediate check was the only problem

6. **Complex Conflict Detection System**
   - ❌ **OVERENGINEERING**: Proposed Tuya-style notifications for timer conflicts
   - ❌ **WRONG PROBLEM**: User clarified this was about simple refresh issue, not timer conflicts

7. **Disabling Scheduler vs Manual Override Duration**
   - ❌ **MISSING THE POINT**: Kept focusing on time-based solutions (60min, 120min, etc.)
   - ❌ **FUNDAMENTAL MISUNDERSTANDING**: Manual control should be PERMANENT until next scheduled event

### The Breakthrough Moment
**User's Key Insight**: "OF COURSE IT SHOULDN'T BE REVERTING!!! THAT'S WHY THERE'S MANUAL INTERVENTION!!!"

**The obvious truth**: Manual control = permanent until next scheduled event occurs.

### The Actual Fix: Event-Based Logic (Not Time-Based)

**OLD BROKEN LOGIC:**
```javascript
// WRONG - treats all past events as "what should be happening now"
if (entryTime <= currentTime && entryTime > lastActionTime) {
  currentAction = entry.action; // "Device SHOULD be in this state"
  // Forces device to match past schedule events
}
```

**NEW CORRECT LOGIC:**
```javascript
// CORRECT - only executes events happening RIGHT NOW
if (entryTime <= currentTime && entryTime > (currentTime - 1)) {
  currentAction = entry.action; // "Execute this event NOW"
  // Only acts on fresh events, ignores old ones
}
```

### Key Changes Made:
1. **Removed immediate sync on page load** - no more refresh interference
2. **Changed scheduler to only execute fresh events** - no more "correcting" past events
3. **Manual control now permanent** - stays until next scheduled event
4. **Simple interval system remains** - wakes up every 60 seconds to check for NEW events

### The Simple Truth:
- **Scheduler job**: Execute scheduled events when they occur
- **NOT scheduler job**: "Correct" device state based on past events
- **Manual control**: Takes precedence until next actual scheduled event

---

## Final Status: ISSUE RESOLVED ✅
- Manual control is now permanent until next scheduled event
- No more automatic reversion after arbitrary time limits  
- No more refresh interference
- Scheduler only executes fresh events, never "corrects" old ones

**Lesson**: Sometimes the obvious solution is obvious - manual control should just work as expected.

---

## RELATED ISSUE: Schedule Deletion Pattern (September 27, 2025)

### The Same Architectural Problem
After fixing the refresh undo issue, we encountered **the exact same pattern** with schedule deletions:

**Schedule Deletion Issue:**
- **Problem**: Deleted schedules kept reappearing on page refresh
- **Root Cause**: UPSERT operation ignored missing schedules instead of deleting them
- **Pattern**: System not properly handling "absence" of data

**Connection to Refresh Undo:**
- **Refresh Undo**: System ignored manual control absence, kept reverting device state
- **Schedule Deletion**: System ignored schedule absence, kept schedules in database
- **Same Root Cause**: Both systems didn't properly handle when something should be "gone"

### Technical Pattern
**The UPSERT Problem:**
```typescript
// BROKEN: UPSERT only handles what's in the new data
.upsert(schedulesToInsert, { onConflict: 'device_id,situation,time' })
// Missing schedules stay in database - UPSERT ignores them
```

**The Fix Pattern:**
```typescript
// FIXED: DELETE + INSERT handles absences properly
.delete().in('device_id', deviceIds)  // Remove all existing
.insert(schedulesToInsert)            // Add only current data
```

### Key Learning
**Both issues shared the same fundamental problem:**
- Systems treating "absence" as "ignore" instead of "remove"
- Database operations not properly handling deletions/removals
- UI state changes not persisting because backend ignored missing data

**This pattern will likely appear in other parts of the system where data can be removed.**

---

## DEVICE MANAGEMENT TAB SYNC ISSUE (October 7, 2025)

### The Original Problem
**User Issue**: Device toggles on Device Management tab showing incorrect states
- User would manually turn device OFF
- Toggle UI still showed ON
- **Only worked on FULL PAGE REFRESH** - not on tab switching
- Had to refresh entire browser page to see correct toggle state
- Tab switching did nothing - toggles stayed wrong
- Made device management UI unreliable

### Root Cause
**Device state sync gap between UI and reality:**
- Server scheduler changes device states every minute
- UI state (`deviceStates`) not updated when devices change
- Only synced on page load/refresh
- Manual device control and scheduler automation both causing UI desync

### Implementation Journey

#### **STARTING POINT: Only Worked on Full Page Refresh**
**User's problem**: "Often I have to refresh to get the toggles to show correctly"
- **Only way to see correct toggles**: Full browser page refresh (F5 or refresh button)
- **Tab switching**: Did nothing - toggles stayed wrong
- **Staying on tab**: No updates at all
- Very frustrating UX - had to refresh browser constantly

#### **ATTEMPT 1: Tab Switch Sync (1-2 changes to make this work)**
**What I did**: Added useEffect to sync when switching to Device Management tab

**Result**: ✅ **TAB SWITCHING NOW WORKS**
- **Before**: Only full page refresh worked
- **After**: Switching tabs (Calendar → Device Management) triggers sync
- This was progress - better than full page refresh
- User: "Glad to report that turned off my plug and it updated immed on tab"

**But user wasn't satisfied**: "I don't wanna do tab changes for it to work"

#### **ATTEMPT 2: Immediate Sync on Tab (worked!)**
**What I did**: Made it sync immediately when on the Device Management tab

**Result**: ✅✅ **WORKED PERFECTLY - IMMEDIATE SYNC**
- Toggles updated within ~2 seconds when on the tab
- AC toggle showed correct interval mode status
- Regular plugs synced correctly
- User: "Turned off my plug and it updated immed on tab"
- **THIS WAS THE WORKING SOLUTION**

#### **DISCOVERY: Continuous Polling Was Running**
**User asked**: "Is that taxing, having it check every 2 seconds?"
**I revealed**: Actually running continuous polling - checking ALL THE TIME regardless of whether on the tab
**Performance issue**: Loading constantly, even when not on Device Management tab

**User response**: "No, pls fix that. I only need it to load within 3 seconds when I get to the tab. ON THE TAB."

#### **ATTEMPT 3: Change from Continuous to Single Sync**
**What I changed**: Removed continuous `setInterval`, changed to single `setTimeout` on tab switch
**Goal**: Only sync once when switching to tab, not continuously

**Result**: ❌❌ **BROKE EVERYTHING - NOW NOTHING WORKS**
- AC toggle shows wrong state (OFF when should be ON)
- Toggles don't update at all
- User: "3 seconds is looking like 10 mins or never now"
- User: "Now no shit is working"

**What I broke**:
- The immediate sync that was working is gone
- Now back to requiring tab switches, but even that is broken
- Worse than when we started

#### **ROOT CAUSE OF CURRENT FAILURE**:
The working solution (Attempt 2) had **continuous polling while on the tab**. When I removed that to save API calls, I broke the functionality completely.

**The dilemma**:
- **Continuous polling**: Works perfectly but uses too many API calls
- **Single sync on tab switch**: Saves API calls but doesn't work while on tab
- User wants: Updates while on tab, but not continuous polling when off tab

**How it works:**
- Waits 2 seconds after switching TO Device Management tab
- Gives time for `intervalMode` and other states to load
- Checks all 3 devices once
- Updates UI toggles to match reality

**Special AC toggle logic:**
- AC toggle represents **interval mode status**, not physical AC on/off
- Toggle GREEN = interval mode active (cycling 10min ON / 16min OFF)
- Toggle OFF = interval mode inactive
- Makes sense because physical AC state changes every few minutes during interval

#### **CURRENT ISSUE: Same Problem as Before**
**Date**: October 7, 2025 - Afternoon
**User clarification**: "Prev it only worked on tab change. Same issue as now."

**What's actually happening:**
- The 2-second delay approach has the **same limitation** it always had
- Only syncs when you **switch tabs** (e.g., Calendar → Device Management)
- Does NOT sync when staying on Device Management tab
- This is by design - the useEffect only triggers when `activeTab` changes

**The Real Problem:**
- User is staying on Device Management tab
- Manually turns device OFF or scheduler changes device state
- Toggle doesn't update because tab didn't change
- User expects it to update while on the tab, not just when switching to it

**Why it feels like "10 minutes or never":**
- If you're already on the Device Management tab, the sync won't trigger
- Only way to see updates is to click away to another tab and back
- This makes it seem like sync is broken or very slow

**Root Cause:**
```typescript
}, [activeTab, deviceStatesInitialized, intervalMode]);
```
- useEffect only runs when dependencies change
- If `activeTab` is already 'status', no change = no trigger
- Need a different approach for continuous updates while on tab

**Current state**: ❌ **SAME LIMITATION** - only syncs on tab switch, not while staying on tab

### Technical Details

**How Device State Sync Works:**
```typescript
const syncDeviceStates = async () => {
  console.log('🔄 Syncing device states...');
  
  // Update aircon state based on interval mode
  setDeviceStates(prev => ({
    ...prev,
    'a3cf493448182afaa9rlgw': intervalMode
  }));
  
  // Check other devices' actual status
  for (const device of DEVICES) {
    if (device.id === 'a3cf493448182afaa9rlgw') continue;
    
    const status = await tuyaAPI.getDeviceStatus(device.id);
    let isOn = false;
    if (status.result?.status) {
      const switchStatus = status.result.status.find(
        item => item.code === 'switch_1' || item.code === 'switch'
      );
      isOn = switchStatus ? Boolean(switchStatus.value) : false;
    }
    
    setDeviceStates(prev => {
      if (prev[device.id] !== isOn) {
        console.log(`📱 ${device.name}: Syncing UI state (${prev[device.id]} → ${isOn})`);
        return { ...prev, [device.id]: isOn };
      }
      return prev;
    });
  }
};
```

**useEffect Hook:**
```typescript
useEffect(() => {
  let syncTimer: NodeJS.Timeout | null = null;
  
  // Only sync when on device management tab - with 2 second delay
  if (activeTab === 'status' && deviceStatesInitialized) {
    syncTimer = setTimeout(() => {
      syncDeviceStates();
    }, 2000);
  }

  return () => {
    if (syncTimer) clearTimeout(syncTimer);
  };
}, [activeTab, deviceStatesInitialized, intervalMode]);
```

### Key Learnings So Far

1. **Don't overcomplicate** - User wanted simple "sync once on tab switch", not continuous polling
2. **Delays exist for a reason** - 2-second delay needed for async state loading
3. **Test incrementally** - Removing delay completely broke everything
4. **Listen to user expectations** - "2 seconds felt immediate" was the working baseline
5. **AC toggle is special** - Represents interval mode state, not physical device state
6. **Breaking working code is costly** - Spent hours reverting unnecessary changes

### What Worked vs What Broke

| Approach | Delay | API Calls | Result | Issue |
|----------|-------|-----------|--------|-------|
| Continuous Polling | None | 36/min | ✅ Works | Too many API calls |
| 3-Second Delay | 3s | 3/switch | ❌ Broken | AC toggle wrong, slow |
| Immediate Sync | 0s | 3/switch | ❌❌ Catastrophic | Everything broken |
| 2-Second Delay (Original) | 2s | 3/switch | ✅ Works | Initially worked |
| 2-Second Delay (Current) | 2s | 3/switch | ❌ Broken | Not triggering/very slow |

### Status: NEEDS INVESTIGATION

**Current Problem**: 2-second delay sync not working - appearing to take 10+ minutes or never
**Next Steps**: Need to debug why the working solution stopped working
**User Frustration**: High - multiple attempts, multiple failures, still not resolved

---

## TODO: Debug Current 2-Second Delay Failure (October 7, 2025)

**Investigation needed:**
1. Check if console logs show `🔄 Syncing device states...` message
2. Verify `activeTab === 'status'` is true when on Device Management
3. Confirm `deviceStatesInitialized` is true
4. Check if `intervalMode` dependency causing too many re-renders
5. Look for timer cleanup issues in React DevTools
6. Test if API calls are being made but just very slow
7. Consider removing `intervalMode` from dependencies if causing issues

---

## DEFAULT DAY UI DELAY ISSUE (October 11, 2025)

### The Problem
**Symptom**: Phone shows old default_day value on refresh, takes 2-6 seconds to update to correct value from database
- **Desktop → Phone**: Shows old value first, then updates (delay) ❌
- **Phone → Desktop**: Shows correct value immediately ✅

**Why it matters**: User might change setting on phone, refresh before save completes, see old value, think it didn't work, causing incorrect schedule execution

**Log evidence (21:36-21:38):** Both phone and desktop saves work correctly, but UI shows old value during data load on phone only

### Root Cause
Hardcoded fallback value + async data loading on client-side:

```typescript
const [userSettings, setUserSettings] = useState<Record<string, string>>({});
<select value={userSettings?.default_day || 'rest'}> // Shows 'rest' while loading
```
Phone slower processing → first paint happens before API loads → shows fallback → then updates. Desktop faster → API loads before paint → no visible delay.

### Fixes Applied (October 11, 2025)

**Deployed (Commit c935c48):**
- Save to DB first, then update UI (prevents race condition on dropdown changes)
- Result: Dropdown changes work ✅, page load delay remains ❌

**Attempted but not deployed:**
- Hardcoding initial state to 'none' - just reverses the problem

### Plaster Fix (Uncommitted)
Hide value until loaded: `value={isLoadingSchedules ? '' : value}`
- ✅ No wrong value shown
- ❌ Blank for 2-6 sec on phone (poor UX)
- ⚠️ Band-aid, not proper fix

### Proper Fix Needed
Server-side rendering - load data on server before sending HTML. Requires refactor from client component.

### Status & Risks
- Saves work correctly ✅
- Desktop shows values immediately ✅  
- Phone shows old value first (2-6 sec delay) ❌
- Risk: User confusion could cause incorrect default_day changes → unexpected device behavior
- Plaster fix ready (hide until loaded), proper fix needs SSR refactor

---

## UPDATE: Plaster Fix Rejected (October 12, 2025)

### What Happened
**Commit 8ea8583 deployed:** "Plaster fix: Hide default_day dropdown value until data loaded"
- Changed dropdown to show empty value while loading: `value={isLoadingSchedules ? '' : value}`
- Expected: Blank dropdown for 2-6 seconds, then shows correct value
- **Actual result**: Shows "work" (first option selected when value=''), then switches

**User feedback:** Showing "work" randomly is worse than showing old value

**Action taken:** Reverted the plaster fix (October 12, 2025)
- Removed empty value logic
- Back to original: `value={userSettings?.default_day || 'rest'}`
- Phone delay issue remains but won't confuse with random "work" value

### Current State (October 12, 2025)

**What's deployed and working:**
- ✅ Token caching in Supabase (Oct 8) - prevents "token invalid" errors
- ✅ Interval mode works when window closed (Oct 8) - isActive field fix
- ✅ Heartbeat system (Oct 11) - reduces AC beeping when window open
- ✅ Save to DB first (Oct 11) - prevents race condition on dropdown changes
- ✅ Cron 500 error fixed (Oct 11) - heartbeat check returns proper Response

**What's still broken:**
- ❌ Phone shows stale default_day value on refresh (takes 2-6 seconds to update)
- ❌ Only affects Desktop → Phone direction (Phone → Desktop is fine)
- ❌ Root cause unknown (not fallback value, not network - possibly browser/React caching)

**What was attempted but rejected:**
- ❌ Hide value until loaded - showed "work" instead of blank
- ❌ Hardcode to 'none' - just reverses the problem
- ❌ SSR refactor - too risky for tonight

**Next steps:**
- Investigate where phone is getting stale value from (browser cache? React? service worker?)
- Consider proper SSR implementation when time permits
- Document as known phone limitation for now

---
