import { NextRequest, NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { DEVICES } from '@/lib/persistent-storage';
import { supabase } from '@/lib/supabase';

async function executeScheduleCheck() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const today = now.toISOString().split('T')[0];
  
  console.log(`🔍 SERVER SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
  console.log(`🔍 DEBUG: Looking for date: ${today}`);
  
  // Load calendar assignments from Supabase
  const { data: calendarData, error: calendarError } = await supabase
    .from('calendar_assignments')
    .select('*');
  
  if (calendarError) {
    console.error('❌ Failed to load calendar assignments:', calendarError);
    return { message: 'Failed to load calendar data', executed: [], error: calendarError.message };
  }
  
  // Convert to the expected format
  const scheduleStorage: Record<string, { date: string; situation: string }> = {};
  calendarData?.forEach(assignment => {
    scheduleStorage[assignment.date] = {
      date: assignment.date,
      situation: assignment.situation
    };
  });
  
  console.log(`📅 Loaded ${calendarData?.length || 0} calendar assignments from Supabase`);
  console.log(`🔍 DEBUG: Available schedules:`, Object.keys(scheduleStorage));
  
  // Get today's schedule assignment
  const todaySchedule = scheduleStorage[today];
  if (!todaySchedule) {
    console.log(`📅 No schedule assigned for today (${today})`);
    console.log(`📅 Available dates: ${Object.keys(scheduleStorage).join(', ')}`);
    return { message: `No schedule for today (${today})`, executed: [], availableDates: Object.keys(scheduleStorage) };
  }
  
  console.log(`📋 Today's schedule: ${todaySchedule.situation} day`);
  
  // Load device schedules from Supabase
  const { data: deviceScheduleData, error: deviceError } = await supabase
    .from('device_schedules')
    .select('*');
  
  if (deviceError) {
    console.error('❌ Failed to load device schedules:', deviceError);
    return { message: 'Failed to load device schedules', executed: [], error: deviceError.message };
  }
  
  // Convert to the expected format
  const deviceSchedules: Record<string, Record<string, Array<{time: string; action: string}>>> = {};
  deviceScheduleData?.forEach(schedule => {
    if (!deviceSchedules[schedule.device_id]) {
      deviceSchedules[schedule.device_id] = {};
    }
    if (!deviceSchedules[schedule.device_id][schedule.situation]) {
      deviceSchedules[schedule.device_id][schedule.situation] = [];
    }
    deviceSchedules[schedule.device_id][schedule.situation].push({
      time: schedule.time,
      action: schedule.action
    });
  });
  
  console.log(`📋 Loaded device schedules for ${Object.keys(deviceSchedules).length} devices from Supabase`);
  
  // Minimal diagnostics for Lights in 20:00–20:45 window (local server time)
  try {
    const lightsId = 'a3e31a88528a6efc15yf4o';
    const lights = (deviceSchedules[lightsId]?.[todaySchedule.situation]) || [];
    const windowEntries = lights
      .map(e => {
        const [h, m] = e.time.split(':').map(Number);
        return { ...e, minutes: h * 60 + m };
      })
      .filter(e => e.minutes >= (20 * 60) && e.minutes <= (20 * 60 + 45));
    const match = windowEntries.find(e => e.minutes === currentTime) || null;
    if (windowEntries.length) {
      console.log(JSON.stringify({ tag: 'server.window.lights', date: today, currentTime, entries: windowEntries.map(e => ({ time: e.time, action: e.action })), match: match ? { time: match.time, action: match.action } : null }));
    }
  } catch (_) {
    // no-op
  }
  
  const executedActions: string[] = [];
  
  // Check each device's schedule
  for (const device of DEVICES) {
    const deviceSchedule = deviceSchedules[device.id];
    if (!deviceSchedule || !deviceSchedule[todaySchedule.situation]) {
      console.log(`📅 No ${todaySchedule.situation} schedule for ${device.name}`);
      continue;
    }
    
    const schedule = deviceSchedule[todaySchedule.situation];
    if (!Array.isArray(schedule)) {
      console.warn(`Schedule for ${device.name} ${todaySchedule.situation} is not an array:`, schedule);
      continue;
    }
    
    console.log(`📋 ${device.name} ${todaySchedule.situation} schedule:`, schedule);
    
    // Manual overrides don't block future scheduled events
    // They only prevent the scheduler from going backwards to execute past events
    // Future scheduled events should always execute regardless of manual overrides
    
    // Find events that should execute NOW (within the last minute)
    let currentAction: 'on' | 'off' | null = null;
    let actionTime: string | null = null;
    
    for (const entry of schedule) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const entryTime = hours * 60 + minutes;
      
      console.log(`⏰ ${device.name}: Checking ${entry.time} (${entryTime} min) ${entry.action} - ${entryTime <= currentTime ? 'PAST' : 'FUTURE'}`);
      
      // Only execute events happening RIGHT NOW (within last minute)
      if (entryTime <= currentTime && entryTime > (currentTime - 1)) {
        // For now, execute all events that should happen now (within the last minute)
        // TODO: Implement proper last executed tracking in Supabase if needed
        currentAction = entry.action as 'on' | 'off';
        actionTime = entry.time;
        console.log(`⚡ ${device.name} EXECUTING NOW: ${entry.action} at ${entry.time}`);
        break;
      }
    }
    
    if (currentAction && actionTime) {
      try {
        // Get current device state to avoid unnecessary commands
        const deviceStatus = await tuyaAPI.getDeviceStatus(device.id);
        const currentState = (deviceStatus.result as { status?: Array<{ code: string; value: boolean }> })?.status?.find((s: { code: string; value: boolean }) => s.code === 'switch_1')?.value;
        const targetState = currentAction === 'on';
        
        if (currentState === targetState) {
          console.log(`✅ ${device.name} already in correct state (${currentState ? 'ON' : 'OFF'}) - no action needed`);
          continue;
        }
        
        console.log(`⚡ ${device.name} state mismatch: current=${currentState ? 'ON' : 'OFF'}, target=${targetState ? 'ON' : 'OFF'}`);
        
        // Use correct action for aircon device
        if (device.id === 'a3cf493448182afaa9rlgw') {
          // Aircon uses ir_power action
          await tuyaAPI.controlDevice(device.id, 'ir_power', currentAction === 'on');
          console.log(`✅ SERVER: Turned ${currentAction.toUpperCase()} ${device.name} via schedule at ${actionTime}`);
          executedActions.push(`${device.name} ${currentAction.toUpperCase()} at ${actionTime}`);
        } else {
          // Regular devices use turnOn/turnOff
          if (currentAction === 'on') {
            await tuyaAPI.turnOn(device.id);
            console.log(`✅ SERVER: Turned ON ${device.name} via schedule at ${actionTime}`);
            executedActions.push(`${device.name} ON at ${actionTime}`);
          } else {
            await tuyaAPI.turnOff(device.id);
            console.log(`✅ SERVER: Turned OFF ${device.name} via schedule at ${actionTime}`);
            executedActions.push(`${device.name} OFF at ${actionTime}`);
          }
        }
        
        // TODO: Clear manual override in Supabase after successful scheduled action
        // For now, manual overrides are handled separately
        
      } catch (error) {
        console.error(`❌ Failed to execute schedule action for ${device.name}:`, error);
        executedActions.push(`${device.name} FAILED at ${actionTime}: ${error}`);
      }
    } else {
      console.log(`⏰ ${device.name}: No schedule actions needed right now`);
    }
  }
  
  return {
    message: 'Schedule check completed',
    time: now.toISOString(),
    situation: todaySchedule.situation,
    executed: executedActions
  };
}

export async function GET(request: NextRequest) {
  try {
    // Token auth restored for security
    const requiredToken = process.env.CRON_SECRET;
    if (requiredToken) {
      const provided = request.headers.get('x-cron-token');
      if (!provided || provided !== requiredToken) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    const result = await executeScheduleCheck();
    
    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ Cron scheduler error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    // Optional token auth: if CRON_SECRET is set, require matching token
    const requiredToken = process.env.CRON_SECRET;
    if (requiredToken) {
      const provided = request.headers.get('x-cron-token');
      if (!provided || provided !== requiredToken) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }
    const result = await executeScheduleCheck();
    
    return NextResponse.json({
      success: true,
      ...result,
      note: 'Manual trigger executed'
    });
    
  } catch (error) {
    console.error('❌ Manual scheduler trigger error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
