## Smart Situation Scheduler – Project Context

This document captures the current setup of the project.

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

### Backup Requirements
- **CRITICAL**: Supabase data is NOT in git - database exists only in cloud
- Regular backups required to prevent data loss
- Current backup: `supabase-backup-2025-09-28-13-00.sql`

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

### Backup Process (CRITICAL)
**Regular Supabase backups are essential** - database exists only in cloud, not in git.

**Methods to create backups**:

1. **Manual Backup Using pg_dump** (Recommended):
   ```bash
   # Install PostgreSQL if needed: brew install postgresql
   pg_dump 'postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres' > backup.sql
   ```

2. **Supabase CLI Backup**:
   ```bash
   supabase db dump --db-url 'postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres' -f backup.sql
   ```

3. **Supabase Dashboard**: Settings > Database > Backups > Create manual backup

4. **Export via Supabase Client** (Node.js):
   ```javascript
   // Use existing supabase client to export table-by-table
   const { data } = await supabase.from('table_name').select('*');
   // Convert to SQL INSERT statements
   ```

**Current backup**: `supabase-backup-2025-09-28-13-00.sql`
**Backup frequency**: Before any major changes or deployments

### Development Notes
- Vercel project root directory should be set to `plug-scheduler` (not repo root)
- Test both localhost and deployed environments separately
- Monitor console logs for network connectivity issues