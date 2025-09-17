import { tuyaAPI } from './tuya-api';

export type SituationType = 'work' | 'rest';

export interface ScheduleEntry {
  time: string; // HH:MM format
  action: 'on' | 'off';
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD format
  situation: SituationType;
  deviceId: string;
}

// Default schedules for new users (fully editable)
export const DEFAULT_SCHEDULES: Record<SituationType, ScheduleEntry[]> = {
  work: [
    { time: '21:00', action: 'on' },  // 9 PM
    { time: '22:00', action: 'off' }  // 10 PM
  ],
  rest: [
    { time: '10:00', action: 'on' },  // 10 AM
    { time: '11:00', action: 'off' }, // 11 AM
    { time: '14:00', action: 'on' },  // 2 PM
    { time: '15:00', action: 'off' }, // 3 PM
    { time: '17:00', action: 'on' },  // 5 PM
    { time: '18:00', action: 'off' }, // 6 PM
    { time: '21:00', action: 'on' },  // 9 PM
    { time: '22:00', action: 'off' }  // 10 PM
  ]
};

// Singleton scheduler instance

export class PlugScheduler {
  private schedules: Map<string, DaySchedule> = new Map();
  private customSchedules: Record<SituationType, ScheduleEntry[]> = DEFAULT_SCHEDULES;
  private lastScheduleCheck: number = 0;
  private manualOverrideUntil: number = 0; // Timestamp until which manual control is active
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log(`🏗️ Creating new PlugScheduler instance with state-based scheduling`);
    this.loadSchedules();
    this.loadCustomSchedules();
    this.startScheduleChecker();
  }

  private loadSchedules(): void {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('plug-schedules');
      if (saved) {
        const data = JSON.parse(saved);
        this.schedules = new Map(data);
      }
    }
  }

  private saveSchedules(): void {
    if (typeof window !== 'undefined') {
      const data = Array.from(this.schedules.entries());
      localStorage.setItem('plug-schedules', JSON.stringify(data));
    }
  }

  private loadCustomSchedules(): void {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom-schedules');
      if (saved) {
        try {
          this.customSchedules = JSON.parse(saved);
        } catch {
          this.customSchedules = DEFAULT_SCHEDULES;
        }
      }
    }
  }

  updateCustomSchedules(schedules: Record<SituationType, ScheduleEntry[]>): void {
    this.customSchedules = schedules;
    localStorage.setItem('custom-schedules', JSON.stringify(schedules));
    console.log(`📋 Updated custom schedules:`, schedules);
  }

  // Clean up when scheduler is destroyed
  destroy(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log(`🧹 Scheduler interval cleared`);
    }
  }

  setSituation(date: string, situation: SituationType, deviceId: string): void {
    this.schedules.set(date, { date, situation, deviceId });
    this.saveSchedules();
  }

  getSituation(date: string): DaySchedule | undefined {
    return this.schedules.get(date);
  }

  getAllSchedules(): DaySchedule[] {
    return Array.from(this.schedules.values());
  }

  private async checkAndExecuteSchedule(): Promise<void> {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];
    const todaySchedule = this.getSituation(today);
    
    console.log(`🔍 SCHEDULE CHECK at ${now.toLocaleTimeString()} (${currentTime} minutes)`);
    
    // Skip if no schedule for today
    if (!todaySchedule) {
      console.log(`📅 No schedule set for today (${today})`);
      return;
    }
    
    console.log(`📋 Today's schedule: ${todaySchedule.situation} day`);
    
    // Skip if in manual override period (temporarily disabled for testing)
    if (Date.now() < this.manualOverrideUntil) {
      const remainingMinutes = Math.round((this.manualOverrideUntil - Date.now()) / 60000);
      console.log(`🔧 Manual override active for ${remainingMinutes} more minutes - BUT CONTINUING FOR TESTING`);
      // return; // DISABLED for testing
    }
    
    const schedule = this.customSchedules[todaySchedule.situation];
    const deviceId = todaySchedule.deviceId;
    
    console.log(`📋 ${todaySchedule.situation} schedule:`, schedule);
    
    // Find what action should be active right now
    let currentAction: 'on' | 'off' | null = null;
    let lastActionTime = -1;
    
    for (const entry of schedule) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const entryTime = hours * 60 + minutes;
      
      console.log(`⏰ Checking ${entry.time} (${entryTime} min) ${entry.action} - ${entryTime <= currentTime ? 'PAST' : 'FUTURE'}`);
      
      // Only consider past entries (that should have already executed)
      if (entryTime <= currentTime && entryTime > lastActionTime) {
        currentAction = entry.action;
        lastActionTime = entryTime;
        console.log(`✅ Most recent action: ${entry.action} at ${entry.time}`);
      }
    }
    
    if (currentAction) {
      // Get current device state to avoid unnecessary commands
      try {
        const deviceStatus = await tuyaAPI.getDeviceStatus(deviceId);
        const currentState = deviceStatus.result?.status?.find(s => s.code === 'switch_1')?.value;
        const targetState = currentAction === 'on';
        
        if (currentState === targetState) {
          console.log(`✅ Device already in correct state (${currentState ? 'ON' : 'OFF'}) - no action needed`);
          return;
        }
        
        console.log(`⚡ Device state mismatch: current=${currentState ? 'ON' : 'OFF'}, target=${targetState ? 'ON' : 'OFF'}`);
        console.log(`⚡ Schedule says: ${currentAction.toUpperCase()} (from ${Math.floor(lastActionTime/60)}:${(lastActionTime%60).toString().padStart(2,'0')})`);
        
        if (currentAction === 'on') {
          await tuyaAPI.turnOn(deviceId);
          console.log(`✅ Turned ON device ${deviceId} via schedule`);
        } else {
          await tuyaAPI.turnOff(deviceId);
          console.log(`✅ Turned OFF device ${deviceId} via schedule`);
        }
      } catch (error) {
        console.error(`❌ Failed to execute scheduled ${currentAction}:`, error);
      }
    } else {
      console.log(`📋 No scheduled action needed at ${now.toLocaleTimeString()}`);
    }
  }

  private async syncDeviceToCurrentSchedule(deviceId: string, situation: SituationType): Promise<void> {
    // Prevent multiple syncs within 5 seconds
    const currentTime = Date.now();
    if (currentTime - this.lastSyncTime < 5000) {
      console.log(`⏭️ Skipping sync - last sync was ${Math.round((currentTime - this.lastSyncTime) / 1000)}s ago`);
      return;
    }
    this.lastSyncTime = currentTime;
    
    console.log(`🔥 SYNC RUNNING - Instance: ${this.instanceId}`);
    
    const schedule = this.customSchedules[situation];
    const now = new Date();
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    console.log(`🔍 DEBUG: Syncing device ${deviceId} for ${situation} situation`);
    console.log(`🔍 DEBUG: Current time: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} (${currentTimeMinutes} minutes)`);
    console.log(`🔍 DEBUG: Schedule entries:`, schedule.map(e => `${e.time} ${e.action}`));
    
    // Find the most recent schedule entry that should have executed today
    let mostRecentEntry = null;
    let mostRecentTime = -1;
    
    for (const entry of schedule) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const entryTime = hours * 60 + minutes;
      
      console.log(`🔍 DEBUG: Checking ${entry.time} (${entryTime} minutes) - ${entryTime <= currentTimeMinutes ? 'PAST' : 'FUTURE'}`);
      
      // Only consider entries that have already passed today
      if (entryTime <= currentTimeMinutes && entryTime > mostRecentTime) {
        mostRecentEntry = entry;
        mostRecentTime = entryTime;
        console.log(`🔍 DEBUG: New most recent entry: ${entry.time} ${entry.action}`);
      }
    }
    
    if (mostRecentEntry) {
      try {
        console.log(`🔄 Syncing device to current schedule state: ${mostRecentEntry.action} (from ${mostRecentEntry.time})`);
        
        if (mostRecentEntry.action === 'on') {
          await tuyaAPI.turnOn(deviceId);
          console.log(`✅ Synced device ${deviceId} to ON state`);
        } else {
          await tuyaAPI.turnOff(deviceId);
          console.log(`✅ Synced device ${deviceId} to OFF state`);
        }
      } catch (error) {
        console.error(`❌ Failed to sync device ${deviceId} to current schedule:`, error);
      }
    } else {
      console.log(`ℹ️ No past schedule entries found for today - device state unchanged`);
    }
  }

  async executeToday(): Promise<void> {
    console.log(`⚡ Force executing today's schedule`);
    this.clearManualOverride(); // Clear any manual override
    await this.checkAndExecuteSchedule(); // Force immediate check
  }

  private startScheduleChecker(): void {
    if (typeof window === 'undefined') return;
    
    console.log(`🔄 Starting SIMPLE schedule checker (checks every 60 seconds)`);
    
    // Check immediately on start (no manual override complexity)
    setTimeout(() => {
      console.log(`⚡ First schedule check starting...`);
      this.checkAndExecuteSchedule();
    }, 2000);
    
    // Then check every 60 seconds
    this.schedulerInterval = setInterval(() => {
      this.checkAndExecuteSchedule();
    }, 60000);
  }
  
  // Call this when user manually controls the device
  setManualOverride(durationMinutes: number = 60): void {
    this.manualOverrideUntil = Date.now() + (durationMinutes * 60000);
    console.log(`🔧 Manual override set for ${durationMinutes} minutes`);
  }
  
  // Clear manual override to resume scheduling
  clearManualOverride(): void {
    this.manualOverrideUntil = 0;
    console.log(`🔄 Manual override cleared - resuming automatic scheduling`);
  }

  getTodayScheduleInfo(): { situation: SituationType | null; nextAction: string | null } {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = this.getSituation(today);
    
    if (!todaySchedule) {
      return { situation: null, nextAction: null };
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const schedule = this.customSchedules[todaySchedule.situation];
    let nextAction = null;
    
    for (const entry of schedule) {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const entryTime = hours * 60 + minutes;
      
      if (entryTime > currentTime) {
        nextAction = `${entry.action.toUpperCase()} at ${entry.time}`;
        break;
      }
    }
    
    return { situation: todaySchedule.situation, nextAction };
  }

  async getCloudTimers(deviceId: string, situation: SituationType): Promise<any[]> {
    try {
      const response = await tuyaAPI.queryTimers(deviceId, situation);
      if (response.success && response.result && response.result.groups) {
        // Flatten all timers from all groups
        const allTimers = [];
        for (const group of response.result.groups) {
          if (group.timers) {
            allTimers.push(...group.timers);
          }
        }
        return allTimers;
      }
      return [];
    } catch (error) {
      console.error('Failed to get cloud timers:', error);
      return [];
    }
  }

  async getTodayCloudScheduleInfo(): Promise<{ situation: SituationType | null; nextAction: string | null; cloudTimers: any[] }> {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = this.getSituation(today);
    
    if (!todaySchedule) {
      return { situation: null, nextAction: null, cloudTimers: [] };
    }

    try {
      const cloudTimers = await this.getCloudTimers(todaySchedule.deviceId, todaySchedule.situation);
      
      // Find next action from cloud timers
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      let nextAction = null;
      for (const timer of cloudTimers) {
        if (timer.status === 1 && timer.time) { // Active timer
          const [hours, minutes] = timer.time.split(':').map(Number);
          const timerTime = hours * 60 + minutes;
          
          if (timerTime > currentTime) {
            // Determine action from functions array
            const action = timer.functions && timer.functions.length > 0 && timer.functions[0].dpValue ? 'ON' : 'OFF';
            nextAction = `${action} at ${timer.time}`;
            break;
          }
        }
      }
      
      return { 
        situation: todaySchedule.situation, 
        nextAction, 
        cloudTimers: cloudTimers.filter(t => t.status === 1) // Only active timers
      };
    } catch (error) {
      console.error('Failed to get cloud timer info:', error);
      return { situation: todaySchedule.situation, nextAction: null, cloudTimers: [] };
    }
  }
}

export const scheduler = new PlugScheduler();
