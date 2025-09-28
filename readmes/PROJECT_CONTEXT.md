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

**Tables:**
- `calendar_assignments(date, situation)` - work/rest day assignments
- `device_schedules(device_id, situation, time, action)` - custom device schedules
- `manual_overrides(device_id, until_timestamp, set_at)` - temporary automation blocks
- `interval_mode(device_id, is_active, on_duration, interval_duration, start_time)` - aircon interval settings

**API Endpoints:**
- `GET /api/schedules` - returns schedules, deviceSchedules, manualOverrides, intervalMode
- `POST /api/schedules` - upserts data to tables
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
- Current backup: `sqls/supabase-backup-2025-09-28-13-00.sql`

### Recent Major Changes (Sep 27-28, 2025)
- **Data Loss Fix**: Removed destructive code that was deleting schedules on every edit
- **Supabase Sync Fixes**: Fixed cron job reading from old files instead of Supabase
- **Schedule Deletion Fix**: Fixed issue where deleted schedules kept reappearing
- **Aircon Settings**: temp=26°C, wind=2 (middle speed)
- **Backup Cleanup**: Removed old backup files causing duplicate schedules
- **File Organization**: Moved documentation to `readmes/` and SQL files to `sqls/` folders

### Files Deleted Today (Sep 28, 2025)
**Deleted to fix duplicate schedule issue:**
- `.tmp-scheduler-storage.json` - Backup file causing duplicates (data already restored to Supabase)
- `restore-schedules.js` - One-time restoration script (no longer needed)
- `restore-schedules.sql` - Generated SQL file (no longer needed)

**Deleted failed backup attempts:**
- `backup-current.js` (original) - Failed due to network issues (recreated)
- `export-backup.js` - Failed due to network issues
- `backup-via-client.js` - Failed due to network issues
- `supabase-backup-2025-09-28-13-30.sql` - Empty file (0KB)
- `supabase-backup-2025-09-28-13-50.sql` - Empty file (0KB)
- `calendar_backup.json` - Failed JSON export

**Current Status**: All important data preserved in Supabase and `sqls/supabase-backup-2025-09-28-13-00.sql`

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

**Current backup**: `sqls/supabase-backup-2025-09-28-13-00.sql`
**Backup frequency**: Before any major changes or deployments

### Project Structure
- `readmes/` - All documentation and investigation files
- `sqls/` - All SQL files, schemas, and database backups
- `src/` - Application source code
- Root directory - Configuration files and scripts only

### Development Notes
- Vercel project root directory should be set to `plug-scheduler` (not repo root)
- Test both localhost and deployed environments separately
- Monitor console logs for network connectivity issues