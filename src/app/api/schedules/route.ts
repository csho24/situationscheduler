import { NextRequest, NextResponse } from 'next/server';
import { loadStorage, saveStorage, updateScheduleStorage, updateDeviceSchedules, setManualOverride, clearManualOverride, type ScheduleEntry, type SituationType, type DaySchedule, type ManualOverride } from '@/lib/persistent-storage';

// Get all schedule data
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  
  try {
    const storage = loadStorage();
    
    if (type === 'calendar') {
      return NextResponse.json({
        success: true,
        schedules: storage.scheduleStorage
      });
    } else if (type === 'devices') {
      return NextResponse.json({
        success: true,
        deviceSchedules: storage.deviceSchedules
      });
    } else if (type === 'overrides') {
      return NextResponse.json({
        success: true,
        manualOverrides: storage.manualOverrides
      });
    } else {
      // Return all data
      return NextResponse.json({
        success: true,
        schedules: storage.scheduleStorage,
        deviceSchedules: storage.deviceSchedules,
        manualOverrides: storage.manualOverrides
      });
    }
  } catch (error) {
    console.error('❌ Error getting schedules:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Update schedule data
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, ...payload } = data;
    
    if (type === 'calendar') {
      // Update calendar assignments
      if (payload.date && payload.situation) {
        updateScheduleStorage({ [payload.date]: { date: payload.date, situation: payload.situation } });
        console.log(`📅 SERVER: Updated calendar ${payload.date} -> ${payload.situation}`);
      } else if (payload.schedules) {
        // Bulk update
        updateScheduleStorage(payload.schedules);
        console.log(`📅 SERVER: Bulk updated calendar schedules`);
      }
    } else if (type === 'devices') {
      // Update device schedules
      if (payload.deviceSchedules) {
        updateDeviceSchedules(payload.deviceSchedules);
        console.log(`📋 SERVER: Updated device schedules for all devices`);
      }
    } else if (type === 'manual-override') {
      // Set manual override
      const { deviceId, durationMinutes = 60 } = payload;
      if (deviceId) {
        setManualOverride(deviceId, durationMinutes);
        console.log(`🔧 SERVER: Manual override set for ${deviceId} for ${durationMinutes} minutes`);
      }
    } else if (type === 'clear-override') {
      // Clear manual override
      const { deviceId } = payload;
      if (deviceId) {
        clearManualOverride(deviceId);
        console.log(`🔄 SERVER: Cleared manual override for ${deviceId}`);
      }
    } else if (type === 'sync-from-client') {
      // Sync all data from client to server
      const storage = loadStorage();
      if (payload.schedules) storage.scheduleStorage = payload.schedules;
      if (payload.deviceSchedules) storage.deviceSchedules = payload.deviceSchedules;
      saveStorage(storage);
      console.log(`🔄 SERVER: Synced all data from client`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schedules updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Error updating schedules:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Clear all manual overrides (utility endpoint)
export async function DELETE(request: NextRequest) {
  try {
    const storage = loadStorage();
    storage.manualOverrides = {};
    saveStorage(storage);
    console.log(`🧹 SERVER: Cleared all manual overrides`);
    
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
