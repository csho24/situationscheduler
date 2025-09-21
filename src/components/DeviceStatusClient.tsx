'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Laptop, Usb, Power, Wifi, WifiOff } from 'lucide-react';
import { tuyaAPI } from '@/lib/tuya-api';

const LIGHTS_DEVICE_ID = 'a3e31a88528a6efc15yf4o'; // Smart Life app device - WORKING
const LAPTOP_DEVICE_ID = 'a34b0f81d957d06e4aojr1'; // Smart Life app device - WORKING
const USB_HUB_DEVICE_ID = 'a3240659645e83dcfdtng7'; // Smart Life app device - WORKING

const DEVICES = [
  { id: LIGHTS_DEVICE_ID, name: 'Lights', icon: Lightbulb, app: LIGHTS_DEVICE_ID },
  { id: LAPTOP_DEVICE_ID, name: 'Laptop', icon: Laptop, app: LAPTOP_DEVICE_ID },
  { id: USB_HUB_DEVICE_ID, name: 'USB Hub', icon: Usb, app: USB_HUB_DEVICE_ID }
];

function DeviceStatusClient() {
  const [selectedDevice, setSelectedDevice] = useState(0); // Start with Lights (working)
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isOn, setIsOn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const currentDevice = DEVICES[selectedDevice];

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDeviceStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tuyaAPI.getDeviceStatus(currentDevice.id);
      
      // Handle the full device response format
      if (response.result && (response.result as { status?: Array<{ code: string; value: boolean }> }).status) {
        const switchStatus = (response.result as { status: Array<{ code: string; value: boolean }> }).status.find(s => s.code === 'switch_1');
        
        if (switchStatus) {
          setIsOn(switchStatus.value);
          setIsOnline((response.result as { online?: boolean }).online ?? false);
        } else {
          setIsOnline(false);
        }
      } else {
        setIsOnline(false);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch device status:', error);
      setIsOnline(false);
      // Show error details in UI
      if (error instanceof Error) {
        setError(error.message);
        console.log('Error details:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = async () => {
    if (loading || !isOnline) return;
    
    setLoading(true);
    try {
      if (isOn) {
        await tuyaAPI.turnOff(currentDevice.id);
        setIsOn(false);
      } else {
        await tuyaAPI.turnOn(currentDevice.id);
        setIsOn(true);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to toggle device:', error);
      await fetchDeviceStatus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      // Reset state when device changes
      setIsOnline(null);
      setIsOn(null);
      setError(null);
      fetchDeviceStatus();
    }
  }, [mounted, selectedDevice]);

  useEffect(() => {
    if (mounted) {
      const interval = setInterval(fetchDeviceStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [mounted, selectedDevice]);

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Device Status</h2>
        <button
          onClick={fetchDeviceStatus}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          <Wifi size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Device Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Device:</label>
        <select 
          value={selectedDevice} 
          onChange={(e) => setSelectedDevice(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
        >
          {DEVICES.map((device, index) => (
            <option key={device.id} value={index}>
              {device.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <currentDevice.icon size={24} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">{currentDevice.name}</h3>
                <p className="text-xs text-gray-500 font-mono">{currentDevice.id}</p>
                <p className="text-sm text-gray-600" suppressHydrationWarning={true}>
                  {error ? 'Error' : isOnline === null ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {isOnline === null ? (
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                ) : isOnline ? (
                  <Wifi size={16} className="text-green-500" />
                ) : (
                  <WifiOff size={16} className="text-red-500" />
                )}
              </div>

              <button
                onClick={toggleDevice}
                disabled={loading || !isOnline}
                className={`
                  p-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  ${isOn 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                <Power size={20} />
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                isOn === null ? 'text-gray-600' : 
                isOn ? 'text-green-600' : 'text-red-600'
              }`} suppressHydrationWarning={true}>
                {isOn === null ? 'Unknown' : isOn ? 'ON' : 'OFF'}
              </span>
            </div>
            
            {error && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-red-500">Error:</span>
                <span className="text-red-600 text-xs">
                  {error}
                </span>
              </div>
            )}
            
            {lastUpdated && !error && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Last updated:</span>
                <span className="text-gray-600" suppressHydrationWarning={true}>
                  {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Test</h3>
        <div className="flex gap-2">
          <button
            onClick={() => tuyaAPI.turnOn(currentDevice.id).then(() => fetchDeviceStatus())}
            disabled={loading || !isOnline}
            className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Turn ON
          </button>
          <button
            onClick={() => tuyaAPI.turnOff(currentDevice.id).then(() => fetchDeviceStatus())}
            disabled={loading || !isOnline}
            className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Turn OFF
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeviceStatusClient;
