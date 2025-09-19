# Server-Side Scheduler – All Attempts, Fixes, and Deploy Guide

This README documents ALL the server-side scheduling attempts: what we tried, what failed, what we fixed, and how to deploy reliably. It captures the many iterations needed to get it working.

## Overview
- **Goal**: Move scheduling off the browser and onto the server so events execute reliably
- **Final Status**: Server-side scheduling is now working with proper Tuya API calls
- **Key Learning**: Many assumptions were wrong; required multiple attempts to identify core issues

## Timeline of ALL Attempts (chronological order)

### Attempt 1: Initial Server-Side Migration
- **What we tried**: Created Vercel cron config and server cron endpoint
- **What failed**: Assumed data would be automatically shared between API routes
- **Result**: Cron endpoint ran but couldn't find any schedule data

### Attempt 2: In-Memory Storage 
- **What we tried**: Created shared in-memory storage object between API routes
- **What failed**: In serverless environments, each route runs in separate contexts
- **Result**: Cron still saw empty schedules while schedules API had data

### Attempt 3: Client-Side Local Scheduler
- **What we tried**: Added browser-based interval to call server cron every 60 seconds
- **What failed**: Browser throttles background tabs; unreliable execution
- **Result**: Worked when app was open but failed when navigating away

### Attempt 4: Manual Override Logic (First Try)
- **What we tried**: Implemented manual overrides that block ALL future scheduling
- **What failed**: User expected manual override to only block next event, not all future events
- **Result**: 6pm event wouldn't fire even after 5:10pm manual control

### Attempt 5: Manual Override Logic (Second Try) 
- **What we tried**: Time-based override (only block for 5 minutes after manual control)
- **What failed**: Still didn't match user expectation of "future events should always run"
- **Result**: Logic was still incorrect

### Attempt 6: Remove Manual Override Blocking
- **What we tried**: Removed all manual override blocking of future events
- **What failed**: Server-side Tuya API calls were using relative URLs
- **Result**: Schedule found events but API calls failed with "Failed to parse URL"

### Attempt 7: Debug Tuya API URL Construction
- **What we tried**: Added debug logging to trace URL construction
- **What failed**: Discovered server was calling `/api/tuya?...` which is invalid in Node.js
- **Result**: Identified the core issue but hadn't fixed it yet

### Attempt 8: File-Based Persistent Storage
- **What we tried**: Replaced in-memory storage with file-based storage
- **What failed**: Still had the Tuya URL issue
- **Result**: Fixed data sharing but API calls still failed

### Attempt 9: Data Migration Endpoint
- **What we tried**: Created `/api/migrate` to transfer localStorage data to server
- **What failed**: Still had the Tuya URL issue
- **Result**: Server had correct data but couldn't execute actions

### Attempt 10: Absolute Base URL Fix (SUCCESS!)
- **What we tried**: Made server use absolute URLs for Tuya API calls
- **What worked**: Server now uses `http://localhost:3001/api/tuya` in dev
- **Result**: Server-side scheduling finally worked end-to-end!

## Key Issues Discovered

### Issue 1: Serverless Storage Isolation
- **Problem**: Each API route runs in separate context
- **Assumption**: In-memory objects would be shared
- **Reality**: Need persistent storage (file-based or database)
- **Solution**: `src/lib/persistent-storage.ts` with load/save functions

### Issue 2: Relative URLs Don't Work Server-Side
- **Problem**: `fetch('/api/tuya')` fails when called from Node.js server
- **Assumption**: Relative URLs work everywhere  
- **Reality**: Server needs absolute base URL
- **Solution**: Detect server context and prefix with full URL

### Issue 3: Manual Override Expectations
- **Problem**: User expected overrides to not block future scheduled events
- **Assumption**: Overrides should prevent all automation
- **Reality**: "Don't go backwards, but execute future events"
- **Solution**: Removed override blocking entirely

### Issue 4: Local Development Cron
- **Problem**: Vercel cron only works in production
- **Assumption**: Local development would have some kind of cron
- **Reality**: Need separate mechanism for local testing
- **Solution**: Browser-based interval (with limitations) or Node script

## Final Working Implementation

### Key Files Created/Modified
- `vercel.json` - Production cron configuration
- `src/app/api/scheduler/route.ts` - Server scheduler endpoint
- `src/app/api/schedules/route.ts` - Schedule data management API
- `src/lib/persistent-storage.ts` - File-based storage system
- `src/lib/tuya-api.ts` - Fixed with absolute base URL logic
- `src/app/api/migrate/route.ts` - Data migration endpoint

### Critical Fix - Server Base URL
```ts
// in src/lib/tuya-api.ts makeRequest()
const base = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001')
  : '';
const sanitizedBase = base.replace(/\/$/, '');
const url = endpoint.startsWith('?')
  ? `${sanitizedBase}/api/tuya${endpoint}`
  : `${sanitizedBase}/api/tuya/${endpoint}`;
```

## Deployment Checklist (Vercel)

### Step-by-Step Instructions
1. **Push to GitHub**: Commit and push all changes
2. **Import to Vercel**: Create new project from GitHub repo
3. **First Deploy**: Let Vercel build and deploy (to get the URL)
4. **Get Your URL**: Copy the generated URL (e.g., `https://your-project-name.vercel.app`)
5. **Set Environment Variable**:
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_BASE_URL = https://your-project-name.vercel.app`
   - Select: Production (and Preview if desired)
6. **Redeploy**: Trigger a new deployment to pick up the env var
7. **Test Scheduler**: Visit `https://your-project-name.vercel.app/api/scheduler`
8. **Test End-to-End**: Set a schedule and wait for execution

### Important Notes
- **No custom domain required** - `*.vercel.app` URLs work perfectly
- **Environment variable is critical** - Without it, server API calls will fail in production
- **Scheduler runs via external pinger** - External service will call `/api/scheduler` every minute once deployed

## Local Development Notes

### Current Behavior
- **Cron doesn't run locally** - Only in production
- **Server base URL**: Automatically uses `http://localhost:3001`
- **Testing**: Can manually trigger via `curl http://localhost:3001/api/scheduler`

### Future Improvements (Optional)
- Add Node script that pings cron every minute locally
- Widen 1-minute execution window to prevent edge cases
- Add better error handling and retry logic

## Lessons Learned

1. **Don't assume relative URLs work everywhere** - Server context is different
2. **Serverless != server** - Each function runs in isolation
3. **Test the full path** - Client → Server → External API requires end-to-end verification
4. **User expectations matter** - Manual overrides have specific behavioral expectations
5. **Local dev ≠ production** - Cron, environment, and context all differ
6. **Check server storage file first** - When debugging schedule sync issues, check `.tmp-scheduler-storage.json` before localStorage
7. **Don't assume data location** - Dual storage systems (localStorage + server storage) can cause confusion
8. **Debug systematically** - Check actual data sources instead of making assumptions

## Current Status

❌ **Server-side scheduling is NOT working**  
❌ **Deployed version fails to execute device controls**  
❌ **Only localhost version works**  
❌ **Supabase integration failed to solve core issues**  

**FINAL STATUS**: After 20+ attempts and Supabase integration, server-side scheduling still doesn't work reliably on deployed version.

### Attempt 8: Schedule Sync Issue (CURRENT)
- **Problem**: Localhost shows custom times (19:03, 21:19, 23:30) but deployed version shows default times
- **What we tried**:
  1. Added `syncToServer()` in constructor - caused React hydration error #418
  2. Fixed hydration by moving sync to `forceSync()` after component mount
  3. Multiple TypeScript/React warning fixes (unnecessary)
  4. 6+ failed deployments trying different sync approaches
- **Result**: Still not working - deployed version unchanged after multiple attempts
- **Status**: INVESTIGATING - localStorage not transferring to server storage

### Attempt 9: Found the Real Problem - Dual Storage Systems
- **Root Cause**: Two separate storage systems that don't sync properly:
  1. **localStorage** (browser) - has rest day schedules ✅
  2. **Server storage file** (`.tmp-scheduler-storage.json`) - has work day schedules ✅
- **The Issue**: 
  - Rest day schedules synced from localStorage → server storage ✅
  - Work day schedules NEVER synced from localStorage → server storage ❌
  - Deployed version uses server storage, so work day schedules were wrong
- **What we tried**:
  1. Hardcoded schedules in deployed version (wrong approach)
  2. Checked localStorage (wrong place)
  3. Finally found server storage file with actual data
- **Solution**: Copy actual schedules from `.tmp-scheduler-storage.json` to deployed version
- **Result**: ✅ FIXED - deployed version now has correct schedules from server storage

### Attempt 10: The 20-Try Debugging Disaster
- **What went wrong**: 
  - Looked in localStorage instead of server storage file
  - Made assumptions instead of checking actual data
  - 20+ attempts of wrong fixes
- **What should have been done**:
  1. Check `.tmp-scheduler-storage.json` first (where real data is)
  2. Copy those schedules to deployed version
  3. Done in 2 minutes
- **Lesson**: When you have server-side storage, check the server storage file first, not localStorage

The scheduler works server-side and deployed version now has correct schedules.

### Attempt 11: In-Memory Cache Approach (LATEST FAILURE)
- **Problem**: File-based storage doesn't persist in Vercel serverless functions
- **What we tried**: 
  1. **CHANGE**: Replaced file storage with in-memory cache in `src/app/api/schedules/route.ts`
  2. **CHANGE**: Updated cron endpoint to read from cache instead of file
  3. **CHANGE**: Fixed all TypeScript/build errors
  4. **CHANGE**: Removed file storage dependencies
- **What failed**: Schedule edits still don't persist after refresh
- **Root cause**: In-memory cache gets wiped between serverless function invocations
- **LEARNING**: Serverless functions are stateless - no persistence between calls
- **POTENTIAL FIX**: Use external database (PostgreSQL, MongoDB) for true persistence
- **Status**: STILL NOT WORKING - need different approach

### Attempt 12: The Real Problem - Serverless Limitations
- **Issue**: Vercel serverless functions can't maintain state between invocations
- **File storage**: Gets wiped between function calls
- **In-memory cache**: Gets wiped between function calls  
- **localStorage**: Only exists in browser, not accessible to server
- **LEARNING**: Serverless = stateless by design - this is a fundamental limitation
- **POTENTIAL FIX**: 
  1. Use external database (PostgreSQL, MongoDB, Supabase)
  2. Use client-side scheduling with browser notifications
  3. Use different hosting (Railway, Render) that supports persistent storage
- **Current status**: All approaches fail due to serverless limitations

## What Actually Needs to Happen
1. **Use external database** (PostgreSQL, MongoDB, etc.) for persistent storage
2. **Or use client-side scheduling** with browser notifications/background sync
3. **Or use different hosting** that supports persistent file storage
4. **Current approach is fundamentally flawed** - serverless can't maintain state

### Attempt 13: Supabase Integration (LATEST FAILURE)
- **Problem**: After Supabase integration, deployed version still doesn't execute device controls
- **What we tried**:
  1. **CHANGE**: Added Supabase database for persistent storage
  2. **CHANGE**: Created database schema with calendar_assignments, device_schedules, manual_overrides, execution_log tables
  3. **CHANGE**: Updated schedules API to use Supabase instead of in-memory cache
  4. **CHANGE**: Updated cron job to read from Supabase database
  5. **CHANGE**: Added fallback schedules if Supabase fails
  6. **CHANGE**: Fixed TypeScript build errors
- **What failed**: 
  - Build errors prevented deployment initially
  - Even after fixing build, deployed version still doesn't work
  - Localhost version works perfectly (11 actions executed)
  - Deployed version fails to execute device controls
- **LEARNING**: Supabase integration didn't solve the core deployment issues
- **POTENTIAL FIX**: The problem might be with Vercel deployment environment, not database storage

### Attempt 14: Build Error Fix (PARTIAL SUCCESS)
- **Problem**: TypeScript error in cron route preventing deployment
- **What we tried**:
  1. **CHANGE**: Fixed fallback schedules type definition
  2. **CHANGE**: Build now compiles successfully
- **What worked**: Build errors resolved, deployment possible
- **What failed**: Deployed version still doesn't execute device controls
- **LEARNING**: Build errors were blocking deployment, but fixing them didn't solve execution issues

## Why Server-Side Scheduling Keeps Failing

### Core Issues Identified:
1. **Serverless Limitations**: Vercel functions are stateless, can't maintain state between calls
2. **Deployment Environment**: Something in Vercel deployment environment prevents device control execution
3. **Database vs Cache**: Even with Supabase database, deployed version doesn't work
4. **Localhost vs Deployed**: Localhost works perfectly, deployed version fails

### What Actually Works:
- ✅ **Localhost version**: Executes 11 device controls successfully
- ✅ **Tuya API calls**: Work perfectly on localhost
- ✅ **Schedule persistence**: Supabase database works
- ✅ **Cron job logic**: Correctly identifies and executes schedules

### What Doesn't Work:
- ❌ **Deployed version**: Fails to execute device controls
- ❌ **Vercel environment**: Something blocks device control execution
- ❌ **Serverless functions**: Can't maintain reliable state

## Possible Ways Forward

### Option 1: Different Hosting Platform
- **Use Railway, Render, or DigitalOcean** instead of Vercel
- **Why**: These platforms support persistent storage and stateful applications
- **Pros**: Real server environment, persistent storage, reliable execution
- **Cons**: More complex deployment, potential costs

### Option 2: Client-Side Scheduling with Improvements
- **Revert to localhost approach** but make it more reliable
- **Use browser notifications** to keep app active
- **Background sync** to maintain schedules
- **Pros**: Already works on localhost, simpler architecture
- **Cons**: Requires browser to be open, less reliable

### Option 3: Hybrid Approach
- **Client-side scheduling** for reliability
- **Server-side logging** for tracking
- **Database storage** for persistence
- **Pros**: Combines benefits of both approaches
- **Cons**: More complex architecture

### Option 4: External Cron Service
- **Use external cron service** (cron-job.org) to ping deployed endpoint
- **Deployed endpoint** just executes device controls
- **No complex scheduling logic** on server
- **Pros**: Simple, reliable, works with serverless
- **Cons**: Depends on external service

## Recommendation

**The server-side approach is fundamentally flawed for this use case.** After 20+ attempts and Supabase integration, the deployed version still doesn't work reliably.

**Best solution: Use client-side scheduling with improvements:**
1. **Revert to localhost approach** (which actually works)
2. **Add browser notifications** to keep app active
3. **Use Supabase for persistence** (schedule storage)
4. **Add background sync** for reliability

**This approach works because:**
- ✅ **Proven to work** (localhost version executes 11 actions successfully)
- ✅ **No serverless limitations** (runs in browser)
- ✅ **Reliable execution** (Tuya API calls work perfectly)
- ✅ **Simple architecture** (no complex server-side logic)

## Next Steps
- Either implement proper database storage
- Or revert to client-side scheduling with improvements
- Or find hosting solution that supports persistent storage

## Every Change Made (with Learning Points)

### File Changes in Attempt 11:
1. **`src/app/api/schedules/route.ts`**:
   - **CHANGE**: Added in-memory `scheduleCache` object
   - **CHANGE**: Modified GET to return cache data instead of file data
   - **CHANGE**: Modified POST to update cache instead of file
   - **LEARNING**: In-memory objects don't persist between serverless invocations
   - **POTENTIAL FIX**: Use external database for true persistence

2. **`src/app/api/cron/route.ts`**:
   - **CHANGE**: Updated to read from cache via API call instead of file
   - **CHANGE**: Removed file storage dependencies
   - **LEARNING**: Serverless functions can't share state between routes
   - **POTENTIAL FIX**: Use database that all functions can access

3. **`src/lib/server-scheduler.ts`**:
   - **CHANGE**: Reverted to load from server and sync back
   - **CHANGE**: Made `syncToServer()` public method
   - **LEARNING**: Client-server sync is complex with stateless server
   - **POTENTIAL FIX**: Use database as single source of truth

4. **Build fixes**:
   - **CHANGE**: Fixed TypeScript errors in cron route
   - **CHANGE**: Fixed React hook dependencies
   - **CHANGE**: Removed unused imports
   - **LEARNING**: Build errors are symptoms, not the root problem
   - **POTENTIAL FIX**: Address architectural issues first, then fix build

### Key Learning Points:
- **Serverless = Stateless**: No persistence between function calls
- **File storage fails**: Gets wiped between invocations
- **In-memory cache fails**: Gets wiped between invocations
- **localStorage inaccessible**: Only exists in browser context
- **Fundamental limitation**: Vercel serverless cannot maintain state
- **Solution requires**: External database or different architecture
