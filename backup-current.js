// Script to backup current Supabase data using Supabase client
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://enywhg3tuc4nkjuc4tfk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVueXdoZzN0dWM0bmtqdWM0dGZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI0NDQwMCwiZXhwIjoyMDUwODEwNDAwfQ.7K8QqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqKqK';

const supabase = createClient(supabaseUrl, supabaseKey);

async function backupCurrent() {
  const tables = ['calendar_assignments', 'device_schedules', 'manual_overrides', 'interval_mode'];
  let backupSQL = `-- Supabase Backup - ${new Date().toISOString()}\n-- Generated: ${new Date().toLocaleString()}\n-- Method: Supabase Client Library\n\n`;
  
  try {
    for (const table of tables) {
      console.log(`📋 Exporting ${table}...`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*');
      
      if (error) {
        console.error(`❌ Error fetching ${table}:`, error.message);
        continue;
      }
      
      console.log(`✅ Found ${data.length} records in ${table}`);
      
      if (data.length > 0) {
        backupSQL += `-- Table: ${table}\n`;
        backupSQL += `TRUNCATE TABLE ${table} CASCADE;\n`;
        
        for (const record of data) {
          const columns = Object.keys(record);
          const values = columns.map(col => {
            const val = record[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          });
          
          backupSQL += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        backupSQL += '\n';
      }
    }
    
    const filename = `sqls/supabase-backup-${new Date().toISOString().split('T')[0]}-${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}.sql`;
    fs.writeFileSync(filename, backupSQL);
    console.log(`✅ Backup exported: ${filename}`);
    console.log(`📊 Backup size: ${fs.statSync(filename).size} bytes`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
  }
}

backupCurrent();