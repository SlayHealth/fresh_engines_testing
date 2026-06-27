require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { db } = require('../../src/services/storage/postgres.service');

async function run() {
  try {
    const res = await db.query('SELECT id, created_at FROM matches ORDER BY created_at DESC LIMIT 5');
    console.log('MATCHES IN DATABASE:');
    console.log(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Database query failed:', err);
    process.exit(1);
  }
}

run();
