require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { db } = require('../../src/services/storage/postgres.service');
const pdfReportService = require('../../src/services/pdfReport.service');
const fs = require('fs');
const path = require('path');

const matchId = 'c3a69bb9-6a6f-4a61-82b5-ef505f800c9d';
const outputPath = '/Users/pranavsingh/.gemini/antigravity-ide/brain/b0330101-0411-4738-b772-e59bd8310c23/scratch/test_report.pdf';

async function fetchRadiologyReport(slayId, name) {
  if (!slayId && !name) return null;
  let res = await db.query(
    'SELECT * FROM radiology_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    return {
      findings_json: typeof row.findings_json === 'string' ? JSON.parse(row.findings_json) : row.findings_json,
      scores_json: typeof row.scores_json === 'string' ? JSON.parse(row.scores_json) : row.scores_json,
      risk_flags_json: typeof row.risk_flags_json === 'string' ? JSON.parse(row.risk_flags_json) : row.risk_flags_json,
      modalities_detected: row.modalities_detected,
      created_at: row.created_at
    };
  }
  res = await db.query(
    'SELECT * FROM usg_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    const extracted = typeof row.extracted_json === 'string' ? JSON.parse(row.extracted_json) : row.extracted_json;
    const analyzed = typeof row.analyzed_results === 'string' ? JSON.parse(row.analyzed_results) : row.analyzed_results;
    return {
      findings_json: { USG_ABDOMEN: extracted?.findings || {} },
      scores_json: {
        organ_scores: analyzed?.scores || {},
        radiology_nuptia_contribution: analyzed?.nuptia_score_usg_contribution || null,
        modalities_scored: ['USG_ABDOMEN']
      },
      risk_flags_json: analyzed?.risk_flags || [],
      modalities_detected: ['USG_ABDOMEN'],
      created_at: row.created_at
    };
  }
  return null;
}

async function run() {
  try {
    console.log(`Fetching match ${matchId} from database...`);
    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];

    if (!match) {
      console.error(`Match ${matchId} not found in database.`);
      process.exit(1);
    }

    let analysis = match.analysis_json || {};
    if (typeof analysis === 'string') {
      try {
        analysis = JSON.parse(analysis);
      } catch (e) {
        analysis = {};
      }
    }
    const chronic = analysis.chronicResult || {};
    const details = analysis.details || {};
    
    let partnerAName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
    let partnerBName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';

    if (partnerAName.toLowerCase().includes('swati') && partnerBName.toLowerCase().includes('sachin')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    } else if (partnerAName.toLowerCase().includes('sachin') && partnerBName.toLowerCase().includes('swati')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    }

    const malePathology = chronic.details?.male_data || null;
    const femalePathology = chronic.details?.female_data || null;
    const maleSlayId = malePathology?.patient?.patient_slay_id || partnerAName;
    const femaleSlayId = femalePathology?.patient?.patient_slay_id || partnerBName;

    // Fetch and attach radiology findings
    const [maleRad, femaleRad] = await Promise.all([
      fetchRadiologyReport(maleSlayId, partnerAName),
      fetchRadiologyReport(femaleSlayId, partnerBName)
    ]);
    
    match.maleRadiology = maleRad;
    match.femaleRadiology = femaleRad;

    console.log('Generating PDF stream...');
    const doc = pdfReportService.generatePDFReportStream(match);
    
    console.log(`Writing PDF to: ${outputPath}...`);
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);
    
    writeStream.on('finish', () => {
      console.log('PDF report successfully written to file!');
      process.exit(0);
    });

    writeStream.on('error', (err) => {
      console.error('WriteStream error:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('PDF generation test failed:', err);
    process.exit(1);
  }
}

run();
