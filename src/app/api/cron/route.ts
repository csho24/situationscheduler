import { NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { supabase } from '@/lib/supabase';
import { DEVICES } from '@/lib/persistent-storage';

// Simple endpoint for external cron services that can't send headers
export async function GET() {
  try {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];
    
    console.log(`🔍 CRON SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
    
    // Get today's calendar assignment from Supabase
    const { data: calendarData, error: calendarError } = await supabase
      .from('calendar_assignments')
      .select('*')
      .eq('date', today)
      .single();
    
    if (calendarError || !calendarData) {
      console.log('📋 No schedule for today');
      return NextResponse.json({
        success: true,
        message: 'No schedule for today',
        result: { date: today, situation: null, executed: [] }
      });
    }
    
    console.log(`📋 Today's schedule: ${calendarData.situation} day`);
    
    // Get device schedules for today's situation from Supabase
    const { data: deviceSchedules, error: deviceError } = await supabase
      .from('device_schedules')
      .select('*')
      .eq('situation', calendarData.situation);
    
    if (deviceError) throw deviceError;
    
    // Group schedules by device
    const schedulesByDevice: Record<string, Array<{time: string; action: string}>> = {};
    deviceSchedules?.forEach(schedule => {
      if (!schedulesByDevice[schedule.device_id]) {
        schedulesByDevice[schedule.device_id] = [];
      }
      schedulesByDevice[schedule.device_id].push({
        time: schedule.time,
        action: schedule.action
      });
    });
    
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
            // Execute the device control
            if (schedule.action === 'on') {
              const result = await tuyaAPI.turnOn(deviceId);
              console.log(`🔌 ${device.name}: Turn ON result:`, result);
            } else {
              const result = await tuyaAPI.turnOff(deviceId);
              console.log(`🔌 ${device.name}: Turn OFF result:`, result);
            }
            
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
        situation: calendarData.situation,
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
