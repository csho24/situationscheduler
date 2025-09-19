// Test script to debug cron execution
const fetch = require('node-fetch');

async function testCron() {
  try {
    console.log('🧪 Testing cron endpoint...');
    
    const response = await fetch('http://localhost:3001/api/cron');
    const data = await response.json();
    
    console.log('📊 Cron Response:', JSON.stringify(data, null, 2));
    
    if (data.result && data.result.executed) {
      console.log(`✅ Executed ${data.result.executed.length} actions`);
      data.result.executed.forEach(action => {
        console.log(`  - ${action.deviceName}: ${action.action} at ${action.time}`);
      });
    } else {
      console.log('❌ No actions executed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCron();
