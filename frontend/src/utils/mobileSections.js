import { CONFIDENCE_WEIGHTS } from './healthProfileProgress';
import { SECONDS_BY_KIND, formatDuration } from './estimateTime';

// Per-section presentation, keyed to the mockup's exact tones/titles/subs/icons.
// Colour is per-section identity here (mag/teal/sea/moss/gold/mute) — that is the
// mockup's own system, applied faithfully.
const META = {
  about:     { title: 'About you',         sub: 'Basics, body & relationship context', tone: 'mag',  icon: 'user' },
  lifestyle: { title: 'Lifestyle & habits', sub: 'Activity, sleep, drinking & more',    tone: 'teal', icon: 'pulse' },
  mental:    { title: 'Mental wellbeing',   sub: 'Optional · 21 quick questions',        tone: 'sea',  icon: 'mind' },
  pathology: { title: 'Pathology reports',  sub: 'Bloodwork — upload or book at home',   tone: 'moss', icon: 'flask', duration: '2 min' },
  radiology: { title: 'Radiology reports',  sub: 'Scans — upload or book at a centre',   tone: 'gold', icon: 'scan' },
  genomics:  { title: 'Genomics report',    sub: 'Carrier & hereditary risk screening',  tone: 'mute', icon: 'dna' }
};

// Real per-step-kind timing (same calibration driving the live in-flow
// countdown in QuestionScreen/MentalSubHub — see utils/estimateTime), not a
// hand-guessed constant, so this hint can't quietly drift away from how fast
// the flow actually is. Composition mirrors the most common real path
// through each category's step builder in add-prospect/page.js: About's
// self-person flow (Gender/DOB/City/Height/Weight/Waist/How-you-met/
// Relationship status) and Lifestyle's 4 base fields (Activity/Drinking/
// Smoking/Sleep) — the rarer conditional steps (name, matrimonial platform,
// menstrual cycle) are left out of this rough estimate on purpose.
const CATEGORY_STEP_KINDS = {
  about: ['choice', 'field', 'city', 'measurement', 'measurement', 'measurement', 'choice', 'choice'],
  lifestyle: ['choice', 'choice', 'choice', 'choice'],
  mental: Array.from({ length: 21 }, () => 'choice')
};

function categoryDuration(key) {
  if (META[key]?.duration) return META[key].duration;
  const kinds = CATEGORY_STEP_KINDS[key];
  if (!kinds) return null;
  const totalSeconds = kinds.reduce((sum, k) => sum + (SECONDS_BY_KIND[k] ?? 10), 0);
  return formatDuration(totalSeconds);
}

function stateOf(cat) {
  if (cat.comingSoon) return 'soon';
  if (cat.locked) return 'locked';
  return (cat.progress || 0) > 0 ? 'progress' : 'todo';
}

// Map one real health-profile category into the mockup's section shape.
export function toMobileSection(cat) {
  const meta = META[cat.key] || { title: cat.label, sub: cat.desc, tone: 'mute', icon: 'user' };
  return {
    id: cat.key,
    title: meta.title,
    sub: meta.sub,
    tone: meta.tone,
    icon: meta.icon,
    duration: categoryDuration(cat.key),
    weight: CONFIDENCE_WEIGHTS[cat.key] || 0,
    pct: Math.round(cat.progress || 0),
    answered: cat.answered,
    total: cat.total,
    state: stateOf(cat),
    price: cat.price,
    tests: cat.suggestedTests
  };
}

export function toMobileSections(categories) {
  return categories.map(toMobileSection);
}

// The weighted subset (weight > 0) drives the gauge, the confidence number, and
// the "N of M sections" counts — genomics (weight 0) is excluded from those.
export function weightedSections(sections) {
  return sections.filter((s) => s.weight > 0);
}
