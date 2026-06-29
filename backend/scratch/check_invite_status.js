require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db } = require('../src/services/storage/postgres.service');

async function main() {
  try {
    const res = await db.query("SELECT * FROM prospect_invites ORDER BY created_at DESC LIMIT 5");
    console.log("Latest invites in DB:");
    res.rows.forEach(r => {
      console.log(`- ID: ${r.id}`);
      console.log(`  Name: ${r.prospect_name}`);
      console.log(`  Phone: ${r.prospect_phone}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Token: ${r.token}`);
      console.log(`  Msg ID: ${r.whatsapp_message_id}`);
      console.log(`  Created: ${r.created_at}`);
      console.log("------------------------");
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
