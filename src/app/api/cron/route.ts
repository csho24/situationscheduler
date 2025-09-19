import { NextResponse } from 'next/server';
import { tuyaAPI } from '@/lib/tuya-api';
import { supabase } from '@/lib/supabase';
import { DEVICES } from '@/lib/persistent-storage';

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
    
    // Get today's calendar assignment from Supabase
    const { data: calendarData, error: calendarError } = await supabase
      .from('calendar_assignments')
      .select('*')
      .eq('date', today)
      .single();
    
    let situation = 'rest'; // Default fallback
    
    if (calendarError) {
      console.error('❌ Supabase calendar error:', calendarError);
      console.log('🔄 Using fallback: assuming rest day');
      situation = 'rest';
    } else if (!calendarData) {
      console.log('📋 No schedule for today, using fallback: rest day');
      situation = 'rest';
    } else {
      situation = calendarData.situation;
    }
    
    console.log(`📋 Today's schedule: ${situation} day`);
    
    // Get device schedules for today's situation from Supabase
    const { data: deviceSchedules, error: deviceError } = await supabase
      .from('device_schedules')
      .select('*')
      .eq('situation', situation);
    
    let schedulesByDevice: Record<string, Array<{time: string; action: string}>> = {};
    
    if (deviceError) {
      console.error('❌ Supabase device schedules error:', deviceError);
      console.log('🔄 Using fallback schedules');
      // Use fallback schedules
      schedulesByDevice = FALLBACK_SCHEDULES;
    } else {
      // Group schedules by device from Supabase
      deviceSchedules?.forEach(schedule => {
        if (!schedulesByDevice[schedule.device_id]) {
          schedulesByDevice[schedule.device_id] = [];
        }
        schedulesByDevice[schedule.device_id].push({
          time: schedule.time,
          action: schedule.action
        });
      });
    }
    
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
