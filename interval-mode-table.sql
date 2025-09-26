-- Create interval_mode table for tracking interval mode state
CREATE TABLE IF NOT EXISTS interval_mode (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_interval_mode_device ON interval_mode(device_id);
