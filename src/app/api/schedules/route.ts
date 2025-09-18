import { NextRequest, NextResponse } from 'next/server';
import { type ScheduleEntry, type SituationType, type DaySchedule, type ManualOverride } from '@/lib/persistent-storage';

// Simple in-memory cache for serverless functions
let scheduleCache: {
  schedules: Record<string, DaySchedule>;
  deviceSchedules: Record<string, Record<SituationType, ScheduleEntry[]>>;
  manualOverrides: Record<string, any>;
} = {
  schedules: {},
  deviceSchedules: {},
  manualOverrides: {}
};

// Get all schedule data from cache
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  
  try {
    if (type === 'calendar') {
      return NextResponse.json({
        success: true,
        schedules: scheduleCache.schedules
      });
    } else if (type === 'devices') {
      return NextResponse.json({
        success: true,
        deviceSchedules: scheduleCache.deviceSchedules
      });
    } else if (type === 'overrides') {
      return NextResponse.json({
        success: true,
        manualOverrides: scheduleCache.manualOverrides
      });
    } else {
      // Return all data
      return NextResponse.json({
        success: true,
        schedules: scheduleCache.schedules,
        deviceSchedules: scheduleCache.deviceSchedules,
        manualOverrides: scheduleCache.manualOverrides
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

// Update schedule data - now updates cache
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, ...payload } = data;
    
    if (type === 'calendar') {
      // Update calendar assignments
      if (payload.date && payload.situation) {
        scheduleCache.schedules[payload.date] = { date: payload.date, situation: payload.situation };
        console.log(`📅 SERVER: Updated calendar ${payload.date} -> ${payload.situation}`);
      } else if (payload.schedules) {
        // Bulk update
        scheduleCache.schedules = { ...scheduleCache.schedules, ...payload.schedules };
        console.log(`📅 SERVER: Bulk updated calendar schedules`);
      }
    } else if (type === 'devices') {
      // Update device schedules
      if (payload.deviceSchedules) {
        scheduleCache.deviceSchedules = { ...scheduleCache.deviceSchedules, ...payload.deviceSchedules };
        console.log(`📋 SERVER: Updated device schedules for all devices`);
      }
    } else if (type === 'manual-override') {
      // Set manual override
      const { deviceId, durationMinutes = 60 } = payload;
      if (deviceId) {
        scheduleCache.manualOverrides[deviceId] = {
          deviceId,
          until: Date.now() + (durationMinutes * 60000),
          setAt: Date.now()
        };
        console.log(`🔧 SERVER: Manual override set for ${deviceId} for ${durationMinutes} minutes`);
      }
    } else if (type === 'clear-override') {
      // Clear manual override
      const { deviceId } = payload;
      if (deviceId) {
        delete scheduleCache.manualOverrides[deviceId];
        console.log(`🔄 SERVER: Cleared manual override for ${deviceId}`);
      }
    } else if (type === 'sync-from-client') {
      // Sync all data from client to server
      if (payload.schedules) scheduleCache.schedules = payload.schedules;
      if (payload.deviceSchedules) scheduleCache.deviceSchedules = payload.deviceSchedules;
      if (payload.manualOverrides) scheduleCache.manualOverrides = payload.manualOverrides;
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
    scheduleCache.manualOverrides = {};
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
