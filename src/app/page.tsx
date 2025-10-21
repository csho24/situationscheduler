'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Settings, Laptop, Edit, Plus, Lightbulb, Usb, Power, Wind } from 'lucide-react';
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
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub', app: 'Smart Life', icon: Usb },
  { id: 'a3cf493448182afaa9rlgw', name: 'Aircon', app: 'Smart Life', icon: Wind }
];

function DeviceControl({ device, deviceStates, setDeviceStates, deviceStatesInitialized, intervalMode, intervalCountdown, offCountdown, isOnPeriod, toggleIntervalMode, stopIntervalMode }: { 
  device: typeof DEVICES[0], 
  deviceStates: Record<string, boolean>,
  setDeviceStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  deviceStatesInitialized: boolean,
  intervalMode: boolean,
  intervalCountdown: number,
  offCountdown: number,
  isOnPeriod: boolean,
  toggleIntervalMode: () => void,
  stopIntervalMode: () => void
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
        const switchStatus = (status.result as { status: Array<{ code: string; value: boolean }> }).status.find((item: { code: string; value: boolean }) => item.code === 'switch_1' || item.code === 'switch');
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
      // Special handling for aircon device
      if (device.id === 'a3cf493448182afaa9rlgw') {
        // Stop interval mode when manual control is used
        if (intervalMode) {
          await stopIntervalMode();
          // Don't toggle the device state when stopping interval mode
          // The stopIntervalMode function already turns off the aircon
          return;
        }
        // Aircon uses ir_power action (only when NOT in interval mode)
        await tuyaAPI.controlDevice(device.id, 'ir_power', !isOn);
        setDeviceStates(prev => ({ ...prev, [device.id]: !isOn }));
      } else {
        // Regular devices use switch_1
        if (isOn) {
          await tuyaAPI.turnOff(device.id);
          setDeviceStates(prev => ({ ...prev, [device.id]: false }));
        } else {
          await tuyaAPI.turnOn(device.id);
          setDeviceStates(prev => ({ ...prev, [device.id]: true }));
        }
      }
      
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
        <div className="text-xs text-gray-500 font-mono">{device.id}</div>
        {/* Interval mode status for aircon only */}
        {device.id === 'a3cf493448182afaa9rlgw' && intervalMode && (
          <div className="text-xs text-blue-600 font-medium flex gap-4">
            {isOnPeriod && (
              <span>⏱️ ON: {Math.floor(intervalCountdown / 60)}:{(intervalCountdown % 60).toString().padStart(2, '0')}</span>
            )}
            {!isOnPeriod && (
              <span>⏱️ OFF: {Math.floor(offCountdown / 60)}:{(offCountdown % 60).toString().padStart(2, '0')}</span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Interval Mode Toggle (Aircon only) */}
        {device.id === 'a3cf493448182afaa9rlgw' && (
          <button
            onClick={toggleIntervalMode}
            className={`
              px-3 py-1 text-xs rounded-full transition-colors
              ${intervalMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            {intervalMode ? 'Stop Interval' : 'Interval Mode'}
          </button>
        )}
        
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
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [userSettings, setUserSettings] = useState<Record<string, string>>({});
  const [isEditingDefaultDay, setIsEditingDefaultDay] = useState(false);
  const [isHoveringDropdown, setIsHoveringDropdown] = useState(false);
  const [customRoutines, setCustomRoutines] = useState<string[]>([]);
  const [showCreateRoutineModal, setShowCreateRoutineModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  
  // Interval mode state for aircon (shared across pages)
  const [intervalMode, setIntervalMode] = useState(false);
  const [intervalCountdown, setIntervalCountdown] = useState(0);
  const [offCountdown, setOffCountdown] = useState(0);
  const [isOnPeriod, setIsOnPeriod] = useState(true);
  const [showIntervalConfig, setShowIntervalConfig] = useState(true);
  const [onDuration, setOnDuration] = useState(10);  // Default to 10 min, never 0
  const [intervalDuration, setIntervalDuration] = useState(16);  // Default to 16 min, never 0
  const [intervalStartTime, setIntervalStartTime] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommandTime = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);

  // Save interval mode state to Supabase
  const saveIntervalModeState = async (isActive: boolean, onDur?: number, intervalDur?: number, startTime?: number) => {
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'interval_mode',
          deviceId: 'a3cf493448182afaa9rlgw',
          isActive: isActive,
          onDuration: onDur !== undefined ? onDur : onDuration,
          intervalDuration: intervalDur !== undefined ? intervalDur : intervalDuration,
          startTime: startTime
        })
      });
      if (!response.ok) {
        console.error('Failed to save interval mode state');
      } else {
        console.log(`💾 Saved interval config: ON=${onDur || onDuration}min, OFF=${intervalDur || intervalDuration}min, Active=${isActive}`);
      }
    } catch (error) {
      console.error('Error saving interval mode state:', error);
    }
  };

  // Save just the configuration (without starting interval mode)
  const saveIntervalConfig = async (onDur: number, intervalDur: number) => {
    await saveIntervalModeState(intervalMode, onDur, intervalDur, intervalStartTime || undefined);
  };

  // Create custom routine
  const createCustomRoutine = async (routineName: string) => {
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom_routine',
          routineName: routineName
        })
      });
      
      if (response.ok) {
        setCustomRoutines(prev => [...prev, routineName]);
        setNotification(`Custom routine "${routineName}" created successfully!`);
        setTimeout(() => setNotification(null), 3000);
        setShowCreateRoutineModal(false);
        setNewRoutineName('');
      } else {
        throw new Error('Failed to create custom routine');
      }
    } catch (error) {
      console.error('Error creating custom routine:', error);
      setNotification('Failed to create custom routine');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Load interval mode state from Supabase
  const loadIntervalModeState = async () => {
    try {
      const response = await fetch('/api/schedules');
      const data = await response.json();
      if (data.success && data.intervalMode !== undefined) {
        setIntervalMode(data.intervalMode);
        
        // Load user's configuration if available
        if (data.intervalConfig) {
          // Never show 0 - use last input or reasonable defaults
          setOnDuration(data.intervalConfig.onDuration || 10);
          setIntervalDuration(data.intervalConfig.intervalDuration || 16);
          
          if (data.intervalMode && data.intervalConfig.startTime) {
            // If interval mode was active, keep config open and resume
            setShowIntervalConfig(true);
            const startTime = new Date(data.intervalConfig.startTime).getTime();
            setIntervalStartTime(startTime);
            
            // Resume immediately with the loaded start time
            setTimeout(() => {
              resumeIntervalModeWithStartTime(startTime, data.intervalConfig.onDuration, data.intervalConfig.intervalDuration);
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('Error loading interval mode state:', error);
    }
  };

  // Interval mode functions for aircon
  const toggleIntervalMode = async () => {
    if (intervalMode) {
      stopIntervalMode();
    } else {
      startIntervalMode();
    }
  };

  const startIntervalMode = async () => {
    // Clear any existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    
    setIntervalMode(true);
    const startTime = Date.now();
    setIntervalStartTime(startTime);
    await saveIntervalModeState(true, onDuration, intervalDuration, startTime);

    console.log(`🔄 Interval mode started: ON for ${onDuration}min, OFF for ${intervalDuration}min`);

    // Start the cycle: Turn ON immediately, start ON period
    await tuyaAPI.controlDevice('a3cf493448182afaa9rlgw', 'ir_power', true);
    setIsOnPeriod(true);
    setIntervalCountdown(onDuration * 60); // Start ON timer
    setOffCountdown(0); // Hide OFF timer
    
    // Create Web Worker for timer
    workerRef.current = new Worker('/interval-worker.js');
    
    // Listen for messages from worker
    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'PERIOD_CHANGE') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] 🔄 Main Thread: Period changed to ${data.period}, countdown: ${data.countdown}`);
        
        // Update UI state
        if (data.period === 'ON') {
          setIsOnPeriod(true);
          setIntervalCountdown(data.countdown);
          setOffCountdown(0);
        } else {
          setIsOnPeriod(false);
          setOffCountdown(data.countdown);
          setIntervalCountdown(0);
        }
        
        // Execute device command
        if (data.command) {
          console.log(`[${timestamp}] 🔧 Main Thread: Sending command - ${data.command.action} = ${data.command.value}`);
          tuyaAPI.controlDevice(data.command.device, data.command.action, data.command.value);
          
          // Update device state to reflect the command
          setDeviceStates(prev => ({ ...prev, [data.command.device]: data.command.value }));
        }
      } else if (type === 'COUNTDOWN_UPDATE') {
        // Update countdown display without executing commands
        if (data.period === 'ON') {
          setIntervalCountdown(data.countdown);
        } else {
          setOffCountdown(data.countdown);
        }
      } else if (type === 'HEARTBEAT') {
        // Web Worker is active - save heartbeat to database
        fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'user_settings',
            settingKey: 'interval_mode_heartbeat',
            settingValue: data.timestamp.toString()
          })
        }).catch(err => console.error('Failed to save heartbeat:', err));
      }
    };
    
    // Start worker timer
    workerRef.current.postMessage({
      type: 'START_INTERVAL',
      data: { onDuration, intervalDuration, startTime }
    });
  };

  const stopIntervalMode = async () => {
    // Clear worker
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP_INTERVAL' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    
    setIntervalMode(false);
    setIntervalCountdown(0);
    setOffCountdown(0);
    setIsOnPeriod(true);
    setIntervalStartTime(null);
    await saveIntervalModeState(false);
    
    // Turn off aircon when stopping
    await tuyaAPI.controlDevice('a3cf493448182afaa9rlgw', 'ir_power', false);
    
    // Update device state to reflect OFF
    setDeviceStates(prev => ({ ...prev, 'a3cf493448182afaa9rlgw': false }));
  };

  // Resume interval mode after page refresh with explicit start time
  const resumeIntervalModeWithStartTime = (startTime: number, onDur: number, intervalDur: number) => {
    console.log(`🔄 Resuming interval mode from saved state using Web Worker`);
    
    // Calculate how much time has passed since the start time
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const totalCycleTime = (onDur + intervalDur) * 60;
    const cyclePosition = elapsed % totalCycleTime;
    
    console.log(`🔄 Elapsed: ${elapsed}s, Cycle position: ${cyclePosition}s`);
    
    // Set initial UI state based on current cycle position
    if (cyclePosition < onDur * 60) {
      // We're in the ON period
      const remainingOnTime = (onDur * 60) - cyclePosition;
      setIntervalCountdown(remainingOnTime);
      setIsOnPeriod(true);
      setOffCountdown(0);
      console.log(`🔄 In ON period, ${remainingOnTime}s remaining`);
    } else {
      // We're in the OFF period
      const remainingOffTime = (intervalDur * 60) - (cyclePosition - onDur * 60);
      setOffCountdown(remainingOffTime);
      setIsOnPeriod(false);
      setIntervalCountdown(0);
      console.log(`🔄 In OFF period, ${remainingOffTime}s remaining`);
    }
    
    // Create Web Worker for timer (same as startIntervalMode)
    workerRef.current = new Worker('/interval-worker.js');
    
    // Listen for messages from worker
    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'PERIOD_CHANGE') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] 🔄 Main Thread: Period changed to ${data.period}, countdown: ${data.countdown}`);
        
        // Update UI state
        if (data.period === 'ON') {
          setIsOnPeriod(true);
          setIntervalCountdown(data.countdown);
          setOffCountdown(0);
        } else {
          setIsOnPeriod(false);
          setOffCountdown(data.countdown);
          setIntervalCountdown(0);
        }
        
        // Execute device command
        if (data.command) {
          console.log(`[${timestamp}] 🔧 Main Thread: Sending command - ${data.command.action} = ${data.command.value}`);
          tuyaAPI.controlDevice(data.command.device, data.command.action, data.command.value);
          
          // Update device state to reflect the command
          setDeviceStates(prev => ({ ...prev, [data.command.device]: data.command.value }));
        }
      } else if (type === 'COUNTDOWN_UPDATE') {
        // Update countdown display without executing commands
        if (data.period === 'ON') {
          setIntervalCountdown(data.countdown);
        } else {
          setOffCountdown(data.countdown);
        }
      } else if (type === 'HEARTBEAT') {
        // Web Worker is active - save heartbeat to database
        fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'user_settings',
            settingKey: 'interval_mode_heartbeat',
            settingValue: data.timestamp.toString()
          })
        }).catch(err => console.error('Failed to save heartbeat:', err));
      }
    };
    
    // Start worker timer with resume data
    workerRef.current.postMessage({
      type: 'START_INTERVAL',
      data: { 
        onDuration: onDur, 
        intervalDuration: intervalDur, 
        startTime,
        resumeMode: true,
        cyclePosition 
      }
    });
  };

  // Resume interval mode after page refresh
  const resumeIntervalMode = () => {
    if (!intervalStartTime) return;
    resumeIntervalModeWithStartTime(intervalStartTime, onDuration, intervalDuration);
  };

  // Cleanup interval mode on unmount
  React.useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Load interval mode state on mount
  React.useEffect(() => {
    
    loadIntervalModeState();
  }, []);

  // Load data directly from API on mount - bypass server scheduler
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadDirectFromAPI = async () => {
        try {
          console.log(`📋 UI: Loading data directly from API...`);
          const response = await fetch('/api/schedules');
          const data = await response.json();
          
          if (data.success && data.deviceSchedules) {
            console.log(`✅ UI: Loaded ${Object.keys(data.deviceSchedules).length} devices from API`);
            setCustomSchedules(data.deviceSchedules);
            
            // Also update the server scheduler (no sync - just load data)
            serverScheduler.updateCustomSchedules(data.deviceSchedules, false);
            setTodayInfo(serverScheduler.getTodayScheduleInfo(data.userSettings?.default_day));
          } else {
            console.log(`❌ UI: No device schedules in API response`);
          }
          
          // Load user settings
          if (data.success && data.userSettings) {
            console.log(`✅ UI: Loaded user settings:`, data.userSettings);
            setUserSettings(data.userSettings);
          }
          
          // Load custom routines
          if (data.success && data.customRoutines) {
            console.log(`✅ UI: Loaded custom routines:`, data.customRoutines);
            setCustomRoutines(data.customRoutines);
          }
          setIsLoadingSchedules(false);
        } catch (error) {
          console.error('❌ UI: Failed to load from API:', error);
          setIsLoadingSchedules(false);
        }
      };
      
      loadDirectFromAPI();
    }
  }, []);

  // Update scheduler with custom schedules when state changes (no sync)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      serverScheduler.updateCustomSchedules(customSchedules, false);
      setTodayInfo(serverScheduler.getTodayScheduleInfo(userSettings?.default_day));
    }
  }, [customSchedules, userSettings?.default_day]);

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
            const switchStatus = (status.result as { status: Array<{ code: string; value: boolean }> }).status.find((item: { code: string; value: boolean }) => item.code === 'switch_1' || item.code === 'switch');
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
    
  }, [deviceStatesInitialized]);

  // Sync device states when on device management tab
  useEffect(() => {
    let syncTimer: NodeJS.Timeout | null = null;
    
    const syncDeviceStates = async () => {
      // Update aircon state based on interval mode
      setDeviceStates(prev => ({
        ...prev,
        'a3cf493448182afaa9rlgw': intervalMode
      }));
      
      // Check other devices' actual status
      for (const device of DEVICES) {
        if (device.id === 'a3cf493448182afaa9rlgw') continue; // Skip aircon, already handled
        
        try {
          const status = await tuyaAPI.getDeviceStatus(device.id);
          
          let isOn = false;
          if (status.result && (status.result as { status?: Array<{ code: string; value: boolean }> }).status) {
            const switchStatus = (status.result as { status: Array<{ code: string; value: boolean }> }).status.find((item: { code: string; value: boolean }) => item.code === 'switch_1' || item.code === 'switch');
            isOn = switchStatus ? Boolean(switchStatus.value) : false;
          }
          
          setDeviceStates(prev => {
            if (prev[device.id] !== isOn) {
              return { ...prev, [device.id]: isOn };
            }
            return prev;
          });
        } catch (error) {
          console.error(`Error syncing ${device.name} status:`, error);
        }
      }
    };

    // Sync when on device management tab
    if (activeTab === 'status' && deviceStatesInitialized) {
      syncDeviceStates();
      syncTimer = setInterval(() => {
        syncDeviceStates();
      }, 5000);
    }

    return () => {
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };
  }, [activeTab, deviceStatesInitialized]);

  // Separate useEffect for AC updates when interval mode changes
  useEffect(() => {
    if (deviceStatesInitialized) {
      console.log('🌬️ AC DEBUG: Updating AC state based on interval mode change', intervalMode);
      setDeviceStates(prev => ({
        ...prev,
        'a3cf493448182afaa9rlgw': intervalMode
      }));
    }
  }, [intervalMode, deviceStatesInitialized]);

  useEffect(() => {
              // Sync device schedules to server after mount
              // No sync - read-only from Supabase

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
    setTodayInfo(serverScheduler.getTodayScheduleInfo(userSettings?.default_day));
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
    
    // Update the server scheduler and save to server (user explicit save)
    await serverScheduler.updateCustomSchedules(newSchedules, true);
    
    // Force sync to server to ensure data is persisted
    // No sync - read-only from Supabase
    
    setTodayInfo(serverScheduler.getTodayScheduleInfo(userSettings?.default_day));
    
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
            <CalendarComponent onDateSelect={handleDateSelect} customRoutines={customRoutines} />
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
                    intervalMode={intervalMode}
                    intervalCountdown={intervalCountdown}
                    offCountdown={offCountdown}
                    isOnPeriod={isOnPeriod}
                    toggleIntervalMode={toggleIntervalMode}
                    stopIntervalMode={stopIntervalMode}
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
            
            {/* Default Days Selector */}
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Default Days:</label>
                <div 
                  className="rounded-md"
                  onMouseEnter={() => !isEditingDefaultDay && setIsHoveringDropdown(true)}
                  onMouseLeave={() => setIsHoveringDropdown(false)}
                >
                  <select 
                    value={userSettings?.default_day || 'rest'} 
                    disabled={!isEditingDefaultDay}
                    onChange={async (e) => {
                      const newValue = e.target.value;
                      try {
                        // Save to database FIRST
                        await fetch('/api/schedules', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'user_settings',
                            settingKey: 'default_day',
                            settingValue: newValue
                          })
                        });
                        // Only update UI AFTER successful save
                        setUserSettings(prev => ({ ...prev, default_day: newValue }));
                        setNotification(`Default days set to: ${newValue}`);
                        setTimeout(() => setNotification(null), 3000);
                        setIsEditingDefaultDay(false); // Auto-save and exit edit mode
                      } catch (error) {
                        console.error('Error updating default days:', error);
                      }
                    }}
                    className={`px-3 py-1 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      isEditingDefaultDay 
                        ? 'bg-white border-gray-300 text-gray-900' 
                        : 'bg-gray-200 border-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <option value="work">Work</option>
                    <option value="rest">Rest</option>
                    {customRoutines.map(routine => (
                      <option key={routine} value={routine}>{routine}</option>
                    ))}
                    <option value="none">None</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    setIsEditingDefaultDay(!isEditingDefaultDay);
                  }}
                  className={`px-3 py-1 bg-gray-50 text-sm rounded-md border border-gray-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 ${
                    isHoveringDropdown && !isEditingDefaultDay 
                      ? 'text-gray-600 bg-gray-100' 
                      : 'text-gray-400'
                  }`}
                >
                  {isEditingDefaultDay ? 'Cancel' : 'Edit'}
                </button>
              </div>
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
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Interval Mode for Aircon */}
            {selectedDevice.id === 'a3cf493448182afaa9rlgw' && (
              <div className="max-w-lg mx-auto">
                <div 
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => setShowIntervalConfig(!showIntervalConfig)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-blue-900">
                          Interval Mode
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleIntervalMode();
                        }}
                        className={`
                          px-4 py-2 text-sm rounded-full transition-colors
                          ${intervalMode 
                            ? 'bg-red-600 text-white hover:bg-red-700' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                          }
                        `}
                      >
                        {intervalMode ? 'Stop Interval' : 'Start Interval'}
                      </button>
                    </div>
                    
                    {showIntervalConfig && (
                      <div className="space-y-3">
                        <div className="text-sm text-black font-medium">
                          Switch ON for: <input 
                            type="text" 
                            value={onDuration} 
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                const newValue = val === '' ? 1 : Number(val);
                                setOnDuration(newValue);
                                // Auto-save to Supabase when user changes the value
                                await saveIntervalConfig(newValue, intervalDuration);
                              }
                            }} 
                            disabled={intervalMode} 
                            className="w-16 px-1 py-0.5 text-lg border-b-2 border-blue-400 bg-transparent text-center font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                          /> mins, then Switch OFF for: <input 
                            type="text" 
                            value={intervalDuration} 
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d+$/.test(val)) {
                                const newValue = val === '' ? 5 : Number(val);
                                setIntervalDuration(newValue);
                                // Auto-save to Supabase when user changes the value
                                await saveIntervalConfig(onDuration, newValue);
                              }
                            }} 
                            disabled={intervalMode} 
                            className="w-16 px-1 py-0.5 text-lg border-b-2 border-blue-400 bg-transparent text-center font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                          /> mins
                        </div>
                        
                        {/* Timer display on settings page */}
                        {intervalMode && (
                          <div className="text-sm text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded flex gap-4">
                            {isOnPeriod && (
                              <span>⏱️ ON Timer: {Math.floor(intervalCountdown / 60)}:{(intervalCountdown % 60).toString().padStart(2, '0')}</span>
                            )}
                            {!isOnPeriod && (
                              <span>⏱️ OFF Timer: {Math.floor(offCountdown / 60)}:{(offCountdown % 60).toString().padStart(2, '0')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="max-w-lg mx-auto space-y-6">
              {/* Work Day Schedule */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Work Day Schedule - {selectedDevice.name}
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
                    const isActiveToday = todaySchedule?.situation === 'work' || (!todaySchedule && userSettings?.default_day === 'work');
                    
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
                    
                    return Array.isArray(workSchedule) ? workSchedule.sort((a, b) => a.time.localeCompare(b.time)).map((entry, index) => (
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
                    Rest Day Schedule - {selectedDevice.name}
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
                    const isActiveToday = todaySchedule?.situation === 'rest' || (!todaySchedule && userSettings?.default_day === 'rest');
                    
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
                    
                    return Array.isArray(restSchedule) ? restSchedule.sort((a, b) => a.time.localeCompare(b.time)).map((entry, index) => (
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
                  onClick={() => setShowCreateRoutineModal(true)}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors mb-4"
                >
                  <Plus size={20} />
                  Add Custom Routine
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

      {/* Create Custom Routine Modal */}
      {showCreateRoutineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Custom Routine</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Routine Name
                  </label>
                  <input
                    type="text"
                    value={newRoutineName}
                    onChange={(e) => setNewRoutineName(e.target.value)}
                    placeholder="e.g., Weekend, Travel, Study"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    autoFocus
                  />
                </div>
                <div className="text-sm text-gray-600">
                  This will create a new routine type that you can assign to calendar days and set as the default for unassigned days.
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-6 pt-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  if (newRoutineName.trim()) {
                    createCustomRoutine(newRoutineName.trim());
                  }
                }}
                disabled={!newRoutineName.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                Create Routine
              </button>
              <button
                onClick={() => {
                  setShowCreateRoutineModal(false);
                  setNewRoutineName('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Trigger – centered and close to footer */}
      <div className="max-w-4xl mx-auto px-4 mt-2 mb-1">
        <div className="flex justify-center">
          <button
            onClick={executeToday}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            title="Run server-side schedule check now (sync to current minute)"
          >
            <Power size={14} />
            Sync Now
          </button>
        </div>
      </div>

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