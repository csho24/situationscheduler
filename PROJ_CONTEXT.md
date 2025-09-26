## Smart Situation Scheduler – Project Context (Factual)

This document captures the current, factual setup of the project (no speculation).

### Purpose
This app solves the problem of inconsistent work schedules where traditional fixed weekly routines don't work. With ad-hoc work and changing commitments, a Tuesday this week isn't the same as next Tuesday. 

**The solution:** Instead of fixed weekly schedules, you define each day as "work" or "rest" as you go, and the app follows the appropriate routine for that day. This gives you the flexibility of Google Home's simple interface (which only allows manual on/off) but adds the automation you need for your changing schedule.

### App overview
- Web app that controls Tuya Smart Life plugs based on calendar "work/rest" days and per‑device schedules.
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
  - `GET /api/schedules` builds and returns:
    - `schedules` (calendar by date)
    - `deviceSchedules` (per device, by situation)
    - `manualOverrides`
  - `POST /api/schedules` upserts to the above tables (when invoked explicitly)

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
  - Smart plugs: `turnOn/turnOff(deviceId)` → `POST /api/tuya` with `{ action: 'switch_1', value: true|false }`
  - Aircon (IR):
    - ON (combined state): `POST /v2.0/infrareds/{ir_id}/air-conditioners/{remote_id}/scenes/command` with `{ power:1, mode:0, temp:27, wind:2 }`
    - OFF (standard): `POST` remotes command with `{ category_id:5, key:"PowerOff", key_id:0 }`
    - Note: IR devices are stateless via `/v1.0/devices/{deviceId}`; UI shows neutral Aircon state on refresh.

### Timezone handling
- `GET /api/cron` computes current time and date in `Asia/Singapore` via `Intl.DateTimeFormat`.

### Notes
- Localhost and deployed both read schedules from Supabase through `/api/schedules`.
- Having localhost open means it can also trigger scheduling (`POST /api/scheduler`) every 60 seconds while the page is open.
- No additional persistence of execution history is implemented beyond console logs and optional `lastExecutedEvents` in server storage (for duplicate suppression on the server route).

### Local vs Deployed (base URL & clashes)
- For local dev, set `NEXT_PUBLIC_BASE_URL=http://localhost:3001` in `.env.local`. If it points to the deployed URL, local calls hit prod.
- Avoid running local scheduler while deployed cron is active to prevent clashes/rate limiting; keep only one scheduler active when testing.


### 24 Sep 2025 – Deploy note (monorepo root)
- Observation: Pushes to GitHub did not auto-deploy UI changes on Vercel; manual redeploy showed “Unexpected error”.
- Likely cause: Vercel building repo root instead of app subfolder.
- Action items for future:
  - During (re)import on Vercel, choose project Root Directory = `plug-scheduler`.
  - If the UI does not expose Root Directory, re-link the repo and pick `plug-scheduler` at import time.
  - Optional safeguard: add a root-level `vercel.json` in the repo (outside this folder) to pin `plug-scheduler` as the build root.
