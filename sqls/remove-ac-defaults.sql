-- Remove default 3/20 timing for AC interval mode
-- This removes the default values from the interval_mode table columns

ALTER TABLE interval_mode 
ALTER COLUMN on_duration DROP DEFAULT;

ALTER TABLE interval_mode 
ALTER COLUMN interval_duration DROP DEFAULT;

