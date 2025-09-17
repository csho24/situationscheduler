interface TuyaResponse<T = unknown> {
  success: boolean;
  result?: T;
  code?: number;
  msg?: string;
}

interface DeviceStatus {
  code: string;
  value: boolean;
}

export class TuyaAPI {
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<TuyaResponse<T>> {
    const url = `/api/tuya${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  async getDeviceStatus(deviceId: string): Promise<TuyaResponse> {
    const response = await this.makeRequest('GET', `?deviceId=${deviceId}&action=status`);
    
    if (!response.success) {
      throw new Error(`Failed to get device status: ${response.msg}`);
    }
    
    return response;
  }

  async controlDevice(deviceId: string, action: string, value: unknown): Promise<boolean> {
    // Add debug logging to track what's calling device control
    console.log(`🔧 DEVICE CONTROL: ${action} = ${value} for device ${deviceId}`);
    console.log(`📍 Call source: ${new Error().stack?.split('\n')[2]?.trim()}`); // Just show immediate caller
    
    const body = { deviceId, action, value };
    
    const response = await this.makeRequest('POST', '', body);
    
    if (!response.success) {
      throw new Error(`Failed to control device: ${response.msg}`);
    }
    
    return true;
  }

  async turnOn(deviceId: string, isManual: boolean = false): Promise<boolean> {
    const result = this.controlDevice(deviceId, 'switch_1', true);
    return result;
  }

  async turnOff(deviceId: string, isManual: boolean = false): Promise<boolean> {
    const result = this.controlDevice(deviceId, 'switch_1', false);
    return result;
  }

  // Cloud Timer Methods
  async addTimer(deviceId: string, timerData: {
    time: string;
    action: 'on' | 'off';
    loops?: string;
    category?: string;
    aliasName?: string;
  }): Promise<any> {
    const body = { 
      deviceId, 
      action: 'timer.add',
      timerData
    };
    
    const response = await this.makeRequest('POST', '', body);
    return response;
  }

  async queryTimers(deviceId: string, category: string = 'schedule'): Promise<any> {
    const response = await this.makeRequest('GET', `?deviceId=${deviceId}&action=timer.list&category=${category}`);
    return response;
  }

  async deleteTimer(deviceId: string, timerId: string): Promise<any> {
    const body = { 
      deviceId, 
      action: 'timer.delete',
      timerData: { timerId }
    };
    const response = await this.makeRequest('POST', '', body);
    return response;
  }

  async deleteAllTimers(deviceId: string, category: string = 'schedule'): Promise<void> {
    try {
      const timersResponse = await this.queryTimers(deviceId, category);
      if (timersResponse.success && timersResponse.result && timersResponse.result.groups) {
        for (const group of timersResponse.result.groups) {
          if (group.timers) {
            for (const timer of group.timers) {
              await this.deleteTimer(deviceId, timer.timer_id.toString());
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete all timers:', error);
    }
  }
}

export const tuyaAPI = new TuyaAPI();
