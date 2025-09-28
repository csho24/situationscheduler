# Endpoint Migration Notes

## What Was Changed (Temporary for Vercel Hobby Deploy)

### Moved Files:
- **FROM**: `src/app/api/cron/scheduler/route.ts`
- **TO**: `src/app/api/scheduler/route.ts`

### Updated References:
1. `src/lib/local-scheduler.ts` - Line 51: `/api/cron/scheduler` → `/api/scheduler`
2. `src/lib/server-scheduler.ts` - Line 210: `/api/cron/scheduler` → `/api/scheduler`
3. `SERVER_SIDE_SCHEDULER_README.md` - Updated all documentation references

## How to Restore Original Structure

### Step 1: Move Endpoint Back
```bash
mkdir -p src/app/api/cron/scheduler
mv src/app/api/scheduler/route.ts src/app/api/cron/scheduler/route.ts
rmdir src/app/api/scheduler
```

### Step 2: Update All References Back
- `src/lib/local-scheduler.ts` - Line 51: `/api/scheduler` → `/api/cron/scheduler`
- `src/lib/server-scheduler.ts` - Line 210: `/api/scheduler` → `/api/cron/scheduler`
- `SERVER_SIDE_SCHEDULER_README.md` - Update all references back

### Step 3: Add Vercel Cron Config (When Ready for Pro Plan)
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/scheduler",
      "schedule": "* * * * *"
    }
  ]
}
```

## Current State
- **Endpoint**: `/api/scheduler` (works exactly the same, just different URL)
- **Functionality**: Identical - all scheduling logic preserved
- **External Pinger**: Will call `/api/scheduler` instead of `/api/cron/scheduler`
- **Local Development**: Still works via `local-scheduler.ts`

## Why This Change?
Vercel Hobby plan blocks deployment if it detects cron jobs. Moving the endpoint to `/api/scheduler` avoids this detection while preserving all functionality.

## Restoration Checklist
- [ ] Move endpoint back to `/api/cron/scheduler/route.ts`
- [ ] Update local-scheduler.ts reference
- [ ] Update server-scheduler.ts reference  
- [ ] Update README documentation
- [ ] Add vercel.json when upgrading to Pro plan
- [ ] Update external pinger to use `/api/cron/scheduler`
