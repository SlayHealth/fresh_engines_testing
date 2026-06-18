const ontologyMapper = require('./src/services/parser/ontologyMapper.service');
console.log(ontologyMapper.mapParameter('Hemoglobin (Hb)', 'complete_blood_count_cbc_hemogram'));
console.log(ontologyMapper.mapParameter('Alanine Aminotransferase (SGPT / ALT)', 'liver_function_test_lft_total_bilirubin'));
console.log(ontologyMapper.mapParameter('Serum Creatinine', 'kidney_function_test_kft'));
