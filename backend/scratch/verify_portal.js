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

async function run() {
  console.log('=== STARTING PORTAL INTEGRATION TEST (PORT 3002) ===');
  
  try {
    const phoneNumber = '+919999988888';
    
    // 1. Login user
    console.log('\n1. Requesting Login (Mock OTP)...');
    const loginRes = await post('/api/auth/login', { phone_number: phoneNumber });
    console.log('Login Status:', loginRes.statusCode);
    console.log('Login Data:', JSON.stringify(loginRes.data, null, 2));

    // 2. Verify OTP code
    console.log('\n2. Verifying OTP...');
    const verifyRes = await post('/api/auth/verify', { phone_number: phoneNumber, otp: '1234' });
    console.log('Verify Status:', verifyRes.statusCode);
    console.log('Verify Data:', JSON.stringify(verifyRes.data, null, 2));

    if (!verifyRes.data || !verifyRes.data.success) {
      throw new Error('OTP verification failed');
    }

    const user = verifyRes.data.user;
    const userId = user.id;

    // 3. Update profile details
    console.log('\n3. Saving Onboarding Profile...');
    const profileRes = await post('/api/auth/profile', {
      id: userId,
      name: 'Rohan Sharma',
      gender: 'male',
      dob: '1995-04-12',
      city: 'Delhi',
      activity_level: 'Moderate',
      daily_steps: '5,000 - 10,000',
      occupation_style: 'Sitting 8h+',
      drinking_habits: 'Never',
      smoking_habits: 'never',
      tobacco_habits: 'never',
      sleep_cycle: 'Early Bird',
      height: 178,
      weight: 74,
      waist: 32
    });
    console.log('Profile Status:', profileRes.statusCode);
    console.log('Profile Data:', JSON.stringify(profileRes.data, null, 2));

    // 4. Try compatibility match trigger
    console.log('\n4. Attempting Match Trigger (Expecting 400 because reports are missing)...');
    // Since we don't have mock report IDs readily generated here, let's see what happens when we send dummy IDs
    const matchRes = await post('/api/chronic/analyze', {
      userId: userId,
      male_report_id: 'nonexistent-report-m',
      female_report_id: 'nonexistent-report-f'
    });
    console.log('Match Status:', matchRes.statusCode);
    console.log('Match Output:', JSON.stringify(matchRes.data, null, 2));
    
    // 5. Upgrade/Reset Quota test
    console.log('\n5. Testing Reset Quota...');
    const resetRes = await post('/api/auth/reset-quota', { id: userId });
    console.log('Reset Status:', resetRes.statusCode);
    console.log('Reset Data:', JSON.stringify(resetRes.data, null, 2));

    console.log('\n=== PORTAL INTEGRATION TEST COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

run();
