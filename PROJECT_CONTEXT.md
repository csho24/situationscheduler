## Smart Situation Scheduler – Project Context (Factual)

This document captures the current, factual setup of the project (no speculation).

### App overview
- Web app that controls Tuya Smart Life plugs based on calendar “work/rest” days and per‑device schedules.
- Devices:
  - Lights: `a3e31a88528a6efc15yf4o`
  - Laptop: `a34b0f81d957d06e4aojr1`
  - USB Hub: `a3240659645e83dcfdtng7`

### Environments
- Localhost (development)
  - Port: `http://localhost:3001`
  - Start: `npm run dev` (Turbopack)
  - UI loads schedules via `GET /api/schedules` (Supabase-backed)
  - Local development scheduler: `src/lib/local-scheduler.ts`
    - Runs only on localhost in the browser
    - Triggers `POST /api/scheduler` immediately on load and then every 60 seconds
  - Manual device control and status go through `GET/POST /api/tuya`

- Deployed (Vercel)
  - Site: `https://situationscheduler.vercel.app`
  - External cron (provider) calls `GET /api/cron`
    - Frequency should be every minute (provider setting)
    - Endpoint calculates time in `Asia/Singapore`
  - Server scheduler: `POST /api/scheduler` (also callable manually)
  - Manual device control and status use the same `GET/POST /api/tuya` endpoint

### Data source (shared)
- Supabase is the source of truth in both environments via `src/app/api/schedules/route.ts`:
  - Tables:
    - `calendar_assignments(date, situation)`
    - `device_schedules(device_id, situation, time, action)`
    - `manual_overrides(device_id, until_timestamp, set_at)`
    - `interval_mode(device_id, is_active, on_duration, interval_duration, start_time)`
  - `GET /api/schedules` builds and returns:
    - `schedules` (calendar by date)
    - `deviceSchedules` (per device, by situation)
    - `manualOverrides`
    - `intervalMode` (interval mode state and config)
  - `POST /api/schedules` upserts to the above tables (when invoked explicitly)

### CRITICAL: Database Backup Requirements
- **Supabase data is NOT in git** - database exists only in Supabase cloud
- **Regular backups required** to prevent data loss
- **Backup strategy needed** for all tables:
  - `calendar_assignments` (work/rest day assignments)
  - `device_schedules` (custom device schedules - most critical)
  - `manual_overrides` (temporary automation blocks)
  - `interval_mode` (aircon interval settings)
- **Current backup**: `.tmp-scheduler-storage.json` (contains device schedules backup)
- **Action needed**: Implement regular automated backups or manual backup procedures

### Scheduling mechanics (current code)
- Localhost
  - `local-scheduler.ts` runs in the browser when hostname is `localhost`/`127.0.0.1`
  - Calls `POST /api/scheduler` on load, then every 60s

- Deployed
  - External cron calls `GET /api/cron` every minute
  - `GET /api/cron` reads schedules via `GET /api/schedules` (Supabase)
  - When an event is due "now", it calls `POST /api/tuya` to switch the device

### Device control
- Wrapper: `src/lib/tuya-api.ts`
  - Server builds absolute base URL for `/api/tuya`
  - `getDeviceStatus(deviceId)` → `GET /api/tuya?action=status&deviceId=...`
  - `turnOn/turnOff(deviceId)` → `POST /api/tuya` with `{ action: 'switch_1', value: true|false }`

### Timezone handling
- `GET /api/cron` computes current time and date in `Asia/Singapore` via `Intl.DateTimeFormat`.

### Notes
- Localhost and deployed both read schedules from Supabase through `/api/schedules`.
- Having localhost open means it can also trigger scheduling (`POST /api/scheduler`) every 60 seconds while the page is open.
- No additional persistence of execution history is implemented beyond console logs and optional `lastExecutedEvents` in server storage (for duplicate suppression on the server route).

### Recent Major Changes (Sep 27, 2025)
- **Data Loss Fix**: Fixed destructive code that was deleting schedules on every edit - see `DELETED_DEVICE_SCHEDULES_INVESTIGATION.md`
- **Supabase Sync Fixes**: 
  - Fixed cron job reading from old file instead of Supabase (calendar assignments not syncing)
  - Fixed schedule deletion issue where deleted schedules kept reappearing
  - Updated cron job to query Supabase directly instead of file-based storage
- **Aircon Settings**: temp=26°C, wind=2 (middle speed) - see `IR_AC_INTEGRATION_README.md`


