-- Supabase Backup - September 27, 2025
-- Generated after major fixes: interval mode, data loss fix, calendar sync fix

-- Calendar Assignments
INSERT INTO calendar_assignments (date, situation) VALUES
('2025-09-19', 'rest'),
('2025-09-21', 'rest'),
('2025-09-22', 'rest'),
('2025-09-23', 'rest'),
('2025-09-24', 'rest'),
('2025-09-26', 'rest'),
('2025-09-27', 'rest'),
('2025-10-06', 'work'),
('2025-10-08', 'work'),
('2025-10-09', 'work'),
('2025-10-10', 'work'),
('2025-10-13', 'rest'),
('2025-10-14', 'rest'),
('2025-10-15', 'work')
ON CONFLICT (date) DO UPDATE SET situation = EXCLUDED.situation;

-- Device Schedules (from restored backup)
INSERT INTO device_schedules (device_id, situation, time, action) VALUES
-- Lights schedules
('a3e31a88528a6efc15yf4o', 'work', '08:00', 'on'),
('a3e31a88528a6efc15yf4o', 'work', '08:10', 'off'),
('a3e31a88528a6efc15yf4o', 'work', '22:45', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '00:05', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '18:57', 'on'),
('a3e31a88528a6efc15yf4o', 'rest', '20:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '20:10', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:30', 'off'),

-- Laptop schedules
('a34b0f81d957d06e4aojr1', 'work', '08:00', 'on'),
('a34b0f81d957d06e4aojr1', 'work', '08:10', 'off'),
('a34b0f81d957d06e4aojr1', 'work', '22:45', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '19:03', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '20:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '05:45', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '23:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '06:15', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '10:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '11:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '12:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '13:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '14:45', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '15:45', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '17:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '18:15', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '21:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '22:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '21:10', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '22:40', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '10:45', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '11:15', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '14:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '15:00', 'off'),

-- USB Hub schedules
('a3240659645e83dcfdtng7', 'work', '08:00', 'on'),
('a3240659645e83dcfdtng7', 'work', '08:10', 'off'),
('a3240659645e83dcfdtng7', 'work', '22:45', 'off'),
('a3240659645e83dcfdtng7', 'rest', '09:30', 'off'),
('a3240659645e83dcfdtng7', 'rest', '14:15', 'on'),
('a3240659645e83dcfdtng7', 'rest', '06:00', 'on'),
('a3240659645e83dcfdtng7', 'rest', '09:00', 'off'),
('a3240659645e83dcfdtng7', 'rest', '13:15', 'on'),
('a3240659645e83dcfdtng7', 'rest', '15:00', 'off'),
('a3240659645e83dcfdtng7', 'rest', '18:30', 'on'),
('a3240659645e83dcfdtng7', 'rest', '20:30', 'off')
ON CONFLICT (device_id, situation, time) DO UPDATE SET action = EXCLUDED.action;

-- Interval Mode (if any exists)
-- Note: This table may be empty, but structure is ready for interval mode data

-- Manual Overrides (if any exist)
-- Note: This table may be empty, but structure is ready for manual override data

-- Backup completed: September 27, 2025
-- Status: All major fixes applied and tested
-- - Interval mode working with persistence
-- - Schedule deletion issue resolved  
-- - Calendar sync between localhost and deployed fixed
-- - Aircon settings: temp=26°C, wind=2

