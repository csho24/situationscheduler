import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Get schedule data from Supabase database
export async function GET(request: NextRequest) {
  try {
    console.log('📂 SERVER: Fetching schedule data from Supabase');
    
    // Get calendar assignments
    const { data: calendarData, error: calendarError } = await supabase
      .from('calendar_assignments')
      .select('*');
    
    if (calendarError) throw calendarError;
    
    // Get device schedules
    const { data: deviceData, error: deviceError } = await supabase
      .from('device_schedules')
      .select('*');
    
    if (deviceError) throw deviceError;
    
    // Get manual overrides
    const { data: overrideData, error: overrideError } = await supabase
      .from('manual_overrides')
      .select('*');
    
    if (overrideError) throw overrideError;
    
    // Get interval mode state
    const { data: intervalData, error: intervalError } = await supabase
      .from('interval_mode')
      .select('*')
      .eq('device_id', 'a3cf493448182afaa9rlgw')
      .maybeSingle();
    
    if (intervalError) throw intervalError;
    
    // Transform data to match expected format
    const schedules: Record<string, { date: string; situation: string }> = {};
    calendarData?.forEach(assignment => {
      schedules[assignment.date] = {
        date: assignment.date,
        situation: assignment.situation
      };
    });
    
    const deviceSchedules: Record<string, Record<string, Array<{time: string; action: string}>>> = {};
    deviceData?.forEach(schedule => {
      if (!deviceSchedules[schedule.device_id]) {
        deviceSchedules[schedule.device_id] = { work: [], rest: [] };
      }
      deviceSchedules[schedule.device_id][schedule.situation].push({
        time: schedule.time,
        action: schedule.action
      });
    });
    
    const manualOverrides: Record<string, { deviceId: string; until: number; setAt: number }> = {};
    overrideData?.forEach(override => {
      manualOverrides[override.device_id] = {
        deviceId: override.device_id,
        until: new Date(override.until_timestamp).getTime(),
        setAt: new Date(override.set_at).getTime()
      };
    });
    
    console.log(`📂 SERVER: Loaded ${calendarData?.length || 0} calendar assignments, ${deviceData?.length || 0} device schedules, ${overrideData?.length || 0} overrides`);
    
    return NextResponse.json({
      success: true,
      schedules,
      deviceSchedules,
      manualOverrides,
      intervalMode: intervalData?.is_active || false,
      intervalConfig: intervalData ? {
        onDuration: intervalData.on_duration || 3,
        intervalDuration: intervalData.interval_duration || 20,
        startTime: intervalData.start_time
      } : null
    });
    
  } catch (error) {
    console.error('❌ Error fetching schedules from Supabase:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Update schedule data in Supabase database
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, ...payload } = data;
    
    if (type === 'calendar') {
      // Update calendar assignment
      if (payload.date && payload.situation) {
        const { error } = await supabase
          .from('calendar_assignments')
          .upsert({
            date: payload.date,
            situation: payload.situation,
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
        console.log(`📅 SERVER: Updated calendar ${payload.date} -> ${payload.situation}`);
      }
    } else if (type === 'devices') {
      // Update device schedules
      if (payload.deviceSchedules) {
        // Clear existing schedules for all devices
        const { error: deleteError } = await supabase
          .from('device_schedules')
          .delete()
          .neq('id', 0); // Delete all records
        
        if (deleteError) throw deleteError;
        
        // Insert new schedules
        const schedulesToInsert = [];
        for (const [deviceId, deviceSchedules] of Object.entries(payload.deviceSchedules)) {
          for (const [situation, schedules] of Object.entries(deviceSchedules as Record<string, Array<{time: string; action: string}>>)) {
            for (const schedule of schedules) {
              schedulesToInsert.push({
                device_id: deviceId,
                situation: situation,
                time: schedule.time,
                action: schedule.action
              });
            }
          }
        }
        
        if (schedulesToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('device_schedules')
            .insert(schedulesToInsert);
          
          if (insertError) throw insertError;
        }
        
        console.log(`📋 SERVER: Updated device schedules for all devices`);
      }
    } else if (type === 'manual-override') {
      // Set manual override
      const { deviceId, durationMinutes = 60 } = payload;
      if (deviceId) {
        const untilTimestamp = new Date(Date.now() + (durationMinutes * 60000)).toISOString();
        
        const { error } = await supabase
          .from('manual_overrides')
          .upsert({
            device_id: deviceId,
            until_timestamp: untilTimestamp,
            set_at: new Date().toISOString()
          });
        
        if (error) throw error;
        console.log(`🔧 SERVER: Manual override set for ${deviceId} for ${durationMinutes} minutes`);
      }
    } else if (type === 'clear-override') {
      // Clear manual override
      const { deviceId } = payload;
      if (deviceId) {
        const { error } = await supabase
          .from('manual_overrides')
          .delete()
          .eq('device_id', deviceId);
        
        if (error) throw error;
        console.log(`🔄 SERVER: Cleared manual override for ${deviceId}`);
      }
    } else if (type === 'interval_mode') {
      // Update interval mode state
      const { deviceId, isActive, onDuration, intervalDuration, startTime } = payload;
      console.log(`🔄 SERVER: Saving interval mode - deviceId: ${deviceId}, isActive: ${isActive}`);
      
      if (deviceId && typeof isActive === 'boolean') {
        const { data, error } = await supabase
          .from('interval_mode')
          .upsert({
            device_id: deviceId,
            is_active: isActive,
            on_duration: onDuration || 3,
            interval_duration: intervalDuration || 20,
            start_time: startTime ? new Date(startTime).toISOString() : null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'device_id'
          })
          .select();
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }
        console.log(`🔄 SERVER: Interval mode ${isActive ? 'enabled' : 'disabled'} for ${deviceId}`, data);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schedules updated successfully in Supabase'
    });
    
  } catch (error) {
    console.error('❌ Error updating schedules in Supabase:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Clear all manual overrides
export async function DELETE() {
  try {
    const { error } = await supabase
      .from('manual_overrides')
      .delete()
      .neq('id', 0); // Delete all records
    
    if (error) throw error;
    
    console.log(`🧹 SERVER: Cleared all manual overrides in Supabase`);
    
    return NextResponse.json({
      success: true,
      message: 'All manual overrides cleared'
    });
    
  } catch (error) {
    console.error('❌ Error clearing overrides:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}