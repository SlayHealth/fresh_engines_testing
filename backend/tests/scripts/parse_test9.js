require('dotenv').config();
const ocrProvider = require('./src/services/ocr/ocrProvider');
const fs = require('fs');

(async () => {
  try {
    const pages = await ocrProvider.process('../contexts/sample_report.pdf');
    fs.writeFileSync('test_ocr.txt', pages.map(p => p.text).join('\n'));
    console.log("Done");
  } catch (e) {
    console.error(e);
  }
})();
