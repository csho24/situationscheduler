-- User Settings Table for Default Days Feature
-- This is an ADDITIVE change only - does not modify existing tables

-- 6. User settings table (store user preferences like default day)
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_user_settings_key ON user_settings(setting_key);

-- Insert default setting (rest day as default)
INSERT INTO user_settings (setting_key, setting_value) VALUES 
('default_day', 'rest')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();














