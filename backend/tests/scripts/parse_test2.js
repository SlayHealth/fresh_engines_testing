const parameterExtractor = require('./src/services/parser/parameterExtractor.service');

const text = `URINE ROUTINE & MICROSCOPY EXAMINATION
Appearance / Clarity / Turbkiity
Specif &avity
Ur i nary Protein
Ur i nary GILCOS•g
i nary
Uri nary Bilirubin
Urobilinogen
Blood / Haemoglobin in Urine
Nitrites
Leu kocyte Esterase
Pus cells cvvgcs) HPF
Rod Cells (Rgcs) HPF
Cells
Crystals
Yeast \ Fungi
Result
Clear
1.015
Absent
Absent
Absent
Absent
Norma I
Absent
Absent
Absent
0-1
Absent
Absent
Absent
Rete
p ale
C I ear
4.5-8.0
Absent
Absent
Absent
Absent
NC' rnal
Absent
Absent
Absent
Absent
Ab Sent
Ab Sent
HPF
HPF
HPF`;

const pages = [{ page: 1, text }];
console.log(JSON.stringify(parameterExtractor.extract(pages), null, 2));
