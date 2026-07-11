export const ABOUT_LIFESTYLE_FIELDS = ['activity_level', 'drinking_habits', 'smoking_habits', 'sleep_cycle'];

export const MENTAL_QUESTION_COUNT = 21;

// How much each section moves the needle on the overall analysis, shown to users as
// "engine confidence" so filling in a section has a visible, motivating payoff. Roughly
// mirrors the real backend engine weights (chronic/fertility ~60% combined, mental 20%,
// radiology 10%) but split further since About You/Lifestyle/Pathology all feed into the
// same chronic+fertility engines rather than being separate scored domains themselves.
// Genomics is deliberately excluded — it's not launched yet ("Coming Soon"), so including
// it would cap everyone's achievable confidence at 90% with no way to close the gap.
export const CONFIDENCE_WEIGHTS = {
  about: 20,
  lifestyle: 15,
  mental: 20,
  pathology: 35,
  radiology: 10
};

// Weighted sum of (progress% * weight) across whichever categories carry a defined
// weight — categories without one (e.g. genomics) simply don't contribute, rather than
// silently capping the achievable total below 100%.
export function computeConfidence(categories) {
  let total = 0;
  categories.forEach((cat) => {
    const weight = CONFIDENCE_WEIGHTS[cat.key];
    if (!weight) return;
    const progress = typeof cat.progress === 'number' ? cat.progress : 0;
    total += (progress / 100) * weight;
  });
  return Math.round(total);
}

export function aboutProgress(adapter, prospectForm) {
  const { form, nameField, genderField, dobField, cityField, isSelfPerson, needsNameStep } = adapter;
  const fields = [form[genderField], form[dobField], form[cityField], form.height, form.weight, form.waist];
  if (needsNameStep) fields.push(form[nameField]);
  if (isSelfPerson) fields.push(prospectForm?.meetingSource, form.relationshipStatus);
  const filled = fields.filter((f) => f !== undefined && f !== null && f !== '').length;
  return Math.round((filled / fields.length) * 100);
}

export function lifestyleProgress(form) {
  const filled = ABOUT_LIFESTYLE_FIELDS.filter((f) => !!form[f]).length;
  return Math.round((filled / ABOUT_LIFESTYLE_FIELDS.length) * 100);
}

export function mentalProgress(optIn, answers) {
  if (optIn === 'skip') return 100;
  if (optIn !== 'yes') return 0;
  const answered = Object.keys(answers || {}).length;
  return Math.round((answered / MENTAL_QUESTION_COUNT) * 100);
}
