// Shared server-side storage
// In production, this should be replaced with a database

interface ScheduleEntry {
  time: string; // HH:MM format
  action: 'on' | 'off';
}

type SituationType = 'work' | 'rest';

interface DaySchedule {
  date: string; // YYYY-MM-DD format
  situation: SituationType;
}

interface ManualOverride {
  deviceId: string;
  until: number; // timestamp
  setAt: number; // timestamp when override was set
}

// Default schedules for new devices
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

// Device configuration
export const DEVICES = [
  { id: 'a3e31a88528a6efc15yf4o', name: 'Lights' },
  { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop' },
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub' }
];

// Shared storage (in production, use a database)
export const storage = {
  scheduleStorage: {} as Record<string, DaySchedule>,
  deviceSchedules: {} as Record<string, Record<SituationType, ScheduleEntry[]>>,
  manualOverrides: {} as Record<string, ManualOverride>,
  lastExecutedEvents: {} as Record<string, number> // deviceId-time-action-date -> timestamp
};

// Initialize device schedules if empty
export function initializeDeviceSchedules() {
  if (Object.keys(storage.deviceSchedules).length === 0) {
    DEVICES.forEach(device => {
      storage.deviceSchedules[device.id] = { ...DEFAULT_SCHEDULES };
    });
    console.log('🔧 Initialized default device schedules on server');
  }
}

export type { ScheduleEntry, SituationType, DaySchedule, ManualOverride };
