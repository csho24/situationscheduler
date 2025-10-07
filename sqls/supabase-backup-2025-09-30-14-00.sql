-- Smart Situation Scheduler Database Backup
-- Created: 2025-09-30 14:00 (before default days feature implementation)
-- Data Status: 21 calendar assignments, 38 device schedules, 111 overrides

-- ==============================================
-- CALENDAR ASSIGNMENTS (21 records)
-- ==============================================
INSERT INTO calendar_assignments (date, situation, created_at, updated_at) VALUES
('2025-09-19', 'rest', NOW(), NOW()),
('2025-09-21', 'rest', NOW(), NOW()),
('2025-09-22', 'rest', NOW(), NOW()),
('2025-09-23', 'rest', NOW(), NOW()),
('2025-09-24', 'rest', NOW(), NOW()),
('2025-10-10', 'work', NOW(), NOW()),
('2025-09-26', 'rest', NOW(), NOW()),
('2025-09-27', 'rest', NOW(), NOW()),
('2025-10-13', 'rest', NOW(), NOW()),
('2025-10-14', 'rest', NOW(), NOW()),
('2025-09-28', 'rest', NOW(), NOW()),
('2025-10-03', 'work', NOW(), NOW()),
('2025-10-17', 'work', NOW(), NOW()),
('2025-10-24', 'work', NOW(), NOW()),
('2025-10-31', 'work', NOW(), NOW()),
('2025-09-29', 'rest', NOW(), NOW()),
('2025-01-15', 'work', NOW(), NOW()),
('2025-10-09', 'rest', NOW(), NOW()),
('2025-10-08', 'rest', NOW(), NOW()),
('2025-10-06', 'rest', NOW(), NOW()),
('2025-10-15', 'rest', NOW(), NOW())
ON CONFLICT (date) DO UPDATE SET 
  situation = EXCLUDED.situation,
  updated_at = NOW();

-- ==============================================
-- DEVICE SCHEDULES (38 records)
-- ==============================================

-- Lights (a3e31a88528a6efc15yf4o) - Work Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a3e31a88528a6efc15yf4o', 'work', '22:45', 'off', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'work', '23:20', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- Lights (a3e31a88528a6efc15yf4o) - Rest Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a3e31a88528a6efc15yf4o', 'rest', '00:05', 'off', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'rest', '18:45', 'on', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'rest', '20:00', 'off', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'rest', '20:10', 'off', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'rest', '23:00', 'off', NOW(), NOW()),
('a3e31a88528a6efc15yf4o', 'rest', '23:30', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- Laptop (a34b0f81d957d06e4aojr1) - Work Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a34b0f81d957d06e4aojr1', 'work', '05:45', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'work', '06:15', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- Laptop (a34b0f81d957d06e4aojr1) - Rest Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a34b0f81d957d06e4aojr1', 'rest', '05:45', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '06:15', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '10:45', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '11:00', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '12:50', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '13:30', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '15:00', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '15:50', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '17:00', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '18:30', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '21:00', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '22:00', 'off', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '22:40', 'on', NOW(), NOW()),
('a34b0f81d957d06e4aojr1', 'rest', '23:00', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- USB Hub (a3240659645e83dcfdtng7) - Work Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a3240659645e83dcfdtng7', 'work', '05:45', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'work', '07:55', 'off', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'work', '19:10', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'work', '23:05', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- USB Hub (a3240659645e83dcfdtng7) - Rest Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a3240659645e83dcfdtng7', 'rest', '06:10', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '09:30', 'off', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '13:15', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '14:15', 'off', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '17:30', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '18:30', 'off', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '22:20', 'on', NOW(), NOW()),
('a3240659645e83dcfdtng7', 'rest', '23:00', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- Aircon (a3cf493448182afaa9rlgw) - Work Day
INSERT INTO device_schedules (device_id, situation, time, action, created_at, updated_at) VALUES
('a3cf493448182afaa9rlgw', 'work', '03:30', 'on', NOW(), NOW()),
('a3cf493448182afaa9rlgw', 'work', '03:50', 'off', NOW(), NOW())
ON CONFLICT (device_id, situation, time) DO UPDATE SET 
  action = EXCLUDED.action,
  updated_at = NOW();

-- Aircon (a3cf493448182afaa9rlgw) - Rest Day (empty)
-- No rest day schedules for aircon

-- ==============================================
-- INTERVAL MODE STATE
-- ==============================================
INSERT INTO interval_mode (device_id, is_active, on_duration, interval_duration, start_time, created_at, updated_at) VALUES
('a3cf493448182afaa9rlgw', true, 10, 20, '2025-09-30T05:59:24.623+00:00', NOW(), NOW())
ON CONFLICT (device_id) DO UPDATE SET 
  is_active = EXCLUDED.is_active,
  on_duration = EXCLUDED.on_duration,
  interval_duration = EXCLUDED.interval_duration,
  start_time = EXCLUDED.start_time,
  updated_at = NOW();

-- ==============================================
-- MANUAL OVERRIDES (4 active overrides)
-- ==============================================
-- Note: Manual overrides are temporary and will expire
-- Current overrides (as of backup time):
-- a34b0f81d957d06e4aojr1: until 1758989242769
-- a3e31a88528a6efc15yf4o: until 1758989240500  
-- a3240659645e83dcfdtng7: until 1758989242743
-- a3cf493448182afaa9rlgw: until 1758805873697

-- ==============================================
-- BACKUP SUMMARY
-- ==============================================
-- Calendar Assignments: 21 records
-- Device Schedules: 38 records (4 devices × work/rest schedules)
-- Interval Mode: 1 active record (aircon)
-- Manual Overrides: 4 active (temporary, will expire)
-- 
-- Devices:
-- - Lights (a3e31a88528a6efc15yf4o): 8 schedules
-- - Laptop (a34b0f81d957d06e4aojr1): 16 schedules  
-- - USB Hub (a3240659645e83dcfdtng7): 12 schedules
-- - Aircon (a3cf493448182afaa9rlgw): 2 schedules
--
-- This backup was created before implementing the default days feature.
-- All data is preserved and can be restored if needed.
















