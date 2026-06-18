const fs = require('fs');

const rawSections = fs.readFileSync('../contexts/path_tests.md', 'utf8').split('\n').filter(Boolean);

const sections = rawSections.map(sec => {
  const cleanSec = sec.trim();
  const id = cleanSec.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  
  const aliases = [cleanSec.toLowerCase()];
  const parensMatch = cleanSec.match(/\(([^)]+)\)/);
  if (parensMatch) {
    const acronyms = parensMatch[1].split(/[/\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    aliases.push(...acronyms);
  }
  
  // Custom aliases for common variations
  if (id.includes('urine')) aliases.push('urine routine', 'urine examination');
  if (id.includes('liver')) aliases.push('lft');
  if (id.includes('kidney')) aliases.push('kft');
  if (id.includes('blood_count')) aliases.push('cbc', 'hemogram');
  
  return {
    id: id.includes('urine') ? 'urine_routine' : id,
    name: cleanSec,
    aliases: [...new Set(aliases)]
  };
});

// Hardcode a few we know
sections.push({
  id: 'urine_routine',
  name: 'Urine Routine',
  aliases: ['urine routine', 'urine routine & microscopy examination', 'urine analysis']
});

const fileContent = `const Fuse = require('fuse.js');
const logger = require('../../utils/logger');

const sections = ${JSON.stringify(sections, null, 2)};

const searchableSections = [];
sections.forEach(sec => {
  sec.aliases.forEach(alias => {
    searchableSections.push({
      id: sec.id,
      canonical_name: sec.name,
      alias: alias
    });
  });
});

const fuse = new Fuse(searchableSections, {
  keys: ['alias'],
  threshold: 0.3,
  includeScore: true
});

class SectionDetectorService {
  detectSection(text) {
    if (!text || text.trim().length < 3) return null;
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').trim();
    const results = fuse.search(normalizedText);
    if (results.length > 0 && results[0].score <= 0.4) {
      return results[0].item.id;
    }
    return null;
  }
}

module.exports = new SectionDetectorService();
`;

fs.writeFileSync('src/services/parser/sectionDetector.service.js', fileContent);
console.log('Updated sectionDetector.service.js');
