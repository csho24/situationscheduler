import { NextResponse } from 'next/server';
import { DEVICES } from '@/lib/persistent-storage';
import crypto from 'crypto';

const ACCESS_ID = 'enywhg3tuc4nkjuc4tfk';
const SECRET = '0ef25f248d1f43828b829f2712f93573';
const BASE_URL = 'https://openapi-sg.iotbing.com';

async function getAccessToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const stringToSign = `${ACCESS_ID}${timestamp}GET\n${crypto.createHash('sha256').update('').digest('hex')}\n\n/v1.0/token?grant_type=1`;
  const signature = crypto.createHmac('sha256', SECRET).update(stringToSign).digest('hex').toUpperCase();
  
  const response = await fetch(`${BASE_URL}/v1.0/token?grant_type=1`, {
    method: 'GET',
    headers: {
      't': timestamp,
      'sign_method': 'HMAC-SHA256',
      'client_id': ACCESS_ID,
      'sign': signature,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.result.access_token;
}

async function generateSignature(method: string, path: string, timestamp: string, accessToken: string, body: string = ''): Promise<string> {
  const stringToSign = `${method}\n${crypto.createHash('sha256').update(body).digest('hex')}\n\n${path}`;
  return crypto.createHmac('sha256', SECRET).update(stringToSign).digest('hex').toUpperCase();
}


// Simple endpoint for external cron services that can't send headers
export async function GET() {
  try {
    // Force time calculations in Asia/Singapore to avoid UTC mismatch on Vercel
    const tz = 'Asia/Singapore';
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
    const currentTime = hour * 60 + minute;
    // Compute "today" in target timezone
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = dateFmt.format(new Date()); // YYYY-MM-DD
    
    console.log(`🔍 CRON SCHEDULE CHECK (${tz}) at ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} (${currentTime} minutes)`);
    
    // Use the SAME approach as /api/schedules endpoint
    const baseUrl = process.env.NODE_ENV === 'production' ? `https://situationscheduler.vercel.app` : 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/schedules`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Failed to get schedules from API:', data.error);
      return NextResponse.json({
        success: false,
        error: 'Failed to get schedules from API'
      }, { status: 500 });
    }
    
    // Get today's situation from the API response
    const schedules = data.schedules || {};
    const todaySchedule = schedules[today];
    const situation = todaySchedule?.situation || 'rest';
    
    console.log(`📋 Today's schedule: ${situation} day`);
    
    // Get device schedules from the API response
    const deviceSchedules = data.deviceSchedules || {};
    const schedulesByDevice: Record<string, Array<{time: string; action: string}>> = {};
    
    // Group schedules by device for the current situation
    Object.entries(deviceSchedules).forEach(([deviceId, deviceSchedule]) => {
      if (deviceSchedule && typeof deviceSchedule === 'object') {
        const schedule = deviceSchedule as Record<string, Array<{time: string; action: string}>>;
        if (schedule[situation]) {
          schedulesByDevice[deviceId] = schedule[situation];
        }
      }
    });
    
    console.log(`📋 Loaded schedules for ${Object.keys(schedulesByDevice).length} devices`);
    
    const executedActions = [];
    
    for (const [deviceId, deviceSchedule] of Object.entries(schedulesByDevice)) {
      const device = DEVICES.find(d => d.id === deviceId);
      if (!device) continue;
      
      console.log(`📋 ${device.name} ${situation} schedule:`, deviceSchedule);
      
      for (const schedule of deviceSchedule) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const scheduleTime = hours * 60 + minutes;
        
        console.log(`⏰ ${device.name}: Checking ${schedule.time} (${scheduleTime} min) ${schedule.action} - ${scheduleTime === currentTime ? 'NOW' : 'SKIP'}`);
        
        if (scheduleTime === currentTime) {
          // This schedule is for RIGHT NOW - EXECUTE IT
          console.log(`⚡ ${device.name}: Executing ${schedule.time} ${schedule.action}`);
          
          try {
            // Use the same API endpoint as manual controls for consistency
            const baseUrl = process.env.NODE_ENV === 'production' ? 'https://situationscheduler.vercel.app' : 'http://localhost:3001';
            console.log(`🔌 ${device.name}: Making API call to turn ${schedule.action} at ${schedule.time}`);
            const response = await fetch(`${baseUrl}/api/tuya`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                action: 'switch_1',
                value: schedule.action === 'on'
              })
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`🔌 ${device.name}: Turn ${schedule.action.toUpperCase()} result:`, result);
            
            if (!result.success) {
              console.error(`❌ ${device.name}: API call failed:`, result);
            }
            
            // Log execution (removed Supabase logging for now)
            executedActions.push({
              deviceId,
              deviceName: device.name,
              time: schedule.time,
              action: schedule.action,
              apiResult: result.success ? 'success' : 'failed',
              apiDetails: result
            });
          } catch (error) {
            console.error(`❌ ${device.name}: Failed to ${schedule.action}:`, error);
            
            executedActions.push({
              deviceId,
              deviceName: device.name,
              time: schedule.time,
              action: schedule.action,
              apiResult: 'error',
              apiDetails: { error: (error as Error).message }
            });
          }
        } else {
          console.log(`⏰ ${device.name}: ${schedule.time} ${schedule.action} is in the future`);
        }
      }
    }
    
    console.log(`📋 Schedule check complete. Executed ${executedActions.length} actions.`);
    
    return NextResponse.json({
      success: true,
      message: 'Cron executed successfully',
      result: {
        date: today,
        situation: situation,
        executed: executedActions
      }
    });
  } catch (error) {
    console.error('❌ Cron execution failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cron execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
