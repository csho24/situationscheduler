import { NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { DEVICES } from '@/lib/persistent-storage';

// Simple endpoint for external cron services that can't send headers
export async function GET() {
  try {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];
    
    console.log(`🔍 CRON SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
    
    // Get data from cache
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/schedules`);
    const data = await response.json();
    
    if (!data.success) {
      console.log('📋 No schedule data available');
      return NextResponse.json({
        success: true,
        message: 'No schedule data available',
        result: { date: today, situation: null, executed: [] }
      });
    }
    
    // Get today's schedule assignment from cache
    const todaySchedule = data.schedules?.[today];
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
    const deviceSchedules = data.deviceSchedules || {};
    const executedActions = [];
    
    for (const [deviceId, schedules] of Object.entries(deviceSchedules)) {
      const device = DEVICES.find(d => d.id === deviceId);
      if (!device) continue;
      
      const deviceSchedule = (schedules as Record<string, Array<{time: string; action: string}>>)[todaySchedule.situation];
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
          // const eventKey = `${deviceId}-${schedule.time}-${schedule.action}-${today}`;
          
          // Note: We can't track executed events without persistent storage
          // This is a limitation of the in-memory cache approach
          const shouldExecute = true; // Always execute for now
          if (shouldExecute) {
            console.log(`⚡ ${device.name}: Executing ${schedule.time} ${schedule.action}`);
            
            try {
              // Use the same Tuya API calls as the main scheduler
              if (schedule.action === 'on') {
                await tuyaAPI.turnOn(deviceId);
              } else {
                await tuyaAPI.turnOff(deviceId);
              }
              
              // Note: We can't update executed events without persistent storage
              // This is a limitation of the localStorage-only approach
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
