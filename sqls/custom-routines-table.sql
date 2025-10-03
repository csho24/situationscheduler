-- Custom Routines Table for Dynamic Situation Types
-- This is an ADDITIVE change only - does not modify existing tables

-- 7. Custom routines table (store user-defined routine types)
CREATE TABLE custom_routines (
  id SERIAL PRIMARY KEY,
  routine_name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_custom_routines_name ON custom_routines(routine_name);

-- Insert some example routines (optional - can be removed)
-- INSERT INTO custom_routines (routine_name) VALUES 
-- ('weekend'),
-- ('travel'),
-- ('study')
-- ON CONFLICT (routine_name) DO NOTHING;













