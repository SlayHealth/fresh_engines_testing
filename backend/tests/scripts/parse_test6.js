const parameterExtractor = require('./src/services/parser/parameterExtractor.service');
const extracted = parameterExtractor.extract([{
  page: 1,
  text: `LIVER FUNCTION TEST\nAlanine Aminotransferase (SGPT / ALT)\t25\t5-40\tU/L`
}]);
console.log(JSON.stringify(extracted, null, 2));
