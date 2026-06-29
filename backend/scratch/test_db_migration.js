require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { initDB, db } = require('../src/services/storage/postgres.service');

async function main() {
  try {
    console.log("Running initDB...");
    await initDB();
    console.log("initDB succeeded. Checking if table prospect_invites exists...");
    
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'prospect_invites';
    `);
    
    if (res.rows.length > 0) {
      console.log("Success! Table 'prospect_invites' exists.");
    } else {
      console.error("Failure: Table 'prospect_invites' was not found.");
    }
  } catch (err) {
    console.error("Migration test failed:", err);
  } finally {
    process.exit(0);
  }
}

main();
