'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Clock, Save } from 'lucide-react';
// import { DEFAULT_SCHEDULES, type SituationType, type ScheduleEntry } from '@/lib/scheduler';
import { type SituationType, type ScheduleEntry } from '@/lib/scheduler';

interface ScheduleEditorProps {
  situation: SituationType;
  currentSchedule: ScheduleEntry[];
  onSave: (situation: SituationType, schedule: ScheduleEntry[]) => void;
  onCancel: () => void;
}

export default function ScheduleEditor({ situation, currentSchedule, onSave, onCancel }: ScheduleEditorProps) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([...currentSchedule]);

  const addEntry = () => {
    setSchedule([...schedule, { time: '09:00', action: 'on' }]);
  };

  const removeEntry = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ScheduleEntry, value: string) => {
    const newSchedule = [...schedule];
    if (field === 'action') {
      newSchedule[index][field] = value as 'on' | 'off';
    } else {
      newSchedule[index][field] = value;
    }
    setSchedule(newSchedule);
  };

  const handleSave = () => {
    // Sort by time to keep schedule in order
    const sortedSchedule = [...schedule].sort((a, b) => a.time.localeCompare(b.time));
    onSave(situation, sortedSchedule);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            Edit {situation} Day Schedule
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-800 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3 mb-4">
          {schedule.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
              <Clock size={16} className="text-gray-600" />
              
              <input
                type="time"
                value={entry.time}
                onChange={(e) => updateEntry(index, 'time', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              
              <select
                value={entry.action}
                onChange={(e) => updateEntry(index, 'action', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="on">Turn ON</option>
                <option value="off">Turn OFF</option>
              </select>
              
              <button
                onClick={() => removeEntry(index)}
                className="p-1 text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={addEntry}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
            >
              <Plus size={16} />
              Add Time
            </button>
          </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex gap-2 p-6 pt-4 border-t bg-gray-50">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Save size={16} />
            Save Schedule
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
