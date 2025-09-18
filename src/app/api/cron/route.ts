import { NextRequest, NextResponse } from '@/app/api/scheduler/route';

// Simple endpoint for external cron services that can't send headers
export async function GET(request: NextRequest) {
  // Just call the main scheduler without auth
  return await import('@/app/api/scheduler/route').then(module => module.GET(request));
}
