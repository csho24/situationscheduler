-- Restore device schedules from backup
-- Generated on: 2025-09-27T13:27:12.472Z

INSERT INTO device_schedules (device_id, situation, time, action) VALUES
('a3e31a88528a6efc15yf4o', 'work', '22:45', 'off'),
('a3e31a88528a6efc15yf4o', 'work', '23:20', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '20:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '21:19', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:30', 'off'),
('a34b0f81d957d06e4aojr1', 'work', '05:45', 'on'),
('a34b0f81d957d06e4aojr1', 'work', '06:15', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '05:45', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '06:15', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '10:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '11:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '14:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '15:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '17:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '19:03', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '20:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '21:00', 'off'),
('a34b0f81d957d06e4aojr1', 'rest', '22:00', 'on'),
('a34b0f81d957d06e4aojr1', 'rest', '23:00', 'off'),
('a3240659645e83dcfdtng7', 'work', '00:20', 'off'),
('a3240659645e83dcfdtng7', 'work', '05:45', 'on'),
('a3240659645e83dcfdtng7', 'work', '07:55', 'off'),
('a3240659645e83dcfdtng7', 'work', '19:00', 'on'),
('a3240659645e83dcfdtng7', 'rest', '06:00', 'on'),
('a3240659645e83dcfdtng7', 'rest', '09:30', 'off'),
('a3240659645e83dcfdtng7', 'rest', '14:15', 'on'),
('a3240659645e83dcfdtng7', 'rest', '15:00', 'off'),
('a3240659645e83dcfdtng7', 'rest', '18:30', 'on'),
('a3240659645e83dcfdtng7', 'rest', '20:30', 'off')
ON CONFLICT (device_id, situation, time) DO UPDATE SET
  action = EXCLUDED.action,
  updated_at = NOW();
