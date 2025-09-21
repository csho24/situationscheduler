import { NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { supabase } from '@/lib/supabase';
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

// Fallback: if Supabase fails, use hardcoded schedules
const FALLBACK_SCHEDULES: Record<string, Array<{time: string; action: string}>> = {
  'a34b0f81d957d06e4aojr1': [ // Laptop
    { time: '10:00', action: 'on' },
    { time: '11:00', action: 'off' },
    { time: '14:00', action: 'on' },
    { time: '15:00', action: 'off' },
    { time: '17:00', action: 'on' },
    { time: '19:03', action: 'on' },
    { time: '20:00', action: 'on' },
    { time: '21:00', action: 'off' },
    { time: '22:00', action: 'on' },
    { time: '23:00', action: 'off' }
  ]
};

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
    const baseUrl = 'https://situationscheduler.vercel.app';
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
      if (deviceSchedule[situation]) {
        schedulesByDevice[deviceId] = deviceSchedule[situation];
      }
    });
    
    console.log(`📋 Loaded schedules for ${Object.keys(schedulesByDevice).length} devices`);
    
    const executedActions = [];
    
    for (const [deviceId, deviceSchedule] of Object.entries(schedulesByDevice)) {
      const device = DEVICES.find(d => d.id === deviceId);
      if (!device) continue;
      
      console.log(`📋 ${device.name} ${calendarData.situation} schedule:`, deviceSchedule);
      
      for (const schedule of deviceSchedule) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const scheduleTime = hours * 60 + minutes;
        
        console.log(`⏰ ${device.name}: Checking ${schedule.time} (${scheduleTime} min) ${schedule.action} - ${scheduleTime <= currentTime ? 'PAST' : 'FUTURE'}`);
        
        if (scheduleTime <= currentTime) {
          // This schedule should have executed - EXECUTE IT NOW
          console.log(`⚡ ${device.name}: Executing ${schedule.time} ${schedule.action}`);
          
          try {
            // Execute the device control directly via Tuya API
            const commands = [{ code: 'switch_1', value: schedule.action === 'on' }];
            const response = await fetch(`https://openapi-sg.iotbing.com/v1.0/devices/${deviceId}/commands`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'client_id': 'enywhg3tuc4nkjuc4tfk',
                'access_token': await getAccessToken(),
                't': Date.now().toString(),
                'sign_method': 'HMAC-SHA256',
                'sign': await generateSignature('POST', `/v1.0/devices/${deviceId}/commands`, Date.now().toString(), await getAccessToken(), JSON.stringify({ commands }))
              },
              body: JSON.stringify({ commands })
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`🔌 ${device.name}: Turn ${schedule.action.toUpperCase()} result:`, result);
            
            // Log execution to Supabase
            await supabase
              .from('execution_log')
              .insert({
                device_id: deviceId,
                action: schedule.action,
                scheduled_time: schedule.time,
                success: true
              });
            
            executedActions.push({
              deviceId,
              deviceName: device.name,
              time: schedule.time,
              action: schedule.action
            });
            
            console.log(`✅ ${device.name}: ${schedule.action} executed successfully`);
          } catch (error) {
            console.error(`❌ ${device.name}: Failed to ${schedule.action}:`, error);
            
            // Log failed execution to Supabase
            await supabase
              .from('execution_log')
              .insert({
                device_id: deviceId,
                action: schedule.action,
                scheduled_time: schedule.time,
                success: false,
                error_message: error instanceof Error ? error.message : 'Unknown error'
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
