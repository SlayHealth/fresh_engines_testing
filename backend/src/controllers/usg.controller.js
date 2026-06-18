// Organ Scorers
function liverScore(liver) {
  let score = 100;
  if (!liver) return score;
  if (liver.fatty_grade === 1) score -= 15;
  if (liver.fatty_grade === 2) score -= 30;
  if (liver.fatty_grade === 3) score -= 50;
  if (liver.hepatomegaly) score -= 10;
  if (liver.ihbr_dilated) score -= 20;
  if (liver.focal_lesions?.length > 0) {
    liver.focal_lesions.forEach(l => {
      if (l.type === 'simple_cyst') score -= 5;
      else if (l.type === 'mass') score -= 40;
    });
  }
  return Math.max(0, score);
}

function prostateScore(prostate, age) {
  if (!prostate || !prostate._applicable) return 100; // Not applicable for females
  const ageNormals = { 40: 20, 50: 25, 60: 30, 70: 40, 80: 45 };
  const ageKey = Math.round(age / 10) * 10;
  const normal = ageNormals[Math.min(80, Math.max(40, ageKey))];
  const vol = prostate.volume_cc || prostate.weight_grams;
  if (!vol) return 80; // insufficient data
  const ratio = vol / normal;
  if (ratio <= 1.2) return 100;
  if (ratio <= 1.5) return 80; // Grade I
  if (ratio <= 2.0) return 55; // Grade II
  return 30; // Grade III
}

function femaleReproductiveScore(uterus, ovaries) {
  if (!uterus || !uterus._applicable) return 100; // Male
  let score = 100;
  if (!ovaries) return score;
  // PCOS flags
  if (ovaries.pcos_morphology_bilateral) score -= 35;
  else if (ovaries.pcos_morphology_unilateral) score -= 20;
  // Ovarian volume
  const rightVol = ovaries.right?.volume_cc;
  const leftVol = ovaries.left?.volume_cc;
  if (rightVol > 10) score -= 10;
  if (leftVol > 10) score -= 10;
  // Ovarian cysts
  if (ovaries.right?.cyst_present) score -= 8;
  if (ovaries.left?.cyst_present) score -= 8;
  // Uterine pathology
  if (uterus?.fibroid_present) score -= 15;
  if (uterus?.collection_in_cavity) score -= 10;
  // POD / pelvic fluid
  if (ovaries.vaginal_cyst_collection) score -= 8;
  if (ovaries.pouch_of_douglas_free_fluid) score -= 5;
  return Math.max(0, score);
}

function gallbladderScore(gb) {
  if (!gb || !gb.present) return 100;
  let score = 100;
  if (gb.calculi_present) score -= 30; 
  if (gb.wall_thickness_normal === false) score -= 15;
  if (gb.polyp_present) score -= 10;
  return Math.max(0, score);
}

function kidneyScore(kidneys) {
  if (!kidneys) return 100;
  let score = 100;
  const checkKidney = (k) => {
    if (!k) return;
    if (k.calculi_present) score -= 20;
    if (k.cysts && k.cysts.length > 0) score -= 5;
    if (k.hydronephrosis) {
       if (k.hydronephrosis_grade === 1) score -= 15;
       else score -= 30;
    }
    if (k.corticomedullary_differentiation === 'poor' || k.corticomedullary_differentiation === 'lost') {
      score -= 30;
    }
  };
  checkKidney(kidneys.right);
  checkKidney(kidneys.left);
  return Math.max(0, score);
}

function bladderScore(bladder) {
  if (!bladder) return 100;
  let score = 100;
  if (bladder.wall_thickness_normal === false) score -= 15;
  if (bladder.calculi_present) score -= 30;
  if (bladder.mass_present) score -= 50;
  
  if (bladder.post_void_residual_cc > 100) score -= 20;
  else if (bladder.post_void_residual_cc > 50) score -= 10;
  
  return Math.max(0, score);
}

function pancreasScore(pancreas) {
  if (!pancreas) return 100;
  let score = 100;
  if (pancreas.size_normal === false) score -= 15;
  if (pancreas.echotexture_normal === false) score -= 15;
  if (pancreas.focal_lesion) score -= 40;
  if (pancreas.calcifications) score -= 20;
  return Math.max(0, score);
}

function spleenScore(spleen) {
  if (!spleen) return 100;
  let score = 100;
  if (spleen.size_category === 'small') score -= 10;
  else if (spleen.size_category && spleen.size_category !== 'normal') score -= 15;
  if (spleen.focal_lesion) score -= 30;
  return Math.max(0, score);
}

function compositeScore(findings, sex, age) {
  if (!findings) return 100;
  const l_score = liverScore(findings.liver);
  const gb_score = gallbladderScore(findings.gallbladder);
  const p_score = pancreasScore(findings.pancreas);
  const s_score = spleenScore(findings.spleen);
  const k_score = kidneyScore(findings.kidneys);
  const b_score = bladderScore(findings.urinary_bladder);
  let rep_score = 100;
  if (sex === 'Female') rep_score = femaleReproductiveScore(findings.uterus, findings.ovaries);
  else rep_score = prostateScore(findings.prostate, age || 40);

  const weights = {
    liver: 0.22,
    gallbladder: 0.10,
    pancreas: 0.08,
    spleen: 0.07,
    kidneys: 0.18,
    bladder: 0.10,
    reproductive: 0.25
  };
  
  const total = l_score * weights.liver +
                gb_score * weights.gallbladder +
                p_score * weights.pancreas +
                s_score * weights.spleen +
                k_score * weights.kidneys +
                b_score * weights.bladder +
                rep_score * weights.reproductive;
                
  return Math.round(total);
}

function calculateMetabolicHealthIndex(fatty_grade, hepatomegaly, cholelithiasis, bmi) {
  let score = 10;
  if (fatty_grade === 1) score -= 1;
  else if (fatty_grade === 2) score -= 2.5;
  else if (fatty_grade === 3) score -= 4;
  
  if (hepatomegaly && !fatty_grade) score -= 1; // "hepatomegaly without fatty"
  if (cholelithiasis) score -= 1;
  
  if (bmi > 35) score -= 2;
  else if (bmi > 30) score -= 1;
  else if (bmi >= 25) score -= 0.5;
  
  return Math.max(0, score);
}

function generateRiskFlags(findings, sex, age) {
  const flags = [];
  let fertRel = 0;
  
  // PCOS
  if (findings.ovaries?.pcos_morphology_bilateral) {
    flags.push({ flag_id: 'PCOS_BILATERAL', flag_label: 'Bilateral PCOS Morphology', organ: 'ovaries', severity: 'high', fertility_relevance: 'critical', clinical_note: 'BCOM detected.', recommended_action: 'Endocrinology consultation.' });
    fertRel = Math.max(fertRel, 10);
  } else if (findings.ovaries?.pcos_morphology_unilateral) {
    flags.push({ flag_id: 'PCOS_UNILATERAL', flag_label: 'Unilateral PCOS Morphology', organ: 'ovaries', severity: 'moderate', fertility_relevance: 'high', clinical_note: 'PCOS changes in one ovary.', recommended_action: 'Clinical correlation.' });
    fertRel = Math.max(fertRel, 8);
  }
  
  // Fatty Liver
  if (findings.liver?.fatty_grade === 2) {
    flags.push({ flag_id: 'FATTY_LIVER_2', flag_label: 'Grade II Fatty Liver', organ: 'liver', severity: 'moderate', fertility_relevance: age < 30 ? 'moderate' : 'low', clinical_note: 'Moderate fat accumulation.', recommended_action: 'Lifestyle/diet changes.' });
    fertRel = Math.max(fertRel, age < 30 ? 5 : 2);
  } else if (findings.liver?.fatty_grade === 1) {
    flags.push({ flag_id: 'FATTY_LIVER_1', flag_label: 'Grade I Fatty Liver', organ: 'liver', severity: 'low', fertility_relevance: 'low', clinical_note: 'Mild fat accumulation.', recommended_action: 'Diet changes.' });
    fertRel = Math.max(fertRel, age > 40 ? 2 : 1);
  }
  
  // Prostate
  if (findings.prostate?.grade === 'Grade_I') {
    flags.push({ flag_id: 'BPH_I', flag_label: 'Prostatomegaly Grade I', organ: 'prostate', severity: 'moderate', fertility_relevance: 'moderate', clinical_note: 'Mild enlargement.', recommended_action: 'Urology follow-up.' });
    fertRel = Math.max(fertRel, 6);
  } else if (findings.prostate?.grade === 'Grade_II' || findings.prostate?.grade === 'Grade_III') {
    flags.push({ flag_id: 'BPH_SEVERE', flag_label: 'Prostatomegaly Grade ' + findings.prostate.grade, organ: 'prostate', severity: 'high', fertility_relevance: 'high', clinical_note: 'Significant enlargement.', recommended_action: 'Urology consult.' });
    fertRel = Math.max(fertRel, 8);
  }
  
  // Renal Calculus
  const rCalc = findings.kidneys?.right?.calculi_present;
  const lCalc = findings.kidneys?.left?.calculi_present;
  if (rCalc || lCalc) {
    flags.push({ flag_id: 'RENAL_CALCULUS', flag_label: 'Renal Calculus', organ: 'kidneys', severity: 'low', fertility_relevance: sex === 'Female' ? 'moderate' : 'low', clinical_note: 'Kidney stone detected.', recommended_action: 'Hydration and urology evaluation.' });
    fertRel = Math.max(fertRel, sex === 'Female' ? 6 : 2);
  }
  
  // Simple Cyst
  if (findings.liver?.focal_lesions?.some(l => l.type === 'simple_cyst')) {
    flags.push({ flag_id: 'LIVER_CYST', flag_label: 'Simple Hepatic Cyst', organ: 'liver', severity: 'low', fertility_relevance: 'none', clinical_note: 'Incidental benign cyst.', recommended_action: 'Routine observation.' });
  }

  // Vaginal cyst
  if (findings.ovaries?.vaginal_cyst_collection) {
    flags.push({ flag_id: 'VAGINAL_CYST', flag_label: 'Vaginal Cyst', organ: 'ovaries', severity: 'low', fertility_relevance: 'moderate', clinical_note: 'Cyst/collection detected.', recommended_action: 'Gynecology follow-up.' });
    fertRel = Math.max(fertRel, 5);
  }
  
  return flags;
}

function generateCoupleInsights(reportA, reportB) {
  const insights = [];
  const A = reportA?.findings || {};
  const B = reportB?.findings || {};
  
  if (A.liver?.fatty_grade >= 1 && B.liver?.fatty_grade >= 1) {
    insights.push({
      id: 'SHARED_METABOLIC',
      title: 'Shared Metabolic Pattern',
      text: 'Both partners show hepatic fat deposition. This suggests similar dietary and physical activity patterns. A joint metabolic reset program is recommended.'
    });
  }
  
  const aPcos = A.ovaries?.pcos_morphology_bilateral || A.ovaries?.pcos_morphology_unilateral;
  const bPcos = B.ovaries?.pcos_morphology_bilateral || B.ovaries?.pcos_morphology_unilateral;
  const aProstate = A.prostate?.size_normal === false || (A.prostate?.grade && A.prostate?.grade !== 'normal');
  const bProstate = B.prostate?.size_normal === false || (B.prostate?.grade && B.prostate?.grade !== 'normal');
  
  if ((aPcos && bProstate) || (bPcos && aProstate)) {
    insights.push({
      id: 'SHARED_HORMONAL',
      title: 'Hormonal Health Flags',
      text: 'Hormonal health flags detected in both partners. Endocrinology consultation recommended before family planning.'
    });
  }
  
  const aRenal = A.kidneys?.right?.calculi_present || A.kidneys?.left?.calculi_present;
  const bRenal = B.kidneys?.right?.calculi_present || B.kidneys?.left?.calculi_present;
  if (aRenal || bRenal) {
    insights.push({
      id: 'SHARED_RENAL',
      title: 'Renal Calculus History',
      text: 'Kidney stone history may recur during pregnancy-related hydration shifts. Urology clearance recommended.'
    });
  }
  
  return insights;
}

function generateCoupleSummary(analyzedA, analyzedB) {
  const summary = {
    good_things: [],
    minor_issues: [],
    major_issues: []
  };

  const getFriendlyEffect = (flag) => {
    const map = {
      PCOS_BILATERAL: "we noticed polycystic patterns in both ovaries. This points to a hormonal imbalance that can sometimes make your cycles irregular and mean natural conception might take a little longer. It's super common, though—a chat with your doctor will help guide you!",
      PCOS_UNILATERAL: "there's a slight polycystic pattern in one ovary. It's a minor hormonal variation that might occasionally throw your cycle off, but usually isn't a big deal.",
      FATTY_LIVER_2: "looks like there's some moderate fat buildup in the liver (Grade II). This can make you feel a bit sluggish and slow down your metabolism. The great news? It's highly reversible with some fun, healthy diet tweaks!",
      FATTY_LIVER_1: "we noticed a tiny bit of fat starting to store in the liver (Grade I). Think of it as a gentle early warning sign from your metabolism—super easy to reverse with a few small lifestyle changes.",
      BPH_I: "there's a mild enlargement in the prostate. It's totally normal and might just mean needing to pee a bit more often, but it's very manageable.",
      BPH_SEVERE: "there's some more noticeable prostate enlargement. This can occasionally impact reproductive health and make daily bathroom trips a bit annoying, so it's a good idea to bring it up with a doctor.",
      RENAL_CALCULUS: "we spotted a kidney stone. While it might not bother you right now, it's really important to know about because pregnancy shifts your hydration needs, which could trigger some discomfort later on. Drink up!",
      LIVER_CYST: "we found a simple cyst in the liver. 'Cyst' sounds scary, but it's actually completely harmless! It won't affect your daily life, energy, or fertility at all.",
      VAGINAL_CYST: "we noticed a small fluid collection (a cyst) in the vaginal area. It's typically completely harmless, but it's good to keep an eye on it just to make sure you stay comfortable."
    };
    return map[flag.flag_id] || `we noticed something called '${flag.flag_label}'. It's best to review this with your doctor to understand if it has any long-term effects on your wellness.`;
  };

  const processFlags = (flags, partnerName) => {
    (flags || []).forEach(f => {
      const effectText = getFriendlyEffect(f);
      if (f.severity === 'high' || f.severity === 'critical') {
        summary.major_issues.push(`For ${partnerName}, ${effectText}`);
      } else {
        summary.minor_issues.push(`For ${partnerName}, ${effectText}`);
      }
    });
  };

  processFlags(analyzedA.risk_flags, "Partner A");
  processFlags(analyzedB.risk_flags, "Partner B");

  // Add good things based on scores
  if (analyzedA.scores.liver === 100 && analyzedB.scores.liver === 100) {
    summary.good_things.push("You both have optimal liver health! This means your metabolisms are strong and your energy levels should be great.");
  } else if (analyzedA.scores.liver === 100) {
    summary.good_things.push("Partner A has a perfectly healthy liver, which is awesome for metabolism and keeping energy levels high.");
  } else if (analyzedB.scores.liver === 100) {
    summary.good_things.push("Partner B has a perfectly healthy liver, which is awesome for metabolism and keeping energy levels high.");
  }

  if (analyzedA.scores.kidneys === 100 && analyzedB.scores.kidneys === 100) {
    summary.good_things.push("Great news—both of you have perfectly healthy kidneys with zero signs of stones! Your detox systems are running smoothly.");
  }
  
  if (analyzedA.scores.reproductive === 100) {
    summary.good_things.push("Partner A has absolutely optimal reproductive organ health. This is a fantastic sign for future family planning!");
  }
  if (analyzedB.scores.reproductive === 100) {
    summary.good_things.push("Partner B has absolutely optimal reproductive organ health. This is a fantastic sign for future family planning!");
  }

  if (summary.minor_issues.length === 0 && summary.major_issues.length === 0) {
    summary.good_things.push("Wow! We didn't detect any significant pathological findings for either of you. Everything looks completely clear!");
  }

  return summary;
}

function calculateNuptiaScoreContribution(scores) {
  // USG total weight: 15%
  // Sub-weights: Metabolic 30%, Reproductive 35%, Renal 15%, Overall Abdominal 20%
  const metabolicPct = (scores.metabolicIndex / 10) * 100;
  
  const met = (metabolicPct / 100) * 0.30;
  const rep = ((scores.reproductiveScore || 100) / 100) * 0.35;
  const ren = ((scores.kidneyScore || 100) / 100) * 0.15;
  const abd = ((scores.compositeScore || 100) / 100) * 0.20;
  
  return (met + rep + ren + abd) * 15;
}

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { db } = require('../services/storage/sqlite.service');
const ocrSpaceService = require('../services/ocr/ocrSpace.service');
const usgExtractorService = require('../services/parser/usgExtractor.service');

function runAnalysis(data) {
  if (!data || !data.findings) return null;
  const sex = data.patient?.sex || 'Female';
  const age = data.patient?.age_years || 30;
  
  const mhi = calculateMetabolicHealthIndex(
    data.findings.liver?.fatty_grade,
    data.findings.liver?.hepatomegaly,
    data.findings.gallbladder?.calculi_present,
    data.patient?.bmi || 24
  );
  
  const cScore = compositeScore(data.findings, sex, age);
  const repScore = sex === 'Female' ? femaleReproductiveScore(data.findings.uterus, data.findings.ovaries) : prostateScore(data.findings.prostate, age);
  const kScore = kidneyScore(data.findings.kidneys);
  const flagsData = generateRiskFlags(data.findings, sex, age);
  
  const nuptiaSlice = calculateNuptiaScoreContribution({
    metabolicIndex: mhi,
    reproductiveScore: repScore,
    kidneyScore: kScore,
    compositeScore: cScore
  });
  
  return {
    raw_data: data,
    scores: {
      liver: liverScore(data.findings.liver),
      prostate: prostateScore(data.findings.prostate, age),
      gallbladder: gallbladderScore(data.findings.gallbladder),
      pancreas: pancreasScore(data.findings.pancreas),
      spleen: spleenScore(data.findings.spleen),
      kidneys: kScore,
      bladder: bladderScore(data.findings.urinary_bladder),
      reproductive: repScore,
      composite_abdominal: cScore,
      metabolic_index: mhi,
      fertility_relevance: flagsData.fertility_relevance
    },
    risk_flags: flagsData.flags,
    nuptia_score_usg_contribution: nuptiaSlice
  };
}

function analyzeUsg(req, res, next) {
  try {
    const analyzed = runAnalysis(req.body);
    if (!analyzed) return res.status(400).json({ error: 'Invalid USG report payload' });
    res.json(analyzed);
  } catch (err) {
    next(err);
  }
}

function persistReport(req, res, next) {
  try {
    const data = req.body;
    const analyzed = runAnalysis(data);
    if (!analyzed) return res.status(400).json({ error: 'Invalid payload' });
    
    const reportId = uuidv4();
    const slayId = data.patient?.patient_slay_id || null;
    
    const stmt = db.prepare('INSERT INTO usg_reports (id, patient_slay_id, extracted_json, analyzed_results) VALUES (?, ?, ?, ?)');
    stmt.run(reportId, slayId, JSON.stringify(data), JSON.stringify(analyzed));
    
    res.json({ reportId, analyzed });
  } catch (err) {
    next(err);
  }
}

function getReport(req, res, next) {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM usg_reports WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return res.status(404).json({ error: 'Report not found' });
    
    res.json({
      id: row.id,
      patient_slay_id: row.patient_slay_id,
      extracted_json: JSON.parse(row.extracted_json),
      analyzed_results: JSON.parse(row.analyzed_results),
      created_at: row.created_at
    });
  } catch (err) {
    next(err);
  }
}

function analyzeCouple(req, res, next) {
  try {
    const { reportId_A, reportId_B } = req.body;
    if (!reportId_A || !reportId_B) return res.status(400).json({ error: 'Both reportId_A and reportId_B required' });
    
    const stmt = db.prepare('SELECT extracted_json, analyzed_results FROM usg_reports WHERE id = ?');
    const rowA = stmt.get(reportId_A);
    const rowB = stmt.get(reportId_B);
    
    if (!rowA || !rowB) return res.status(404).json({ error: 'One or both reports not found in database' });
    
    const reportA = JSON.parse(rowA.extracted_json);
    const reportB = JSON.parse(rowB.extracted_json);
    
    const insights = generateCoupleInsights(reportA, reportB);
    
    res.json({
      partner_A: JSON.parse(rowA.analyzed_results),
      partner_B: JSON.parse(rowB.analyzed_results),
      shared_insights: insights
    });
  } catch (err) {
    next(err);
  }
}

function getCoupleSummary(req, res, next) {
  try {
    const { reportId_A, reportId_B } = req.body;
    if (!reportId_A || !reportId_B) return res.status(400).json({ error: 'Both reportId_A and reportId_B required' });
    
    const stmt = db.prepare('SELECT analyzed_results FROM usg_reports WHERE id = ?');
    const rowA = stmt.get(reportId_A);
    const rowB = stmt.get(reportId_B);
    
    if (!rowA || !rowB) return res.status(404).json({ error: 'One or both reports not found in database' });
    
    const analyzedA = JSON.parse(rowA.analyzed_results);
    const analyzedB = JSON.parse(rowB.analyzed_results);
    
    const summary = generateCoupleSummary(analyzedA, analyzedB);
    
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function uploadReport(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    
    // 1. OCR
    const ocrResults = await ocrSpaceService.process(filePath);
    const rawText = ocrResults.map(p => p.text).join('\n\n');
    
    // 2. LLM Extraction
    const extractedJson = await usgExtractorService.extract(rawText);
    
    // 3. Analysis Pipeline
    const analyzed = runAnalysis(extractedJson);
    if (!analyzed) throw new Error('Failed to analyze the extracted JSON structure');
    
    // 4. Persistence
    const reportId = uuidv4();
    const slayId = extractedJson.patient?.patient_slay_id || null;
    const stmt = db.prepare('INSERT INTO usg_reports (id, patient_slay_id, extracted_json, analyzed_results) VALUES (?, ?, ?, ?)');
    stmt.run(reportId, slayId, JSON.stringify(extractedJson), JSON.stringify(analyzed));
    
    // 5. Cleanup temp file
    fs.unlinkSync(filePath);
    
    res.json({ reportId, analyzed });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
}

module.exports = {
  liverScore,
  prostateScore,
  femaleReproductiveScore,
  gallbladderScore,
  kidneyScore,
  bladderScore,
  pancreasScore,
  spleenScore,
  compositeScore,
  calculateMetabolicHealthIndex,
  generateRiskFlags,
  generateCoupleInsights,
  calculateNuptiaScoreContribution,
  analyzeUsg,
  persistReport,
  getReport,
  analyzeCouple,
  getCoupleSummary,
  uploadReport
};
