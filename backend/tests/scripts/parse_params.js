const fs = require('fs');

const rawParams = fs.readFileSync('../contexts/paht_parameters.md', 'utf8').split('\n').filter(Boolean);

const ontology = rawParams.map(param => {
  const cleanParam = param.trim();
  // Extract canonical name by taking the whole string and slugifying
  const canonical_name = cleanParam.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  
  // Extract aliases: the whole thing, plus anything in parentheses
  const aliases = [cleanParam.toLowerCase()];
  const parensMatch = cleanParam.match(/\(([^)]+)\)/);
  if (parensMatch) {
    const acronyms = parensMatch[1].split(/[/\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    aliases.push(...acronyms);
  }

  // Guess section
  let section = 'general';
  if (cleanParam.match(/blood|hemo|rbc|wbc|platelet|neutrophil|lymphocyte|monocyte|eosinophil|basophil|mcv|mch|pdw/i)) section = 'cbc';
  else if (cleanParam.match(/bilirubin|alanine|aspartate|sgpt|sgot/i)) section = 'lft';
  else if (cleanParam.match(/creatinine|urea|uric acid|egfr/i)) section = 'kft';
  else if (cleanParam.match(/thyroid|triiodothyronine|thyroxine|tsh|ft3|ft4|t3|t4/i)) section = 'thyroid';
  else if (cleanParam.match(/cholesterol|lipoprotein|triglyceride/i)) section = 'lipid';
  else if (cleanParam.match(/glucose|hba1c|sugar/i)) section = 'diabetes';
  else if (cleanParam.match(/semen|sperm|liquefaction/i)) section = 'semen_analysis';
  else if (cleanParam.match(/urine|urinary|urobilinogen/i)) section = 'urine_routine';

  return {
    canonical_name,
    section,
    aliases: [...new Set(aliases)], // unique
    expected_units: [],
    normal_range_type: 'unknown'
  };
});

const fileContent = `const Fuse = require('fuse.js');

const parametersOntology = ${JSON.stringify(ontology, null, 2)};

const searchableParams = [];
parametersOntology.forEach(param => {
  param.aliases.forEach(alias => {
    searchableParams.push({
      canonical_name: param.canonical_name,
      section: param.section,
      expected_units: param.expected_units,
      alias: alias
    });
  });
});

const fuse = new Fuse(searchableParams, {
  keys: ['alias'],
  threshold: 0.3,
  includeScore: true
});

class OntologyMapperService {
  mapParameter(rawName, currentSection) {
    if (!rawName) return null;
    
    // Normalize string by removing parentheses and lowering case
    const normalized = rawName.toLowerCase().replace(/\\(.*?\\)/g, '').trim();
    const results = fuse.search(normalized);
    
    for (const result of results) {
      if (result.score <= 0.5) {
        if (!currentSection || result.item.section === currentSection || result.item.section === 'general') {
          return {
            canonical_name: result.item.canonical_name,
            expected_units: result.item.expected_units || [],
            match_score: 1.0 - result.score
          };
        }
      }
    }
    
    return null;
  }
}

module.exports = new OntologyMapperService();
`;

fs.writeFileSync('src/services/parser/ontologyMapper.service.js', fileContent);
console.log('Updated ontologyMapper.service.js with 142 parameters.');
