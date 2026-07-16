const { db } = require('../services/storage/postgres.service');
const { generateStructuredInsight } = require('../services/llm.service');

// WS1B06: FEMALE_AGE_LIMIT/MALE_AGE_LIMIT were both dead — never referenced
// anywhere in this file (the actual age ceiling comes from the FEM/MAL tables'
// own natural clamping at their max key, 50 and 55 respectively). Removed rather
// than wired into a new hard age gate, which would be a real clinical-product
// decision on its own, not a bug fix.

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

// WS3A04: ages 35-44 were re-anchored to published natural fecundability data
// (ASRM 2022 committee opinion; standard fecundability-by-age literature: ~12%/
// cycle at 35, ~5% at 38, ~3-5% at 40, <2-3% at 42+). The previous table showed
// ~2x the literature value from 38-44 (e.g. age 40 displayed ~8.7% monthly vs.
// lit ~3-5%), understating the urgency of a specialist conversation for exactly
// the couples who most need one. 18-34 are unchanged (already close to
// literature at the one age explicitly checked, 30: ~19.8% shown vs ~20% lit).
// 45-50 now taper continuously into the existing 50:4 anchor (previously dead
// code — mfrAt hard-zeroed at 45 before interpolation ever reached it) instead
// of an absolute cliff to exactly 0, which claimed certainty ("blocked") the
// data doesn't support — natural conception at 45 is rare, not impossible.
const FEM = { 18: 97, 24: 97, 25: 94, 26: 92, 27: 90, 28: 88, 29: 87, 30: 86, 31: 83, 32: 80, 33: 76, 34: 72, 35: 52, 36: 38, 37: 28, 38: 21, 39: 19, 40: 17, 41: 14, 42: 11, 43: 9, 44: 7, 45: 5, 50: 4 };
const MAL = { 18: 97, 25: 97, 30: 95, 32: 91, 34: 89, 35: 87, 37: 83, 40: 80, 42: 76, 45: 71, 48: 66, 50: 62, 55: 55 };

function fScore(age, reserveAdj) { return Math.max(2, Math.min(100, interp(FEM, age) + reserveAdj)); }
function mScore(age, semenAdj) { return Math.max(2, Math.min(100, interp(MAL, age) + semenAdj)); }

function mfrAt(fa, ma, reserveAdj, semenAdj, isSevere = false) {
  const f = fScore(fa, reserveAdj);
  const m = mScore(ma, semenAdj);
  // WS1B03: the standard 0.6/0.4 blend lets a healthy partner mask a near-sterile
  // one — a Severe Deficit / Very Low reserve partner (concentration ~2, not
  // literally azoospermic — that's already a hard gate above) still let 40% of a
  // healthy partner's score pull the combined figure up to a falsely-reassuring
  // ~87% annual conception chance. Conception needs both gametes viable, so when
  // either partner is in the severe category, the weaker partner dominates the
  // blend (0.9/0.1) instead of being averaged away — without claiming the flat 0%
  // an absolute barrier gate would (a real, if small, chance still exists short of
  // outright azoospermia/absolute barriers). Non-severe couples are unaffected.
  const minWeight = isSevere ? 0.9 : 0.6;
  const combined = minWeight * Math.min(f, m) + (1 - minWeight) * Math.max(f, m);
  return (combined / 100) * 0.25; // biological MFR as probability
}

// Ovarian reserve classification
function classifyOvarianReserve(amh, afc, age) {
  if (amh === undefined && afc === undefined) return null;

  // WS1B04: only `undefined`/`null`/`isNaN` were rejected — any other finite
  // value, including negatives, was accepted as a real reading. AMH<=0 and AFC<0
  // are physiologically impossible (a classic OCR/extraction glitch, e.g. a
  // misread minus sign or misplaced decimal) and were silently classified as a
  // genuine "Very Low" reserve, which — via severeOvarianReserve — hard-gates the
  // couple to "natural conception blocked" from a single mis-extracted value. A
  // generous upper ceiling catches the same class of glitch on the other end
  // without false-rejecting genuinely high real values.
  const AMH_MAX_PLAUSIBLE = 20; // ng/mL — real AMH essentially never exceeds this
  const AFC_MAX_PLAUSIBLE = 50; // real antral follicle counts essentially never exceed this
  // WS3A02: the age-banded "Normal" ceiling floats UP with age (e.g. up to 1.5
  // ng/mL at 40+), so a 40-year-old with AMH 0.7 ng/mL read "Normal" here even
  // though ASRM/ACOG (the field's headline authority) flag AMH <1.0 ng/mL as
  // diminished ovarian reserve (DOR) regardless of age — ESHRE Bologna (0.5-1.1)
  // and POSEIDON (<1.2) concur a value in this range is not simply "normal for
  // age". The age-relative band is still useful context, but can no longer
  // present a value below the absolute DOR cutoff as better than "Low".
  const ABSOLUTE_DOR_THRESHOLD = 1.0; // ng/mL — ASRM/ACOG

  function classifyByAmh(val) {
    if (val === undefined || val === null || isNaN(val) || val <= 0 || val > AMH_MAX_PLAUSIBLE) return null;
    let ageRelative;
    if (age < 30) {
      if (val < 1.0) ageRelative = 'Very Low';
      else if (val <= 1.5) ageRelative = 'Low';
      else if (val <= 4.0) ageRelative = 'Normal';
      else ageRelative = 'High for age';
    } else if (age < 35) {
      if (val < 0.8) ageRelative = 'Very Low';
      else if (val <= 1.2) ageRelative = 'Low';
      else if (val <= 3.5) ageRelative = 'Normal';
      else ageRelative = 'High for age';
    } else if (age < 40) {
      if (val < 0.5) ageRelative = 'Very Low';
      else if (val <= 0.9) ageRelative = 'Low';
      else if (val <= 2.5) ageRelative = 'Normal';
      else ageRelative = 'High for age';
    } else {
      if (val < 0.3) ageRelative = 'Very Low';
      else if (val <= 0.6) ageRelative = 'Low';
      else if (val <= 1.5) ageRelative = 'Normal';
      else ageRelative = 'High for age';
    }

    if (val < ABSOLUTE_DOR_THRESHOLD && (ageRelative === 'Normal' || ageRelative === 'High for age')) {
      return 'Low';
    }
    return ageRelative;
  }

  function classifyByAfc(val) {
    if (val === undefined || val === null || isNaN(val) || val < 0 || val > AFC_MAX_PLAUSIBLE) return null;
    // WS3A03: the under-30 band previously called AFC<=11 "Low" — stricter than
    // the literature supports (11 is low-normal at this age, not clearly low).
    // Widened the Normal floor to 10 and anchored VeryLow/Low to the ESHRE
    // Bologna/POSEIDON poor-responder evidence (AFC <5-7), matching the already-
    // correct shape of the next age band rather than using a separate, uncited
    // wider VeryLow ceiling.
    if (age < 30) {
      if (val < 6) return 'Very Low';
      if (val <= 9) return 'Low';
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
// Callers compute these via parseFloat(findExtractedParam(...)?.value) — when a
// parameter is genuinely absent from the report, that expression evaluates to NaN,
// not undefined (parseFloat(undefined) === NaN). Every check below previously tested
// only `!== undefined && !== null`, which NaN passes, and then compared NaN against a
// threshold (e.g. `NaN < 16`), which is always false in JS — so a completely absent
// semen analysis silently fell through every single check as "not abnormal" and
// landed on the default 'Normal' category, fabricating a clean result from zero real
// data. classifyOvarianReserve's helper functions already guard against exactly this
// with isNaN() checks; this is the same fix applied here.
const isRealNumber = (x) => typeof x === 'number' && !isNaN(x);

function classifySemen(volume, concentration, totalCount, totalMotility, progressive, vitality, morphology, ph) {
  if (!isRealNumber(volume) && !isRealNumber(concentration) && !isRealNumber(totalCount) && !isRealNumber(totalMotility)) return null;

  const abnormalFields = [];
  let belowCount = 0;

  // Concentration
  if (isRealNumber(concentration)) {
    if (concentration === 0) return { category: 'Severe Deficit', details: 'Azoospermia' };
    if (concentration < 16) {
      belowCount++;
      abnormalFields.push('concentration');
    }
  }

  // Total Count
  if (isRealNumber(totalCount)) {
    if (totalCount === 0) return { category: 'Severe Deficit', details: 'Azoospermia' };
    if (totalCount < 39) {
      belowCount++;
      abnormalFields.push('total sperm count');
    }
  }

  // Volume
  if (isRealNumber(volume) && volume < 1.4) {
    belowCount++;
    abnormalFields.push('volume');
  }

  // Total Motility
  if (isRealNumber(totalMotility) && totalMotility < 42) {
    belowCount++;
    abnormalFields.push('total motility');
  }

  // Progressive Motility
  if (isRealNumber(progressive) && progressive < 30) {
    belowCount++;
    abnormalFields.push('progressive motility');
  }

  // Vitality
  if (isRealNumber(vitality) && vitality < 54) {
    belowCount++;
    abnormalFields.push('vitality');
  }

  // Morphology
  if (isRealNumber(morphology) && morphology < 4) {
    belowCount++;
    abnormalFields.push('morphology');
  }

  // pH
  if (isRealNumber(ph) && ph < 7.2) {
    belowCount++;
    abnormalFields.push('pH');
  }

  let category = 'Normal';
  if (belowCount >= 3 || (isRealNumber(concentration) && concentration < 5)) {
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

    // Every downstream input silently defaults to a favourable value when absent
    // (age -> 30, ovarian reserve -> 'Normal', semen quality -> 'Normal', lifestyle
    // penalties -> 0) — an empty or malformed request previously still produced a
    // precise, reassuring ~94% / "Aligned" result with no signal that nothing real
    // was actually submitted (WS1B02). Age is the one input the real onboarding flow
    // always has (DOB is a required field before a match can even be requested — see
    // CompatibilityContext.js's own pre-flight validation), so requiring both real
    // ages here is a low-risk floor: it only rejects a request that's already
    // missing data no legitimate flow would omit, rather than fabricating a result.
    // WS1B05: a bare parseFloat + `|| 30` fallback accepted any finite number,
    // including implausible ones, as a real age — a negative age (or one below
    // 18/above 60) was passed straight through: age -3 clamped to the fertility
    // table's minimum key and returned the *best* possible score; age 0
    // specifically got the `|| 30` fallback (0 is falsy) while -3 didn't, an
    // inconsistency with no basis. plausibleAge treats anything outside a
    // realistic reproductive-relevant range the same as genuinely missing.
    const plausibleAge = (raw) => (typeof raw === 'number' && !isNaN(raw) && raw >= 18 && raw <= 60) ? raw : null;
    const fAgePlausible = plausibleAge(parseFloat(female_manual_data.age));
    const mAgePlausible = plausibleAge(parseFloat(male_manual_data.age));
    if (fAgePlausible === null && mAgePlausible === null) {
      return res.status(422).json({
        success: false,
        error: 'insufficient_data',
        message: 'Not enough information to estimate fertility timelines yet — at least both partners’ ages are required.'
      });
    }

    // Extract Female Inputs
    const fAge = fAgePlausible ?? 30;

    // Auto-detect Ovarian markers from report if available
    const amhValue = parsedFemaleData ? parseFloat(findExtractedParam(parsedFemaleData, 'amh')?.value) : undefined;
    const afcValue = parsedFemaleData ? parseFloat(findExtractedParam(parsedFemaleData, 'afc')?.value) : undefined;
    
    const calculatedReserve = classifyOvarianReserve(amhValue, afcValue, fAge);
    // WS1B06: defaulting genuinely-absent labs to 'Normal' doesn't just mislabel —
    // it fabricates a real positive claim downstream ("✓ Ovarian reserve
    // appropriate for age" below fires on exactly this default). 'Not Assessed'
    // carries the same neutral 0-point modifier (reserveModifiers has no entry for
    // it) but can no longer be mistaken for a genuine measured-normal result.
    const ovarianReserve = female_manual_data.ovarianReserve || calculatedReserve || 'Not Assessed';

    // Extract Male Inputs
    const mAge = mAgePlausible ?? 30;

    // Auto-detect Semen markers from report — canonical names must match the real
    // ontology exactly (see ontologyMapper.service.js); several of these previously
    // used guessed names ('total_sperm_count', 'total_motility', 'progressive_motility',
    // 'vitality', 'morphology', 'ph') that don't match what the extractor actually
    // produces, so those fields always silently read as undefined from a real report
    // — only sperm_concentration and semen_volume happened to already be correct.
    const semVol = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'semen_volume')?.value) : undefined;
    const semConc = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'sperm_concentration')?.value) : undefined;
    const semCount = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'total_sperm_count_per_ejaculate')?.value) : undefined;
    const semMot = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'total_sperm_motility')?.value) : undefined;
    const semProg = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'progressive_motility_pr')?.value) : undefined;
    const semVit = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'sperm_vitality_viability')?.value) : undefined;
    const semMorph = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'sperm_morphology_normal_forms')?.value) : undefined;
    const semPh = parsedMaleData ? parseFloat(findExtractedParam(parsedMaleData, 'semen_ph')?.value) : undefined;

    const calculatedSemen = classifySemen(semVol, semConc, semCount, semMot, semProg, semVit, semMorph, semPh);
    // WS1B06: same reasoning as ovarianReserve above — 'Not Assessed' keeps the
    // same neutral 0-point modifier but stops "✓ Semen parameters meet standard
    // WHO reference values" from firing on a report with no semen analysis at all.
    const semenQuality = male_manual_data.semenQuality || calculatedSemen?.category || 'Not Assessed';

    // Validate progressive motility <= total motility if parsed
    let validationIssue = null;
    if (semProg !== undefined && semMot !== undefined && semProg > semMot) {
      validationIssue = 'Progressive motility cannot exceed total motility. Check report extraction parameters.';
    }

    // Convert string categories to adj points.
    // 'Very Low' ovarian reserve is intentionally left at its original -20 here —
    // unlike Severe Deficit below, it's not this modifier doing the work: a few
    // lines down, `severeOvarianReserve` already routes 'Very Low' through the
    // absolute-barrier `gate` (p_12m forced to exactly 0), which fully overrides
    // whatever fScore/fReserveAdj compute. Changing this constant would be a no-op
    // in every reachable path and just mislead a future reader into thinking it's
    // load-bearing.
    const reserveModifiers = { 'High for age': 5, 'Normal': 0, 'Low': -10, 'Very Low': -20 };
    let fReserveAdj = reserveModifiers[ovarianReserve] || 0;

    // WS1B03 (part 2): -30 for Severe Deficit only dropped a young male partner's
    // own score to ~65/100 — nowhere near severe enough for cryptozoospermia
    // (conc<5, a WHO-severe finding on its own) to read as near-sterile even with
    // the heavier min-weighted blend above. Unlike ovarian reserve, semen quality
    // has no equivalent absolute-barrier gate for this category (only literal
    // azoospermia, conc===0, is separately hard-gated), so this modifier is the
    // only lever — raised enough to floor mScore's own Math.max(2, ...) clamp
    // across the realistic age range on its own, without needing to stack with
    // age/AZFc/varicocele-type compounding factors the way -30 required. Mild/
    // Moderate are unchanged — only the most-severe tier moves.
    const semenModifiers = { 'Normal': 0, 'Mild Deficit': -8, 'Moderate Deficit': -18, 'Severe Deficit': -95 };
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

    // Absolute Barriers. calculatedSemen (server-computed directly from the pathology
    // PDF, above) is included here as its own independent trigger — previously the
    // azoospermia gate only fired from the client-supplied barriers.b_azoo flag, so
    // any caller that didn't perfectly replicate the client's own detection logic
    // (or simply didn't send it) would silently lose this specific hard gate even
    // though the server already knows the real answer from the same report.
    // Likewise, a "Very Low" ovarian reserve classification (already an age-banded
    // clinical judgment from classifyOvarianReserve, not a raw number) previously
    // only applied a flat -20 point continuous adjustment — clinically this reads
    // closer to a specialist-referral case than "plan together with a slightly lower
    // score," so it's promoted to a hard gate here too.
    const serverDetectedAzoospermia = calculatedSemen?.details === 'Azoospermia';
    const severeOvarianReserve = calculatedReserve === 'Very Low' || ovarianReserve === 'Very Low';
    const gate = barriers.b_tubal || barriers.b_azoo || barriers.b_uterus ||
                 male_manual_data.scrotalFinding === 'Obstruction / CBAVD' ||
                 physicalBlock || geneticBlock || serverDetectedAzoospermia || severeOvarianReserve;

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

    // WS1B03: cryptozoospermia/severely diminished reserve (Severe Deficit / Very
    // Low) isn't an absolute barrier like azoospermia (already a hard gate above),
    // but it's severe enough that a healthy partner's score must not be allowed to
    // pull the blended figure back up to a falsely-reassuring range.
    const isSevereFactor = ovarianReserve === 'Very Low' || semenQuality === 'Severe Deficit';

    // Current projection logic
    const bioNow = mfrAt(fAge, mAge, fReserveAdj, mSemenAdj, isSevereFactor);
    let p_monthly_current = gate ? 0 : (bioNow * lambda_current * freqVal);
    let p_monthly_optimised = gate ? 0 : (bioNow * lambda_optimised * freqVal);

    // Calculate age curves
    const years = Array.from({ length: 11 }, (_, i) => i);
    const projection_current = [];
    const projection_optimised = [];

    for (let y = 0; y < 11; y++) {
      const bioY = mfrAt(fAge + y, mAge + y, fReserveAdj, mSemenAdj, isSevereFactor);
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
  analyzeMfr,
  // Exposed so other consumers of AMH (e.g. reportSummary.service.js's hormones
  // body-health card) can reuse this real, age-banded classification instead of
  // maintaining their own separate, age-blind cutoff that could disagree with it for
  // the same lab value.
  classifyOvarianReserve
};
