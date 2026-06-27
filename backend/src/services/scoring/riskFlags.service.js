function generateRiskFlags(findings, sex, age) {
  const flags = [];
  if (!findings) return flags;

  // 1. Whole Abdomen / Pelvis USG findings
  const abdomenData = findings.USG_ABDOMEN || findings.USG_ABDOMEN_PELVIS || findings.USG_PELVIS;
  if (abdomenData) {
    // PCOS
    if (abdomenData.ovaries?.pcos_morphology_bilateral) {
      flags.push({
        flag_id: 'PCOS_BILATERAL',
        flag_label: 'Bilateral PCOS Morphology',
        organ: 'ovaries',
        severity: 'high',
        fertility_relevance: 'critical',
        clinical_note: 'BCOM detected.',
        recommended_action: 'Endocrinology consultation.'
      });
    } else if (abdomenData.ovaries?.pcos_morphology_unilateral) {
      flags.push({
        flag_id: 'PCOS_UNILATERAL',
        flag_label: 'Unilateral PCOS Morphology',
        organ: 'ovaries',
        severity: 'moderate',
        fertility_relevance: 'high',
        clinical_note: 'PCOS changes in one ovary.',
        recommended_action: 'Clinical correlation.'
      });
    }

    // Fatty Liver
    if (abdomenData.liver?.fatty_grade === 2) {
      flags.push({
        flag_id: 'FATTY_LIVER_2',
        flag_label: 'Grade II Fatty Liver',
        organ: 'liver',
        severity: 'moderate',
        fertility_relevance: age < 30 ? 'moderate' : 'low',
        clinical_note: 'Moderate fat accumulation.',
        recommended_action: 'Lifestyle/diet changes.'
      });
    } else if (abdomenData.liver?.fatty_grade === 1) {
      flags.push({
        flag_id: 'FATTY_LIVER_1',
        flag_label: 'Grade I Fatty Liver',
        organ: 'liver',
        severity: 'low',
        fertility_relevance: 'low',
        clinical_note: 'Mild fat accumulation.',
        recommended_action: 'Diet changes.'
      });
    }

    // Prostate BPH
    if (abdomenData.prostate?.grade === 'Grade_I') {
      flags.push({
        flag_id: 'BPH_I',
        flag_label: 'Prostatomegaly Grade I',
        organ: 'prostate',
        severity: 'moderate',
        fertility_relevance: 'moderate',
        clinical_note: 'Mild enlargement.',
        recommended_action: 'Urology follow-up.'
      });
    } else if (['Grade_II', 'Grade_III', 'Grade II', 'Grade III'].includes(abdomenData.prostate?.grade)) {
      flags.push({
        flag_id: 'BPH_SEVERE',
        flag_label: 'Prostatomegaly Grade ' + abdomenData.prostate.grade,
        organ: 'prostate',
        severity: 'high',
        fertility_relevance: 'high',
        clinical_note: 'Significant enlargement.',
        recommended_action: 'Urology consult.'
      });
    }

    // Renal Calculus
    const rCalc = abdomenData.kidneys?.right?.calculi_present;
    const lCalc = abdomenData.kidneys?.left?.calculi_present;
    if (rCalc || lCalc) {
      flags.push({
        flag_id: 'RENAL_CALCULUS',
        flag_label: 'Renal Calculus',
        organ: 'kidneys',
        severity: 'low',
        fertility_relevance: sex === 'Female' ? 'moderate' : 'low',
        clinical_note: 'Kidney stone detected.',
        recommended_action: 'Hydration and urology evaluation.'
      });
    }

    // Simple Cyst
    if (abdomenData.liver?.focal_lesions?.some(l => l.type === 'simple_cyst')) {
      flags.push({
        flag_id: 'LIVER_CYST',
        flag_label: 'Simple Hepatic Cyst',
        organ: 'liver',
        severity: 'low',
        fertility_relevance: 'none',
        clinical_note: 'Incidental benign cyst.',
        recommended_action: 'Routine observation.'
      });
    }

    // Vaginal cyst
    if (abdomenData.ovaries?.vaginal_cyst_collection) {
      flags.push({
        flag_id: 'VAGINAL_CYST',
        flag_label: 'Vaginal Cyst',
        organ: 'ovaries',
        severity: 'low',
        fertility_relevance: 'moderate',
        clinical_note: 'Cyst/collection detected.',
        recommended_action: 'Gynecology follow-up.'
      });
    }
  }

  // 2. TVS USG findings (specifically female)
  const tvsData = findings.USG_TVS;
  if (tvsData) {
    if (tvsData.pcos_morphology_bilateral || tvsData.right_ovary?.pcos_morphology || tvsData.left_ovary?.pcos_morphology) {
      flags.push({
        flag_id: 'PCOS_BILATERAL_TVS',
        flag_label: 'TVS: Bilateral PCOS Morphology',
        organ: 'ovaries',
        severity: 'high',
        fertility_relevance: 'critical',
        clinical_note: 'Antral follicle count or morphology suggests BCOM.',
        recommended_action: 'Endocrinology consultation.'
      });
    }

    if (tvsData.uterus?.fibroid_present) {
      flags.push({
        flag_id: 'UTERINE_FIBROID_TVS',
        flag_label: 'TVS: Uterine Fibroid present',
        organ: 'uterus',
        severity: 'moderate',
        fertility_relevance: 'high',
        clinical_note: 'Myometrial fibroid observed.',
        recommended_action: 'Gynecology clearance before trying.'
      });
    }
  }

  // 3. USG Scrotum findings (specifically male)
  const scrotumData = findings.USG_SCROTUM_DOPPLER;
  if (scrotumData?.varicocele?.present) {
    const grade = scrotumData.varicocele.grade;
    flags.push({
      flag_id: `VARICOCELE_${grade ? 'GR' + grade : 'UNGRADED'}`,
      flag_label: `Varicocele${grade ? ` Grade ${grade}` : ''} detected`,
      organ: 'scrotum',
      severity: grade >= 2 ? 'high' : 'moderate',
      fertility_relevance: grade >= 2 ? 'high' : 'moderate',
      clinical_note: 'Varicocele is the most common correctable cause of male infertility. Grade II/III are clinically significant.',
      recommended_action: 'Urology consultation + semen analysis mandatory before marriage planning'
    });
  }

  // 4. Echo findings
  const echoData = findings.ECHO;
  if (echoData?.diastolic_dysfunction_grade >= 2) {
    flags.push({
      flag_id: 'ECHO_DIASTOLIC_DYSFUNCTION_G2',
      flag_label: `Grade ${echoData.diastolic_dysfunction_grade} LV Diastolic Dysfunction`,
      organ: 'heart',
      severity: echoData.diastolic_dysfunction_grade >= 3 ? 'high' : 'moderate',
      fertility_relevance: 'moderate',
      clinical_note: 'Diastolic dysfunction increases cardiac load risk during pregnancy.',
      recommended_action: 'Cardiology clearance before family planning'
    });
  }

  if (echoData?.pah?.present && echoData.pah.pasp_mmhg > 35) {
    flags.push({
      flag_id: 'PAH_ELEVATED',
      flag_label: `Pulmonary Arterial Hypertension (PASP ${echoData.pah.pasp_mmhg} mmHg)`,
      organ: 'heart',
      severity: echoData.pah.pasp_mmhg > 50 ? 'high' : 'moderate',
      fertility_relevance: 'high',
      clinical_note: 'PAH is a contraindication to pregnancy above moderate severity.',
      recommended_action: 'Urgent cardiology + obstetric medicine consultation'
    });
  }

  // 5. DEXA findings
  const dexaData = findings.DEXA;
  if (dexaData?.lowest_t_score_value < -1.0) {
    flags.push({
      flag_id: 'DEXA_OSTEOPENIA',
      flag_label: `${dexaData.overall_who_classification.toUpperCase()} — Lowest T-score: ${dexaData.lowest_t_score_value} (${dexaData.lowest_t_score_site})`,
      organ: 'bone',
      severity: dexaData.lowest_t_score_value < -2.5 ? 'high' : 'moderate',
      fertility_relevance: 'low',
      clinical_note: 'Bone density below normal for age. Calcium + Vitamin D supplementation often indicated.',
      recommended_action: 'Endocrinology/orthopedics consultation, dietary calcium review'
    });
  }

  return flags;
}

module.exports = { generateRiskFlags };
