-- Clear existing AC interval mode record to remove 3/20 defaults
-- This will delete any existing interval mode record for the AC device

DELETE FROM interval_mode 
WHERE device_id = 'a3cf493448182afaa9rlgw';

-- Alternative: If you want to keep the record but clear the values:
-- UPDATE interval_mode 
-- SET on_duration = NULL, interval_duration = NULL
-- WHERE device_id = 'a3cf493448182afaa9rlgw';
