# Smart Plug Scheduler - Hydration Error Debug Log

## Project Overview
Smart plug scheduler web app that allows users to set "Work Day" vs "Rest Day" schedules for Tuya and TAPO smart plugs. Built with Next.js 15, TypeScript, and Tailwind CSS.

## Current Issues

### 1. Hydration Error (PERSISTENT)
**Error:** `Uncaught Error: Hydration failed because the server rendered HTML didn't match the client`
**Location:** Originally line 120 (animate-pulse), persists despite multiple fixes

### 2. Token Invalid Error  
**Error:** `{"code":1010,"msg":"token invalid","success":false}`
**Status:** Was working initially in manual tests, now consistently failing

## Hydration Error - All Attempted Fixes

### ❌ Fix Attempt 1: Client-side Check
- Added `isClient` state to components
- Used `useEffect(() => setIsClient(true), [])` 
- Conditional rendering based on `isClient`
- **Result:** Error persisted

### ❌ Fix Attempt 2: Remove Dynamic Classes
- Removed `animate-pulse` from line 120 (Power icon)
- Removed `loading ? 'animate-spin' : ''` classes
- **Result:** Error persisted

### ❌ Fix Attempt 3: Dynamic Import with SSR False
- Used `dynamic(() => import('./DeviceStatusClient'), { ssr: false })`
- Added loading placeholder
- **Result:** Error persisted

### ❌ Fix Attempt 4: Suppress Hydration Warnings
- Added `suppressHydrationWarning={true}` to dynamic elements:
  - Status text (Online/Offline/Checking)
  - ON/OFF status display
  - Last updated timestamp
- **Result:** Error persisted

### ❌ Fix Attempt 5: Mounted State Check
- Added `mounted` state with `useEffect`
- Only execute API calls after `mounted = true`
- **Result:** Error persisted

### ❌ Fix Attempt 6: Double Dynamic Import
- Made DeviceStatus dynamic in main page: `dynamic(() => import('@/components/DeviceStatus'), { ssr: false })`
- DeviceStatus already had dynamic import for DeviceStatusClient
- **Result:** Error persisted

### ❌ Fix Attempt 7: Server-Side Placeholder
- Added static loading state for server rendering
- Different loading UI for server vs client
- **Result:** Error persisted

## Current Suspected Causes

### 1. Calendar Component
The hydration error might actually be coming from the Calendar component, not DeviceStatus:
- Date calculations with `isSameDay`, `isPastDate`
- Time-dependent rendering that differs between server/client
- Format dates differently on server vs client

### 2. Scheduler Component
LocalStorage access in scheduler might cause SSR/client mismatch:
- `localStorage.getItem('plug-schedules')` in browser only
- Server renders without localStorage data
- Client hydrates with localStorage data

### 3. Browser Extensions
Could be browser extensions (Grammarly, etc.) modifying DOM before React hydration

### 4. Next.js 15 Issues
Using latest Next.js 15.5.3 which might have hydration bugs with Turbopack

## Token Error - Timeline

### ✅ Initially Working
Manual test of credentials worked:
```bash
curl "http://localhost:3001/api/tuya?deviceId=a34b0f81d957d06e4aojr1&action=test"
# Result: {"result":{"access_token":"8f74ee06bce07f6dad653255caa4a177"...},"success":true}
```

### ❌ Then Broke
Subsequent device status calls failed:
```bash
curl "http://localhost:3001/api/tuya?deviceId=a34b0f81d957d06e4aojr1&action=status"  
# Result: {"code":1010,"msg":"token invalid","success":false}
```

### Attempted Fixes
1. **Two-step auth:** Get token first, then use for device calls - Failed
2. **Direct signature:** Revert to simple credential signing - Failed  
3. **Timestamp format:** Fixed "request time invalid" but still "token invalid"
4. **Different endpoints:** Tried EU, US, CN data centers - Same error

## Current Tuya API Setup
- **Access ID:** `enywhg3tuc4nkjuc4tfk`
- **Secret:** `0ef25f248d1f43828b829f2712f93573`
- **Project Code:** `p1757843735627qyny8w`
- **Data Center:** EU (openapi.tuyaeu.com)
- **Device ID:** `a34b0f81d957d06e4aojr1` (laptop plug)

## Next Steps to Try

### For Hydration Error:
1. **Isolate the source:** Test Calendar component separately
2. **Check scheduler localStorage:** Remove localStorage usage temporarily  
3. **Downgrade Next.js:** Try Next.js 14 instead of 15
4. **Disable browser extensions:** Test in incognito mode
5. **Use suppressHydrationWarning on entire app:** Nuclear option

### For Token Error:
1. **Check device permissions:** Verify device is properly linked in Tuya IoT project
2. **Re-create project:** Start fresh Tuya IoT project
3. **Check API scope:** Verify project has device control permissions
4. **Test with different device:** Try USB hub device instead of laptop
5. **Use Tuya's official SDK:** Switch from custom implementation

## File Structure
```
src/
├── app/
│   ├── api/tuya/route.ts          # Tuya API backend
│   └── page.tsx                   # Main app (double dynamic import)
├── components/
│   ├── Calendar.tsx               # Calendar component (potential hydration source)
│   ├── DeviceStatus.tsx           # Dynamic import wrapper
│   ├── DeviceStatusClient.tsx     # Actual device status logic
│   └── ScheduleEditor.tsx         # Schedule editing
└── lib/
    ├── scheduler.ts               # LocalStorage scheduler (potential hydration source)
    └── tuya-api.ts                # Client-side API calls
```

## Development Environment
- **Next.js:** 15.5.3 with Turbopack
- **Node.js:** Latest
- **macOS:** Darwin 24.6.0
- **Port:** 3001 (fixed)
- **Browser:** Safari/Chrome (both show same error)

## Conclusion
Despite multiple comprehensive attempts to fix the hydration error using all recommended Next.js patterns (dynamic imports, SSR disabling, suppressHydrationWarning, client-only rendering), the error persists. The issue may be in a different component than DeviceStatus, or could be a fundamental Next.js 15 issue.

The token error suggests either a permissions issue with the Tuya IoT project setup or a change in their API requirements that wasn't documented.

