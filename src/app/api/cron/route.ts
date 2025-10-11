import { NextResponse } from 'next/server';
import { DEVICES } from '@/lib/persistent-storage';
import crypto from 'crypto';

const ACCESS_ID = 'enywhg3tuc4nkjuc4tfk';
const SECRET = '0ef25f248d1f43828b829f2712f93573';
const BASE_URL = 'https://openapi-sg.iotbing.com';

async function getAccessToken(): Promise<string> {
  // Always get fresh token - caching doesn't work reliably in serverless
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
  
  if (!data.success) {
    console.error('❌ Token request failed:', data);
    throw new Error(`Token request failed: ${data.msg}`);
  }
  
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
    let situation = todaySchedule?.situation;
    let isUsingDefault = false;
    
    // If no day is assigned, use default from user settings
    if (!situation) {
      console.log(`📅 No day assigned for today (${today}) - checking default settings`);
      
      const userSettings = data.userSettings || {};
      const defaultDay = userSettings.default_day || 'rest';
      
      if (defaultDay === 'none') {
        console.log(`📅 No day assigned and default is 'none' - no schedules will run`);
        return NextResponse.json({
          success: true,
          message: 'No day assigned and default is none - no schedules executed',
          result: {
            date: today,
            situation: 'none',
            executed: [],
            isUsingDefault: false
          }
        });
      }
      
      situation = defaultDay;
      isUsingDefault = true;
      console.log(`📋 Using default schedule: ${defaultDay} day (unassigned day)`);
    } else {
      console.log(`📋 Today's schedule: ${situation} day`);
    }
    
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
    
    // Minimal diagnostics for Lights in 20:00–20:45 window (SG) without changing behavior
    try {
      const lightsId = 'a3e31a88528a6efc15yf4o';
      const lights = schedulesByDevice[lightsId] || [];
      const windowEntries = lights
        .map(e => {
          const [h, m] = e.time.split(':').map(Number);
          return { ...e, minutes: h * 60 + m };
        })
        .filter(e => e.minutes >= (20 * 60) && e.minutes <= (20 * 60 + 45));
      const match = windowEntries.find(e => e.minutes === currentTime) || null;
      if (windowEntries.length) {
        console.log(JSON.stringify({ tag: 'cron.window.lights', today, currentTime, entries: windowEntries.map(e => ({ time: e.time, action: e.action })), match: match ? { time: match.time, action: match.action } : null }));
      }
    } catch (_) {
      // no-op
    }
    
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
            // Use correct action for aircon device
            const action = deviceId === 'a3cf493448182afaa9rlgw' ? 'ir_power' : 'switch_1';
            
            const response = await fetch(`${baseUrl}/api/tuya`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                action,
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
    
    // Check interval mode for aircon device
    try {
      const intervalData = data.intervalConfig;
      console.log(`🔄 CRON: Interval mode data:`, JSON.stringify(intervalData));
      
      if (!intervalData) {
        console.log(`🔄 CRON: No interval mode data found`);
      } else if (!intervalData.isActive) {
        console.log(`🔄 CRON: Interval mode is NOT active (isActive=${intervalData.isActive})`);
      } else if (!intervalData.startTime) {
        console.log(`🔄 CRON: Interval mode active but NO startTime`);
      }
      
      if (intervalData && intervalData.isActive && intervalData.startTime) {
        console.log(`🔄 CRON: Checking interval mode for aircon - ACTIVE with startTime`);
        
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://situationscheduler.vercel.app' : 'http://localhost:3001';
        
        // Check if Web Worker is active (heartbeat < 2 min old)
        const heartbeatResponse = await fetch(`${baseUrl}/api/schedules`);
        const heartbeatData = await heartbeatResponse.json();
        const heartbeatTimestamp = heartbeatData?.userSettings?.interval_mode_heartbeat;
        
        // Check if Web Worker is active - if so, skip interval mode control
        let shouldSkipIntervalMode = false;
        if (heartbeatTimestamp) {
          const heartbeatAge = Date.now() - parseInt(heartbeatTimestamp);
          if (heartbeatAge < 120000) { // Less than 2 minutes old
            console.log(`🔄 CRON: Web Worker is active (heartbeat ${Math.floor(heartbeatAge/1000)}s ago), skipping interval mode control`);
            shouldSkipIntervalMode = true;
          } else {
            console.log(`🔄 CRON: Web Worker heartbeat stale (${Math.floor(heartbeatAge/1000)}s ago), cron taking over`);
          }
        } else {
          console.log(`🔄 CRON: No Web Worker heartbeat found, cron taking over`);
        }
        
        // Only execute interval mode logic if Web Worker is not active
        if (!shouldSkipIntervalMode) {
          const startTime = new Date(intervalData.startTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const totalCycleTime = (intervalData.onDuration + intervalData.intervalDuration) * 60;
        const cyclePosition = elapsed % totalCycleTime;
        
        // Calculate what the AC should be right now
        const shouldBeOn = cyclePosition < (intervalData.onDuration * 60);
        const currentPeriod = shouldBeOn ? 'ON' : 'OFF';
        const remainingTime = shouldBeOn 
          ? (intervalData.onDuration * 60) - cyclePosition
          : totalCycleTime - cyclePosition;
        
        console.log(`🔄 CRON: Interval mode - ${currentPeriod} period, ${remainingTime}s remaining`);
        
        // Check if we need to send command (only send when transitioning)
        // Track last state in user_settings to avoid sending same command repeatedly
        const lastStateResponse = await fetch(`${baseUrl}/api/schedules`);
        const lastStateData = await lastStateResponse.json();
        const lastIntervalState = lastStateData?.userSettings?.interval_mode_last_state;
        
        // If no saved state, always send command (first run)
        // Otherwise, only send if state changed
        const shouldSendCommand = !lastIntervalState || (lastIntervalState === 'true') !== shouldBeOn;
        
        if (shouldSendCommand) {
          const lastState = lastIntervalState === 'true';
          console.log(`🔄 CRON: State changed (${lastIntervalState ? (lastState ? 'ON' : 'OFF') : 'UNKNOWN'} → ${shouldBeOn ? 'ON' : 'OFF'}), sending command`);
          
          const commandResponse = await fetch(`${baseUrl}/api/tuya`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: 'a3cf493448182afaa9rlgw',
              action: 'ir_power',
              value: shouldBeOn
            })
          });
          
          if (commandResponse.ok) {
            const commandResult = await commandResponse.json();
            console.log(`🔄 CRON: Interval mode command result:`, commandResult);
            
            // Save new state to prevent duplicate commands
            await fetch(`${baseUrl}/api/schedules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'user_settings',
                settingKey: 'interval_mode_last_state',  // camelCase, not snake_case!
                settingValue: shouldBeOn.toString()
              })
            });
            
            executedActions.push({
              deviceId: 'a3cf493448182afaa9rlgw',
              deviceName: 'Air',
              time: 'interval_mode',
              action: shouldBeOn ? 'on' : 'off',
              apiResult: commandResult.success ? 'success' : 'failed',
              apiDetails: commandResult
            });
          }
        } else {
          console.log(`🔄 CRON: AC already in correct state (${shouldBeOn ? 'ON' : 'OFF'}), no command needed`);
        }
        } // End of if (!shouldSkipIntervalMode)
      }
    } catch (error) {
      console.error('❌ CRON: Interval mode check failed:', error);
      // Don't fail the entire cron job if interval mode check fails
    }
    
    return NextResponse.json({
      success: true,
      message: isUsingDefault ? `Cron executed successfully (using default: ${situation})` : 'Cron executed successfully',
      result: {
        date: today,
        situation: situation,
        executed: executedActions,
        isUsingDefault
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
