// Mirrors contexts/mental_health_questions.md — ids match the field names
// backend/src/controllers/mental.controller.js expects on partner_A_answers/partner_B_answers.
//
// Wording is deliberately plain/conversational (not clinical) — this is a
// self-report survey a normal person fills out mid-onboarding, not a form a
// doctor reads. Option ORDER must stay worst-to-best (index 0 = val 1) since
// the scoring engine treats a higher value as healthier/more aligned —
// rewrite the wording, never the order or the `val`.
//
// `category` is a short key into MENTAL_HEALTH_CATEGORIES below, used to
// group the 21 questions into 5 visible sub-sections with their own
// progress segment instead of one long flat 1-of-21 counter.

import { Zap, Sparkles, Users, Compass, Wind } from 'lucide-react';

const scale = (labels) => labels.map((label, i) => ({ val: i + 1, label }));

// Five shades, only from the brand's pink and teal — alternating hue with
// varied depth (bright / bright / deep / deep / light) so all 5 stay
// distinguishable side-by-side in the global progress bar without reaching
// for an unrelated color like amber, blue, or violet. `icon`/`desc` back the
// sub-hub's card grid (one card per category, tappable in any order).
export const MENTAL_HEALTH_CATEGORIES = [
  { key: 'feelings', label: 'Feelings & Energy', desc: 'Your everyday mood, energy & stress', icon: Zap, color: '#18CC96', soft: '#E3F9F0' },
  { key: 'personality', label: 'Your Personality', desc: 'How you think, socialize & handle change', icon: Sparkles, color: '#DE457D', soft: '#FCE8EF' },
  { key: 'together', label: 'Building Together', desc: 'Trust, communication & commitment', icon: Users, color: '#0A6B52', soft: '#DCEEE9' },
  { key: 'lifeGoals', label: 'Life & Family Goals', desc: 'Career, money, family & kids', icon: Compass, color: '#B8305F', soft: '#F5E1E8' },
  { key: 'habits', label: 'Habits & Calm', desc: 'Substance habits & anger control', icon: Wind, color: '#4FD1A5', soft: '#E4FBF3' }
];

export const MENTAL_HEALTH_QUESTIONS = [
  // 1. Feelings & Energy
  {
    id: 'emotional_wellbeing',
    category: 'feelings',
    title: "How's your everyday energy?",
    desc: 'Just your usual mood on a normal day — no big events, just regular life.',
    options: scale(['Pretty low most days', 'Runs out of steam sometimes', 'Feels normal, ups and downs', 'Good energy most days', 'Full of drive, always going'])
  },
  {
    id: 'stress_worry',
    category: 'feelings',
    title: 'How do you handle everyday stress?',
    desc: 'Think normal pressure — deadlines, traffic, small annoyances.',
    options: scale(['Gets overwhelmed fast', 'Worries a lot, most days', 'Stressed sometimes, manageable', 'Stays pretty calm', 'Rarely rattled, very chill'])
  },
  {
    id: 'life_stress_capacity',
    category: 'feelings',
    title: 'How well do you bounce back from tough stuff?',
    desc: 'Sudden changes, setbacks, or hard times — how do you usually cope?',
    options: scale(['Gets knocked down easily', 'Struggles when things change', 'Copes okay, takes some time', 'Bounces back pretty well', 'Adapts fast, hard to shake'])
  },
  // 2. Your Personality
  {
    id: 'personality_openness',
    category: 'personality',
    title: 'Set in your ways, or open to new things?',
    desc: 'New ideas, new places, switching up your routine — how do you feel about that?',
    options: scale(['Like sticking to what I know', 'Prefer familiar over new', 'Open to new things sometimes', 'Love trying new stuff', 'Always chasing something new'])
  },
  {
    id: 'personality_conscientiousness',
    category: 'personality',
    title: 'Planner, or go-with-the-flow?',
    desc: 'Think to-do lists, deadlines, keeping things organized.',
    options: scale(['Totally spontaneous', 'A bit of both', 'Usually organized', 'Big on planning ahead', 'Everything scheduled, no surprises'])
  },
  {
    id: 'personality_extraversion',
    category: 'personality',
    title: 'Do people energize you, or drain you?',
    desc: 'Big groups and socializing vs. quiet time alone — what feels more like you?',
    options: scale(['Quiet, keep to myself', 'Small groups over big ones', 'A healthy mix of both', 'Love being social', 'The more people, the better'])
  },
  {
    id: 'personality_agreeableness',
    category: 'personality',
    title: 'Go with the flow, or speak your mind?',
    desc: "When there's disagreement, how do you usually show up?",
    options: scale(['Blunt, say it like it is', 'Set clear boundaries', 'Usually easy to get along with', 'Warm, like keeping the peace', 'Always put others first'])
  },
  {
    id: 'personality_stability',
    category: 'personality',
    title: 'How steady are your moods?',
    desc: "In tense moments or arguments, how much do your emotions swing?",
    options: scale(['Small things affect me a lot', 'Moods shift pretty fast', 'Mostly even-keeled', 'Rarely rattled', "Nothing really shakes me"])
  },
  {
    id: 'attachment_style',
    category: 'personality',
    title: 'How do you usually bond in relationships?',
    desc: "Pick whichever sounds most like you when you're close to someone.",
    options: [
      { val: 'Secure', label: 'Secure & easygoing', desc: "Comfortable being close, okay with space too — trust comes naturally." },
      { val: 'Anxious', label: 'Craves closeness', desc: 'Wants to feel close a lot, can worry when a partner needs space.' },
      { val: 'Avoidant', label: 'Values independence', desc: 'Likes personal space, can pull back emotionally when things get intense.' },
      { val: 'Fearful', label: 'Wants closeness, cautious', desc: "Wants to be close, but trusting and opening up doesn't come easy." }
    ]
  },
  // 3. Building Together
  {
    id: 'readiness_communication',
    category: 'together',
    title: 'How easily do you open up?',
    desc: "Sharing what you're really feeling, not just the surface stuff.",
    options: scale(['Hard for me to open up', 'Stick to easy topics', 'Share the basics', 'Pretty open about feelings', 'An open book, always'])
  },
  {
    id: 'readiness_conflict',
    category: 'together',
    title: 'How do you handle arguments?',
    desc: 'When you and a partner disagree, what usually happens?',
    options: scale(['I shut down or avoid it', 'Arguments happen a lot', 'We work it out, some friction', 'We talk it through calmly', 'We solve it together, no drama'])
  },
  {
    id: 'readiness_trust',
    category: 'together',
    title: 'How much do you trust a partner?',
    desc: 'Feeling safe, believed, and like you can count on each other.',
    options: scale(['Trust is hard for me', 'Takes time to trust', 'Trust comes fairly easily', 'I feel safe and secure', 'Trust is never a question'])
  },
  {
    id: 'readiness_commitment',
    category: 'together',
    title: "How 'all in' are you for the long haul?",
    desc: 'When things get hard, are you the type to stick it out?',
    options: scale(['Taking it one day at a time', 'Happy for now, unsure long-term', 'Thinking long-term', 'Deeply committed', 'In it for life, no matter what'])
  },
  {
    id: 'readiness_support',
    category: 'together',
    title: "How do you show up when your partner's struggling?",
    desc: "When they're having a rough day, what's your instinct?",
    options: scale(["I don't always know how to help", 'I help if they ask', 'I usually check in', "I'm there for them, always", 'I show up no matter what'])
  },
  // 4. Life & Family Goals
  {
    id: 'career_alignment',
    category: 'lifeGoals',
    title: 'How do you feel about career & moving for work?',
    desc: 'Ambition, long hours, relocating for a job — where do you stand?',
    options: scale(["Career isn't a big focus", 'Depends on the situation', 'Fairly career-focused', 'Career matters a lot to me', 'Career comes first, always'])
  },
  {
    id: 'financial_alignment',
    category: 'lifeGoals',
    title: "What's your money style?",
    desc: 'Spending, saving, budgeting — how do you handle money day to day?',
    options: scale(["I spend freely, don't track much", 'Loose with a budget', 'Balance spending & saving', 'Careful saver, budget-focused', 'Very disciplined about money'])
  },
  {
    id: 'lifestyle_alignment',
    category: 'lifeGoals',
    title: "What's your day-to-day rhythm like?",
    desc: 'Sleep schedule, free time, how social you are — day to day.',
    options: scale(['Pretty chaotic, no real routine', 'Routine varies a lot', 'Fairly steady routine', 'Pretty structured days', 'Very consistent, same rhythm daily'])
  },
  {
    id: 'family_expectations',
    category: 'lifeGoals',
    title: 'How involved should extended family be?',
    desc: 'In-laws, living arrangements, how much say family gets in your life together.',
    options: scale(['Prefer a lot of independence', 'Some involvement is okay', 'Comfortable with regular involvement', 'Family plays a big role', 'Family is central to everything'])
  },
  {
    id: 'parenting_alignment',
    category: 'lifeGoals',
    title: 'Where do you stand on having kids?',
    desc: 'Whether, when, and how many — and what kind of parent you want to be.',
    options: scale(['Not sure / big differences here', 'Still figuring it out', 'Have a general idea', 'Pretty clear on timeline', 'Very clear vision for our family'])
  },
  // 5. Habits & Calm
  {
    id: 'substance_concern',
    category: 'habits',
    title: 'How would you describe your drinking habits?',
    desc: 'Be honest — this just helps build a full picture, no judgment.',
    options: [
      { val: 'Low', label: 'Rarely or never', desc: "Alcohol isn't really part of my life." },
      { val: 'Moderate', label: 'Socially, now and then', desc: 'I drink sometimes when out with others — nothing heavy.' },
      { val: 'Elevated', label: 'Fairly often', desc: "I drink regularly, and it's a bigger part of my routine." }
    ]
  },
  {
    id: 'anger_regulation',
    category: 'habits',
    title: 'How do you handle anger?',
    desc: "When you're really upset, how do you usually react?",
    options: scale(['I get loud / say things I regret', 'I get pretty irritated', 'I keep it together, mostly', 'I stay calm and in control', 'Nothing really gets me angry'])
  }
];

// Precompute each question's place within its 5-question sub-section once,
// so every consumer (add-prospect wizard, invite-link wizard) shows the same
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
