import { NextRequest, NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { loadStorage, updateLastExecutedEvent, clearManualOverride, DEVICES } from '@/lib/persistent-storage';

async function executeScheduleCheck() {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const today = now.toISOString().split('T')[0];
  
  console.log(`🔍 SERVER SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
  console.log(`🔍 DEBUG: Looking for date: ${today}`);
  
  // Load fresh data from persistent storage
  const storage = loadStorage();
  
  console.log(`🔍 DEBUG: Available schedules:`, Object.keys(storage.scheduleStorage));
  console.log(`🔍 DEBUG: Full schedule storage:`, storage.scheduleStorage);
  
  // Get today's schedule assignment
  const todaySchedule = storage.scheduleStorage[today];
  if (!todaySchedule) {
    console.log(`📅 No schedule assigned for today (${today})`);
    console.log(`📅 Available dates: ${Object.keys(storage.scheduleStorage).join(', ')}`);
    return { message: `No schedule for today (${today})`, executed: [], availableDates: Object.keys(storage.scheduleStorage) };
  }
  
  console.log(`📋 Today's schedule: ${todaySchedule.situation} day`);
  
  const executedActions: string[] = [];
  
  // Check each device's schedule
  for (const device of DEVICES) {
    const deviceSchedule = storage.deviceSchedules[device.id];
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
        // Check if we've already executed this exact event today
        const eventKey = `${device.id}-${entry.time}-${entry.action}-${today}`;
        const lastExecuted = storage.lastExecutedEvents[eventKey];
        
        if (!lastExecuted || (Date.now() - lastExecuted) > 60000) {
          currentAction = entry.action;
          actionTime = entry.time;
          updateLastExecutedEvent(eventKey, Date.now());
          console.log(`⚡ ${device.name} EXECUTING NOW: ${entry.action} at ${entry.time} (fresh event)`);
          break;
        } else {
          console.log(`⏭️ ${device.name} event ${entry.time} ${entry.action} already executed today`);
        }
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
        
        // Clear any manual override after successful scheduled action
        if (storage.manualOverrides[device.id]) {
          clearManualOverride(device.id);
          console.log(`🔄 Cleared manual override for ${device.name} after scheduled action`);
        }
        
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
