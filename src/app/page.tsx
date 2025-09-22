'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Settings, Laptop, Edit, Plus, Lightbulb, Usb, Power } from 'lucide-react';
import CalendarComponent from '@/components/Calendar';
import ScheduleEditor from '@/components/ScheduleEditor';
// import dynamic from 'next/dynamic';
import { tuyaAPI } from '@/lib/tuya-api';

// const DeviceStatus = dynamic(() => import('@/components/DeviceStatus'), {
//   ssr: false,
//   loading: () => <div className="text-center p-8">Loading device status...</div>
// });
import { serverScheduler, type SituationType, type ScheduleEntry } from '@/lib/server-scheduler';
import { startLocalScheduler, stopLocalScheduler } from '@/lib/local-scheduler';

const DEVICES = [
  { id: 'a3e31a88528a6efc15yf4o', name: 'Lights', app: 'Smart Life', icon: Lightbulb },
  { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop', app: 'Smart Life', icon: Laptop },
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub', app: 'Smart Life', icon: Usb }
];

function DeviceControl({ device, deviceStates, setDeviceStates, deviceStatesInitialized }: { 
  device: typeof DEVICES[0], 
  deviceStates: Record<string, boolean>,
  setDeviceStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  deviceStatesInitialized: boolean
}) {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isOn = deviceStates[device.id] ?? false;

  const checkStatus = React.useCallback(async () => {
    if (!mounted) return;
    setLoading(true);
    try {
      const status = await tuyaAPI.getDeviceStatus(device.id);
      
      // Extract the switch status from the response
      let isOn = false;
      if (status.result && (status.result as { status?: Array<{ code: string; value: boolean }> }).status) {
        const switchStatus = (status.result as { status: Array<{ code: string; value: boolean }> }).status.find((item: { code: string; value: boolean }) => item.code === 'switch_1');
        isOn = switchStatus ? Boolean(switchStatus.value) : false;
      }
      
      setDeviceStates(prev => ({ ...prev, [device.id]: isOn }));
    } catch (error) {
      console.error(`Error checking ${device.name} status:`, error);
      setDeviceStates(prev => ({ ...prev, [device.id]: false }));
    } finally {
      setLoading(false);
    }
  }, [device.id, device.name, mounted, setDeviceStates]);

  useEffect(() => {
    setMounted(true);
    // Only check status if the main initialization hasn't happened yet
    if (!deviceStatesInitialized) {
      checkStatus();
    }
  }, [deviceStatesInitialized, checkStatus]);

  const toggleDevice = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isOn) {
        await tuyaAPI.turnOff(device.id);
        setDeviceStates(prev => ({ ...prev, [device.id]: false }));
      } else {
        await tuyaAPI.turnOn(device.id);
        setDeviceStates(prev => ({ ...prev, [device.id]: true }));
      }
      
      // Set manual override for 60 minutes
      await serverScheduler.setManualOverride(device.id, 60);
      
    } catch (error) {
      console.error('Error toggling device:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg">
      <div className="p-1 bg-blue-100 rounded">
        <device.icon size={14} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{device.name}</div>
        <div className="text-xs text-gray-500">{device.app}</div>
      </div>
      
      {/* Toggle Switch */}
      <button
        onClick={toggleDevice}
        disabled={loading}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${loading 
            ? 'bg-gray-300 cursor-not-allowed' 
            : isOn 
            ? 'bg-green-600' 
            : 'bg-gray-200'
          }
        `}
      >
        <span
          className={`
            inline-block h-3 w-3 transform rounded-full bg-white transition-transform
            ${isOn ? 'translate-x-5' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

function MasterToggle({ deviceStates, setDeviceStates, deviceStatesInitialized }: { 
  deviceStates: Record<string, boolean>,
  setDeviceStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  deviceStatesInitialized: boolean
}) {
  const [loading, setLoading] = useState(false);

  const toggleAllDevices = async () => {
    if (loading || !deviceStatesInitialized) return;
    
    // Determine if we should turn all ON or all OFF
    const statusValues = Object.values(deviceStates);
    const allOn = statusValues.every(status => status === true);
    const targetState = !allOn; // If all are on, turn off; otherwise turn on
    
    // If turning OFF, show confirmation popup
    if (!targetState) {
      const devicesOnCount = statusValues.filter(status => status === true).length;
      if (devicesOnCount > 0) {
        const confirmed = window.confirm(`Turn off ${devicesOnCount} device${devicesOnCount > 1 ? 's' : ''}?`);
        if (!confirmed) {
          return; // User cancelled
        }
      }
    }
    
    setLoading(true);
    
    try {
      // Toggle all devices to the target state
      const promises = DEVICES.map(async (device) => {
        try {
          if (targetState) {
            await tuyaAPI.turnOn(device.id);
          } else {
            await tuyaAPI.turnOff(device.id);
          }
          
          // Set manual override for 60 minutes for each device
          await serverScheduler.setManualOverride(device.id, 60);
          
          return { deviceId: device.id, success: true, state: targetState };
        } catch (error) {
          console.error(`Error toggling ${device.name}:`, error);
          return { deviceId: device.id, success: false, state: deviceStates[device.id] };
        }
      });

      const results = await Promise.all(promises);
      
      // Update the status based on results
      const newStatuses = { ...deviceStates };
      results.forEach(result => {
        if (result.success) {
          newStatuses[result.deviceId] = result.state;
        }
      });
      setDeviceStates(newStatuses);
      
    } catch (error) {
      console.error('Error in master toggle:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusValues = Object.values(deviceStates);
  const allOn = deviceStatesInitialized && statusValues.length > 0 && statusValues.every(status => status === true);
  const someOn = deviceStatesInitialized && statusValues.some(status => status === true);
  

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">All</span>
      <button
        onClick={toggleAllDevices}
        disabled={loading || !deviceStatesInitialized}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${loading || !deviceStatesInitialized
            ? 'bg-gray-300 cursor-not-allowed' 
            : allOn
            ? 'bg-green-600' 
            : someOn
            ? 'bg-yellow-500'
            : 'bg-gray-200'
          }
        `}
        title={loading ? 'Loading...' : !deviceStatesInitialized ? 'Checking device status...' : allOn ? 'Turn all OFF' : 'Turn all ON'}
      >
        <span
          className={`
            inline-block h-3 w-3 transform rounded-full bg-white transition-transform
            ${allOn ? 'translate-x-5' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'status' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && ['calendar', 'status', 'settings'].includes(savedTab)) {
        return savedTab as 'calendar' | 'status' | 'settings';
      }
    }
    return 'calendar';
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [editingSituation, setEditingSituation] = useState<SituationType | null>(null);
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]); // For settings page
  const [todayInfo, setTodayInfo] = useState(serverScheduler.getTodayScheduleInfo());
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});
  const [deviceStatesInitialized, setDeviceStatesInitialized] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [customSchedules, setCustomSchedules] = useState(() => serverScheduler.getCustomSchedules());

  // Update scheduler with custom schedules on load
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Update scheduler with all device schedules
      serverScheduler.updateCustomSchedules(customSchedules);
      setTodayInfo(serverScheduler.getTodayScheduleInfo());
    }
  }, [customSchedules]);

  // Update current time every minute for live schedule highlighting
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab]);

  // Initialize device states and local scheduler on page load
  useEffect(() => {
    const initializeDeviceStates = async () => {
      const initialStates: Record<string, boolean> = {};
      
      for (const device of DEVICES) {
        try {
          const status = await tuyaAPI.getDeviceStatus(device.id);
          
          // Extract the switch status from the response
          let isOn = false;
          if (status.result && (status.result as { status?: Array<{ code: string; value: boolean }> }).status) {
            // Look for switch_1 in the status array
            const switchStatus = (status.result as { status: Array<{ code: string; value: boolean }> }).status.find((item: { code: string; value: boolean }) => item.code === 'switch_1');
            isOn = switchStatus ? Boolean(switchStatus.value) : false;
          }
          
          initialStates[device.id] = isOn;
        } catch (error) {
          console.error(`Error checking ${device.name} status on init:`, error);
          initialStates[device.id] = false;
        }
      }
      
      setDeviceStates(initialStates);
      setDeviceStatesInitialized(true);
    };

    if (!deviceStatesInitialized) {
      initializeDeviceStates();
    }
    
    // Start local scheduler for development
    startLocalScheduler();
    
              // Force sync localStorage to server after mount to avoid hydration issues
              serverScheduler.forceSync();

              // DEBUG: Log what's in localStorage
              console.log('🔍 LOCALSTORAGE DEBUG:');
              console.log('plug-schedules:', localStorage.getItem('plug-schedules'));
              console.log('per-device-schedules:', localStorage.getItem('per-device-schedules'));
              
              // GET ACTUAL LOCALHOST SCHEDULES
              const actualSchedules = localStorage.getItem('per-device-schedules');
              if (actualSchedules) {
                console.log('📋 ACTUAL LOCALHOST SCHEDULES:');
                console.log(JSON.parse(actualSchedules));
              }
              
              // COPY ACTUAL LOCALHOST SCHEDULES TO DEPLOYED VERSION
              const customSchedules = {
                "a3e31a88528a6efc15yf4o": {
                  "work": [
                    {"time":"22:45","action":"off"},
                    {"time":"23:20","action":"off"}
                  ],
                  "rest": [
                    {"time":"20:00","action":"off"},
                    {"time":"21:19","action":"off"},
                    {"time":"23:00","action":"off"},
                    {"time":"23:30","action":"off"}
                  ]
                },
                "a34b0f81d957d06e4aojr1": {
                  "work": [
                    {"time":"05:45","action":"on"},
                    {"time":"06:15","action":"off"}
                  ],
                  "rest": [
                    {"time":"05:45","action":"off"},
                    {"time":"06:15","action":"off"},
                    {"time":"10:00","action":"on"},
                    {"time":"11:00","action":"off"},
                    {"time":"14:00","action":"on"},
                    {"time":"15:00","action":"off"},
                    {"time":"17:00","action":"on"},
                    {"time":"19:03","action":"on"},
                    {"time":"20:00","action":"on"},
                    {"time":"21:00","action":"off"},
                    {"time":"22:00","action":"on"},
                    {"time":"23:00","action":"off"}
                  ]
                },
                "a3240659645e83dcfdtng7": {
                  "work": [
                    {"time":"00:20","action":"off"},
                    {"time":"05:45","action":"on"},
                    {"time":"07:55","action":"off"},
                    {"time":"19:00","action":"on"}
                  ],
                  "rest": [
                    {"time":"06:00","action":"on"},
                    {"time":"09:30","action":"off"},
                    {"time":"14:15","action":"on"},
                    {"time":"15:00","action":"off"},
                    {"time":"18:30","action":"on"},
                    {"time":"20:30","action":"off"}
                  ]
                }
              };
              
              console.log('📋 COPYING LOCALHOST SCHEDULES TO DEPLOYED VERSION');
              localStorage.setItem('per-device-schedules', JSON.stringify(customSchedules));
    
    // Cleanup on unmount
    return () => {
      stopLocalScheduler();
    };
  }, [deviceStatesInitialized]);

  const handleDateSelect = (date: Date, situation: SituationType) => {
    const dateString = date.toLocaleDateString();
    setNotification(`Set ${dateString} as ${situation} day`);
    setTimeout(() => setNotification(null), 3000);
  };

  const executeToday = async () => {
    try {
      await serverScheduler.executeScheduleCheck();
      setNotification('Schedule check triggered successfully!');
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification('Failed to trigger schedule check');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const scheduleToday = async (situation: SituationType) => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    await serverScheduler.setSituation(dateString, situation);
    setTodayInfo(serverScheduler.getTodayScheduleInfo());
    setNotification(`Today scheduled as ${situation} day - server scheduling active!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveSchedule = async (situation: SituationType, schedule: ScheduleEntry[]) => {
    const newSchedules = {
      ...customSchedules,
      [selectedDevice.id]: {
        ...customSchedules[selectedDevice.id],
        [situation]: schedule
      }
    };
    setCustomSchedules(newSchedules);
    
    // Update the server scheduler to use new custom schedules for all devices
    await serverScheduler.updateCustomSchedules(newSchedules);
    
    // Force sync to server to ensure data is persisted
    await serverScheduler.syncToServer();
    
    setTodayInfo(serverScheduler.getTodayScheduleInfo());
    
    setEditingSituation(null);
    setNotification(`${selectedDevice.name} ${situation} schedule updated and synced to server!`);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Laptop size={24} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Situation Scheduler</h1>
                <p className="text-sm text-gray-600">Situation-based automation</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => scheduleToday('work')}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Work Day
              </button>
              <button
                onClick={() => scheduleToday('rest')}
                className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
              >
                Rest Day
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-8">
            {[
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'status', label: 'Device Management', icon: Laptop },
              { id: 'settings', label: 'Schedule', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as 'calendar' | 'status' | 'settings')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium
                  ${activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }
                `}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>


      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg">
          {notification}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Today's Schedule Status */}
        {todayInfo.situation && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg mb-8">
            <div className="px-4 py-4">
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${todayInfo.situation === 'work' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm font-medium text-gray-800">
                    <span className="font-bold">Today:</span> <span className="capitalize">{todayInfo.situation}</span> Day Schedule
                  </span>
                  {todayInfo.nextAction && (
                    <span className="text-sm text-gray-600 ml-4">
                      <span className="font-bold">Next:</span> {todayInfo.nextAction}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Your Schedule</h2>
              <p className="text-gray-600">
                Assign work or rest day smart plug schedules to your days!
              </p>
            </div>
            <CalendarComponent onDateSelect={handleDateSelect} />
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Management</h2>
              <p className="text-gray-600">
                Monitor and manually control your connected devices.
              </p>
            </div>
            
            {/* Device Controls */}
            <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Device Controls</h3>
                <MasterToggle 
                  deviceStates={deviceStates} 
                  setDeviceStates={setDeviceStates}
                  deviceStatesInitialized={deviceStatesInitialized}
                />
              </div>
              <div className="space-y-3">
                {DEVICES.map((device) => (
                  <DeviceControl 
                    key={device.id} 
                    device={device} 
                    deviceStates={deviceStates}
                    setDeviceStates={setDeviceStates}
                    deviceStatesInitialized={deviceStatesInitialized}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule Settings</h2>
              <p className="text-gray-600">
                View and configure your situation-based schedules.
              </p>
            </div>
            
            {/* Device Selector */}
            <div className="max-w-lg mx-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Device to Configure:</label>
              <select 
                value={DEVICES.findIndex(d => d.id === selectedDevice.id)} 
                onChange={(e) => setSelectedDevice(DEVICES[Number(e.target.value)])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                {DEVICES.map((device, index) => (
                  <option key={device.id} value={index}>
                    {device.name} ({device.app})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="max-w-lg mx-auto space-y-6">
              {/* Work Day Schedule */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    {selectedDevice.name} - Work Day
                  </h3>
                  <button
                    onClick={() => setEditingSituation('work')}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 transition-colors"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const workSchedule = customSchedules[selectedDevice.id]?.work || [];
                    const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                    
                    // Check if work schedule is active today (regardless of device)
                    const today = new Date().toISOString().split('T')[0];
                    const todaySchedule = serverScheduler.getSituation(today);
                    const isActiveToday = todaySchedule?.situation === 'work';
                    
                    // Find the most recent schedule entry that should be active (including overnight)
                    let activeIndex = -1;
                    let bestTimeDiff = Infinity;
                    
                    if (Array.isArray(workSchedule)) {
                      workSchedule.forEach((entry, index) => {
                        const [hours, minutes] = entry.time.split(':').map(Number);
                        const entryTime = hours * 60 + minutes;
                        
                        // Calculate time difference, considering overnight schedules
                        let timeDiff;
                        if (entryTime <= currentTimeMinutes) {
                          // Same day - entry is before current time
                          timeDiff = currentTimeMinutes - entryTime;
                        } else {
                          // Overnight - entry was yesterday (24 hours ago + difference)
                          timeDiff = (24 * 60) - entryTime + currentTimeMinutes;
                        }
                        
                        // Find the entry with the smallest positive time difference (most recent)
                        if (timeDiff >= 0 && timeDiff < bestTimeDiff) {
                          activeIndex = index;
                          bestTimeDiff = timeDiff;
                        }
                      });
                    }
                    
                    return Array.isArray(workSchedule) ? workSchedule.map((entry, index) => (
                      <div key={index} className={`flex items-center gap-4 py-2 px-3 rounded-lg transition-colors ${
                        index === activeIndex && isActiveToday
                          ? 'bg-blue-50 border-2 border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}>
                        <span className={`w-16 ${
                          index === activeIndex && isActiveToday ? 'text-blue-700 font-medium' : 'text-gray-600'
                        }`}>{entry.time}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.action === 'on' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          Turn {entry.action.toUpperCase()}
                        </span>
                        {index === activeIndex && isActiveToday && (
                          <span className="text-blue-600 text-xs ml-auto">← Active Now</span>
                        )}
                      </div>
                    )) : [];
                  })()}
                </div>
              </div>

              {/* Rest Day Schedule */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    {selectedDevice.name} - Rest Day
                  </h3>
                  <button
                    onClick={() => setEditingSituation('rest')}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-yellow-600 hover:text-yellow-800 transition-colors"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const restSchedule = customSchedules[selectedDevice.id]?.rest || [];
                    const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                    
                    // Check if rest schedule is active today (regardless of device)
                    const today = new Date().toISOString().split('T')[0];
                    const todaySchedule = serverScheduler.getSituation(today);
                    const isActiveToday = todaySchedule?.situation === 'rest';
                    
                    // Find the most recent schedule entry that should be active (including overnight)
                    let activeIndex = -1;
                    let bestTimeDiff = Infinity;
                    
                    if (Array.isArray(restSchedule)) {
                      restSchedule.forEach((entry, index) => {
                        const [hours, minutes] = entry.time.split(':').map(Number);
                        const entryTime = hours * 60 + minutes;
                        
                        // Calculate time difference, considering overnight schedules
                        let timeDiff;
                        if (entryTime <= currentTimeMinutes) {
                          // Same day - entry is before current time
                          timeDiff = currentTimeMinutes - entryTime;
                        } else {
                          // Overnight - entry was yesterday (24 hours ago + difference)
                          timeDiff = (24 * 60) - entryTime + currentTimeMinutes;
                        }
                        
                        // Find the entry with the smallest positive time difference (most recent)
                        if (timeDiff >= 0 && timeDiff < bestTimeDiff) {
                          activeIndex = index;
                          bestTimeDiff = timeDiff;
                        }
                      });
                    }
                    
                    return Array.isArray(restSchedule) ? restSchedule.map((entry, index) => (
                      <div key={index} className={`flex items-center gap-4 py-2 px-3 rounded-lg transition-colors ${
                        index === activeIndex && isActiveToday
                          ? 'bg-blue-50 border-2 border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}>
                        <span className={`w-16 ${
                          index === activeIndex && isActiveToday ? 'text-blue-700 font-medium' : 'text-gray-600'
                        }`}>{entry.time}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.action === 'on' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          Turn {entry.action.toUpperCase()}
                        </span>
                        {index === activeIndex && isActiveToday && (
                          <span className="text-blue-600 text-xs ml-auto">← Active Now</span>
                        )}
                      </div>
                    )) : [];
                  })()}
                </div>
              </div>

              {/* Add Routine Button */}
              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={() => {
                    setNotification('Custom routines coming soon! For now, edit existing schedules.');
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors mb-4"
                >
                  <Plus size={20} />
                  Add Custom Routine
                </button>
                
                {/* Test Server Scheduler Button */}
                <button
                  onClick={executeToday}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Power size={16} />
                  Test Server Scheduler
                </button>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Schedule Editor Modal */}
      {editingSituation && (
        <ScheduleEditor
          situation={editingSituation}
          currentSchedule={(customSchedules[selectedDevice.id]?.[editingSituation]) || []}
          onSave={handleSaveSchedule}
          onCancel={() => setEditingSituation(null)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-800">
            Smart Plug Scheduler - Built for flexible work schedules
          </div>
        </div>
      </footer>
    </div>
  );
}