interface TuyaResponse<T = unknown> {
  success: boolean;
  result?: T;
  code?: number;
  msg?: string;
}

// interface DeviceStatus {
//   code: string;
//   value: boolean;
// }

export class TuyaAPI {
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<TuyaResponse<T>> {
    // Use absolute base when running on the server so internal fetches resolve correctly
    const base = typeof window === 'undefined'
      ? (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001')
      : '';
    const sanitizedBase = base.replace(/\/$/, '');
    const url = endpoint.startsWith('?')
      ? `${sanitizedBase}/api/tuya${endpoint}`
      : `${sanitizedBase}/api/tuya/${endpoint}`;
    
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
    // First attempt as provided (e.g., switch_1)
    let response = await this.makeRequest('POST', '', body);
    if (response.success) {
      return true;
    }
    // Fallback for devices that use generic 'switch' code (e.g., some IR/virtual devices)
    if (action === 'switch_1') {
      const fallbackBody = { deviceId, action: 'switch', value };
      response = await this.makeRequest('POST', '', fallbackBody);
      if (response.success) {
        return true;
      }
    }
    throw new Error(`Failed to control device: ${response.msg}`);
  }

  async turnOn(deviceId: string): Promise<boolean> {
    // Special case: Aircon via IR blaster uses IR power command
    if (deviceId === 'a3cf493448182afaa9rlgw') {
      const result = this.controlDevice(deviceId, 'ir_power', true);
      return result;
    }
    const result = this.controlDevice(deviceId, 'switch_1', true);
    return result;
  }

  async turnOff(deviceId: string): Promise<boolean> {
    if (deviceId === 'a3cf493448182afaa9rlgw') {
      const result = this.controlDevice(deviceId, 'ir_power', false);
      return result;
    }
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
  }): Promise<unknown> {
    const body = { 
      deviceId, 
      action: 'timer.add',
      timerData
    };
    
    const response = await this.makeRequest('POST', '', body);
    return response;
  }

  async queryTimers(deviceId: string, category: string = 'schedule'): Promise<unknown> {
    const response = await this.makeRequest('GET', `?deviceId=${deviceId}&action=timer.list&category=${category}`);
    return response;
  }

  async deleteTimer(deviceId: string, timerId: string): Promise<unknown> {
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
      const response = timersResponse as { success?: boolean; result?: { groups?: Array<{ timers?: unknown[] }> } };
      if (response.success && response.result && response.result.groups) {
        for (const group of response.result.groups) {
          if ((group as { timers?: unknown[] }).timers) {
            for (const timer of (group as { timers: unknown[] }).timers) {
              await this.deleteTimer(deviceId, (timer as { timer_id?: number }).timer_id?.toString() || '');
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
