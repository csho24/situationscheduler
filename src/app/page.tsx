'use client';

import React, { useState } from 'react';
import { Calendar, Settings, Laptop, Edit, Plus } from 'lucide-react';
import CalendarComponent from '@/components/Calendar';
import ScheduleEditor from '@/components/ScheduleEditor';
import dynamic from 'next/dynamic';

const DeviceStatus = dynamic(() => import('@/components/DeviceStatus'), {
  ssr: false,
  loading: () => <div className="text-center p-8">Loading device status...</div>
});
import { scheduler, type SituationType, DEFAULT_SCHEDULES, type ScheduleEntry } from '@/lib/scheduler';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'status' | 'settings'>('calendar');
  const [notification, setNotification] = useState<string | null>(null);
  const [editingSituation, setEditingSituation] = useState<SituationType | null>(null);
  const [todayInfo, setTodayInfo] = useState(scheduler.getTodayScheduleInfo());
  const [customSchedules, setCustomSchedules] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom-schedules');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_SCHEDULES;
        }
      }
    }
    return DEFAULT_SCHEDULES;
  });

  // Update scheduler with custom schedules on load
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      scheduler.updateCustomSchedules(customSchedules);
      setTodayInfo(scheduler.getTodayScheduleInfo());
    }
  }, [customSchedules]);

  const handleDateSelect = (date: Date, situation: SituationType) => {
    const dateString = date.toLocaleDateString();
    setNotification(`Set ${dateString} as ${situation} day`);
    setTimeout(() => setNotification(null), 3000);
  };

  const executeToday = async () => {
    try {
      await scheduler.executeToday();
      setNotification('Today\'s schedule executed successfully!');
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification('Failed to execute today\'s schedule');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const scheduleToday = (situation: SituationType) => {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    scheduler.setSituation(dateString, situation, 'a3e31a88528a6efc15yf4o'); // Smart Life device that works
    setTodayInfo(scheduler.getTodayScheduleInfo());
    setNotification(`Today scheduled as ${situation} day - auto-execution active!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveSchedule = (situation: SituationType, schedule: ScheduleEntry[]) => {
    const newSchedules = {
      ...customSchedules,
      [situation]: schedule
    };
    setCustomSchedules(newSchedules);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('custom-schedules', JSON.stringify(newSchedules));
    }
    
    // Update the scheduler to use new custom schedules
    scheduler.updateCustomSchedules(newSchedules);
    setTodayInfo(scheduler.getTodayScheduleInfo());
    
    setEditingSituation(null);
    setNotification(`${situation} schedule updated and activated!`);
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
              <button
                onClick={executeToday}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                title="Force immediate execution of all scheduled actions for today"
              >
                Force Run All
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
              { id: 'status', label: 'Device Status', icon: Laptop },
              { id: 'settings', label: 'Settings', icon: Settings },
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
            <DeviceStatus />
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
            
            <div className="max-w-lg mx-auto space-y-6">
              {/* Work Day Schedule */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Work Day Schedule
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
                  {customSchedules.work.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center py-2">
                      <span className="text-gray-600">{entry.time}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.action === 'on' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Turn {entry.action.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rest Day Schedule */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Rest Day Schedule
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
                  {customSchedules.rest.map((entry, index) => (
                    <div key={index} className="flex justify-between items-center py-2">
                      <span className="text-gray-600">{entry.time}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.action === 'on' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        Turn {entry.action.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Routine Button */}
              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={() => {
                    setNotification('Custom routines coming soon! For now, edit existing schedules.');
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-colors"
                >
                  <Plus size={20} />
                  Add Custom Routine
                </button>
              </div>

              {/* Device Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Connected Devices</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Laptop size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">Laptop Plug</div>
                        <div className="text-sm text-gray-600">ID: a34b0f81d957d06e4aojr1</div>
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Schedule Editor Modal */}
      {editingSituation && (
        <ScheduleEditor
          situation={editingSituation}
          currentSchedule={customSchedules[editingSituation]}
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