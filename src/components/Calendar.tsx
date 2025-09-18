'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, BriefcaseIcon, Coffee, Lightbulb, Laptop, Usb } from 'lucide-react';
import { serverScheduler, type SituationType } from '@/lib/server-scheduler';

const DEVICES = [
  { id: 'a3e31a88528a6efc15yf4o', name: 'Lights', icon: Lightbulb, app: 'Smart Life' },
  { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop', icon: Laptop, app: 'Smart Life' },
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub', icon: Usb, app: 'Smart Life' }
];

interface CalendarProps {
  onDateSelect?: (date: Date, situation: SituationType) => void;
}

export default function Calendar({ onDateSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showSituationModal, setShowSituationModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]); // Default to lights
  const [schedules, setSchedules] = useState(serverScheduler.getAllSchedules());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSchedules(serverScheduler.getAllSchedules());
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handleDateClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date >= today) {
      setSelectedDate(date);
      setShowSituationModal(true);
    }
  };

  const handleSituationSelect = async (situation: SituationType) => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      await serverScheduler.setSituation(dateString, situation);
      setSchedules(serverScheduler.getAllSchedules());
      onDateSelect?.(selectedDate, situation);
      setShowSituationModal(false);
      setSelectedDevice(DEVICES[0]); // Reset to default
      setSelectedDate(null);
    }
  };

  const getSituationForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return schedules.find(s => s.date === dateString);
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        <h2 className="text-xl font-semibold text-gray-800">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-700 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((date) => {
          const situation = getSituationForDate(date);
          const isToday = isClient ? isSameDay(date, new Date()) : false;
          const isPast = isClient ? isPastDate(date) : false;
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => !isPast && handleDateClick(date)}
              disabled={isPast}
              className={`
                relative p-3 text-sm rounded-lg transition-all duration-200
                ${isPast 
                  ? 'text-gray-300 cursor-not-allowed opacity-50' 
                  : 'hover:bg-blue-50 cursor-pointer text-gray-900'
                }
                ${isToday ? 'bg-blue-100 text-blue-800 font-semibold' : ''}
                ${situation ? 'ring-2 ring-offset-1' : ''}
                ${situation?.situation === 'work' ? 'ring-green-500 bg-green-50' : ''}
                ${situation?.situation === 'rest' ? 'ring-yellow-500 bg-yellow-50' : ''}
              `}
            >
              <span className="block">{format(date, 'd')}</span>
              {situation && (
                <div className="absolute bottom-1 right-1">
                  {situation.situation === 'work' ? (
                    <BriefcaseIcon size={12} className="text-green-600" />
                  ) : (
                    <Coffee size={12} className="text-yellow-600" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Situation Selection Modal */}
      {showSituationModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 max-w-90vw">
            <h3 className="text-lg font-semibold mb-4 text-center">
              Select situation for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            
            {/* Device Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Device:</label>
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
            
            <div className="space-y-3">
              <button
                onClick={() => handleSituationSelect('work')}
                className="w-full p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg transition-colors flex items-center justify-center gap-3"
              >
                <BriefcaseIcon size={20} className="text-green-600" />
                <div className="font-medium text-green-800">Work Day</div>
              </button>
              
              <button
                onClick={() => handleSituationSelect('rest')}
                className="w-full p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 rounded-lg transition-colors flex items-center justify-center gap-3"
              >
                <Coffee size={20} className="text-yellow-600" />
                <div className="font-medium text-yellow-800">Rest Day</div>
              </button>
            </div>
            
            <button
              onClick={() => setShowSituationModal(false)}
              className="w-full mt-4 p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-800 mb-2"></div>
        <div className="flex items-center gap-4 text-sm text-gray-800">
          <div className="flex items-center gap-1">
            <BriefcaseIcon size={12} className="text-green-600" />
            <span>Work Day</span>
          </div>
          <div className="flex items-center gap-1">
            <Coffee size={12} className="text-yellow-600" />
            <span>Rest Day</span>
          </div>
        </div>
      </div>
    </div>
  );
}
