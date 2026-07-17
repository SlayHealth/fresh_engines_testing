export const ABOUT_LIFESTYLE_FIELDS = ['activity_level', 'drinking_habits', 'smoking_habits', 'sleep_cycle'];

export const MENTAL_QUESTION_COUNT = 21;

// How much each section moves the needle on the overall analysis, shown to users as
// "The Full Picture" so filling in a section has a visible, motivating payoff. Roughly
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

// Raw filled/total field counts behind each *Progress percentage below —
// surfaced separately so the UI can show a concrete "4 of 6" instead of (or
// alongside) an abstract percent. Each *Progress function is a thin wrapper
// so the count and the percent can never drift apart.
export function aboutCounts(adapter) {
  const { form, nameField, genderField, dobField, cityField, needsNameStep } = adapter;
  const fields = [form[genderField], form[dobField], form[cityField], form.height, form.weight, form.waist];
  if (needsNameStep) fields.push(form[nameField]);
  const answered = fields.filter((f) => f !== undefined && f !== null && f !== '').length;
  return { answered, total: fields.length };
}

export function aboutProgress(adapter) {
  const { answered, total } = aboutCounts(adapter);
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}

export function lifestyleCounts(form) {
  // Menstrual cycle is a real extra step in the wizard for female profiles
  // (see buildLifestyleSteps) — counting it only when it applies keeps the
  // displayed "N of Y" honest instead of always capping Y at 4.
  const fields = [...ABOUT_LIFESTYLE_FIELDS];
  if (form.gender === 'Female' || form.candidateGender === 'Female') fields.push('menstrualCycle');
  const answered = fields.filter((f) => !!form[f]).length;
  return { answered, total: fields.length };
}

export function lifestyleProgress(form) {
  const { answered, total } = lifestyleCounts(form);
  return Math.round((answered / total) * 100);
}

export function mentalCounts(answers) {
  return { answered: Object.keys(answers || {}).length, total: MENTAL_QUESTION_COUNT };
}

export function mentalProgress(answers) {
  const { answered, total } = mentalCounts(answers);
  return Math.round((answered / total) * 100);
}

// Below this, the composite analysis is materially guesswork — several
// domains still gated off from the score entirely. This is a real, enforced
// threshold (see ProvisionalBadge/RELIABLE_THRESHOLD usages), not a label
// with no behavior behind it.
export const RELIABLE_THRESHOLD = 70;

// Tone is a function of a category's STATE, not its identity — six fixed
// hues for six categories is decoration, not information. Every consumer
// (ScoreBar segments, tile rows, mini-rings) must derive color this way
// rather than keying off category.key.
export function categoryTone(category) {
  if (category.locked || category.comingSoon) return 'neutral';
  return category.progress > 0 ? 'teal' : 'pink';
}

export const TONE_COLORS = {
  teal: { color: 'var(--teal)', soft: 'var(--soft-teal)', text: 'var(--teal-d)' },
  pink: { color: 'var(--pink)', soft: 'var(--soft-pink)', text: 'var(--pink-d)' },
  neutral: { color: 'var(--muted)', soft: 'var(--line)', text: 'var(--muted)' }
};
