// Web Worker for interval mode timer
let intervalId = null;
let currentPeriod = 'ON';
let lastCommandTime = 0;
let onCountdown = 0;
let offCountdown = 0;

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  if (type === 'START_INTERVAL') {
    const { onDuration, intervalDuration, startTime } = data;
    
    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    currentPeriod = 'ON';
    lastCommandTime = 0;
    onCountdown = onDuration * 60;
    offCountdown = 0;
    
    // Start the timer
    intervalId = setInterval(() => {
      if (currentPeriod === 'ON') {
        onCountdown--;
        if (onCountdown <= 0) {
          const now = Date.now();
          if (now - lastCommandTime > 3000) {
            lastCommandTime = now;
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
        if (offCountdown <= 0) {
          const now = Date.now();
          if (now - lastCommandTime > 3000) {
            lastCommandTime = now;
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
