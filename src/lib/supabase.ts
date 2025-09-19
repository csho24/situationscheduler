import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://yrlvnshydrmhsvfqesnv.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybHZuc2h5ZHJtaHN2ZnFlc252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNjgwODgsImV4cCI6MjA3Mzg0NDA4OH0.DxGxkIX783bvZ6ClcCq_o-ueY4viCrSWZA5OEw-xc0M'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface CalendarAssignment {
  id: number
  date: string
  situation: 'work' | 'rest'
  created_at: string
  updated_at: string
}

export interface DeviceSchedule {
  id: number
  device_id: string
  situation: 'work' | 'rest'
  time: string
  action: 'on' | 'off'
  created_at: string
  updated_at: string
}

export interface ManualOverride {
  id: number
  device_id: string
  until_timestamp: string
  set_at: string
  created_at: string
}

export interface ExecutionLog {
  id: number
  device_id: string
  action: 'on' | 'off'
  scheduled_time: string
  executed_at: string
  success: boolean
  error_message?: string
}
