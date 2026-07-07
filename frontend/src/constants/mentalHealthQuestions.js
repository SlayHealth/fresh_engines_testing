// Mirrors contexts/mental_health_questions.md — ids match the field names
// backend/src/controllers/mental.controller.js expects on partner_A_answers/partner_B_answers.

const scale = (labels) => labels.map((label, i) => ({ val: i + 1, label }));

export const MENTAL_HEALTH_QUESTIONS = [
  // 1. Emotional Health & Resiliency
  {
    id: 'emotional_wellbeing',
    category: 'Emotional Health & Resiliency',
    title: 'Daily energy & motivation',
    desc: 'Typical daily drive, motivation level, and general emotional energy.',
    options: scale(['Frequently low/sluggish', 'Mild energy drops', 'Typical daily drive', 'Consistent positive energy', 'Highly driven and motivated'])
  },
  {
    id: 'stress_worry',
    category: 'Emotional Health & Resiliency',
    title: 'Composure under pressure',
    desc: 'Ability to maintain steady focus and composure during daily stressors.',
    options: scale(['Easily overwhelmed', 'Frequent daily worry', 'Manageable stress level', 'High steady composure', 'Consistently calm & serene'])
  },
  {
    id: 'life_stress_capacity',
    category: 'Emotional Health & Resiliency',
    title: 'Coping reserve & adaptability',
    desc: 'Capacity to adapt to sudden changes, hardships, or life shifts.',
    options: scale(['Quickly depleted', 'Vulnerable to disruption', 'Moderate coping capacity', 'Strong coping reserve', 'Highly resilient & adaptive'])
  },
  // 2. Personality & Attachment
  {
    id: 'personality_openness',
    category: 'Personality & Attachment',
    title: 'Intellectual curiosity & flexibility',
    desc: 'Comfort with new ideas, unconventional philosophies, and routine changes.',
    options: scale(['Highly traditional / structured', 'Prefers familiar settings', 'Open to some new views', 'Very curious and flexible', 'Thrives on constant novelty'])
  },
  {
    id: 'personality_conscientiousness',
    category: 'Personality & Attachment',
    title: 'Planning, reliability & organization',
    desc: 'Preference for order, meticulous planning, and deadline tracking.',
    options: scale(['Spontaneous and loose', 'Moderate organization', 'Generally orderly and neat', 'Detail planner & reliable', 'Meticulous and systematic'])
  },
  {
    id: 'personality_extraversion',
    category: 'Personality & Attachment',
    title: 'Social energy & engagement',
    desc: 'Level of extroversion, outgoing nature, and preference for group settings.',
    options: scale(['Quiet / highly reserved', 'Prefers intimate groups', 'Balanced social needs', 'Outgoing and engaging', 'Life of the party'])
  },
  {
    id: 'personality_agreeableness',
    category: 'Personality & Attachment',
    title: 'Cooperation & empathetic alignment',
    desc: 'Disposition towards consensus, helping others, and harmony-seeking.',
    options: scale(['Skeptical / direct speaker', 'Maintains clear boundaries', 'Generally cooperative', 'Very warm and agreeable', 'Highly empathetic & harmony-focused'])
  },
  {
    id: 'personality_stability',
    category: 'Personality & Attachment',
    title: 'Emotional regulation & steady temperament',
    desc: 'Comfort in keeping a stable emotional state under stressful interactions.',
    options: scale(['Highly sensitive to friction', 'Prone to quick mood shifts', 'Generally stable mood', 'Strong emotional control', 'Extremely stable temperament'])
  },
  {
    id: 'attachment_style',
    category: 'Personality & Attachment',
    title: 'Bonding & relationship attachment style',
    desc: 'Primary attachment pattern describing closeness, independence, and trust.',
    options: [
      { val: 'Secure', label: 'Secure', desc: 'Comfortable with closeness and independence; trusts easily.' },
      { val: 'Anxious', label: 'Anxious', desc: 'Desires high closeness; prone to worry about partner space.' },
      { val: 'Avoidant', label: 'Avoidant', desc: 'Values self-reliance; prefers emotional distance under stress.' },
      { val: 'Fearful', label: 'Fearful', desc: 'Desires closeness but struggles with trust and vulnerability.' }
    ]
  },
  // 3. Marriage Readiness
  {
    id: 'readiness_communication',
    category: 'Marriage Readiness',
    title: 'Verbal expression & deeper sharing',
    desc: 'Comfort level in sharing vulnerable feelings and active listening.',
    options: scale(['Struggles to share feelings', 'Prefers superficial topics', 'Shares general emotions', 'Open, deep communicator', 'Total verbal transparency'])
  },
  {
    id: 'readiness_conflict',
    category: 'Marriage Readiness',
    title: 'Disagreement & conflict management',
    desc: 'Manner of resolving heated differences without emotional shutdown.',
    options: scale(['Avoids conflict / shuts down', 'Prone to high arguments', 'Resolves with some friction', 'Constructive compromise', 'Calm, collaborative resolution'])
  },
  {
    id: 'readiness_trust',
    category: 'Marriage Readiness',
    title: 'Honesty & relationship trust',
    desc: 'Sense of reliability, dependability, and safety inside the bond.',
    options: scale(['Substantial trust doubts', 'Takes time to open up', 'Reasonable day-to-day trust', 'Strong, reliable safety', 'Implicit, complete trust'])
  },
  {
    id: 'readiness_commitment',
    category: 'Marriage Readiness',
    title: 'Long-term partnership mindset',
    desc: 'Dedication to working through obstacles together long-term.',
    options: scale(['Wait and see mindset', 'Comfortable for now', 'Generally long-term focused', 'High partnership dedication', 'Unwavering lifelong commitment'])
  },
  {
    id: 'readiness_support',
    category: 'Marriage Readiness',
    title: 'Empathy & responsiveness',
    desc: 'Availability to offer support and emotional presence when partner is low.',
    options: scale(['Struggles to offer support', 'Supports only when asked', 'Generally supportive', 'Highly empathetic partner', 'Complete, active presence'])
  },
  // 4. Life, Career & Family Alignment
  {
    id: 'career_alignment',
    category: 'Life, Career & Family Alignment',
    title: 'Career priorities & relocation',
    desc: 'Alignment on ambition, working hours, and relocating for jobs.',
    options: scale(['Significant clashes in goals', 'Varying relocation flexibility', 'Moderate career harmony', 'Highly aligned milestones', 'Perfect professional synergy'])
  },
  {
    id: 'financial_alignment',
    category: 'Life, Career & Family Alignment',
    title: 'Savings, budgets & financial views',
    desc: 'Agreement on spending habits, budget splits, and financial safety nets.',
    options: scale(['Opposing spending habits', 'Varying budget structures', 'Generally similar values', 'Aligned saving/budget views', 'Complete financial harmony'])
  },
  {
    id: 'lifestyle_alignment',
    category: 'Life, Career & Family Alignment',
    title: 'Daily routines & social pacing',
    desc: 'Agreement on daily sleep schedules, social habits, and leisure pacing.',
    options: scale(['Opposing lifestyle rhythms', 'Different routine needs', 'Good day-to-day compatibility', 'Highly synchronized rhythm', 'Flawless lifestyle synergy'])
  },
  {
    id: 'family_expectations',
    category: 'Life, Career & Family Alignment',
    title: 'Extended family boundaries & living',
    desc: 'Alignment on involvement, boundaries, and arrangements with in-laws.',
    options: scale(['Significant friction expected', 'Different boundary views', 'Generally manageable bounds', 'Aligned boundary expectations', 'Complete boundary synergy'])
  },
  {
    id: 'parenting_alignment',
    category: 'Life, Career & Family Alignment',
    title: 'Children timeline & parenting styles',
    desc: 'Agreement on whether to have children, timeline, and philosophy.',
    options: scale(['Major differences in vision', 'Undecided / varying times', 'Generally similar outlook', 'Strong timeline harmony', 'Perfect parenting alignment'])
  },
  // 5. Composure & Substance Habits
  {
    id: 'substance_concern',
    category: 'Composure & Substance Habits',
    title: 'Alcohol & lifestyle substance habits',
    desc: 'Rate frequency and impact of alcohol or other social substance use.',
    options: [
      { val: 'Low', label: 'Low', desc: 'Infrequent or no substance use; no lifestyle concerns.' },
      { val: 'Moderate', label: 'Moderate', desc: 'Regular social drinking; manageable habits.' },
      { val: 'Elevated', label: 'Elevated', desc: 'Frequent use or concerns regarding lifestyle impacts.' }
    ]
  },
  {
    id: 'anger_regulation',
    category: 'Composure & Substance Habits',
    title: 'Anger control under intense stress',
    desc: 'Capacity to self-regulate and avoid verbal aggression when angry.',
    options: scale(['Quick to anger / aggressive', 'Vocalizes high irritation', 'Typical self-regulation', 'Excellent anger management', 'Flawless emotional calm'])
  }
];
