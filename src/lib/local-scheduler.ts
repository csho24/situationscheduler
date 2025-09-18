// Local development scheduler
// This runs a client-side interval ONLY for development
// Production uses Vercel cron jobs

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startLocalScheduler() {
  // Only run in browser (client-side)
  if (typeof window === 'undefined') {
    return;
  }
  
  // Check if we're in development by looking for localhost
  const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isDevelopment) {
    console.log('🚀 Production mode: Using Vercel cron jobs');
    return;
  }
  
  if (isRunning) {
    console.log('⚠️ Local scheduler already running');
    return;
  }
  
  console.log('🔄 Starting local development scheduler (60-second intervals)');
  isRunning = true;
  
  // Run immediately, then every 60 seconds
  executeSchedulerCheck();
  
  schedulerInterval = setInterval(() => {
    executeSchedulerCheck();
  }, 60000); // 60 seconds
}

export function stopLocalScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('🛑 Local scheduler stopped');
  }
}

async function executeSchedulerCheck() {
  try {
    console.log(`🔍 LOCAL SCHEDULER: Executing check at ${new Date().toLocaleTimeString()}`);
    
    const response = await fetch('/api/cron/scheduler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.executed && result.executed.length > 0) {
      console.log(`✅ LOCAL SCHEDULER: Executed actions:`, result.executed);
    } else {
      console.log(`⏰ LOCAL SCHEDULER: No actions needed at this time`);
    }
    
  } catch (error) {
    console.error('❌ LOCAL SCHEDULER: Error executing schedule check:', error);
  }
}

// Note: Auto-start is handled in the main component to ensure proper lifecycle management
