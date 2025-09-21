// Server-side scheduler client for frontend components
// This replaces the client-side scheduler with server communication

// import { tuyaAPI } from './tuya-api';

export type SituationType = 'work' | 'rest';

export interface ScheduleEntry {
  time: string; // HH:MM format
  action: 'on' | 'off';
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD format
  situation: SituationType;
}

// No default schedules - use Supabase as single source of truth

export class ServerScheduler {
  private schedules: Map<string, DaySchedule> = new Map();
  private customSchedules: Record<string, Record<SituationType, ScheduleEntry[]>> = {};
  private lastSyncTime: number = 0;

  constructor() {
    console.log(`🏗️ Creating ServerScheduler - using Supabase only`);
    // Only load from server on client side to avoid SSR issues
    if (typeof window !== 'undefined') {
      this.loadFromServer();
    }
  }

  // No localStorage - use Supabase only

  private initializeDefaultSchedules(): void {
    // No default schedules - load from Supabase only
    console.log('📱 No default schedules - using Supabase data only');
  }

  // Load data from server
  private async loadFromServer(): Promise<void> {
    try {
      // Use absolute URL for client-side requests
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/schedules`);
      const data = await response.json();
      
      if (data.success) {
        // Load calendar schedules from server
        if (data.schedules) {
          this.schedules = new Map(Object.entries(data.schedules));
          console.log(`📅 Loaded ${this.schedules.size} calendar schedules from server`);
        }
        
        // Load device schedules from server
        if (data.deviceSchedules) {
          this.customSchedules = data.deviceSchedules;
          console.log(`📋 Loaded device schedules for ${Object.keys(this.customSchedules).length} devices from server`);
        }
        
        // No localStorage caching - use Supabase only
      }
    } catch (error) {
      console.error('❌ Failed to load from server:', error);
      // Just use local data, don't overwrite server
      console.log('📱 Using local data as fallback');
    }
  }

  // Sync device schedules to server
  async syncToServer(): Promise<void> {
    // DISABLED - no sync to prevent data overwrites in deployed version
    console.log(`🚫 syncToServer() disabled - deployed version is READ-ONLY`);
  }

  // No localStorage - use Supabase only
  private saveToLocalStorage(): void {
    // This method is now empty as localStorage is no longer used
  }

  // No sync - read-only from Supabase  
  forceSync(): void {
    // This method is now empty - no sync to prevent data overwrites
  }

  // Set calendar assignment and sync to server
  async setSituation(date: string, situation: SituationType): Promise<void> {
    this.schedules.set(date, { date, situation });
    
    // No localStorage - use Supabase only

    // Sync to server
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      await fetch(`${baseUrl}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'calendar',
          date,
          situation
        })
      });
      console.log(`📅 Synced calendar update to server: ${date} -> ${situation}`);
    } catch (error) {
      console.error('❌ Failed to sync calendar to server:', error);
    }
  }

  getSituation(date: string): DaySchedule | undefined {
    return this.schedules.get(date);
  }

  getAllSchedules(): DaySchedule[] {
    return [...this.schedules.values()];
  }

  // Update device schedules and sync to server
  async updateCustomSchedules(allDeviceSchedules: Record<string, Record<SituationType, ScheduleEntry[]>>): Promise<void> {
    this.customSchedules = allDeviceSchedules;
    
    // DISABLED - no localStorage or server sync in deployed version
    console.log(`🚫 updateCustomSchedules() disabled - deployed version is READ-ONLY`);
    console.log(`📋 Would have updated ${Object.keys(allDeviceSchedules).length} devices, but sync disabled`);
  }

  getCustomSchedules(): Record<string, Record<SituationType, ScheduleEntry[]>> {
    return this.customSchedules;
  }

  // Manual device control with server-side override tracking
  async setManualOverride(deviceId: string, durationMinutes: number = 60): Promise<void> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      await fetch(`${baseUrl}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manual-override',
          deviceId,
          durationMinutes
        })
      });
      console.log(`🔧 Set manual override for ${deviceId} for ${durationMinutes} minutes`);
    } catch (error) {
      console.error('❌ Failed to set manual override:', error);
    }
  }

  async clearManualOverride(deviceId: string): Promise<void> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      await fetch(`${baseUrl}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clear-override',
          deviceId
        })
      });
      console.log(`🔄 Cleared manual override for ${deviceId}`);
    } catch (error) {
      console.error('❌ Failed to clear manual override:', error);
    }
  }

  // Manual trigger of schedule check (for testing)
  async executeScheduleCheck(): Promise<unknown> {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/scheduler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      console.log(`⚡ Manual schedule check executed:`, result);
      return result;
    } catch (error) {
      console.error('❌ Failed to execute schedule check:', error);
      throw error;
    }
  }

  // Get status information (same logic as before but using server data)
  getTodayScheduleInfo(): { situation: SituationType | null; nextAction: string | null } {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = this.getSituation(today);
    
    if (!todaySchedule) {
      return { situation: null, nextAction: null };
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Collect all upcoming events from all devices (TODAY + TOMORROW)
    const upcomingEvents: Array<{
      deviceName: string;
      time: string;
      action: 'on' | 'off';
      timeInMinutes: number;
      dayOffset: number; // 0 = today, 1 = tomorrow
    }> = [];
    
    // Get device names for lookup
    const DEVICES = [
      { id: 'a3e31a88528a6efc15yf4o', name: 'Lights' },
      { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop' },
      { id: 'a3240659645e83dcfdtng7', name: 'USB Hub' }
    ];
    
    // Check TODAY's remaining events
    for (const device of DEVICES) {
      const deviceSchedules = this.customSchedules[device.id];
      if (!deviceSchedules || !deviceSchedules[todaySchedule.situation]) continue;
      
      const schedule = deviceSchedules[todaySchedule.situation];
      
      // Safety check: ensure schedule is iterable
      if (!schedule || !Array.isArray(schedule)) {
        console.warn(`Schedule for ${device.name} ${todaySchedule.situation} is not an array:`, schedule);
        continue;
      }
      
      for (const entry of schedule) {
        const [hours, minutes] = entry.time.split(':').map(Number);
        const entryTime = hours * 60 + minutes;
        
        if (entryTime > currentTime) {
          upcomingEvents.push({
            deviceName: device.name,
            time: entry.time,
            action: entry.action,
            timeInMinutes: entryTime,
            dayOffset: 0
          });
        }
      }
    }
    
    // If no events today, check TOMORROW's first events
    if (upcomingEvents.length === 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
      const tomorrowSchedule = this.getSituation(tomorrowDateStr);
      
      if (tomorrowSchedule) {
        for (const device of DEVICES) {
          const deviceSchedules = this.customSchedules[device.id];
          if (!deviceSchedules || !deviceSchedules[tomorrowSchedule.situation]) continue;
          
          const schedule = deviceSchedules[tomorrowSchedule.situation];
          if (!schedule || !Array.isArray(schedule)) continue;
          
          for (const entry of schedule) {
            const [hours, minutes] = entry.time.split(':').map(Number);
            const entryTime = hours * 60 + minutes;
            
            upcomingEvents.push({
              deviceName: device.name,
              time: entry.time,
              action: entry.action,
              timeInMinutes: entryTime,
              dayOffset: 1
            });
          }
        }
      }
    }
    
    if (upcomingEvents.length === 0) {
      return { situation: todaySchedule.situation, nextAction: null };
    }
    
    // Sort by day then time
    upcomingEvents.sort((a, b) => {
      if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
      return a.timeInMinutes - b.timeInMinutes;
    });
    const earliestTime = upcomingEvents[0].timeInMinutes;
    const eventsAtEarliestTime = upcomingEvents.filter(event => event.timeInMinutes === earliestTime);
    
    // Format the next action (include day if tomorrow)
    const dayPrefix = upcomingEvents[0].dayOffset === 1 ? ' (Tomorrow)' : '';
    let nextAction = '';
    if (eventsAtEarliestTime.length === 1) {
      const event = eventsAtEarliestTime[0];
      nextAction = `${event.deviceName} ${event.action.toUpperCase()} at ${event.time}${dayPrefix}`;
    } else {
      // Group by action
      const onDevices = eventsAtEarliestTime.filter(e => e.action === 'on').map(e => e.deviceName);
      const offDevices = eventsAtEarliestTime.filter(e => e.action === 'off').map(e => e.deviceName);
      
      const actionParts = [];
      if (onDevices.length > 0) {
        actionParts.push(`${onDevices.join(' + ')} ON`);
      }
      if (offDevices.length > 0) {
        actionParts.push(`${offDevices.join(' + ')} OFF`);
      }
      
      nextAction = `${actionParts.join(', ')} at ${eventsAtEarliestTime[0].time}${dayPrefix}`;
    }
    
    return { situation: todaySchedule.situation, nextAction };
  }

  // No more client-side interval - server handles all scheduling
  destroy(): void {
    console.log(`🧹 ServerScheduler destroyed (no intervals to clear)`);
  }
}

export const serverScheduler = new ServerScheduler();
