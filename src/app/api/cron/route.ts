import { NextRequest, NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { loadStorage, updateLastExecutedEvent, DEVICES } from '@/lib/persistent-storage';

// Simple endpoint for external cron services that can't send headers
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];
    
    console.log(`🔍 CRON SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
    
    // Load fresh data from persistent storage
    const storage = loadStorage();
    
    // Get today's schedule assignment
    const todaySchedule = storage.scheduleStorage[today];
    if (!todaySchedule) {
      console.log('📋 No schedule for today');
      return NextResponse.json({
        success: true,
        message: 'No schedule for today',
        result: { date: today, situation: null, executed: [] }
      });
    }
    
    console.log(`📋 Today's schedule: ${todaySchedule.situation} day`);
    
    // Get device schedules for today's situation
    const deviceSchedules = storage.deviceSchedules;
    const executedActions = [];
    
    for (const [deviceId, schedules] of Object.entries(deviceSchedules)) {
      const device = DEVICES.find(d => d.id === deviceId);
      if (!device) continue;
      
      const deviceSchedule = schedules[todaySchedule.situation];
      if (!deviceSchedule || deviceSchedule.length === 0) {
        console.log(`📋 ${device.name}: No ${todaySchedule.situation} schedule`);
        continue;
      }
      
      console.log(`📋 ${device.name} ${todaySchedule.situation} schedule:`, deviceSchedule);
      
      for (const schedule of deviceSchedule) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const scheduleTime = hours * 60 + minutes;
        
        console.log(`⏰ ${device.name}: Checking ${schedule.time} (${scheduleTime} min) ${schedule.action} - ${scheduleTime <= currentTime ? 'PAST' : 'FUTURE'}`);
        
        if (scheduleTime <= currentTime) {
          // This schedule should have executed
          const eventKey = `${deviceId}-${schedule.time}-${schedule.action}-${today}`;
          
          if (!storage.lastExecutedEvents[eventKey]) {
            console.log(`⚡ ${device.name}: Executing ${schedule.time} ${schedule.action}`);
            
            try {
              // Use the same Tuya API calls as the main scheduler
              if (schedule.action === 'on') {
                await tuyaAPI.turnOn(deviceId);
              } else {
                await tuyaAPI.turnOff(deviceId);
              }
              
              updateLastExecutedEvent(eventKey, Date.now());
              executedActions.push({
                deviceId,
                deviceName: device.name,
                time: schedule.time,
                action: schedule.action
              });
              
              console.log(`✅ ${device.name}: ${schedule.action} executed successfully`);
            } catch (error) {
              console.error(`❌ ${device.name}: Failed to ${schedule.action}:`, error);
            }
          } else {
            console.log(`⏭️ ${device.name}: ${schedule.time} ${schedule.action} already executed`);
          }
        }
      }
    }
    
    console.log(`📋 Schedule check complete. Executed ${executedActions.length} actions.`);
    
    return NextResponse.json({
      success: true,
      message: 'Cron executed successfully',
      result: {
        date: today,
        situation: todaySchedule.situation,
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
