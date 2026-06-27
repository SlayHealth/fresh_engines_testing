require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { db, initDB } = require('../../src/services/storage/postgres.service');

async function run() {
  await initDB();
  console.log('Deleting pre-seeded radiology reports matching Sachin or Swati...');
  
  // Delete from radiology_reports
  const delRad = await db.query(
    `DELETE FROM radiology_reports 
     WHERE LOWER(patient_slay_id) IN ('sachin', 'swati')`
  );
  console.log(`Deleted ${delRad.rowCount} rows from radiology_reports.`);

  // Delete from usg_reports
  const delUsg = await db.query(
    `DELETE FROM usg_reports 
     WHERE LOWER(patient_slay_id) IN ('sachin', 'swati', '58102')`
  );
  console.log(`Deleted ${delUsg.rowCount} rows from usg_reports.`);

  console.log('Successfully cleaned up database.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
