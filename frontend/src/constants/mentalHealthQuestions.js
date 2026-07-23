// v2.0 (see contexts/mental_health_engine_update.md) — ids match the field names
// backend/src/controllers/mental.controller.js expects on partner_A_answers/partner_B_answers.
//
// Wording is deliberately plain/conversational (not clinical) — this is a
// self-report survey a normal person fills out mid-onboarding, not a form a
// doctor reads. Option ORDER must stay worst-to-best (index 0 = val 1) since
// the scoring engine treats a higher value as more of what's asked, never the
// reverse — whether more/less/middle is "healthy" is decided in scoring, never
// shown to the user (this is what lets peaked/preference/clarity scoring work
// under the hood while the scale itself stays one consistent direction).
// Rewrite the wording, never the order or the `val`.
//
// Journey-aware copy: the default `title`/`desc`/`options` are first/second
// person ("how has YOUR energy been", "I worry that…") — correct when someone
// answers about THEMSELVES (the account holder's own journey and the invite
// flow, where the partner self-reports). When the account holder fills their
// partner's profile in themselves ("I'll enter their details myself"), that
// same "you/I" wording is ambiguous, so each question also carries a
// hand-authored THIRD-person variant — `titleP`/`descP`/`optionsP` — that names
// the partner via a `{name}` token. `optionsP` is positional over `options`
// (relabel only; `val`/order preserved); a null entry keeps the base label.
// framePerson(q, name) returns the right copy: pass the partner's name for
// third person, or nothing/null for the default first person. Only the
// self-entry partner path passes a name.
//
// `category` is a short key into MENTAL_HEALTH_CATEGORIES below, used to
// group the 27 questions into 5 visible sub-sections with their own
// progress segment instead of one long flat 1-of-27 counter.

import { Zap, Sparkles, Users, Compass, Wind } from 'lucide-react';

const scale = (labels) => labels.map((label, i) => ({ val: i + 1, label }));

// Shared 5-point agreement scale for the 6 attachment items (indirect,
// agree/disagree framing rather than a direct "how much anxiety do you feel"
// question) — same 1..5 direction convention as every other Likert item here.
const agreementScale = () => scale(['Not like me at all', 'A little like me', 'Somewhat like me', 'Mostly like me', 'Very like me']);
// Third-person relabel of the agreement scale (positional over agreementScale()).
const agreementScaleP = ['Not like them at all', 'A little like them', 'Somewhat like them', 'Mostly like them', 'Very like them'];

// Five shades, only from the brand's pink and teal — alternating hue with
// varied depth (bright / bright / deep / deep / light) so all 5 stay
// distinguishable side-by-side in the global progress bar without reaching
// for an unrelated color like amber, blue, or violet. `icon`/`desc` back the
// sub-hub's card grid (one card per category, tappable in any order).
// `descP` (where present) is the third-person variant for the partner journey.
export const MENTAL_HEALTH_CATEGORIES = [
  { key: 'feelings', label: 'Feelings & Energy', desc: 'Your everyday mood, energy & stress', descP: "{name}'s everyday mood, energy & stress", icon: Zap, color: '#18CC96', soft: '#E3F9F0' },
  { key: 'personality', label: 'Your Personality', desc: 'How you think, bond & handle change', descP: 'How {name} thinks, bonds & handles change', icon: Sparkles, color: '#DE457D', soft: '#FCE8EF' },
  { key: 'together', label: 'Building Together', desc: 'Trust, communication & commitment', icon: Users, color: '#0A6B52', soft: '#DCEEE9' },
  { key: 'lifeGoals', label: 'Life & Family Goals', desc: 'Career, money, family & kids', icon: Compass, color: '#B8305F', soft: '#F5E1E8' },
  { key: 'habits', label: 'Habits & Calm', desc: 'Substance habits & anger control', icon: Wind, color: '#4FD1A5', soft: '#E4FBF3' }
];

export const MENTAL_HEALTH_QUESTIONS = [
  // 1. Feelings & Energy — recency-framed (past two weeks) to reduce the
  // social-desirability pull of an unbounded "how are you generally" stem.
  {
    id: 'emotional_wellbeing',
    category: 'feelings',
    title: 'Over the past two weeks, how has your energy been on a normal day?',
    titleP: "Over the past two weeks, how has {name}'s energy been on a normal day?",
    desc: 'Your usual mood on an ordinary day — no big events, just regular life.',
    descP: "{name}'s usual mood on an ordinary day — no big events, just regular life.",
    options: scale(['Low most days', 'Ran out of steam fairly often', 'Normal — the usual ups and downs', 'Good most days', 'High — full of drive throughout'])
  },
  {
    id: 'stress_worry',
    category: 'feelings',
    title: 'Over the past two weeks, how often did everyday pressure get to you?',
    titleP: 'Over the past two weeks, how often did everyday pressure get to {name}?',
    desc: 'Normal pressure — deadlines, traffic, small annoyances.',
    options: scale(['Overwhelmed easily, most days', 'Worried or on edge fairly often', 'Stressed sometimes, but manageable', 'Mostly stayed calm', 'Rarely rattled, very composed'])
  },
  {
    id: 'life_stress_capacity',
    category: 'feelings',
    title: 'When something knocks you off course, how do you usually bounce back?',
    titleP: 'When something knocks {name} off course, how do they usually bounce back?',
    desc: 'Sudden changes, setbacks, or hard times — how do you usually cope?',
    descP: 'Sudden changes, setbacks, or hard times — how do they usually cope?',
    options: scale(['Knocked down easily, takes a long while', 'Struggle when things change', 'Cope okay, takes some time', 'Bounce back fairly well', 'Adapt fast, hard to shake']),
    optionsP: ['Knocked down easily, takes a long while', 'Struggles when things change', 'Copes okay, takes some time', 'Bounces back fairly well', 'Adapts fast, hard to shake']
  },
  // 2. Your Personality — 5 trait items (unchanged constructs, reworded for a
  // clean low->high gradient) + 6 new dimensional attachment items replacing
  // the old single-choice attachment_style.
  {
    id: 'personality_openness',
    category: 'personality',
    title: 'How do you feel about new things — new ideas, places, or changing up your routine?',
    titleP: 'How does {name} feel about new things — new ideas, places, or changing up their routine?',
    desc: 'Set in your ways, or open to whatever comes?',
    descP: 'Set in their ways, or open to whatever comes?',
    options: scale(['Prefer sticking to what I know', 'Lean towards the familiar', 'Open to new things now and then', 'Enjoy trying new things', 'Always seeking something new']),
    optionsP: ['Prefers sticking to what they know', 'Leans towards the familiar', 'Open to new things now and then', 'Enjoys trying new things', 'Always seeking something new']
  },
  {
    id: 'personality_conscientiousness',
    category: 'personality',
    title: 'How do you approach planning and organisation?',
    titleP: 'How does {name} approach planning and organisation?',
    desc: 'Think to-do lists, deadlines, keeping things organized.',
    options: scale(['Very spontaneous, little planning', 'A bit of both', 'Usually organised', 'Big on planning ahead', 'Everything scheduled, tightly structured'])
  },
  {
    id: 'personality_extraversion',
    category: 'personality',
    title: 'How do social situations affect you?',
    titleP: 'How do social situations affect {name}?',
    desc: 'Big groups and socializing vs. quiet time alone — what feels more like you?',
    descP: 'Big groups and socializing vs. quiet time alone — what feels more like them?',
    options: scale(['Prefer quiet, keep to myself', 'Small groups over big ones', 'A mix of both', 'Enjoy being social', 'The more people, the better']),
    optionsP: ['Prefers quiet, keeps to themselves', 'Small groups over big ones', 'A mix of both', 'Enjoys being social', 'The more people, the better']
  },
  {
    id: 'personality_agreeableness',
    category: 'personality',
    title: 'In a disagreement, how do you usually show up?',
    titleP: 'In a disagreement, how does {name} usually show up?',
    desc: 'The most extreme answer is not automatically the healthiest one here — a strong-but-balanced middle ground is scored highest.',
    options: scale(["Direct — I say it plainly, even if it stings", 'Firm — I hold my ground', 'Balanced — I give and take', 'Accommodating — I lean towards keeping the peace', 'Selfless — I put others first, almost always']),
    optionsP: ['Direct — says it plainly, even if it stings', 'Firm — holds their ground', 'Balanced — gives and takes', 'Accommodating — leans towards keeping the peace', 'Selfless — puts others first, almost always']
  },
  {
    id: 'personality_stability',
    category: 'personality',
    title: 'In tense moments or arguments, how steady are your emotions?',
    titleP: "In tense moments or arguments, how steady are {name}'s emotions?",
    desc: 'How much your mood swings under pressure, not how you feel privately.',
    descP: 'How much their mood swings under pressure, not how they feel privately.',
    options: scale(['Small things affect me a lot', 'My mood shifts fairly quickly', 'Mostly even-keeled', 'Rarely rattled', 'Almost nothing shakes me']),
    optionsP: ['Small things affect them a lot', 'Their mood shifts fairly quickly', 'Mostly even-keeled', 'Rarely rattled', 'Almost nothing shakes them']
  },
  // Attachment — 6 statements, indirect agree/disagree framing rather than a
  // single self-classification. Scored dimensionally (anxiety/avoidance),
  // not as a forced category — see mental.controller.js §2.3.
  {
    id: 'attachment_anxiety_1',
    category: 'personality',
    title: "I worry that someone I'm close to might not care about me as much as I care about them.",
    titleP: "{name} worries that someone they're close to might not care about them as much as they care in return.",
    desc: 'A few statements — rate how much each sounds like you.',
    descP: 'A few statements — rate how much each sounds like {name}.',
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  {
    id: 'attachment_anxiety_2',
    category: 'personality',
    title: 'When someone I\'m close to needs space, I start to feel uneasy.',
    titleP: 'When someone {name} is close to needs space, they start to feel uneasy.',
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  {
    id: 'attachment_anxiety_3',
    category: 'personality',
    title: "I often want more closeness or reassurance than the other person seems to want.",
    titleP: '{name} often wants more closeness or reassurance than the other person seems to want.',
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  {
    id: 'attachment_avoidance_1',
    category: 'personality',
    title: "I find it hard to fully open up, even to people I'm close to.",
    titleP: "{name} finds it hard to fully open up, even to people they're close to.",
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  {
    id: 'attachment_avoidance_2',
    category: 'personality',
    title: 'I prefer to keep some emotional distance, and I pull back when things get intense.',
    titleP: '{name} prefers to keep some emotional distance, and pulls back when things get intense.',
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  {
    id: 'attachment_avoidance_3',
    category: 'personality',
    title: "I'd rather rely on myself than depend on someone else.",
    titleP: '{name} would rather rely on themselves than depend on someone else.',
    options: agreementScale(),
    optionsP: agreementScaleP
  },
  // 3. Building Together
  {
    id: 'readiness_communication',
    category: 'together',
    title: "How easily do you open up about what you're really feeling?",
    titleP: "How easily does {name} open up about what they're really feeling?",
    desc: 'Sharing what you\'re really feeling, not just the surface stuff.',
    descP: 'Sharing what they\'re really feeling, not just the surface stuff.',
    options: scale(['Hard for me to open up', 'I stick to easy topics', 'I share the basics', "I'm fairly open about feelings", "I'm an open book"]),
    optionsP: ['Finds it hard to open up', 'Sticks to easy topics', 'Shares the basics', 'Fairly open about feelings', 'An open book']
  },
  {
    id: 'readiness_conflict',
    category: 'together',
    title: 'When you and a partner disagree, how does it usually go?',
    titleP: 'When {name} and a partner disagree, how does it usually go?',
    options: scale(['I shut down or avoid it', 'It turns into frequent arguments', 'We work it out, with some friction', 'We talk it through calmly', 'We solve it together, no drama']),
    optionsP: ['Shuts down or avoids it', 'It turns into frequent arguments', 'Works it out, with some friction', 'Talks it through calmly', 'Resolves it together, no drama']
  },
  {
    id: 'readiness_trust',
    category: 'together',
    title: 'When a relationship is still new, how easily does trust come to you?',
    titleP: 'When a relationship is still new, how easily does trust come to {name}?',
    desc: 'Think of the early days of a relationship in general — not one particular person.',
    options: scale(['Trust is hard for me at first', 'It takes me a while to trust', 'Trust comes fairly easily', 'I trust and feel secure pretty quickly', 'I trust almost right away']),
    optionsP: ['Trust is hard for them at first', 'Takes a while to trust', 'Trust comes fairly easily', 'Trusts and feels secure pretty quickly', 'Trusts almost right away']
  },
  {
    id: 'readiness_commitment',
    category: 'together',
    title: "When you enter a new relationship, how 'all in' do you tend to be?",
    titleP: "When {name} enters a new relationship, how 'all in' do they tend to be?",
    desc: 'Your usual pattern at the start of something — not one particular person.',
    descP: 'Their usual pattern at the start of something — not one particular person.',
    options: scale(['I take it one day at a time', 'I stay in the moment, unsure long-term', 'I start thinking long-term', 'I invest deeply early on', "I'm all in from the start"]),
    optionsP: ['Takes it one day at a time', 'Stays in the moment, unsure long-term', 'Starts thinking long-term', 'Invests deeply early on', 'All in from the start']
  },
  {
    id: 'readiness_support',
    category: 'together',
    title: 'When a partner is having a hard time, what do you tend to do?',
    titleP: 'When a partner is having a hard time, what does {name} tend to do?',
    desc: "What you actually do, not just what you'd want to do.",
    descP: "What they actually do, not just what they'd want to do.",
    options: scale(['I tend to give them space and stay out of it', 'I help only if they ask', 'I check in now and then', 'I make a point of being there', 'I drop things to show up for them']),
    optionsP: ['Tends to give them space and stay out of it', 'Helps only if asked', 'Checks in now and then', 'Makes a point of being there', 'Drops things to show up for them']
  },
  // 4. Life & Family Goals — Life & Career half (preference items: quality is
  // scored on how CLEAR the stance is, not which direction it points).
  {
    id: 'career_alignment',
    category: 'lifeGoals',
    title: 'How central is your career to your life?',
    titleP: "How central is {name}'s career to their life?",
    options: scale(["Career isn't a big focus for me", "It matters, but it's not the priority", 'Fairly career-focused', 'Career matters a lot to me', 'Career comes first, almost always']),
    optionsP: ["Career isn't a big focus for them", "It matters, but it's not the priority", 'Fairly career-focused', 'Career matters a lot to them', 'Career comes first, almost always']
  },
  {
    id: 'relocation_openness',
    category: 'lifeGoals',
    title: 'How open are you to moving for work — a new city, or relocating for a job?',
    titleP: 'How open is {name} to moving for work — a new city, or relocating for a job?',
    options: scale(["I'd rather not move at all", "Only if there's no other option", 'Open to it if it makes sense', 'Fairly willing to move', 'Happy to move whenever it helps my career']),
    optionsP: ["Would rather not move at all", "Only if there's no other option", 'Open to it if it makes sense', 'Fairly willing to move', 'Happy to move whenever it helps their career']
  },
  {
    id: 'financial_alignment',
    category: 'lifeGoals',
    title: "What's your money style, day to day?",
    titleP: "What's {name}'s money style, day to day?",
    options: scale(["I spend freely, don't track much", 'Loose with a budget', 'I balance spending and saving', 'Careful saver, budget-focused', 'Very disciplined about money']),
    optionsP: ["Spends freely, doesn't track much", 'Loose with a budget', 'Balances spending and saving', 'Careful saver, budget-focused', 'Very disciplined about money']
  },
  {
    id: 'lifestyle_alignment',
    category: 'lifeGoals',
    title: "What's your day-to-day rhythm like — sleep, free time, routine?",
    titleP: "What's {name}'s day-to-day rhythm like — sleep, free time, routine?",
    options: scale(['Pretty chaotic, no set routine', 'My routine varies a lot', 'A fairly steady routine', 'Pretty structured days', 'Very consistent, same rhythm daily']),
    optionsP: ['Pretty chaotic, no set routine', 'Their routine varies a lot', 'A fairly steady routine', 'Pretty structured days', 'Very consistent, same rhythm daily']
  },
  // Family & Parenting half (also preference items — see above).
  {
    id: 'family_expectations',
    category: 'lifeGoals',
    title: 'How much day-to-day involvement would you like your families — in-laws and immediate family — to have?',
    titleP: 'How much day-to-day involvement would {name} like their families — in-laws and immediate family — to have?',
    desc: 'Your parents and in-laws, siblings — not distant relatives.',
    descP: 'Their parents and in-laws, siblings — not distant relatives.',
    options: scale(['Live independently, meet once a year or two', 'Occasional visits, mainly for festivals', 'Regular contact, meet often', 'Very involved, frequent contact', 'Live together, family involved day-to-day'])
  },
  {
    id: 'parenting_alignment',
    category: 'lifeGoals',
    title: 'Where do you stand on having children?',
    titleP: 'Where does {name} stand on having children?',
    desc: 'Whether, and how strongly, children are part of your plan.',
    descP: 'Whether, and how strongly, children are part of their plan.',
    options: scale(["I don't want children", "I'm leaning towards no", "I'm still figuring it out", 'I want children, flexible on the details', 'I definitely want children, with a clear vision']),
    optionsP: ["Doesn't want children", 'Leaning towards no', 'Still figuring it out', 'Wants children, flexible on the details', 'Definitely wants children, with a clear vision']
  },
  // 5. Habits & Calm
  {
    id: 'substance_concern',
    category: 'habits',
    title: 'How would you describe your drinking habits?',
    titleP: "How would you describe {name}'s drinking habits?",
    desc: 'Be honest — this just helps build a full picture, no judgment.',
    options: [
      { val: 'Low', label: 'Rarely or never', desc: "Alcohol isn't really part of my life." },
      { val: 'Moderate', label: 'Socially, now and then', desc: 'I drink sometimes when out with others — nothing heavy.' },
      { val: 'Elevated', label: 'Fairly often', desc: "I drink regularly, and it's a bigger part of my routine." }
    ],
    optionsP: [
      { desc: "Alcohol isn't really part of their life." },
      { desc: 'They drink sometimes when out with others — nothing heavy.' },
      { desc: "They drink regularly, and it's a bigger part of their routine." }
    ]
  },
  {
    id: 'anger_regulation',
    category: 'habits',
    title: "When you're really angry, how does it usually come out?",
    titleP: "When {name} is really angry, how does it usually come out?",
    desc: 'Not how you feel it privately — how it actually shows.',
    descP: 'Not how they feel it privately — how it actually shows.',
    options: scale(['I get loud or say things I regret', 'I get visibly irritated', 'I mostly keep it in check', 'I stay calm and in control', 'Almost nothing makes me angry']),
    optionsP: ['Gets loud or says things they regret', 'Gets visibly irritated', 'Mostly keeps it in check', 'Stays calm and in control', 'Almost nothing makes them angry']
  }
];

// Resolve a question's copy for whoever is being asked about. Pass `name` (the
// partner's name) to get the hand-authored third-person variant — used ONLY on
// the self-entry partner journey; pass nothing/null to keep the default
// first/second-person wording (the account holder's own journey and the invite
// flow, where the partner self-reports). `optionsP` is positional over
// `options`: each entry relabels the option at the same index (a string sets
// the label; an object can patch `label` and/or `desc`), always preserving the
// base `val` and worst->best order so scoring is untouched. A `{name}` token in
// any variant string is replaced with the partner's name.
export function framePerson(q, name) {
  if (!name) return q;
  const fill = (s) => (typeof s === 'string' ? s.replace(/\{name\}/g, name) : s);
  const options = q.optionsP
    ? q.options.map((o, i) => {
        const p = q.optionsP[i];
        if (p == null) return o;
        const patch = typeof p === 'string' ? { label: p } : p;
        return { ...o, ...patch, label: fill(patch.label ?? o.label), desc: fill(patch.desc ?? o.desc) };
      })
    : q.options;
  return {
    ...q,
    title: fill(q.titleP) ?? q.title,
    desc: fill(q.descP) ?? q.desc,
    options
  };
}

// Precompute each question's place within its sub-section once, so every
// consumer (add-prospect wizard, invite-link wizard) shows the same
// "Feelings & Energy · 2 of 3" style progress without recomputing it.
const sectionLengths = MENTAL_HEALTH_QUESTIONS.reduce((acc, q) => {
  acc[q.category] = (acc[q.category] || 0) + 1;
  return acc;
}, {});
const sectionRunningCount = {};
MENTAL_HEALTH_QUESTIONS.forEach((q) => {
  sectionRunningCount[q.category] = (sectionRunningCount[q.category] || 0) + 1;
  q.sectionIndex = MENTAL_HEALTH_CATEGORIES.findIndex((c) => c.key === q.category);
  q.sectionPosition = sectionRunningCount[q.category];
  q.sectionLength = sectionLengths[q.category];
});

// Real per-subcategory completion (answered / questions-in-that-subcategory),
// backing each card's progress ring on the mental-wellbeing sub-hub.
export function mentalCategoryProgress(categoryKey, answers) {
  const questions = MENTAL_HEALTH_QUESTIONS.filter((q) => q.category === categoryKey);
  if (questions.length === 0) return 0;
  const answered = questions.filter((q) => answers?.[q.id] !== undefined).length;
  return Math.round((answered / questions.length) * 100);
}

// Raw answered/total counts behind the progress above — surfaced separately
// so the UI can show a concrete "3 of 5" instead of (or alongside) a percent.
// Exact counts read as more tangible than an abstract number and are what
// actually drives the per-card time estimate.
export function mentalCategoryCounts(categoryKey, answers) {
  const questions = MENTAL_HEALTH_QUESTIONS.filter((q) => q.category === categoryKey);
  const answered = questions.filter((q) => answers?.[q.id] !== undefined).length;
  return { answered, total: questions.length };
}
