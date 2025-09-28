import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ACCESS_ID = 'enywhg3tuc4nkjuc4tfk';
const SECRET = '0ef25f248d1f43828b829f2712f93573';
const BASE_URL = 'https://openapi-sg.iotbing.com'; // Correct Singapore endpoint

function generateTokenSignature(timestamp: string, body: string = ''): { headers: Record<string, string> } {
  const stringToSign = `${ACCESS_ID}${timestamp}GET\n${crypto.createHash('sha256').update(body).digest('hex')}\n\n/v1.0/token?grant_type=1`;
  const signature = crypto.createHmac('sha256', SECRET).update(stringToSign).digest('hex').toUpperCase();
  
  return {
    headers: {
      't': timestamp,
      'sign_method': 'HMAC-SHA256',
      'client_id': ACCESS_ID,
      'sign': signature,
      'Content-Type': 'application/json'
    }
  };
}

function generateBusinessSignature(
  method: string, 
  path: string, 
  timestamp: string, 
  accessToken: string, 
  body: string = ''
): { headers: Record<string, string> } {
  const stringToSign = `${method}\n${crypto.createHash('sha256').update(body).digest('hex')}\n\n${path}`;
  const signature = crypto.createHmac('sha256', SECRET).update(`${ACCESS_ID}${accessToken}${timestamp}${stringToSign}`).digest('hex').toUpperCase();
  
  return {
    headers: {
      't': timestamp,
      'sign_method': 'HMAC-SHA256',
      'client_id': ACCESS_ID,
      'access_token': accessToken,
      'sign': signature,
      'Content-Type': 'application/json'
    }
  };
}

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const timestamp = Date.now().toString();
  const { headers } = generateTokenSignature(timestamp);
  
  const tokenResponse = await fetch(`${BASE_URL}/v1.0/token?grant_type=1`, {
    method: 'GET',
    headers,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token request failed:', tokenResponse.status, errorText);
    throw new Error(`Token request failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log('Token response:', tokenData);
  
  if (!tokenData.success) {
    throw new Error(`Token request failed: ${tokenData.msg}`);
  }

  const expiresIn = tokenData.result.expire_time * 1000; // Convert to milliseconds
  cachedToken = {
    token: tokenData.result.access_token,
    expires: Date.now() + expiresIn - 60000 // Refresh 1 minute early
  };

  return cachedToken.token;
}

async function makeTuyaRequest(method: string, path: string, body?: unknown): Promise<Response> {
  const timestamp = Date.now().toString();
  
  if (path.includes('/token')) {
    const { headers } = generateTokenSignature(timestamp, body ? JSON.stringify(body) : '');
    
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } else {
    const accessToken = await getAccessToken();
    const { headers } = generateBusinessSignature(method, path, timestamp, accessToken, body ? JSON.stringify(body) : '');
    
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const action = searchParams.get('action');
    const category = searchParams.get('category');

    console.log('GET request:', { deviceId, action, category });

    if (!deviceId || !action) {
      return NextResponse.json({ error: 'Missing deviceId or action' }, { status: 400 });
    }

    if (action === 'status') {
      const response = await makeTuyaRequest('GET', `/v1.0/devices/${deviceId}`);
      const responseText = await response.text();
      
      console.log('Device status response:', response.status, responseText);
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to get device status', 
          details: responseText,
          status: response.status 
        }, { status: 500 });
      }

      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    }

    if (action === 'timer.list') {
      if (!category) {
        return NextResponse.json({ error: 'Missing category for timer query' }, { status: 400 });
      }

      const response = await makeTuyaRequest('GET', `/v1.0/devices/${deviceId}/timers?category=${category}`);
      const responseText = await response.text();
      
      console.log('Query timers response:', response.status, responseText);
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to query timers', 
          details: responseText,
          status: response.status 
        }, { status: 500 });
      }

      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, action, value, timerData } = body;

    console.log('POST request:', { deviceId, action, value, timerData });

    if (!deviceId || !action) {
      return NextResponse.json({ error: 'Missing deviceId or action' }, { status: 400 });
    }

    // Handle device control commands
    if (action === 'switch_1' || action === 'switch') {
      const commands = [{ code: action, value }];
      const response = await makeTuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
      const responseText = await response.text();
      
      console.log('Device control response:', response.status, responseText);
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to control device', 
          details: responseText,
          status: response.status 
        }, { status: 500 });
      }
      
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    }

    // IR Aircon Power and setup sequence (standard command endpoint)
    // Uses constants captured from user's IR remote binding
    if (action === 'ir_power') {
      const irDeviceId = '5810306084f3ebc188ed';
      const remoteId = 'a3cf493448182afaa9rlgw';
      const categoryId = 5;
      const brandId = 2782;
      const remoteIndex = 2997;
      const keyId = 0;

      // Helper to send a single standard command
      const sendStandard = async (payload: Record<string, unknown>) => {
        // Use v2.0 command endpoint as confirmed in Tuya Explorer
        const path = `/v2.0/infrareds/${irDeviceId}/remotes/${remoteId}/command`;
        const response = await makeTuyaRequest('POST', path, payload);
        const responseText = await response.text();
        console.log('IR standard command response:', response.status, responseText);
        if (!response.ok) {
          throw new Error(`IR command failed: ${response.status} ${responseText}`);
        }
        return JSON.parse(responseText);
      };

      const sendRaw = async (payload: Record<string, unknown>) => {
        const path = `/v2.0/infrareds/${irDeviceId}/remotes/${remoteId}/raw/command`;
        const response = await makeTuyaRequest('POST', path, payload);
        const responseText = await response.text();
        console.log('IR raw command response:', response.status, responseText);
        if (!response.ok) {
          throw new Error(`IR raw command failed: ${response.status} ${responseText}`);
        }
        return JSON.parse(responseText);
      };

      const sendScene = async (payload: Record<string, unknown>) => {
        const path = `/v2.0/infrareds/${irDeviceId}/air-conditioners/${remoteId}/scenes/command`;
        const response = await makeTuyaRequest('POST', path, payload);
        const responseText = await response.text();
        console.log('IR scene command response:', response.status, responseText);
        if (!response.ok) {
          throw new Error(`IR scene command failed: ${response.status} ${responseText}`);
        }
        return JSON.parse(responseText);
      };

      try {
        if (value) {
          // Combined-state: set power/mode/temp/wind in one call (cool, 26°C, fan 2)
          const result = await sendScene({
            power: 1,
            mode: 0,
            temp: 26,
            wind: 2
          });
          return NextResponse.json(result);
        } else {
          const result = await sendStandard({
            category_id: categoryId,
            key: 'PowerOff',
            key_id: keyId
          });
          return NextResponse.json(result);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
          error: 'Failed to send IR command(s)',
          details: message,
          status: 500,
        }, { status: 500 });
      }
    }

    // Handle timer creation
    if (action === 'timer.add') {
      if (!timerData) {
        return NextResponse.json({ error: 'Missing timer data' }, { status: 400 });
      }

      const timerPayload = {
        instruct: [
          {
            time: timerData.time,
            functions: [
              {
                code: "switch_1",
                value: timerData.action === 'on'
              }
            ]
          }
        ],
        loops: timerData.loops || '0000000',
        category: timerData.category || 'schedule',
        timezone_id: "America/New_York", // Adjust as needed
        time_zone: "-05:00", // Adjust as needed
        alias_name: timerData.aliasName || `${timerData.action} at ${timerData.time}`
      };

      console.log('Creating timer with payload:', timerPayload);

      const response = await makeTuyaRequest('POST', `/v1.0/devices/${deviceId}/timers`, timerPayload);
      const responseText = await response.text();
      
      console.log('Add timer response:', response.status, responseText);
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to create timer', 
          details: responseText,
          status: response.status 
        }, { status: 500 });
      }

      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    }

    // Handle timer deletion
    if (action === 'timer.delete') {
      if (!timerData?.timerId) {
        return NextResponse.json({ error: 'Missing timer ID' }, { status: 400 });
      }

      const response = await makeTuyaRequest('DELETE', `/v1.0/devices/${deviceId}/timers/${timerData.timerId}`);
      const responseText = await response.text();
      
      console.log('Delete timer response:', response.status, responseText);
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to delete timer', 
          details: responseText,
          status: response.status 
        }, { status: 500 });
      }

      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const timerId = searchParams.get('timerId');

    console.log('DELETE request:', { deviceId, timerId });

    if (!deviceId || !timerId) {
      return NextResponse.json({ error: 'Missing deviceId or timerId' }, { status: 400 });
    }

    const response = await makeTuyaRequest('DELETE', `/v1.0/devices/${deviceId}/timers/${timerId}`);
    const responseText = await response.text();
    
    console.log('Delete timer response:', response.status, responseText);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to delete timer', 
        details: responseText,
        status: response.status 
      }, { status: 500 });
    }

    const data = JSON.parse(responseText);
    return NextResponse.json(data);
  } catch (error) {
    console.error('DELETE Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
