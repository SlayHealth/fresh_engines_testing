const sqlite3 = require('better-sqlite3');
const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

const db = new sqlite3('src/database/slayhealth.db');
const reportId = db.prepare('SELECT id FROM reports ORDER BY id DESC LIMIT 1').get().id;
const rows = db.prepare('SELECT page_number, raw_text FROM ocr_pages WHERE report_id = ?').all(reportId);
db.close();

const pages = rows.map(r => ({ page: r.page_number, text: r.raw_text }));
const extracted = parameterExtractor.extract(pages);

let count = 0;
for (const section in extracted) {
  for (const param in extracted[section]) {
    count++;
  }
}
console.log('Locally extracted parameters count:', count);
console.log(JSON.stringify(extracted, null, 2).substring(0, 1000));
