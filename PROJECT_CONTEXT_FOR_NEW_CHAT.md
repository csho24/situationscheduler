# Smart Situation Scheduler - Project Context

## Current Status
**Ready to migrate from client-side to server-side scheduling** due to reliability issues with browser-based intervals.

## What This Project Does
**Smart Situation Scheduler** - A web app that automatically controls smart plugs based on your daily routine.

### Core Concept
- **Calendar-based scheduling**: You assign each day as either "work" or "rest" using a calendar interface
- **Per-device automation**: Each smart plug (Lights, Laptop, USB Hub) has its own independent schedule for work days vs rest days
- **Manual override**: You can manually turn devices on/off, and the scheduler respects that until the next scheduled event

### Example Usage
- **Monday (work day)**: Lights turn on at 9am, off at 11pm. Laptop on at 8:30am, off at 6pm
- **Saturday (rest day)**: Lights turn on at 10am, off at 10pm. Laptop stays off all day
- **Manual control**: If you manually turn lights off at 8pm, they stay off until tomorrow's scheduled "on" time

### How It Currently Functions

#### 1. Calendar Tab
- Click dates to assign "work" or "rest" 
- Creates daily schedule assignments stored in localStorage

#### 2. Schedule Tab  
- Dropdown to select which device to configure
- Separate schedules for work days vs rest days per device
- Visual highlighting shows currently active schedule lines
- Modal editor for adding/editing schedule entries

#### 3. Device Management Tab
- Real-time on/off switches for each device
- Master toggle to control all devices at once
- Confirmation popup when turning multiple devices off
- Status syncs with actual device states via Tuya API

#### 4. Status Bar
- Shows next upcoming schedule event across all devices
- Format: "Next: Lights ON at 09:00" or "Next: Multiple devices at 23:00"
- Looks ahead to tomorrow if today's events are finished

## Key Components

### Devices (All on Smart Life app)
- **Lights**: `a3e31a88528a6efc15yf4o`
- **Laptop**: `a34b0f81d957d06e4aojr1` 
- **USB Hub**: `a3240659645e83dcfdtng7`

### Current Technical Flow
1. **Page loads** → Fetches device statuses from Tuya API via Next.js proxy
2. **Calendar assignments** → Stored in localStorage as date → "work"/"rest" mappings  
3. **Schedule data** → Stored in localStorage per device (work/rest schedules)
4. **Scheduler runs** → 60-second client-side setInterval checks current time vs schedules
5. **Device control** → Manual toggles call Tuya API, automatic scheduling calls same API
6. **Status updates** → Real-time polling of device states for UI sync

### Current Architecture
- **Frontend**: Next.js with React components
- **API**: Next.js API routes proxy to Tuya (bypasses CORS)
- **Storage**: localStorage for schedules and settings  
- **Scheduling**: Client-side setInterval every 60 seconds (PROBLEMATIC)
- **Device Control**: Tuya IoT API for smart plug commands

### Main Features
1. **Calendar**: Assign work/rest days to dates
2. **Schedule Tab**: Per-device schedule editing with dropdown selector
3. **Device Management**: Individual + master toggle controls with confirmation
4. **Status Bar**: Shows next upcoming schedule event across all devices
5. **Tab Persistence**: Remembers active tab on refresh

## Current Critical Issues

### 1. Client-Side Scheduling Unreliability
- **Browser throttling** causes missed schedule events
- **Manual override conflicts** - scheduler reverts manual changes
- **Refresh issues** - fixed but still fragile

### 2. Manual Control vs Automation
- **User expectation**: Manual control should be permanent until next scheduled event
- **Current problem**: 1-minute interval checks "backwards" and overrides manual control
- **Root cause**: State-based vs event-based logic confusion

## Technical Details

### File Structure
```
plug-scheduler/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main app with tab management
│   │   └── api/tuya/route.ts     # Tuya API proxy
│   ├── components/
│   │   ├── Calendar.tsx          # Day assignment
│   │   ├── DeviceStatusClient.tsx # Legacy component
│   │   └── ScheduleEditor.tsx    # Schedule editing modal
│   └── lib/
│       ├── scheduler.ts          # Core scheduling logic (NEEDS REPLACEMENT)
│       └── tuya-api.ts           # Tuya API wrapper
```

### Data Structure
```typescript
// Per-device schedules in localStorage
Record<string, Record<SituationType, ScheduleEntry[]>>
// Example:
{
  "a3e31a88528a6efc15yf4o": {
    "work": [{ time: "09:00", action: "on" }, { time: "23:00", action: "off" }],
    "rest": [{ time: "10:00", action: "on" }, { time: "22:00", action: "off" }]
  }
}
```

### Current Scheduler Logic (PROBLEMATIC)
```typescript
// In scheduler.ts - checkAndExecuteSchedule()
// Only executes events happening "right now" (within 1 minute)
if (entryTime <= currentTime && entryTime > (currentTime - 1)) {
  currentAction = entry.action; // Execute fresh events only
}
```

## User Requirements

### Core Functionality
1. **Reliable scheduling** - events must execute on time
2. **Manual override respect** - manual control permanent until next schedule
3. **Per-device independence** - each device has own work/rest schedules
4. **Visual feedback** - status bar, current schedule highlighting
5. **Persistence** - settings survive page refresh/browser restart

### UI Preferences
- Clean, centered design
- Master toggle with confirmation for turning devices off
- Active tab persistence
- Scrollable modals for mobile compatibility
- No redundant information (removed "Force Run All" button)

## Next Steps for New Chat

### Immediate Goal
**Migrate to server-side scheduling** using Vercel cron jobs to eliminate all client-side reliability issues.

### Implementation Plan
1. Create Vercel cron function for schedule checking
2. Move schedule logic from client to server
3. Implement proper manual override tracking
4. Update frontend to work with server-side scheduler
5. Test reliability across all scenarios

### Key Files to Focus On
- `src/lib/scheduler.ts` - Replace with server-side logic
- `src/app/api/` - Add new cron endpoint
- `vercel.json` - Add cron configuration

### Testing Requirements
- Schedule execution reliability
- Manual override persistence
- Multi-device independence
- Browser tab inactive scenarios
- Computer sleep/wake scenarios

## Historical Context
See `SCHEDULER_DEBUGGING_JOURNEY.md` for detailed debugging history including failed attempts and the evolution of the manual override solution.

---
**Status**: Ready for server-side migration to solve all reliability issues.
