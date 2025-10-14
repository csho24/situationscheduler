-- Backup + Blackout Window Check Script
-- Created: 2025-10-14 23:30 (after Oct 15-16 experiments)
-- Run this in Supabase SQL Editor

-- ==============================================
-- PART 1: BACKUP ALL DATA
-- ==============================================

-- Copy these results and save them!

-- Calendar Assignments (run this query separately)
SELECT * FROM calendar_assignments ORDER BY date;

-- Device Schedules (run this query separately)  
SELECT * FROM device_schedules ORDER BY device_id, situation, time;

-- User Settings (run this query separately)
SELECT * FROM user_settings;

-- Interval Mode (run this query separately)
SELECT * FROM interval_mode;

-- ==============================================
-- PART 2: BLACKOUT WINDOW CHECK
-- ==============================================

-- Schedules that fall in blackout windows (:01-:10 and :31-:40)
SELECT 
  device_id,
  situation,
  time,
  action,
  CASE 
    WHEN CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 1 AND 10 THEN 'BLACKOUT :01-:10'
    WHEN CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 31 AND 40 THEN 'BLACKOUT :31-:40'
  END as blackout_window,
  'Cron may miss this time!' as warning
FROM device_schedules
WHERE 
  -- Minutes :01-:10
  CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 1 AND 10
  OR
  -- Minutes :31-:40
  CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 31 AND 40
ORDER BY time, device_id, situation;

-- Summary count
SELECT 
  COUNT(*) as total_schedules_in_blackout_windows
FROM device_schedules
WHERE 
  CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 1 AND 10
  OR
  CAST(SUBSTRING(time FROM 4 FOR 2) AS INTEGER) BETWEEN 31 AND 40;

