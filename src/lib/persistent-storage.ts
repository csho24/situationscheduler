// File-based persistent storage for server-side state
// This ensures data is shared between different API routes in serverless environments

import fs from 'fs';
import path from 'path';

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

interface StorageData {
  scheduleStorage: Record<string, DaySchedule>;
  deviceSchedules: Record<string, Record<SituationType, ScheduleEntry[]>>;
  manualOverrides: Record<string, ManualOverride>;
  lastExecutedEvents: Record<string, number>;
}

// Default schedules for new devices
// export const DEFAULT_SCHEDULES: Record<SituationType, ScheduleEntry[]> = {
//   work: [
//     { time: '21:00', action: 'on' },  // 9 PM
//     { time: '22:00', action: 'off' }  // 10 PM
//   ],
//   rest: [
//     { time: '10:00', action: 'on' },  // 10 AM
//     { time: '11:00', action: 'off' }, // 11 AM
//     { time: '14:00', action: 'on' },  // 2 PM
//     { time: '15:00', action: 'off' }, // 3 PM
//     { time: '17:00', action: 'on' },  // 5 PM
//     { time: '18:00', action: 'off' }, // 6 PM
//     { time: '21:00', action: 'on' },  // 9 PM
//     { time: '22:00', action: 'off' }  // 10 PM
//   ]
// };

// Device configuration
export const DEVICES = [
  { id: 'a3e31a88528a6efc15yf4o', name: 'Lights' },
  { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop' },
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub' },
  { id: 'a3cf493448182afaa9rlgw', name: 'Aircon' }
];

// Storage file path (in tmp for serverless compatibility)
const STORAGE_FILE = path.join(process.cwd(), '.tmp-scheduler-storage.json');

// Initialize default data
const defaultData: StorageData = {
  scheduleStorage: {},
  deviceSchedules: {},
  manualOverrides: {},
  lastExecutedEvents: {}
};

// Initialize device schedules
function initializeDefaultDeviceSchedules(data: StorageData): StorageData {
  if (Object.keys(data.deviceSchedules).length === 0) {
    DEVICES.forEach(device => {
      data.deviceSchedules[device.id] = {
        work: [
          { time: '21:00', action: 'on' },
          { time: '22:00', action: 'off' }
        ],
        rest: [
          { time: '10:00', action: 'on' },
          { time: '11:00', action: 'off' },
          { time: '14:00', action: 'on' },
          { time: '15:00', action: 'off' },
          { time: '17:00', action: 'on' },
          { time: '18:00', action: 'off' },
          { time: '21:00', action: 'on' },
          { time: '22:00', action: 'off' }
        ]
      };
    });
    console.log('🔧 Initialized default device schedules');
  }
  return data;
}

// Load data from file
export function loadStorage(): StorageData {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const fileContent = fs.readFileSync(STORAGE_FILE, 'utf8');
      const data = JSON.parse(fileContent) as StorageData;
      console.log(`📂 Loaded storage from file: ${Object.keys(data.scheduleStorage).length} schedules`);
      return initializeDefaultDeviceSchedules(data);
    }
  } catch (error) {
    console.error('❌ Error loading storage:', error);
  }
  
  console.log('📂 Creating new storage file');
  const newData = initializeDefaultDeviceSchedules({ ...defaultData });
  saveStorage(newData);
  return newData;
}

// Save data to file
export function saveStorage(data: StorageData): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Saved storage to file: ${Object.keys(data.scheduleStorage).length} schedules`);
  } catch (error) {
    console.error('❌ Error saving storage:', error);
  }
}

// Update specific parts of storage
export function updateScheduleStorage(schedules: Record<string, DaySchedule>): void {
  const data = loadStorage();
  data.scheduleStorage = { ...data.scheduleStorage, ...schedules };
  saveStorage(data);
}

export function updateDeviceSchedules(deviceSchedules: Record<string, Record<SituationType, ScheduleEntry[]>>): void {
  const data = loadStorage();
  data.deviceSchedules = { ...data.deviceSchedules, ...deviceSchedules };
  saveStorage(data);
}

export function updateManualOverrides(overrides: Record<string, ManualOverride>): void {
  const data = loadStorage();
  data.manualOverrides = { ...data.manualOverrides, ...overrides };
  saveStorage(data);
}

export function setManualOverride(deviceId: string, durationMinutes: number): void {
  const data = loadStorage();
  data.manualOverrides[deviceId] = {
    deviceId,
    until: Date.now() + (durationMinutes * 60000),
    setAt: Date.now()
  };
  saveStorage(data);
}

export function clearManualOverride(deviceId: string): void {
  const data = loadStorage();
  delete data.manualOverrides[deviceId];
  saveStorage(data);
}

export function updateLastExecutedEvent(eventKey: string, timestamp: number): void {
  const data = loadStorage();
  data.lastExecutedEvents[eventKey] = timestamp;
  saveStorage(data);
}

export type { ScheduleEntry, SituationType, DaySchedule, ManualOverride, StorageData };
