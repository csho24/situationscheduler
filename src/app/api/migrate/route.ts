import { NextRequest, NextResponse } from 'next/server';
import { saveStorage, type StorageData } from '@/lib/persistent-storage';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('🔄 MIGRATION: Received data from client:', {
      schedules: Object.keys(data.schedules || {}).length,
      deviceSchedules: Object.keys(data.deviceSchedules || {}).length
    });

    // Create storage data structure
    const storageData: StorageData = {
      scheduleStorage: data.schedules || {},
      deviceSchedules: data.deviceSchedules || {},
      manualOverrides: {},
      lastExecutedEvents: {}
    };

    // Save to persistent storage
    saveStorage(storageData);

    console.log('✅ MIGRATION: Successfully saved data to persistent storage');

    return NextResponse.json({
      success: true,
      message: 'Data migrated successfully',
      migrated: {
        schedules: Object.keys(storageData.scheduleStorage).length,
        deviceSchedules: Object.keys(storageData.deviceSchedules).length
      }
    });

  } catch (error) {
    console.error('❌ MIGRATION: Error migrating data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
