const { execSync } = require('child_process');
const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

const text = execSync('python3 test_python_pdf.py').toString();
const pages = [{ page: 1, text: text }];

const extracted = parameterExtractor.extract(pages);
let count = 0;
for (const section in extracted) {
  for (const param in extracted[section]) {
    count++;
  }
}
console.log('Total extracted count:', count);
