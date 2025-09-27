// Script to restore device schedules from backup
const fs = require('fs');

// Read the backup file
const backupData = JSON.parse(fs.readFileSync('.tmp-scheduler-storage.json', 'utf8'));
const deviceSchedules = backupData.deviceSchedules;

console.log('📋 Restoring device schedules from backup...');
console.log(`Found schedules for ${Object.keys(deviceSchedules).length} devices:`);

// Convert to SQL INSERT format
const schedulesToInsert = [];

for (const [deviceId, deviceData] of Object.entries(deviceSchedules)) {
  console.log(`\nDevice: ${deviceId}`);
  
  for (const [situation, schedules] of Object.entries(deviceData)) {
    console.log(`  ${situation}: ${schedules.length} schedules`);
    
    for (const schedule of schedules) {
      schedulesToInsert.push({
        device_id: deviceId,
        situation: situation,
        time: schedule.time,
        action: schedule.action
      });
    }
  }
}

console.log(`\nTotal schedules to restore: ${schedulesToInsert.length}`);

// Generate SQL
let sql = '-- Restore device schedules from backup\n';
sql += '-- Generated on: ' + new Date().toISOString() + '\n\n';

sql += 'INSERT INTO device_schedules (device_id, situation, time, action) VALUES\n';

const values = schedulesToInsert.map(schedule => 
  `('${schedule.device_id}', '${schedule.situation}', '${schedule.time}', '${schedule.action}')`
).join(',\n');

sql += values + '\n';
sql += 'ON CONFLICT (device_id, situation, time) DO UPDATE SET\n';
sql += '  action = EXCLUDED.action,\n';
sql += '  updated_at = NOW();\n';

// Write SQL file
fs.writeFileSync('restore-schedules.sql', sql);

console.log('\n✅ SQL file generated: restore-schedules.sql');
console.log('Run this SQL in your Supabase SQL editor to restore schedules.');

// Also generate curl command for API
const apiPayload = {
  type: 'devices',
  deviceSchedules: deviceSchedules
};

console.log('\n📡 Or use this curl command to restore via API:');
console.log('curl -X POST https://situationscheduler.vercel.app/api/schedules \\');
console.log('  -H "Content-Type: application/json" \\');
console.log(`  -d '${JSON.stringify(apiPayload)}'`);
