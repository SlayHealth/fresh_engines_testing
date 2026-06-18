const fs = require('fs');
const sqlite3 = require('better-sqlite3');
const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

// Get the latest raw_text from DB
const db = new sqlite3('src/database/slayhealth.db');
const row = db.prepare('SELECT raw_text FROM ocr_pages ORDER BY id DESC LIMIT 1').get();
db.close();

const pages = [{ page: 1, text: row.raw_text }];
const extracted = parameterExtractor.extract(pages);

let count = 0;
for (const section in extracted) {
  for (const param in extracted[section]) {
    count++;
  }
}
console.log('Locally extracted parameters count:', count);
