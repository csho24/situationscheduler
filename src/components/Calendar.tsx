'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, BriefcaseIcon, Coffee, Lightbulb, Laptop, Usb } from 'lucide-react';
import { serverScheduler, type SituationType } from '@/lib/server-scheduler';

const DEVICES = [
  { id: 'a3e31a88528a6efc15yf4o', name: 'Lights', icon: Lightbulb, app: 'a3e31a88528a6efc15yf4o' },
  { id: 'a34b0f81d957d06e4aojr1', name: 'Laptop', icon: Laptop, app: 'a34b0f81d957d06e4aojr1' },
  { id: 'a3240659645e83dcfdtng7', name: 'USB Hub', icon: Usb, app: 'a3240659645e83dcfdtng7' }
];

interface CalendarProps {
  onDateSelect?: (date: Date, situation: SituationType) => void;
  customRoutines?: string[];
}

export default function Calendar({ onDateSelect, customRoutines = [] }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showSituationModal, setShowSituationModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]); // Default to lights
  const [schedules, setSchedules] = useState(serverScheduler.getAllSchedules());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load schedules from server to get latest data
    const loadSchedules = async () => {
      try {
        const response = await fetch('/api/schedules');
        const data = await response.json();
        if (data.success && data.calendarAssignments) {
          setSchedules(data.calendarAssignments);
        } else {
          // Fallback to local scheduler
          setSchedules(serverScheduler.getAllSchedules());
        }
      } catch (error) {
        console.error('Failed to load schedules:', error);
        // Fallback to local scheduler
        setSchedules(serverScheduler.getAllSchedules());
      }
    };
    loadSchedules();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate leading empty cells to align first day with correct weekday (Monday = 0)
  const startDayOfWeek = monthStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const leadingEmptyCells = Array(startDayOfWeek === 0 ? 6 : startDayOfWeek - 1).fill(null);

  const handleDateClick = (date: Date) => {
    // Use Singapore timezone to match cron logic
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
    today.setHours(0, 0, 0, 0);
    
    if (date >= today) {
      setSelectedDate(date);
      setShowSituationModal(true);
    }
  };

  const handleSituationSelect = async (situation: SituationType) => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      // Save original state for rollback
      const originalSchedules = [...schedules];
      
      // Update local state immediately for responsive UI
      let updatedSchedules;
      const existingIndex = schedules.findIndex(s => s.date === dateString);
      
      if (existingIndex >= 0) {
        // Update existing assignment
        updatedSchedules = [...schedules];
        updatedSchedules[existingIndex] = { date: dateString, situation };
      } else {
        // Add new assignment
        updatedSchedules = [...schedules, { date: dateString, situation }];
      }
      
      setSchedules(updatedSchedules);
      
      // Try to sync to server (with retry logic)
      try {
        await serverScheduler.setSituation(dateString, situation);
        
        // Success! Reload from server to confirm
        try {
          const response = await fetch('/api/schedules');
          const data = await response.json();
          if (data.success && data.calendarAssignments) {
            setSchedules(data.calendarAssignments);
            console.log('📅 Calendar: Reloaded from server after update');
          }
        } catch (reloadError) {
          console.error('📅 Calendar: Error reloading from server:', reloadError);
        }
        
        onDateSelect?.(selectedDate, situation);
        setShowSituationModal(false);
        setSelectedDevice(DEVICES[0]); // Reset to default
        setSelectedDate(null);
        
      } catch (saveError) {
        // All retries failed - revert UI to original state
        console.error('❌ Calendar save failed, reverting UI:', saveError);
        setSchedules(originalSchedules);
        alert('Failed to save calendar assignment. Please check your internet connection and try again.');
      }
    }
  };

  const getSituationForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return schedules.find(s => s.date === dateString);
  };

  const isPastDate = (date: Date) => {
    // Use Singapore timezone to match cron logic
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Singapore"}));
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        
        <h2 className="text-xl font-semibold text-gray-800">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-700 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {leadingEmptyCells.map((_, index) => (
          <div key={`empty-${index}`} className="p-3"></div>
        ))}
        
        {/* Actual month days */}
        {monthDays.map((date) => {
          const situation = getSituationForDate(date);
          // Use Singapore timezone to match cron logic
          const singaporeToday = isClient ? new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Singapore"})) : new Date();
          const isToday = isClient ? isSameDay(date, singaporeToday) : false;
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
                ${situation?.situation && !['work', 'rest'].includes(situation.situation) ? 'ring-blue-500 bg-blue-50' : ''}
              `}
            >
              <span className="block">{format(date, 'd')}</span>
              {situation && (
                <div className="absolute bottom-1 right-1">
                  {situation.situation === 'work' ? (
                    <BriefcaseIcon size={12} className="text-green-600" />
                  ) : situation.situation === 'rest' ? (
                    <Coffee size={12} className="text-yellow-600" />
                  ) : (
                    <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
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
            <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">
              {format(selectedDate, 'MMMM d, EEE')}
            </h3>
            
            {/* Device Selector removed for simplicity */}
            
            <div className="space-y-3">
              <button
                onClick={() => handleSituationSelect('work')}
                className="w-full p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer"
              >
                <BriefcaseIcon size={20} className="text-green-600" />
                <div className="font-medium text-green-800">Work Day</div>
              </button>
              
              <button
                onClick={() => handleSituationSelect('rest')}
                className="w-full p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer"
              >
                <Coffee size={20} className="text-yellow-600" />
                <div className="font-medium text-yellow-800">Rest Day</div>
              </button>
              
              {customRoutines.map(routine => (
                <button
                  key={routine}
                  onClick={() => handleSituationSelect(routine)}
                  className="w-full p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer"
                >
                  <div className="w-5 h-5 bg-blue-600 rounded-full"></div>
                  <div className="font-medium text-blue-800">{routine}</div>
                </button>
              ))}
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
        <div className="flex items-center gap-4 text-sm text-gray-800 flex-wrap">
          <div className="flex items-center gap-1">
            <BriefcaseIcon size={12} className="text-green-600" />
            <span>Work Day</span>
          </div>
          <div className="flex items-center gap-1">
            <Coffee size={12} className="text-yellow-600" />
            <span>Rest Day</span>
          </div>
          {customRoutines.map(routine => (
            <div key={routine} className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span>{routine}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
