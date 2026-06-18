const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../../database/slayhealth.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

// Initialize schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        file_name TEXT,
        upload_timestamp DATETIME,
        processing_status TEXT,
        confidence_score REAL,
        extracted_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ocr_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id TEXT,
        page_number INTEGER,
        raw_text TEXT,
        FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extraction_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id TEXT,
        step TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        male_report_id TEXT,
        female_report_id TEXT,
        status TEXT,
        compatibility_score REAL,
        analysis_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(male_report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY(female_report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usg_reports (
        id TEXT PRIMARY KEY,
        patient_slay_id TEXT,
        extracted_json TEXT,
        analyzed_results TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_usg_reports_patient_slay_id ON usg_reports(patient_slay_id);
  `);
  
  // Auto-migrate column if it doesn't exist
  try {
    db.exec("ALTER TABLE reports ADD COLUMN extracted_json TEXT;");
  } catch (e) {
    // Column likely already exists
  }
}

initDB();

// Cleanup old rows (older than 24h)
function cleanupOldReports() {
  const statement = db.prepare(`
    DELETE FROM reports WHERE created_at < datetime('now', '-1 day');
  `);
  const info = statement.run();
  return info.changes;
}

module.exports = {
  db,
  cleanupOldReports
};
