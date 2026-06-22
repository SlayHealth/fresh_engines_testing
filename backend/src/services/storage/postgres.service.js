const { Pool } = require('pg');
const logger = require('../../utils/logger');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL
  }
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

const db = {
  query: (text, params) => {
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Executing Query: ${text} | Params: ${JSON.stringify(params)}`);
    }
    return pool.query(text, params);
  },
  pool
};

async function initDB() {
  logger.info('Initializing PostgreSQL database schema...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          file_name TEXT,
          upload_timestamp TIMESTAMP,
          processing_status TEXT,
          confidence_score REAL,
          extracted_json TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ocr_pages (
          id SERIAL PRIMARY KEY,
          report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
          page_number INTEGER,
          raw_text TEXT
      );

      CREATE TABLE IF NOT EXISTS extraction_logs (
          id SERIAL PRIMARY KEY,
          report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
          step TEXT,
          message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          male_report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
          female_report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,
          status TEXT,
          compatibility_score REAL,
          analysis_json TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS usg_reports (
          id TEXT PRIMARY KEY,
          patient_slay_id TEXT,
          extracted_json TEXT,
          analyzed_results TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          report_id TEXT,
          partner_report_id TEXT,
          engine_type TEXT NOT NULL,
          context_metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          phone_number TEXT UNIQUE NOT NULL,
          name TEXT,
          gender TEXT,
          dob TEXT,
          city TEXT,
          activity_level TEXT,
          daily_steps TEXT,
          occupation_style TEXT,
          drinking_habits TEXT,
          smoking_habits TEXT,
          tobacco_habits TEXT,
          sleep_cycle TEXT,
          height REAL,
          weight REAL,
          waist REAL,
          runs_used INTEGER DEFAULT 0,
          chats_used INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes if they don't exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_usg_reports_patient_slay_id ON usg_reports(patient_slay_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
    `);

    logger.info('Database schema successfully initialized.');
  } catch (error) {
    logger.error('Database schema initialization failed:', error);
    throw error;
  }
}

async function cleanupOldReports() {
  try {
    const result = await pool.query("DELETE FROM reports WHERE created_at < NOW() - INTERVAL '1 day'");
    logger.info(`Cleaned up old reports. Removed rows: ${result.rowCount}`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to cleanup old reports:', error);
    throw error;
  }
}

module.exports = {
  db,
  initDB,
  cleanupOldReports
};
