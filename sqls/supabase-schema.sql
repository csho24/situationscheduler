-- Smart Situation Scheduler Database Schema
-- Run these commands in your Supabase SQL editor

-- 1. Calendar assignments table (which days are work/rest)
CREATE TABLE calendar_assignments (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  situation VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Device schedules table (custom schedules for each device)
CREATE TABLE device_schedules (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  situation VARCHAR(50) NOT NULL,
  time VARCHAR(5) NOT NULL, -- Format: "10:00"
  action VARCHAR(3) NOT NULL CHECK (action IN ('on', 'off')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(device_id, situation, time)
);

-- 3. Manual overrides table (temporary blocks on automation)
CREATE TABLE manual_overrides (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  until_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  set_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Execution log table (track what was executed when)
CREATE TABLE execution_log (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  action VARCHAR(3) NOT NULL,
  scheduled_time VARCHAR(5) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- 5. Interval mode table (track interval mode state for devices)
CREATE TABLE interval_mode (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  on_duration INTEGER DEFAULT 3,
  interval_duration INTEGER DEFAULT 20,
  start_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Custom routines table (store user-defined routine types)
CREATE TABLE custom_routines (
  id SERIAL PRIMARY KEY,
  routine_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_calendar_assignments_date ON calendar_assignments(date);
CREATE INDEX idx_device_schedules_device_situation ON device_schedules(device_id, situation);
CREATE INDEX idx_manual_overrides_device_until ON manual_overrides(device_id, until_timestamp);
CREATE INDEX idx_execution_log_device_executed ON execution_log(device_id, executed_at);
CREATE INDEX idx_interval_mode_device ON interval_mode(device_id);
CREATE INDEX idx_custom_routines_name ON custom_routines(routine_name);

-- Insert default template schedules for your devices
-- Replace these device IDs with your actual device IDs
INSERT INTO device_schedules (device_id, situation, time, action) VALUES
-- Lights (a3e31a88528a6efc15yf4o) - Work Day
('a3e31a88528a6efc15yf4o', 'work', '21:00', 'on'),
('a3e31a88528a6efc15yf4o', 'work', '22:00', 'off'),

-- Lights (a3e31a88528a6efc15yf4o) - Rest Day  
('a3e31a88528a6efc15yf4o', 'rest', '20:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '21:19', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:00', 'off'),
('a3e31a88528a6efc15yf4o', 'rest', '23:30', 'off'),

-- Laptop (a34b0f81d957d06e4aojr1) - Work Day
('a34b0f81d957d06e4aojr1', 'work', '05:45', 'on'),
('a34b0f81d957d06e4aojr1', 'work', '06:15', 'off'),

-- Laptop (a34b0f81d957d06e4aojr1) - Rest Day
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

-- USB Hub (a3240659645e83dcfdtng7) - Work Day
('a3240659645e83dcfdtng7', 'work', '00:20', 'off'),
('a3240659645e83dcfdtng7', 'work', '05:45', 'on'),
('a3240659645e83dcfdtng7', 'work', '07:55', 'off'),
('a3240659645e83dcfdtng7', 'work', '19:00', 'on'),

-- USB Hub (a3240659645e83dcfdtng7) - Rest Day
('a3240659645e83dcfdtng7', 'rest', '06:00', 'on'),
('a3240659645e83dcfdtng7', 'rest', '09:30', 'off'),
('a3240659645e83dcfdtng7', 'rest', '14:15', 'on'),
('a3240659645e83dcfdtng7', 'rest', '15:00', 'off'),
('a3240659645e83dcfdtng7', 'rest', '18:30', 'on'),
('a3240659645e83dcfdtng7', 'rest', '20:30', 'off');

-- Set today as rest day (replace with actual date)
INSERT INTO calendar_assignments (date, situation) VALUES 
(CURRENT_DATE, 'rest')
ON CONFLICT (date) DO UPDATE SET 
  situation = EXCLUDED.situation,
  updated_at = NOW();
