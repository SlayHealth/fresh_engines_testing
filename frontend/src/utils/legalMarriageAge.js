// India's legal minimum marriage age: 18 for women, 21 for men (Prohibition
// of Child Marriage Act, 2006 / Special Marriage Act, 1954). This app exists
// to run a premarital compatibility check, so a DOB that puts someone below
// their gender's legal marriage age today isn't just an edge case — the
// check itself isn't legally actionable for them yet.
export const LEGAL_MARRIAGE_AGE = { Male: 21, Female: 18 };
const DEFAULT_LEGAL_MARRIAGE_AGE = 21; // stricter of the two, used when gender isn't yet known/'Other'

export function legalMarriageAgeFor(gender) {
  return LEGAL_MARRIAGE_AGE[gender] ?? DEFAULT_LEGAL_MARRIAGE_AGE;
}

// today's date minus the legal age, as 'YYYY-MM-DD' — pass as a date input's
// `max` so the native picker defaults to (and only offers) legally-old-enough
// dates without needing JS validation for the common case.
export function maxDobForLegalMarriageAge(gender) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - legalMarriageAgeFor(gender));
  return d.toISOString().split('T')[0];
}

export function isBelowLegalMarriageAge(dob, gender) {
  if (!dob) return false;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - legalMarriageAgeFor(gender));
  return birth > cutoff;
}

export function legalMarriageAgeNotice(gender) {
  const age = legalMarriageAgeFor(gender);
  const who = gender === 'Female' ? 'women' : gender === 'Male' ? 'men' : 'this';
  return `Just so you know — the legal marriage age in India is ${age} for ${who}. Once that birthday passes, come right back — we'll be here. 💛`;
}
