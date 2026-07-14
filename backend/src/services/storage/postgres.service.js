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
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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

      CREATE TABLE IF NOT EXISTS radiology_reports (
          id TEXT PRIMARY KEY,
          patient_slay_id VARCHAR(255),
          sex VARCHAR(10),
          age INTEGER,
          modalities_detected TEXT[],
          findings_json JSONB NOT NULL,
          scores_json JSONB,
          risk_flags_json JSONB,
          raw_ocr_text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

      CREATE TABLE IF NOT EXISTS otp_requests (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          purpose TEXT DEFAULT 'login',
          expires_at TIMESTAMP NOT NULL,
          attempts INTEGER DEFAULT 0,
          used_at TIMESTAMP DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          refresh_token_hash TEXT NOT NULL,
          device_info TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          revoked_at TIMESTAMP DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS prospect_invites (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          prospect_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          prospect_name TEXT NOT NULL,
          prospect_phone TEXT,
          token TEXT UNIQUE NOT NULL,
          whatsapp_message_id TEXT,
          status TEXT DEFAULT 'created',
          consent_timestamp TIMESTAMP DEFAULT NULL,
          consent_ip TEXT DEFAULT NULL,
          consent_user_agent TEXT DEFAULT NULL,
          pathology_report_id TEXT DEFAULT NULL,
          radiology_report_id TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
      );
    `);

    // Migration to add pathology and radiology report columns if table already exists
    await pool.query(`
      ALTER TABLE prospect_invites
      ADD COLUMN IF NOT EXISTS pathology_report_id TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS radiology_report_id TEXT DEFAULT NULL;
    `);

    // Invites are now shared as a manually-copied link rather than sent via WhatsApp,
    // so a prospect phone number is no longer collected.
    await pool.query(`
      ALTER TABLE prospect_invites ALTER COLUMN prospect_phone DROP NOT NULL;
    `);

    // Optional mental-health questionnaire answers, collected independently by
    // the inviter (at link-generation time) and the prospect (at submission time).
    await pool.query(`
      ALTER TABLE prospect_invites
      ADD COLUMN IF NOT EXISTS mental_answers_json JSONB DEFAULT NULL;
    `);

    // Explicit mock-data tracking. Reports created via a "use a mock report" opt-in
    // (rather than a real uploaded PDF) must stay distinguishable from real reports —
    // previously only inferred from filename (e.g. 'mock_report.pdf'), which was
    // inconsistent across code paths and let some synthetic reports pass as real.
    await pool.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;
      ALTER TABLE radiology_reports ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;
    `);

    // Create indexes if they don't exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_usg_reports_patient_slay_id ON usg_reports(patient_slay_id);
      CREATE INDEX IF NOT EXISTS idx_radiology_patient_slay_id ON radiology_reports(patient_slay_id);
      CREATE INDEX IF NOT EXISTS idx_radiology_created_at ON radiology_reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
      CREATE INDEX IF NOT EXISTS idx_otp_requests_phone ON otp_requests(phone);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_prospect_invites_user_id ON prospect_invites(user_id);
      CREATE INDEX IF NOT EXISTS idx_prospect_invites_token ON prospect_invites(token);
      CREATE INDEX IF NOT EXISTS idx_prospect_invites_msg_id ON prospect_invites(whatsapp_message_id);
    `);

    // Schema migrations
    await pool.query(`
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS presentation_json JSONB DEFAULT NULL;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_narrative JSONB DEFAULT NULL;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS presentation_version TEXT DEFAULT NULL;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT DEFAULT NULL;
      CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
    `);

    // Nullable ownership stamp, going forward only — rows created before this shipped
    // have no reliable identifier back to an account (only free-text extracted from
    // the PDF itself) and stay unlinked. This is what makes real account-deletion of
    // radiology/USG data possible for anything uploaded after this migration.
    await pool.query(`
      ALTER TABLE radiology_reports ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE usg_reports ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_radiology_reports_user_id ON radiology_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_usg_reports_user_id ON usg_reports(user_id);
    `);

    // WhatsApp message log — the Cloud API has no "fetch message history" endpoint, so
    // this is the only source of truth for the admin message viewer. Populated going
    // forward only: outbound rows are written at send-time (WhatsAppProvider), inbound
    // rows and status transitions arrive via the existing /webhook/whatsapp handler.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
          id SERIAL PRIMARY KEY,
          direction TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          message_type TEXT,
          template_name TEXT,
          body_text TEXT,
          status TEXT DEFAULT 'sent',
          wa_message_id TEXT,
          raw_payload JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id ON whatsapp_messages(wa_message_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
    `);

    logger.info('Database schema successfully initialized.');
  } catch (error) {
    logger.error('Database schema initialization failed:', error);
    throw error;
  }
}

async function cleanupOldReports() {
  try {
    // `matches` has ON DELETE CASCADE back to `reports` — deleting a report that's
    // still referenced by a match would silently destroy that couple's completed
    // compatibility result along with it. Only prune reports no match points to.
    const result = await pool.query(`
      DELETE FROM reports
      WHERE created_at < NOW() - INTERVAL '1 day'
        AND id NOT IN (
          SELECT male_report_id FROM matches WHERE male_report_id IS NOT NULL
          UNION
          SELECT female_report_id FROM matches WHERE female_report_id IS NOT NULL
        )
    `);
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
