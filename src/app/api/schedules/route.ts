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
    
    // Get user settings
    const { data: userSettingsData, error: userSettingsError } = await supabase
      .from('user_settings')
      .select('*');
    
    if (userSettingsError) throw userSettingsError;
    
    // Get custom routines (temporarily disabled until table is created)
    // const { data: customRoutinesData, error: customRoutinesError } = await supabase
    //   .from('custom_routines')
    //   .select('*');
    
    // if (customRoutinesError) throw customRoutinesError;
    const customRoutinesData: { routine_name: string }[] = [];
    
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
    
    // Transform user settings to key-value pairs
    const userSettings: Record<string, string> = {};
    userSettingsData?.forEach(setting => {
      userSettings[setting.setting_key] = setting.setting_value;
    });
    
    console.log(`📂 SERVER: Loaded ${calendarData?.length || 0} calendar assignments, ${deviceData?.length || 0} device schedules, ${overrideData?.length || 0} overrides, ${userSettingsData?.length || 0} user settings, ${customRoutinesData?.length || 0} custom routines`);
    
    return NextResponse.json({
      success: true,
      schedules,
      calendarAssignments: Object.values(schedules), // Add calendarAssignments array format
      deviceSchedules,
      manualOverrides,
      intervalMode: intervalData?.is_active || false,
      intervalConfig: intervalData ? {
        isActive: intervalData.is_active,
        onDuration: intervalData.on_duration || 10,  // Default to last known good values or 10
        intervalDuration: intervalData.interval_duration || 16,  // Default to 16
        startTime: intervalData.start_time
      } : null,
      userSettings, // Added to response
      customRoutines: customRoutinesData?.map(r => r.routine_name) || [] // Added to response
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
    console.log(`📝 SERVER: Received POST request`);
    
    let data;
    try {
      data = await request.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request JSON:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }
    
    const { type, ...payload } = data;
    
    console.log(`📝 SERVER: Parsed request - type: ${type}, payload:`, JSON.stringify(payload, null, 2));
    
    if (type === 'calendar') {
      // Update calendar assignment
      if (payload.date && payload.situation) {
        console.log(`📅 SERVER: Attempting to update calendar ${payload.date} -> ${payload.situation}`);
        
        // Test Supabase connection first
        console.log(`📅 SERVER: Testing Supabase connection...`);
        const { data: testData, error: testError } = await supabase
          .from('calendar_assignments')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('❌ Supabase connection test failed:', testError);
          throw new Error(`Supabase connection failed: ${testError.message}`);
        }
        
        console.log(`📅 SERVER: Supabase connection OK, proceeding with update...`);
        
        const { data, error } = await supabase
          .from('calendar_assignments')
          .upsert({
            date: payload.date,
            situation: payload.situation,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'date'
          })
          .select();
        
        if (error) {
          console.error('❌ Supabase calendar update error:', error);
          throw error;
        }
        
        console.log(`📅 SERVER: Successfully updated calendar ${payload.date} -> ${payload.situation}`, data);
      } else {
        console.error('❌ Missing required fields for calendar update:', { date: payload.date, situation: payload.situation });
        throw new Error('Missing required fields: date and situation');
      }
    } else if (type === 'devices') {
      // Update device schedules
      if (payload.deviceSchedules) {
        // First, delete all schedules for devices that are being updated
        const deviceIds = Object.keys(payload.deviceSchedules);
        if (deviceIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('device_schedules')
            .delete()
            .in('device_id', deviceIds);
          
          if (deleteError) throw deleteError;
          console.log(`🗑️ SERVER: Deleted existing schedules for devices: ${deviceIds.join(', ')}`);
        }
        
        // Then, insert the new schedules
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
          console.log(`📋 SERVER: Inserted ${schedulesToInsert.length} new schedules`);
        }
        
        console.log(`📋 SERVER: Updated device schedules for devices: ${deviceIds.join(', ')}`);
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
      console.log(`🔄 SERVER: Saving interval mode - deviceId: ${deviceId}, isActive: ${isActive}, onDuration: ${onDuration}, intervalDuration: ${intervalDuration}`);

      const { data, error } = await supabase
        .from('interval_mode')
        .upsert({
          device_id: deviceId,
          is_active: isActive,
          on_duration: onDuration,
          interval_duration: intervalDuration,
          start_time: startTime ? new Date(startTime).toISOString() : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'device_id'
        });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      console.log(`🔄 SERVER: Interval mode ${isActive ? 'enabled' : 'disabled'} for ${deviceId}`, data);
    } else if (type === 'user_settings') {
      // Update user settings
      const { settingKey, settingValue } = payload;
      console.log(`⚙️ SERVER: Updating user setting - ${settingKey}: ${settingValue}`);
      
      if (settingKey && settingValue) {
        const { data, error } = await supabase
          .from('user_settings')
          .upsert({
            setting_key: settingKey,
            setting_value: settingValue,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'setting_key'
          })
          .select();
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }
        console.log(`⚙️ SERVER: User setting updated - ${settingKey}: ${settingValue}`, data);
      }
    } else if (type === 'custom_routine') {
      // Create custom routine
      const { routineName } = payload;
      console.log(`🆕 SERVER: Creating custom routine - ${routineName}`);
      
      if (routineName) {
        const { data, error } = await supabase
          .from('custom_routines')
          .insert({
            routine_name: routineName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }
        console.log(`🆕 SERVER: Custom routine created - ${routineName}`, data);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schedules updated successfully in Supabase'
    });
    
  } catch (error) {
    console.error('❌ Error updating schedules in Supabase:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined
    });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error)
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