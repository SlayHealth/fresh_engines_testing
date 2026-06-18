const parameterExtractor = require('./src/services/parser/parameterExtractor.service');
const mockPages = [
  {
    page: 1,
    text: `
      COMPLETE BLOOD COUNT
      Hemoglobin (Hb)\t16.0\t13.5-17.5\tg/dL
      Total White Blood Cell Count\t6500\t4000-11000\tcells/cmm
      Random Invalid Line 55
      
      LIVER FUNCTION TEST
      Alanine Aminotransferase (SGPT / ALT)\t25\t5-40\tU/L
      
      // Columnar Layout Test
      Parameter\tResult\tReference
      Serum Creatinine\t0.85\t0.5-1.1
    `
  }
];
console.log(JSON.stringify(parameterExtractor.extract(mockPages), null, 2));
