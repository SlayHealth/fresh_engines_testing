require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const { db } = require('../src/services/storage/postgres.service');

const BASE_URL = 'http://localhost:3001';

async function main() {
  console.log("Starting verification flow tests...");
  
  // 1. Create a dummy user session if not exists, or get one
  const userRes = await db.query("SELECT * FROM users LIMIT 1");
  const user = userRes.rows[0];
  if (!user) {
    console.error("No user found in DB. Run seed data or log in first.");
    return;
  }
  
  const inviterId = user.id;
  console.log(`Using inviter: ${user.name} (${user.phone_number}), ID: ${inviterId}`);
  
  // Seed a report and match for the inviter so background job has a report to compare
  const inviterReportId = 'inviter-test-report-id';
  await db.query(`
    INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [inviterReportId, 'inviter_report.pdf', 'completed', 0.98, JSON.stringify({
    cbc: { hemoglobin: { value: 15.0, unit: 'g/dL', reference_range: '13.5-17.5', confidence: 0.98 } }
  })]);

  await db.query(`
    INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, ['dummy-female-id', 'dummy_female.pdf', 'completed', 0.98, JSON.stringify({})]);
  
  await db.query(`
    INSERT INTO matches (id, user_id, male_report_id, female_report_id, status, compatibility_score)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO NOTHING
  `, ['dummy-match-id', inviterId, inviterReportId, 'dummy-female-id', 'completed', 0.85]);
  
  // 2. Generate a mock JWT for the inviter
  const jwtService = require('../src/services/auth/jwt.service');
  const tokens = jwtService.generateTokens(user.id, user.phone_number);
  const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };
  
  // Test createInvite
  console.log("\n1. Testing createInvite POST /api/invite/send...");
  try {
    const resSend = await axios.post(`${BASE_URL}/api/invite/send`, {
      prospectName: 'Test Partner Prospect',
      prospectPhone: '+919999999999'
    }, { headers: authHeader });
    
    console.log("Create invite response:", resSend.data);
    const token = resSend.data.invite.token;
    const inviteId = resSend.data.invite.id;
    
    // Test validateToken
    console.log("\n2. Testing validateToken GET /api/invite/validate/:token...");
    const resVal = await axios.get(`${BASE_URL}/api/invite/validate/${token}`);
    console.log("Validate token response:", resVal.data);
    
    // Test updateConsent -> Rejected
    console.log("\n3. Testing updateConsent POST /api/invite/consent (Rejected)...");
    const resConsentReject = await axios.post(`${BASE_URL}/api/invite/consent`, {
      token,
      accepted: false
    });
    console.log("Consent reject response:", resConsentReject.data);
    
    // Check invite status in DB
    let inviteRow = await db.query("SELECT status FROM prospect_invites WHERE id = $1", [inviteId]);
    console.log("Status in DB after rejection:", inviteRow.rows[0].status);
    
    // Test updateConsent -> Accepted
    console.log("\n4. Testing updateConsent POST /api/invite/consent (Accepted)...");
    const resConsentAccept = await axios.post(`${BASE_URL}/api/invite/consent`, {
      token,
      accepted: true
    });
    console.log("Consent accept response:", resConsentAccept.data);
    
    inviteRow = await db.query("SELECT status FROM prospect_invites WHERE id = $1", [inviteId]);
    console.log("Status in DB after acceptance:", inviteRow.rows[0].status);
    
    // Test submitQuestionnaire
    console.log("\n5. Testing submitQuestionnaire POST /api/invite/submit...");
    const resSubmit = await axios.post(`${BASE_URL}/api/invite/submit`, {
      token,
      dob: '1995-05-15',
      city: 'Delhi',
      gender: 'Female',
      height: 165,
      weight: 58,
      waist: 28,
      activity_level: 'Active',
      daily_steps: '5,000 - 10,000',
      occupation_style: 'Sitting 4h+',
      drinking_habits: 'Never',
      smoking_habits: 'never',
      tobacco_habits: 'never',
      sleep_cycle: 'Early Bird',
      useMockPathology: 'true',
      useMockRadiology: 'true'
    });
    console.log("Submit questionnaire response:", resSubmit.data);

    // Test runInviteMatch
    console.log("\n6. Testing runInviteMatch POST /api/invite/run-match/:id...");
    const resRunMatch = await axios.post(`${BASE_URL}/api/invite/run-match/${inviteId}`, {}, { headers: authHeader });
    console.log("Run match response:", resRunMatch.data);
    
    // Wait for background analysis job to complete
    console.log("\n7. Waiting 4 seconds for background compatibility job to finish...");
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    inviteRow = await db.query("SELECT status, prospect_user_id FROM prospect_invites WHERE id = $1", [inviteId]);
    console.log("Invite status after background job:", inviteRow.rows[0].status);
    
    const prospectUser = await db.query("SELECT * FROM users WHERE id = $1", [inviteRow.rows[0].prospect_user_id]);
    console.log("Prospect profile details in DB:");
    console.log(`- Name: ${prospectUser.rows[0].name}`);
    console.log(`- DOB: ${prospectUser.rows[0].dob}`);
    console.log(`- City: ${prospectUser.rows[0].city}`);
    console.log(`- Sleep: ${prospectUser.rows[0].sleep_cycle}`);
    
    const matchesCount = await db.query("SELECT COUNT(*) FROM matches WHERE user_id = $1", [inviterId]);
    console.log(`Total matches in DB for inviter: ${matchesCount.rows[0].count}`);
    
  } catch (error) {
    console.error("Error running verification:", error.response ? error.response.data : error.message);
  } finally {
    process.exit(0);
  }
}

main();
