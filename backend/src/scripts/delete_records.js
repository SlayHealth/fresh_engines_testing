const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res1 = await pool.query("DELETE FROM radiology_reports WHERE LOWER(patient_slay_id) = 'sachin' OR LOWER(patient_slay_id) = 'swati'");
    console.log(`Deleted ${res1.rowCount} rows from radiology_reports.`);
    const res2 = await pool.query("DELETE FROM usg_reports WHERE LOWER(patient_slay_id) = 'sachin' OR LOWER(patient_slay_id) = 'swati'");
    console.log(`Deleted ${res2.rowCount} rows from usg_reports.`);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
