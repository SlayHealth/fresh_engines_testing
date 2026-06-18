const { execSync } = require('child_process');
const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

const text = execSync('python3 test_python_pdf.py').toString();
const pages = [{ page: 1, text: text }];

const extracted = parameterExtractor.extract(pages);
console.log(JSON.stringify(extracted, null, 2));
