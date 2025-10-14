// Supabase Backup Script - Direct Export
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://yrlvnshydrmhsvfqesnv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHZuc2h5ZHJtaHN2ZnFlc252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNjgwODgsImV4cCI6MjA3Mzg0NDA4OH0.DxGxkIX783bvZ6ClcCq_o-ueY4viCrSWZA5OEw-xc0M'
);

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `supabase-backup-${timestamp}.sql`;
  
  let sql = `-- Supabase Backup ${new Date().toISOString()}\n\n`;
  
  // Calendar assignments
  const { data: calendar } = await supabase.from('calendar_assignments').select('*').order('date');
  sql += `-- Calendar Assignments (${calendar?.length || 0} records)\n`;
  if (calendar && calendar.length > 0) {
    sql += `INSERT INTO calendar_assignments (id, date, situation, created_at, updated_at) VALUES\n`;
    sql += calendar.map(r => 
      `(${r.id}, '${r.date}', '${r.situation}', '${r.created_at}', '${r.updated_at}')`
    ).join(',\n');
    sql += `\nON CONFLICT (date) DO UPDATE SET situation = EXCLUDED.situation, updated_at = EXCLUDED.updated_at;\n\n`;
  }
  
  // Device schedules
  const { data: devices } = await supabase.from('device_schedules').select('*').order('device_id, situation, time');
  sql += `-- Device Schedules (${devices?.length || 0} records)\n`;
  if (devices && devices.length > 0) {
    sql += `INSERT INTO device_schedules (id, device_id, situation, time, action, created_at, updated_at) VALUES\n`;
    sql += devices.map(r => 
      `(${r.id}, '${r.device_id}', '${r.situation}', '${r.time}', '${r.action}', '${r.created_at}', '${r.updated_at}')`
    ).join(',\n');
    sql += `\nON CONFLICT (device_id, situation, time) DO UPDATE SET action = EXCLUDED.action, updated_at = EXCLUDED.updated_at;\n\n`;
  }
  
  // User settings
  const { data: settings } = await supabase.from('user_settings').select('*');
  sql += `-- User Settings (${settings?.length || 0} records)\n`;
  if (settings && settings.length > 0) {
    sql += `INSERT INTO user_settings (id, setting_key, setting_value, created_at, updated_at) VALUES\n`;
    sql += settings.map(r => 
      `(${r.id}, '${r.setting_key}', '${r.setting_value}', '${r.created_at}', '${r.updated_at}')`
    ).join(',\n');
    sql += `\nON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at;\n\n`;
  }
  
  // Interval mode
  const { data: interval } = await supabase.from('interval_mode').select('*');
  sql += `-- Interval Mode (${interval?.length || 0} records)\n`;
  if (interval && interval.length > 0) {
    sql += `INSERT INTO interval_mode (id, device_id, is_active, on_duration, interval_duration, start_time, created_at, updated_at) VALUES\n`;
    sql += interval.map(r => 
      `(${r.id}, '${r.device_id}', ${r.is_active}, ${r.on_duration}, ${r.interval_duration}, ${r.start_time ? `'${r.start_time}'` : 'NULL'}, '${r.created_at}', '${r.updated_at}')`
    ).join(',\n');
    sql += `\nON CONFLICT (device_id) DO UPDATE SET is_active = EXCLUDED.is_active, on_duration = EXCLUDED.on_duration, interval_duration = EXCLUDED.interval_duration, start_time = EXCLUDED.start_time, updated_at = EXCLUDED.updated_at;\n\n`;
  }
  
  fs.writeFileSync(filename, sql);
  console.log(`✅ Backup saved to ${filename}`);
  console.log(`📊 ${calendar?.length || 0} calendar, ${devices?.length || 0} devices, ${settings?.length || 0} settings, ${interval?.length || 0} interval`);
  
  // Check blackout windows
  const blackout = devices?.filter(d => {
    const mins = parseInt(d.time.split(':')[1]);
    return (mins >= 1 && mins <= 10) || (mins >= 31 && mins <= 40);
  });
  
  console.log(`\n⚠️  ${blackout?.length || 0} schedules in blackout windows:`);
  blackout?.forEach(d => console.log(`   ${d.device_id} ${d.situation} ${d.time} ${d.action}`));
}

backup().catch(console.error);

