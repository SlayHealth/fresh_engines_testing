const fs = require('fs');
const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

const text = fs.readFileSync('test_ocr.txt', 'utf8');
const pages = [{ page: 1, text: text }];

const extracted = parameterExtractor.extract(pages);
console.log(JSON.stringify(extracted, null, 2).substring(0, 2000));
