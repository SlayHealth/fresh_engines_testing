export const ABOUT_LIFESTYLE_FIELDS = ['activity_level', 'drinking_habits', 'smoking_habits', 'sleep_cycle'];

export const MENTAL_QUESTION_COUNT = 21;

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
