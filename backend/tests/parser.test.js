const assert = require('assert');
const sectionDetector = require('../src/services/parser/sectionDetector.service');
const parameterExtractor = require('../src/services/parser/parameterExtractor.service');

// Test Section Detector
console.log('Testing Section Detector...');
const testCases = [
  { input: 'COMPLETE BLOOD COUNT', expected: 'complete_blood_count_cbc_hemogram' },
  { input: 'Thyroid Test', expected: 'thyroid_test' },
  { input: 'Liver Function Test', expected: 'liver_function_test_lft_total_bilirubin' },
  { input: 'Random Noise', expected: null },
];

testCases.forEach((test, idx) => {
  const result = sectionDetector.detectSection(test.input);
  assert.strictEqual(result, test.expected, `Test ${idx+1} failed: expected ${test.expected}, got ${result}`);
});
console.log('✓ Section Detector tests passed.');


// Test Parameter Extractor
console.log('Testing Parameter Extractor...');
const mockPages = [
  {
    page: 1,
    text: `
      COMPLETE BLOOD COUNT
      Total Red Blood Cell Count (RBC)\t4.99\t4.0-5.2\tmill/pL
      Total White Blood Cell Count\t6500\t4000-11000\tcells/cmm
      Random Invalid Line 55
      
      LIVER FUNCTION TEST
      Alanine Aminotransferase (SGPT / ALT)\t25\t5-40\tU/L
      
      // Columnar Layout Test
      KIDNEY FUNCTION TEST
      Parameter\tResult\tReference
      Serum Creatinine\t0.85\t0.5-1.1
    `
  }
];

const extracted = parameterExtractor.extract(mockPages);

// Verify RBC
const rbc = extracted['complete_blood_count_cbc_hemogram']?.total_red_blood_cell_count_rbc;
assert.ok(rbc, 'RBC not extracted');
assert.strictEqual(rbc.value, 4.99);
assert.strictEqual(rbc.unit, 'mill/pL');
assert.strictEqual(rbc.reference_range, '4.0-5.2');

// Verify SGPT
const sgpt = extracted['liver_function_test_lft_total_bilirubin']?.alanine_aminotransferase_sgpt_alt;
assert.ok(sgpt, 'SGPT not extracted');
assert.strictEqual(sgpt.value, 25);

// Verify Creatinine (Columnar)
const creat = extracted['kidney_function_test_kft']?.serum_creatinine;
assert.ok(creat, 'Creatinine not extracted');
assert.strictEqual(creat.value, 0.85);

console.log('✓ Parameter Extractor tests passed.');
console.log('All tests passed successfully! ✨');
