const http = require('http');

function post(path, bodyData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyData);
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function run() {
  console.log('=== STARTING CHAT INTEGRATION TEST (PORT 3002) ===');
  
  try {
    // 1. Create a session
    console.log('\n1. Creating Chat Session...');
    const sessionRes = await post('/api/chat/session', {
      report_id: 'test-report-abc',
      engine_type: 'usg',
      context_metadata: {
        partner_A: {
          raw_data: {
            liver: "Fatty Liver Grade 1",
            kidneys: "Normal size and echo pattern"
          }
        }
      }
    });
    
    console.log('Session Status:', sessionRes.statusCode);
    console.log('Session Data:', JSON.stringify(sessionRes.data, null, 2));
    
    if (!sessionRes.data || !sessionRes.data.success) {
      throw new Error('Failed to create session');
    }
    
    const sessionId = sessionRes.data.sessionId;
    
    // 2. Send a message
    console.log('\n2. Sending Chat Message...');
    const messageRes = await post('/api/chat/message', {
      sessionId: sessionId,
      message: 'Hello! Please review my ultrasound report and tell me what the fatty liver finding means, simply.'
    });
    
    console.log('Message Status:', messageRes.statusCode);
    console.log('Message Reply:', JSON.stringify(messageRes.data, null, 2));
    
    // 3. Get history
    console.log('\n3. Fetching Chat History...');
    const historyRes = await get(`/api/chat/session/${sessionId}/history`);
    console.log('History Status:', historyRes.statusCode);
    console.log('History Messages:', JSON.stringify(historyRes.data, null, 2));
    
    console.log('\n=== CHAT INTEGRATION TEST COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

run();
