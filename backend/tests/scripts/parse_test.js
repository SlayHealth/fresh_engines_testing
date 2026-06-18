const sectionDetector = require('./src/services/parser/sectionDetector.service');
const text = "URINE ROUTINE & MICROSCOPY EXAMINATION";
console.log("Section:", sectionDetector.detectSection(text));
