## Smart Situation Scheduler – Project Context

This document captures the current setup of the project.

terminal shortcut: smartsch

### Purpose
This app solves the problem of inconsistent work schedules where traditional fixed weekly routines don't work. With ad-hoc work and changing commitments, a Tuesday this week isn't the same as next Tuesday. 

**The solution:** Instead of fixed weekly schedules, you define each day as "work" or "rest" as you go, and the app follows the appropriate routine for that day.

### App Overview
- Web app that controls Tuya Smart Life plugs based on calendar "work/rest" days and per‑device schedules
- Devices:
  - Lights: `a3e31a88528a6efc15yf4o`
  - Laptop: `a34b0f81d957d06e4aojr1`
  - USB Hub: `a3240659645e83dcfdtng7`
  - Aircon (IR): `a3cf493448182afaa9rlgw`

### Environments
- **Localhost (development)**
  - Port: `http://localhost:3001`
  - Start: `npm run dev` (Turbopack)
  - UI loads schedules via `GET /api/schedules` (Supabase-backed)
  - Local scheduler runs in browser, triggers `POST /api/scheduler` every 60 seconds
  - Manual device control via `GET/POST /api/tuya`

- **Deployed (Vercel)**
  - Site: `https://situationscheduler.vercel.app`
  - External cron calls `GET /api/cron` every minute
  - Server scheduler: `POST /api/scheduler` (also callable manually)
  - Manual device control via same `GET/POST /api/tuya` endpoint
  

### Data Source (Supabase)
Supabase is the single source of truth via `src/app/api/schedules/route.ts`:

**CRITICAL: NO LOCAL STORAGE**
- localStorage must NEVER be used for any functionality
- All data persistence must go through Supabase
- localStorage causes sync issues and data loss
- Deployed version must work without localStorage
- Any localStorage usage will be rejected and reverted

**CRITICAL: NO LIGHT GREY TEXT**
- Never use `text-gray-400` or `text-gray-500` for important text
- Light grey text is invisible and unusable
- Use `text-gray-600` or darker for readable text
- Light grey should only be used for disabled states or very secondary info
- User has to correct this every time - avoid it completely

**Tables:**
- `calendar_assignments(date, situation)` - work/rest day assignments
- `device_schedules(device_id, situation, time, action)` - custom device schedules
- `manual_overrides(device_id, until_timestamp, set_at)` - temporary automation blocks
- `interval_mode(device_id, is_active, on_duration, interval_duration, start_time)` - aircon interval settings
- `user_settings(setting_key, setting_value)` - user preferences like default days

Note on interval mode storage:
- Interval mode settings are persisted in Supabase in the `interval_mode` table (no localStorage fallback).
- The UI saves/updates via `POST /api/schedules` with `type: 'interval_mode'` and reads via `GET /api/schedules` (`intervalMode` + `intervalConfig`).
- Defaults 3/20 are UI/server fallbacks only when no DB row exists; they are not saved unless explicitly updated.

**CRITICAL: NO LOCAL STORAGE**
- **NEVER use localStorage** - all data must be stored in Supabase
- localStorage causes data loss, sync issues, and deployment problems
- All user settings, schedules, and preferences are stored in Supabase tables
- This ensures data consistency across devices and environments

**API Endpoints:**
- `GET /api/schedules` - returns schedules, deviceSchedules, manualOverrides, intervalMode, userSettings
- `POST /api/schedules` - upserts data to tables (supports user_settings type)
- `GET /api/cron` - external cron endpoint for schedule execution
- `POST /api/scheduler` - manual schedule check/execution
- `GET/POST /api/tuya` - device control (plugs and IR aircon)

### Device Control
- **Smart Plugs**: `POST /api/tuya` with `{ action: 'switch_1', value: true|false }`
- **Aircon (IR)**:
  - ON: Scene command `{ power:1, mode:0, temp:26, wind:2 }` (cool, 26°C, fan speed 2)
  - OFF: Standard command `{ category_id:5, key:"PowerOff", key_id:0 }`

### Timezone
- All time calculations use `Asia/Singapore` timezone via `Intl.DateTimeFormat`

### Logging Notes
- Smart Life (Tuya) app manual actions do NOT appear in Vercel logs (they bypass our `/api/tuya`). Only actions initiated via our app/site are logged.

**Where to Check Logs:**

1. **Vercel Logs** (situationscheduler.vercel.app)
   - Shows: **SCHEDULED** actions from cron jobs, calendar assignments, device schedule executions
   - Shows: **MANUAL** actions from our web app (manual device controls via our UI)
   - Does NOT show: Manual Smart Life app controls, manual device buttons
   - Access: Vercel dashboard → Functions → View logs

2. **Cron Jobs Website** (cron-job.org)
   - Shows: **SCHEDULED** cron service calls to our `/api/cron` endpoint (timing only)
   - Does NOT show: **MANUAL** actions, what happens inside our app
   - Access: Your cron-job.org account dashboard

3. **Tuya IoT Platform** (iot.tuya.com)
   - Shows: **SCHEDULED** API commands from our app (cron jobs, interval mode)
   - Shows: **MANUAL** API commands from our web app
   - Does NOT show: Manual Smart Life app controls, manual device buttons
   - Access: Tuya IoT Platform → Device logs

4. **Smart Life App Device History**
   - Shows: **SCHEDULED** smart plug actions (if they go through Smart Life)
   - Shows: **MANUAL** smart plug actions from Smart Life app
   - Does NOT show: IR device history (Aircon) - IR devices don't appear in device logs
   - Does NOT show: Actions from our web app
   - Access: Smart Life app → Device → History

**Manual Action Types:**
- **Manual via our web app**: Manual device controls through our UI (shows in Vercel logs, Tuya IoT)
- **Manual via Smart Life app**: Direct device controls through Smart Life app (shows in Smart Life history, does NOT show in Vercel logs)

### Backup Requirements
- **CRITICAL**: Supabase data is NOT in git - database exists only in cloud
- Regular backups required to prevent data loss
- Current backup: `supabase-backup-2025-09-28-13-00.sql`

### Device Management Tab Sync (October 7, 2025)
**Current sync behavior:**
- **Tab switch**: Immediate sync (no delay) when switching to Device Management tab
- **While on tab**: Continuous polling every 5 seconds for real-time updates
- **AC updates**: Immediate updates when interval mode changes
- **All devices**: Sync correctly without requiring page refresh

### Scheduling Behavior: Event-Based vs State-Based (October 8, 2025)

**CRITICAL DISTINCTION**: The system uses TWO different approaches for different features:

**1. Regular Schedules (Lights, Laptop, USB Hub) - EVENT-BASED:**
- **How it works**: "Execute this action at this exact time"
- **Example**: "Turn lights OFF at 20:10"
- **Behavior**: If cron hits at 20:10, executes. If cron misses 20:10 (blackout), event is lost forever.
- **Manual override**: Respected! Manual control creates override that pauses automation for 60 minutes.
- **Does NOT "go back"**: If you manually turn lights ON, system won't "correct" it back to scheduled state.
- **Philosophy**: One-time events that happen or don't happen. Respects user manual control.

**2. Interval Mode (AC only) - STATE-BASED:**
- **How it works**: "Calculate what device SHOULD be right now based on cycle"
- **Example**: "Started at 18:00, 6 min ON / 10 min OFF, now it's 18:11 → AC should be OFF"
- **Behavior**: Every minute, calculates correct state. If wrong, corrects it. Auto-recovers from missed minutes.
- **Manual override**: NOT available during interval mode. Interval mode takes full control.
- **DOES "go back"**: If AC is OFF but should be ON, next cron will turn it ON (auto-corrects).
- **Philosophy**: Continuous state that must be maintained. No manual intervention during interval.

**Why the Difference:**
- **Regular schedules**: User needs manual control flexibility (turn lights on anytime, system respects it)
- **Interval mode**: Automated cycling system (like a thermostat), user opts into full automation

**Cron Blackout Impact:**
- **Regular schedules**: Event at 20:08 missed = lights stay in wrong state forever
- **Interval mode**: Missed at 18:06 = auto-corrects at 18:11 when blackout ends

**Example Scenarios:**

*Scenario A - Regular Schedule (Event-Based):*
1. Schedule: Lights OFF at 20:08
2. User manually turns lights ON at 19:00
3. Manual override active until 20:00 (60 min)
4. At 20:08: Cron executes "lights OFF" (override expired)
5. Result: Lights turn OFF ✅ (respects schedule after override expires)

*Scenario B - Interval Mode (State-Based):*
1. Interval mode: 6 min ON / 10 min OFF, started 18:00
2. At 18:06: Should turn OFF (blackout window - missed)
3. At 18:11: Cron calculates "should be OFF", sends OFF command
4. At 18:16: AC turns ON (next cycle)
5. Result: Auto-corrects after blackout ✅ (maintains cycle)

*Scenario C - Manual Override During Regular Schedule:*
1. Schedule: Lights OFF at 20:00
2. User manually turns lights ON at 20:30
3. Next schedule: Lights OFF at 22:00
4. At 22:00: Lights turn OFF (next scheduled event)
5. Result: Manual control respected until next event ✅

**Key Takeaway**: Regular schedules respect your manual control and execute one-time events. Interval mode maintains a continuous automated state and auto-corrects any deviations.

### Recent Major Changes (Sep 27-30, 2025)
- **Data Loss Fix**: Removed destructive code that was deleting schedules on every edit
- **Supabase Sync Fixes**: Fixed cron job reading from old files instead of Supabase
- **Schedule Deletion Fix**: Fixed issue where deleted schedules kept reappearing
- **Aircon Settings**: temp=26°C, wind=2 (middle speed)
- **Backup Cleanup**: Removed old backup files causing duplicate schedules
- **Interval Mode Fix (Sep 29)**: Removed 30-second sync conflicts, added timestamped logging - Web Worker approach now working reliably for background operation
- **Calendar Upsert Fix (Sep 29)**: Fixed calendar assignment updates failing with 500 errors due to missing `onConflict: 'date'` in upsert operation
- **Default Days Feature (Sep 30)**: Added user_settings table and default day functionality for unassigned days - NO localStorage used, all data in Supabase

### Critical Database Pattern - UPSERT Operations (Sep 29, 2025)
**IMPORTANT**: All Supabase upsert operations MUST specify `onConflict` for tables with unique constraints:

- **Calendar Assignments**: `onConflict: 'date'` (date field is unique)
- **Device Schedules**: `onConflict: 'device_id,situation,time'` (composite unique constraint)
- **Manual Overrides**: `onConflict: 'device_id'` (device_id is unique)
- **Interval Mode**: `onConflict: 'device_id'` (device_id is unique)
- **User Settings**: `onConflict: 'setting_key'` (setting_key is unique)

**Pattern**: For any table with unique constraints, ALWAYS add `onConflict: 'column_name'` to upsert operations to prevent duplicate key constraint violations.

### Local vs Deployed (Base URL & Safety)
**CRITICAL**: For local development, set `NEXT_PUBLIC_BASE_URL=http://localhost:3001` in `.env.local`. 
- **If it points to the deployed URL, local calls will hit production instead of local**
- This can cause serious bugs where localhost accidentally controls production devices
- Always verify your base URL before starting local development
- Avoid running local scheduler while deployed cron is active to prevent clashes/rate limiting

### Vercel Deploy Issues (Monorepo)
**Problem encountered Sep 24, 2025**: Pushes to GitHub did not auto-deploy UI changes on Vercel; manual redeploy showed "Unexpected error".

**Root cause**: Vercel building repo root instead of app subfolder.

**Solution**:
- During (re)import on Vercel, choose project Root Directory = `plug-scheduler`
- If the UI does not expose Root Directory, re-link the repo and pick `plug-scheduler` at import time
- Optional safeguard: add a root-level `vercel.json` in the repo (outside this folder) to pin `plug-scheduler` as the build root

### Backup Process (CRITICAL - Updated Oct 14, 2025)
**Regular Supabase backups are essential** - database exists only in cloud, not in git.

**⚠️ CRITICAL WARNINGS:**
1. **VERIFY PROJECT URL** - Must use correct Supabase project URL: `yrlvnshydrmhsvfqesnv.supabase.co` (NOT old URLs)
2. **DNS ERRORS ARE COMMON** - pg_dump often fails with "could not translate host name" - this is a network/DNS issue, not a mistake
3. **Use Node.js method** - Most reliable, bypasses DNS issues

**RECOMMENDED METHOD (Node.js Script):**

```bash
cd plug-scheduler
node backup-supabase.js
```

This creates `supabase-backup-YYYY-MM-DDTHH-MM-SS.sql` in the plug-scheduler directory and shows:
- Record counts for each table
- Schedules in blackout windows (times ending in :01-:10 or :31-:40)

**Script location**: `plug-scheduler/backup-supabase.js` (already exists in repo)

**What it backs up:**
- Calendar assignments (calendar_assignments)
- Device schedules (device_schedules) 
- User settings (user_settings)
- Interval mode state (interval_mode)

**Alternative Methods (if Node.js fails):**

1. **Supabase Dashboard** (simplest, no command line):
   - Settings → Database → Backups → "Create manual backup"
   - Downloads automatically

2. **pg_dump** (often fails with DNS errors):
   ```bash
   # Usually FAILS with "could not translate host name" error
   pg_dump 'postgresql://postgres:[PASSWORD]@db.yrlvnshydrmhsvfqesnv.supabase.co:5432/postgres' > backup.sql
   ```

3. **Manual CSV Export** (tedious but works):
   - Table Editor → Select table → ... menu → Download as CSV
   - Repeat for each table: calendar_assignments, device_schedules, user_settings, interval_mode

**Current backup**: `supabase-backup-2025-10-14T15-42-11.sql` (29 calendar, 44 devices, 3 settings, 1 interval)
**Backup frequency**: Before any major changes or deployments

**Common Issues:**
- **"could not translate host name"** = DNS/network issue, try Node.js method instead
- **0 records returned** = Wrong project URL or API key
- **Permission denied** = Using anon key instead of service role key (anon key works for this project)

### Development Notes
- Vercel project root directory should be set to `plug-scheduler` (not repo root)
- Test both localhost and deployed environments separately
- Monitor console logs for network connectivity issues

### Public/Commercial Expansion Requirements (2025-10-02)

**Cron Infrastructure for Scale:**
- Current free cron provider has blackout windows (:01–:10, :31–:40 each hour)
- For commercial deployment, need reliable every-minute execution
- Options:
  1. **Dual free providers**: Add second provider for blackout windows with idempotency
  2. **Upgrade to paid tier**: Single reliable provider with SLA guarantees
  3. **Vercel Pro cron**: Native Vercel cron (requires Pro plan)

**Rate Limiting Considerations:**
- Monitor daily execution limits on free tiers
- Implement usage tracking and alerts
- Plan for upgrade when approaching limits

**Reliability Requirements:**
- 99%+ uptime for scheduled actions
- Monitoring and alerting for failures
- Customer support for missed executions

**Technical Implementation:**
- Add idempotency to `/api/cron` to handle duplicate calls safely
- Implement execution logging for debugging
- Create monitoring dashboard for cron health

### Multiple Window Detection (October 21, 2025)

**Problem**: Multiple browser windows/tabs running simultaneously causes conflicts with Web Workers and device commands, leading to erratic interval mode behavior.

**Solution**: Dual detection system
- **BroadcastChannel**: Instant detection for same browser/origin - Alert: "Another window/tab is already open in the same browser!"
- **Supabase Heartbeat**: 12-second detection for cross-browser/cross-origin - Alert: "Another window/tab is already open in a different browser or across localhost/deployed!"

**Why It Matters**:
- Multiple Web Workers send conflicting commands to devices
- Causes AC interval mode to malfunction (timers run but AC doesn't respond)
- User should only have ONE window/tab open at a time

**See**: `AC_INTERVAL_MODE_DEVELOPMENT_README.md` for full implementation details

### Documentation Structure

**Project Readmes** (in `/readmes/` directory):

1. **`PROJECT_CONTEXT.md`** - This file; project overview, setup, and critical patterns
2. **`Refresh undo_DEBUGGING_JOURNEY.md`** - Primary debugging log for UI issues, default_day problems, and general troubleshooting
3. **`AC_INTERVAL_MODE_DEVELOPMENT_README.md`** - Complete development history of AC interval mode feature, beeping fixes, and heartbeat system
4. **`LIGHTS_DONT_OFF_20-10.md`** - Incidents and debugging for lights scheduling failures, token issues, and cron problems
5. **`IR_AC_INTEGRATION_README.md`** - Technical documentation for Tuya IR AC integration, API endpoints, and commands
6. **`SERVER_SIDE_SCHEDULER_README.md`** - Server-side scheduling implementation and migration notes
7. **`TOKEN_ISSUES_DEBUG.md`** - Tuya API token management, caching solutions, and authentication debugging
8. **`MIGRATION to server side_NOTES.md`** - Migration from client-side to server-side scheduling implementation
9. **`HYDRATION_DEBUG.md`** - Next.js hydration mismatch debugging and SSR issues
10. **`DELETED_DEVICE_SCHEDULES_INVESTIGATION.md`** - Investigation into disappearing device schedules bug

**Documentation Guidelines:**
- Each readme focuses on specific feature/issue area
- Include dates for all entries (YYYY-MM-DD format)
- Document problems, discoveries, fixes, and lessons learned
- Update relevant readme when making changes to related code
- Cross-reference between readmes when issues are related

### Deployment Notes
**CRITICAL**: Do NOT add `vercel.json` with cron configurations - deployment will fail.

**External Cron Setup**: Project uses external cron-job.org service, NOT Vercel cron jobs.

**If deployment fails**:
1. Check if `vercel.json` exists and remove it
2. Verify no Vercel cron configurations in project
3. Ensure external cron service is properly configured