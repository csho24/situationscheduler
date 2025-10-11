// Web Worker for interval mode timer
let intervalId = null;
let currentPeriod = 'ON';
let lastCommandTime = 0;
let onCountdown = 0;
let offCountdown = 0;
let onDuration = 0;
let intervalDuration = 0;
let startTime = 0;
let heartbeatCounter = 0; // Counter for heartbeat updates

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  if (type === 'START_INTERVAL') {
    const { onDuration: newOnDuration, intervalDuration: newIntervalDuration, startTime: newStartTime, resumeMode, cyclePosition } = data;
    
    // Store the parameters
    onDuration = newOnDuration;
    intervalDuration = newIntervalDuration;
    startTime = newStartTime;
    
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🔄 Web Worker: Starting interval mode - ${onDuration}min ON, ${intervalDuration}min OFF`);
    
    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    // Initialize based on whether this is a fresh start or resume
    if (resumeMode && cyclePosition !== undefined) {
      // Resume mode - calculate current state from cycle position
      if (cyclePosition < onDuration * 60) {
        // Currently in ON period
        currentPeriod = 'ON';
        onCountdown = (onDuration * 60) - cyclePosition;
        offCountdown = 0;
        console.log(`[${timestamp}] 🔄 Web Worker: Resuming ON period with ${onCountdown}s remaining`);
      } else {
        // Currently in OFF period
        currentPeriod = 'OFF';
        offCountdown = (intervalDuration * 60) - (cyclePosition - onDuration * 60);
        onCountdown = 0;
        console.log(`[${timestamp}] 🔄 Web Worker: Resuming OFF period with ${offCountdown}s remaining`);
      }
    } else {
      // Fresh start - begin with ON period
      currentPeriod = 'ON';
      onCountdown = onDuration * 60;
      offCountdown = 0;
      console.log(`[${timestamp}] 🔄 Web Worker: Fresh start - ON period for ${onCountdown}s`);
    }
    
    lastCommandTime = 0;
    
    // Start the timer - NO 30-second sync to avoid conflicts
    intervalId = setInterval(() => {
      heartbeatCounter++;
      
      // Send heartbeat every 60 seconds to signal Web Worker is active
      if (heartbeatCounter % 60 === 0) {
        self.postMessage({
          type: 'HEARTBEAT',
          data: { timestamp: Date.now() }
        });
      }
      
      if (currentPeriod === 'ON') {
        onCountdown--;
        
        // Send countdown update every second
        self.postMessage({
          type: 'COUNTDOWN_UPDATE',
          data: {
            period: 'ON',
            countdown: Math.max(0, onCountdown)
          }
        });
        
        if (onCountdown <= 0) {
          const now = Date.now();
          if (now - lastCommandTime > 3000) {
            lastCommandTime = now;
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] 🔄 Web Worker: ON period done (${onDuration}min), switching to OFF period (${intervalDuration}min)`);
            
            currentPeriod = 'OFF';
            offCountdown = intervalDuration * 60;
            
            // Send message to main thread
            self.postMessage({
              type: 'PERIOD_CHANGE',
              data: {
                period: 'OFF',
                countdown: offCountdown,
                command: { device: 'a3cf493448182afaa9rlgw', action: 'ir_power', value: false }
              }
            });
          }
        }
      } else {
        offCountdown--;
        
        // Send countdown update every second
        self.postMessage({
          type: 'COUNTDOWN_UPDATE',
          data: {
            period: 'OFF',
            countdown: Math.max(0, offCountdown)
          }
        });
        
        if (offCountdown <= 0) {
          const now = Date.now();
          if (now - lastCommandTime > 3000) {
            lastCommandTime = now;
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] 🔄 Web Worker: OFF period done (${intervalDuration}min), switching to ON period (${onDuration}min)`);
            
            currentPeriod = 'ON';
            onCountdown = onDuration * 60;
            
            // Send message to main thread
            self.postMessage({
              type: 'PERIOD_CHANGE',
              data: {
                period: 'ON',
                countdown: onCountdown,
                command: { device: 'a3cf493448182afaa9rlgw', action: 'ir_power', value: true }
              }
            });
          }
        }
      }
    }, 1000);
    
  } else if (type === 'STOP_INTERVAL') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
