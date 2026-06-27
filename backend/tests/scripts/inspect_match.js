require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { db, initDB } = require('../../src/services/storage/postgres.service');

async function run() {
  await initDB();
  console.log('Querying radiology_reports...');
  const radRes = await db.query('SELECT id, patient_slay_id, sex, age, modalities_detected, created_at FROM radiology_reports ORDER BY created_at DESC LIMIT 10');
  console.log('RADIOLOGY REPORTS:', radRes.rows);

  console.log('Querying usg_reports...');
  const usgRes = await db.query('SELECT id, patient_slay_id, created_at FROM usg_reports ORDER BY created_at DESC LIMIT 10');
  console.log('USG REPORTS:', usgRes.rows);

  console.log('Querying users...');
  const userRes = await db.query('SELECT id, name, gender FROM users LIMIT 10');
  console.log('USERS:', userRes.rows);

  process.exit(0);
}

run();
