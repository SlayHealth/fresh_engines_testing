const { db } = require('../services/storage/postgres.service');
const { generateStructuredInsight } = require('../services/llm.service');

// Constants
const FEMALE_AGE_LIMIT = 45;
const MALE_AGE_LIMIT = 55;

// ---- age -> biological score (illustrative curves) ----
function interp(table, age) {
  const ks = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (age <= ks[0]) return table[ks[0]];
  if (age >= ks[ks.length - 1]) return table[ks[ks.length - 1]];
  for (let i = 0; i < ks.length - 1; i++) {
    if (age >= ks[i] && age <= ks[i + 1]) {
      const t = (age - ks[i]) / (ks[i + 1] - ks[i]);
      return table[ks[i]] + t * (table[ks[i + 1]] - table[ks[i]]);
    }
  }
  return table[ks[ks.length - 1]];
}

const FEM = { 18: 97, 24: 97, 25: 94, 26: 92, 27: 90, 28: 88, 29: 87, 30: 86, 31: 83, 32: 80, 33: 76, 34: 72, 35: 67, 36: 62, 37: 56, 38: 50, 39: 44, 40: 38, 41: 31, 42: 24, 43: 17, 44: 11, 45: 7, 50: 4 };
const MAL = { 18: 97, 25: 97, 30: 95, 32: 91, 34: 89, 35: 87, 37: 83, 40: 80, 42: 76, 45: 71, 48: 66, 50: 62, 55: 55 };

function fScore(age, reserveAdj) { return Math.max(2, Math.min(100, interp(FEM, age) + reserveAdj)); }
function mScore(age, semenAdj) { return Math.max(2, Math.min(100, interp(MAL, age) + semenAdj)); }

function mfrAt(fa, ma, reserveAdj, semenAdj) {
  if (fa >= 45) return 0.0; // Strict drop to 0 at age 45

  const f = fScore(fa, reserveAdj);
  const m = mScore(ma, semenAdj);
  const combined = 0.6 * Math.min(f, m) + 0.4 * Math.max(f, m);
  return (combined / 100) * 0.25; // biological MFR as probability
}

// Ovarian reserve classification
function classifyOvarianReserve(amh, afc, age) {
  if (amh === undefined && afc === undefined) return null;

  function classifyByAmh(val) {
    if (val === undefined || val === null || isNaN(val)) return null;
    if (age < 30) {
      if (val < 1.0) return 'Very Low';
      if (val <= 1.5) return 'Low';
      if (val <= 4.0) return 'Normal';
      return 'High for age';
    } else if (age < 35) {
      if (val < 0.8) return 'Very Low';
      if (val <= 1.2) return 'Low';
      if (val <= 3.5) return 'Normal';
      return 'High for age';
    } else if (age < 40) {
      if (val < 0.5) return 'Very Low';
      if (val <= 0.9) return 'Low';
      if (val <= 2.5) return 'Normal';
      return 'High for age';
    } else {
      if (val < 0.3) return 'Very Low';
      if (val <= 0.6) return 'Low';
      if (val <= 1.5) return 'Normal';
      return 'High for age';
    }
  }

  function classifyByAfc(val) {
    if (val === undefined || val === null || isNaN(val)) return null;
    if (age < 30) {
      if (val < 8) return 'Very Low';
      if (val <= 11) return 'Low';
      if (val <= 20) return 'Normal';
      return 'High for age';
    } else if (age < 35) {
      if (val < 6) return 'Very Low';
      if (val <= 9) return 'Low';
      if (val <= 18) return 'Normal';
      return 'High for age';
    } else if (age < 40) {
      if (val < 4) return 'Very Low';
      if (val <= 7) return 'Low';
      if (val <= 14) return 'Normal';
      return 'High for age';
    } else {
      if (val < 3) return 'Very Low';
      if (val <= 5) return 'Low';
      if (val <= 10) return 'Normal';
      return 'High for age';
    }
  }

  const classAmh = classifyByAmh(amh);
  const classAfc = classifyByAfc(afc);

  const rank = { 'Very Low': 0, 'Low': 1, 'Normal': 2, 'High for age': 3 };
  if (classAmh && classAfc) {
    return rank[classAmh] < rank[classAfc] ? classAmh : classAfc;
  }
  return classAmh || classAfc || null;
}

// Semen analysis classification (WHO 2021 Limits)
function classifySemen(volume, concentration, totalCount, totalMotility, progressive, vitality, morphology, ph) {
  if (volume === undefined && concentration === undefined && totalMotility === undefined) return null;

  const abnormalFields = [];
  let belowCount = 0;

  // Concentration
  if (concentration !== undefined && concentration !== null) {
    if (concentration === 0) return { category: 'Severe Deficit', details: 'Azoospermia' };
    if (concentration < 16) {
      belowCount++;
      abnormalFields.push('concentration');
    }
  }

  // Total Count
  if (totalCount !== undefined && totalCount !== null) {
    if (totalCount === 0) return { category: 'Severe Deficit', details: 'Azoospermia' };
    if (totalCount < 39) {
      belowCount++;
      abnormalFields.push('total sperm count');
    }
  }

  // Volume
  if (volume !== undefined && volume !== null && volume < 1.4) {
    belowCount++;
    abnormalFields.push('volume');
  }

  // Total Motility
  if (totalMotility !== undefined && totalMotility !== null && totalMotility < 42) {
    belowCount++;
    abnormalFields.push('total motility');
  }

  // Progressive Motility
  if (progressive !== undefined && progressive !== null && progressive < 30) {
    belowCount++;
    abnormalFields.push('progressive motility');
  }

  // Vitality
  if (vitality !== undefined && vitality !== null && vitality < 54) {
    belowCount++;
    abnormalFields.push('vitality');
  }

  // Morphology
  if (morphology !== undefined && morphology !== null && morphology < 4) {
    belowCount++;
    abnormalFields.push('morphology');
  }

  // pH
  if (ph !== undefined && ph !== null && ph < 7.2) {
    belowCount++;
    abnormalFields.push('pH');
  }

  let category = 'Normal';
  if (belowCount >= 3 || (concentration !== undefined && concentration < 5)) {
    category = 'Severe Deficit';
  } else if (belowCount === 2) {
    category = 'Moderate Deficit';
  } else if (belowCount === 1) {
    category = 'Mild Deficit';
  }

  let details = 'All semen parameters align with reference ranges';
  if (abnormalFields.length > 0) {
    details = `Reduced parameters detected: ${abnormalFields.join(', ')}`;
  }

  return { category, details };
}

// Map manual input helper
function findExtractedParam(extracted_data, canonical_name) {
  if (!extracted_data) return null;
  for (const sectionKey of Object.keys(extracted_data)) {
    const section = extracted_data[sectionKey];
    if (section && section[canonical_name]) {
      return section[canonical_name];
    }
  }
  return null;
}

// Main Analyze Controller
async function analyzeMfr(req, res, next) {
  try {
    const { 
      male_report_id, 
      female_report_id, 
      male_manual_data = {}, 
      female_manual_data = {},
      shared_lifestyle = {},
      barriers = {},
      match_id
    } = req.body;

    let parsedMaleData = null;
    let parsedFemaleData = null;

    if (male_report_id) {
      const maleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [male_report_id]);
      const maleReport = maleReportRes.rows[0];
      if (maleReport) parsedMaleData = JSON.parse(maleReport.extracted_json);
    }
    if (female_report_id) {
      const femaleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [female_report_id]);
      const femaleReport = femaleReportRes.rows[0];
      if (femaleReport) parsedFemaleData = JSON.parse(femaleReport.extracted_json);
    }

    // Extract Female Inputs
    const fAge = parseFloat(female_manual_data.age) || 30;
    
    // Auto-detect Ovarian markers from report if available
    const amhValue = parsedFemaleData ? parseFloat(findExtractedParam(parsedFemaleData, 'amh')?.value) : undefined;
    const afcValue = parsedFemaleData ? parseFloat(findExtractedParam(parsedFemaleData, 'afc')?.value) : undefined;
    
    const calculatedReserve = classifyOvarianReserve(amhValue, afcValue, fAge);
    const ovarianReserve = female_manual_data.ovarianReserve || calculatedReserve || 'Normal';

    // Extract Male Inputs
    const mAge = parseFloat(male_manual_data.age) || 30;

    // Auto-detect Semen markers from report
    const semVol = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'semen_volume')?.value) : undefined;
    const semConc = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'sperm_concentration')?.value) : undefined;
    const semCount = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'total_sperm_count')?.value) : undefined;
    const semMot = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'total_motility')?.value) : undefined;
    const semProg = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'progressive_motility')?.value) : undefined;
    const semVit = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'vitality')?.value) : undefined;
    const semMorph = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'morphology')?.value) : undefined;
    const semPh = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'ph')?.value) : undefined;

    const calculatedSemen = classifySemen(semVol, semConc, semCount, semMot, semProg, semVit, semMorph, semPh);
    const semenQuality = male_manual_data.semenQuality || calculatedSemen?.category || 'Normal';

    // Validate progressive motility <= total motility if parsed
    let validationIssue = null;
    if (semProg !== undefined && semMot !== undefined && semProg > semMot) {
      validationIssue = 'Progressive motility cannot exceed total motility. Check report extraction parameters.';
    }

    // Convert string categories to adj points
    const reserveModifiers = { 'High for age': 5, 'Normal': 0, 'Low': -10, 'Very Low': -20 };
    let fReserveAdj = reserveModifiers[ovarianReserve] || 0;

    const semenModifiers = { 'Normal': 0, 'Mild Deficit': -8, 'Moderate Deficit': -18, 'Severe Deficit': -30 };
    let mSemenAdj = semenModifiers[semenQuality] || 0;

    // Retrieve evaluationTier from request body
    const evaluationTier = parseInt(req.body.evaluationTier) || 1;

    // Tiers 2 & 3: Radiology (USG) Modifiers
    let radWarnings = [];
    let physicalBlock = false;

    if (evaluationTier >= 2) {
      // Female Pelvic USG / HSG modifiers
      const uterineLining = female_manual_data.uterineLining || 'Normal';
      const fibroids = female_manual_data.fibroids || 'None';
      const tubalPatency = female_manual_data.tubalPatency || 'Both open';
      const pcosMorphology = female_manual_data.pcosMorphology || 'None';
      const ovarianVolume = female_manual_data.ovarianVolume || 'Normal';
      const pelvicFluid = female_manual_data.pelvicFluid || 'No';
      const fFattyLiver = female_manual_data.fattyLiverGrade || 'None';

      if (uterineLining === 'Thin') {
        fReserveAdj -= 8;
        radWarnings.push('Thin endometrial lining (<7mm) reduces implantation success probability');
      } else if (uterineLining === 'Thick') {
        fReserveAdj -= 3;
      }

      if (fibroids === 'Submucosal') {
        fReserveAdj -= 15;
        radWarnings.push('Submucosal uterine fibroid/polyp significantly impedes implantation');
      } else if (fibroids === 'Intramural') {
        fReserveAdj -= 6;
      }

      if (tubalPatency === 'One blocked') {
        fReserveAdj -= 12;
        radWarnings.push('Unilateral fallopian tubal obstruction reduces monthly egg transport chance');
      } else if (tubalPatency === 'Both blocked') {
        physicalBlock = true;
        radWarnings.push('Bilateral fallopian tubal obstruction blocks natural fertilization pathway');
      }

      if (pcosMorphology === 'Bilateral') {
        fReserveAdj -= 15;
        radWarnings.push('Bilateral polycystic ovarian morphology (BCOM) suggests risk of ovulatory dysfunction');
      } else if (pcosMorphology === 'Unilateral') {
        fReserveAdj -= 8;
        radWarnings.push('Unilateral polycystic ovarian morphology indicates potential ovulatory irregularity');
      }

      if (ovarianVolume === 'Enlarged') {
        fReserveAdj -= 5;
        radWarnings.push('Enlarged ovarian volume (>10cc) exceeds the standard Rotterdam classification threshold');
      }

      if (pelvicFluid === 'Yes') {
        fReserveAdj -= 5;
        radWarnings.push('Significant free fluid in the Pouch of Douglas (POD) may indicate pelvic inflammatory response or endometriosis');
      }

      if (fFattyLiver === 'Grade I') {
        fReserveAdj -= 2;
        radWarnings.push('Female: Mild fatty liver (Grade I) indicates early metabolic overload');
      } else if (fFattyLiver === 'Grade II') {
        fReserveAdj -= 5;
        radWarnings.push('Female: Moderate fatty liver (Grade II) is associated with insulin resistance, potentially affecting egg quality');
      } else if (fFattyLiver === 'Grade III') {
        fReserveAdj -= 10;
        radWarnings.push('Female: Severe fatty liver (Grade III) represents a high metabolic inflammatory burden impacting systemic reproductive reserve');
      }

      // Male Scrotal & Abdominal USG modifiers
      const varicoceleGrade = male_manual_data.varicoceleGrade || 'None';
      const testicularVolume = male_manual_data.testicularVolume || 'Normal';
      const scrotalObstruction = male_manual_data.scrotalObstruction || 'No';
      const prostateGrade = male_manual_data.prostateGrade || 'None';
      const pvrVolume = male_manual_data.pvrVolume || 'Normal';
      const mFattyLiver = male_manual_data.fattyLiverGrade || 'None';

      if (varicoceleGrade === 'Grade 1') {
        mSemenAdj -= 3;
      } else if (varicoceleGrade === 'Grade 2') {
        mSemenAdj -= 7;
        radWarnings.push('Moderate varicocele (Grade 2) may increase scrotal heat and oxidative stress');
      } else if (varicoceleGrade === 'Grade 3') {
        mSemenAdj -= 12;
        radWarnings.push('Severe varicocele (Grade 3) significantly impairs spermatogenesis');
      }

      if (testicularVolume === 'Low') {
        mSemenAdj -= 5;
        radWarnings.push('Reduced testicular volume suggests lower sperm production capacity');
      }

      if (scrotalObstruction === 'Yes') {
        physicalBlock = true;
        radWarnings.push('Epididymal/scrotal tract obstruction impedes natural sperm ejaculation');
      }

      if (prostateGrade === 'Grade I') {
        mSemenAdj -= 3;
      } else if (prostateGrade === 'Grade II') {
        mSemenAdj -= 6;
        radWarnings.push('Male: Moderate prostatomegaly (Grade II) may cause urinary tract and reproductive pathway pressure');
      } else if (prostateGrade === 'Grade III') {
        mSemenAdj -= 12;
        radWarnings.push('Male: Severe prostatomegaly (Grade III) represents a high risk for retrograde ejaculation or prostatic duct occlusion');
      }

      if (pvrVolume === 'Borderline') {
        mSemenAdj -= 2;
      } else if (pvrVolume === 'Significant') {
        mSemenAdj -= 5;
        radWarnings.push('Male: Significant post-void residual (PVR >100cc) indicates bladder voiding inefficiency and pelvic floor strain');
      }

      if (mFattyLiver === 'Grade I') {
        mSemenAdj -= 2;
        radWarnings.push('Male: Mild fatty liver (Grade I) indicates early metabolic overload');
      } else if (mFattyLiver === 'Grade II') {
        mSemenAdj -= 5;
        radWarnings.push('Male: Moderate fatty liver (Grade II) is associated with metabolic syndrome, which may increase sperm DNA fragmentation');
      } else if (mFattyLiver === 'Grade III') {
        mSemenAdj -= 10;
        radWarnings.push('Male: Severe fatty liver (Grade III) represents a high metabolic inflammatory burden impacting spermatogenesis');
      }
    }

    // Tier 3: Genomics Modifiers
    let genomicWarnings = [];
    let geneticBlock = false;

    if (evaluationTier === 3) {
      // Male Genomics
      const yDeletion = male_manual_data.yDeletion || 'None';
      const maleKaryotype = male_manual_data.maleKaryotype || 'Normal 46,XY';

      if (yDeletion === 'AZFa' || yDeletion === 'AZFb') {
        geneticBlock = true;
        genomicWarnings.push('Y-chromosome microdeletion in AZFa/AZFb region prevents mature sperm production');
      } else if (yDeletion === 'AZFc') {
        mSemenAdj -= 25;
        genomicWarnings.push('AZFc microdeletion causes progressive severe reduction in sperm count');
      }

      if (maleKaryotype !== 'Normal 46,XY') {
        geneticBlock = true;
        genomicWarnings.push('Abnormal male karyotype (e.g. 47,XXY Klinefelter) typically leads to azoospermia');
      }

      // Female Genomics
      const mthfr = female_manual_data.mthfr || 'None';
      const femaleKaryotype = female_manual_data.femaleKaryotype || 'Normal 46,XX';
      const cftrCarrier = female_manual_data.cftrCarrier || 'No';

      if (mthfr === 'Homozygous') {
        fReserveAdj -= 8;
        genomicWarnings.push('Homozygous MTHFR mutation increases homocysteine and gestational loss risk');
      } else if (mthfr === 'Heterozygous') {
        fReserveAdj -= 3;
      }

      if (femaleKaryotype !== 'Normal 46,XX') {
        fReserveAdj -= 20;
        genomicWarnings.push('Abnormal female karyotype (e.g. 45,X Turner variant) impairs ovarian reserve');
      }

      // CFTR carrier transmission warning
      const hasCBAVD = male_manual_data.scrotalFinding === 'Obstruction / CBAVD' || male_manual_data.b_azoo;
      if (cftrCarrier === 'Yes' && hasCBAVD) {
        genomicWarnings.push('CFTR Carrier status + Male CBAVD risk suggests a high chance of cystic fibrosis transmission');
      }
    }

    // Absolute Barriers
    const gate = barriers.b_tubal || barriers.b_azoo || barriers.b_uterus || 
                 male_manual_data.scrotalFinding === 'Obstruction / CBAVD' || 
                 physicalBlock || geneticBlock;

    // Shared Lifestyle
    const smokeVal = shared_lifestyle.smoke !== undefined ? parseFloat(shared_lifestyle.smoke) : 0;
    const bmiVal = shared_lifestyle.bmi !== undefined ? parseFloat(shared_lifestyle.bmi) : 0;
    const actVal = shared_lifestyle.act !== undefined ? parseFloat(shared_lifestyle.act) : 0;
    const alcVal = shared_lifestyle.alc !== undefined ? parseFloat(shared_lifestyle.alc) : 0;
    const stressVal = shared_lifestyle.stress !== undefined ? parseFloat(shared_lifestyle.stress) : 0;
    const freqVal = shared_lifestyle.freq !== undefined ? parseFloat(shared_lifestyle.freq) : 0.92; // default twice/wk

    const totalPenalty = smokeVal + bmiVal + actVal + alcVal + stressVal;
    const L = Math.max(0, 100 - totalPenalty); // Lifestyle index

    const lambda_current = 0.55 + 0.45 * (L / 100);
    const lambda_optimised = 1.00;

    // Current projection logic
    const bioNow = mfrAt(fAge, mAge, fReserveAdj, mSemenAdj);
    let p_monthly_current = gate ? 0 : (bioNow * lambda_current * freqVal);
    let p_monthly_optimised = gate ? 0 : (bioNow * lambda_optimised * freqVal);

    // Calculate age curves
    const years = Array.from({ length: 11 }, (_, i) => i);
    const projection_current = [];
    const projection_optimised = [];

    for (let y = 0; y < 11; y++) {
      const bioY = mfrAt(fAge + y, mAge + y, fReserveAdj, mSemenAdj);
      projection_current.push(gate ? 0 : bioY * lambda_current * freqVal * 100);
      projection_optimised.push(gate ? 0 : bioY * lambda_optimised * freqVal * 100);
    }

    // Cumulative 12-Month conception probability
    const p_12m_current = gate ? 0.0 : (1.0 - Math.pow(1.0 - p_monthly_current, 12));
    const p_12m_optimised = gate ? 0.0 : (1.0 - Math.pow(1.0 - p_monthly_optimised, 12));

    // Time to conceive
    let time_to_conceive = 'N/A';
    if (gate) {
      time_to_conceive = 'Natural conception blocked. Assisted Reproductive Technology (ART) or medical intervention required.';
    } else if (p_monthly_current > 0) {
      const medianMonths = Math.max(1, Math.round(1 / p_monthly_current)); 
      time_to_conceive = `~${medianMonths} ${medianMonths === 1 ? 'mo' : 'mo'}`;
    } else {
      time_to_conceive = 'Conception likelihood extremely low under current parameters. Specialist evaluation advised.';
    }

    // Status pill
    let state = 'Aligned';
    if (gate) {
      state = 'Specialist conversation';
    } else if (p_monthly_current * 100 >= 18) {
      state = 'Aligned';
    } else if (p_monthly_current * 100 >= 12) {
      state = 'Plan together';
    } else {
      state = 'Specialist conversation';
    }

    // Narrative details & Strengths via LLM (Dynamic Insights)
    let positive_findings = [];
    let summary = '';
    
    try {
      const llmMessages = [
        {
          role: "system",
          content: "You are a specialized reproductive endocrinologist AI. Your task is to analyze clinical fertility metrics and provide two things in a JSON format: a list of 'positive_findings' (clinical strengths, 1-4 short bullet points) and a 'summary' (a supportive, professional 2-4 sentence clinician assessment summary). Keep the tone encouraging but medically accurate. Avoid definitive guarantees."
        },
        {
          role: "user",
          content: `Please analyze this couple's fertility profile:
Female: Age ${fAge}, Ovarian Reserve: ${ovarianReserve}
Male: Age ${mAge}, Semen Quality: ${semenQuality}
Shared Lifestyle Score: ${L}/100 (where >80 is good)
Absolute Barrier Present: ${gate} (Reasons: ${gate ? JSON.stringify(barriers) + (physicalBlock ? ' radiological block ' : '') + (geneticBlock ? ' genetic block ' : '') : 'None'})
Current State Category: ${state} (Aligned, Plan together, or Specialist conversation)
Current Monthly Conception Chance: ${(p_monthly_current * 100).toFixed(1)}%
Respond ONLY with JSON matching this schema: { "positive_findings": ["str1", "str2"], "summary": "string" }`
        }
      ];
      
      const fallbackObj = {
        positive_findings: [
          fAge < 35 ? '✓ Female age is optimal for natural conception timeline' : '✓ Female age incorporated into baseline',
          ovarianReserve === 'Normal' || ovarianReserve === 'High for age' ? '✓ Ovarian reserve appropriate for age' : null,
          semenQuality === 'Normal' ? '✓ Semen parameters meet standard WHO reference values' : null,
          !gate ? '✓ No evidence of obstruction' : null,
          L >= 85 ? '✓ Personal lifestyle profiles strongly support healthy fertility' : null
        ].filter(Boolean),
        summary: gate 
          ? "Natural pathways are currently blocked due to an absolute barrier. The model routes to a specialist / IVF pathway rather than producing a probability."
          : (state !== 'Aligned' ? "Fertility potential shows moderate reduction. Lifestyle enhancements and tracking ovulation present key recovery pathways." : "Fertility parameters are aligned. The biological age profile, healthy ovarian reserve, and unimpeded physical pathways indicate highly favorable natural conception markers.")
      };

      const cacheKey = match_id ? `mfr_insights_${match_id}` : null;
      const llmResult = await generateStructuredInsight(llmMessages, fallbackObj, { temperature: 0.3, max_tokens: 400, cacheKey });
      positive_findings = llmResult.positive_findings || fallbackObj.positive_findings;
      summary = llmResult.summary || fallbackObj.summary;
    } catch (err) {
      console.error("[MFR] LLM Generation failed:", err);
      // Ensure fallbacks are populated if exception occurs
      positive_findings = ['✓ Core metrics processed successfully'];
      summary = gate ? "Specialist consultation recommended due to detected barriers." : "Fertility baseline established successfully.";
    }

    const calculations = {
      female_age: fAge,
      female_base_score: interp(FEM, fAge),
      female_reserve_adj: fReserveAdj,
      female_final_score: fScore(fAge, fReserveAdj),
      male_age: mAge,
      male_base_score: interp(MAL, mAge),
      male_semen_adj: mSemenAdj,
      male_final_score: mScore(mAge, mSemenAdj),
      bio_mfr: bioNow,
      lifestyle_index: L,
      lifestyle_multiplier_current: lambda_current,
      lifestyle_multiplier_optimised: lambda_optimised,
      frequency_multiplier: freqVal,
      p_monthly_current: p_monthly_current,
      p_monthly_optimised: p_monthly_optimised,
      p_12m_current: p_12m_current,
      p_12m_optimised: p_12m_optimised
    };

    res.json({
      success: true,
      state,
      monthly_chance_current: p_monthly_current * 100,
      monthly_chance_optimised: p_monthly_optimised * 100,
      p_12m_current: p_12m_current * 100,
      p_12m_optimised: p_12m_optimised * 100,
      time_to_conceive,
      positive_findings,
      summary,
      validation_issue: validationIssue,
      rad_warnings: radWarnings,
      genomic_warnings: genomicWarnings,
      projection: {
        current: projection_current,
        optimised: projection_optimised,
        years
      },
      calculations,
      details: {
        female_age: fAge,
        female_ovarian_reserve: ovarianReserve,
        male_age: mAge,
        male_semen_quality: semenQuality,
        lifestyle_score: L,
        gate: gate,
        detected_reserve_from_pathology: calculatedReserve,
        detected_semen_from_pathology: calculatedSemen
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyzeMfr
};
