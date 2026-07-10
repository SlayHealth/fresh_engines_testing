// Small, rotating "why this matters" whispers shown beneath each questionnaire
// step. Personalized with the person's first name, kept short and warm —
// never the visual focus of the screen, just quiet reassurance while they answer.
// {name} is replaced with the person's first name at render time.
//
// Messages are grouped per questionnaire (category) so "About You" doesn't
// echo the same lines as "Lifestyle" or "Mental Wellbeing" — each pool is
// themed to what that section is actually asking about, and is large enough
// that a full run through that section rarely repeats a line.

export const TRUST_MESSAGES_BY_CATEGORY = {
  about: [
    "{name}, these basics are the foundation everything else builds on — no detail here is too small to matter.",
    "There's no 'ideal' answer to this one, {name} — just the true one.",
    "{name}, your body, your data — this stays between you and your match, nothing more.",
    "Every detail here helps paint an honest picture, not a perfect one, {name}.",
    "{name}, filling this out honestly is one of the most useful things you can do right now.",
    "Simple facts like this one quietly power a much bigger picture, {name}.",
    "{name}, nobody's judging these numbers — they're just context for what comes next.",
    "You're laying the groundwork for real clarity, {name}, one basic detail at a time.",
    "{name}, we ask for this because it genuinely changes how accurate your results are.",
    "This is the easy part, {name} — the more meaningful questions build right on top of it.",
    "{name}, small identity details like this connect the dots between every report you upload.",
    "Nothing about you is 'just a number' here, {name} — every field adds real signal.",
    "{name}, you're one honest answer closer to a result that actually reflects you.",
    "We use this to calibrate your results precisely, {name} — not to categorize you.",
    "{name}, this is where your story starts to take shape."
  ],

  lifestyle: [
    "{name}, daily habits like this one often matter more for long-term health than any single test result.",
    "Be honest here, {name} — this is exactly where lifestyle science earns its keep.",
    "{name}, small daily patterns compound into big outcomes over a lifetime together.",
    "No judgment on this one, {name} — just the real picture of how you live.",
    "{name}, habits are the most changeable part of health, which is exactly why they matter so much.",
    "Your everyday rhythm, {name}, tells us more than you'd think about long-term wellbeing.",
    "{name}, this is the kind of detail that turns a generic report into a personal one.",
    "Whatever your honest answer is here, {name}, it's the right one to give.",
    "{name}, lifestyle factors like this one are often the most fixable — knowing is the first step.",
    "You'd be surprised how much a simple habit like this shifts a long-term picture, {name}.",
    "{name}, we're not grading your lifestyle — we're mapping it, honestly.",
    "This detail helps connect your day-to-day life to your long-term health story, {name}.",
    "{name}, real habits, real insights — that's the whole idea here.",
    "Every honest answer here sharpens the accuracy of what we can tell you both, {name}.",
    "{name}, this is exactly the kind of thing couples wish they'd talked about earlier."
  ],

  mental: [
    "{name}, there are no wrong answers in this section — only honest ones.",
    "Take a breath before this one, {name} — self-awareness is the whole point here.",
    "{name}, understanding yourself here helps your partner understand you too.",
    "This section exists because emotional compatibility matters just as much as physical health, {name}.",
    "{name}, it's okay if this one makes you pause — that's usually a sign it matters.",
    "Your honest reflection here, {name}, is worth more than a 'correct' sounding answer.",
    "{name}, every lasting couple has had to answer questions like this one honestly, eventually.",
    "This isn't a personality test to pass, {name} — it's a mirror, and that's a good thing.",
    "{name}, the goal here is clarity, not perfection.",
    "Emotional insight like this, {name}, is the part most relationships skip and shouldn't.",
    "{name}, however you answer this, it's giving your future partner a truer picture of you.",
    "This kind of self-honesty, {name}, is what makes your mental compatibility score actually meaningful.",
    "{name}, you're allowed to still be figuring some of this out — just answer where you are today.",
    "Real emotional maturity starts with questions exactly like this one, {name}.",
    "{name}, we ask this because relationships are built on emotional patterns, not just chemistry.",
    "However you feel about this one, {name}, that feeling is useful information.",
    "{name}, this section is private and used only to understand you and your match better.",
    "You're being remarkably thoughtful right now, {name} — that matters more than you know.",
    "{name}, understanding your own patterns is the first step to healthier ones.",
    "This is the kind of question a good therapist would ask, {name}, and you're answering it for free.",
    "{name}, insight like this is exactly what makes a compatibility score more than just numbers.",
    "Whatever comes to mind first, {name}, is usually worth trusting here.",
    "{name}, you're building real self-knowledge with every question in this section.",
    "This one might feel personal, {name} — that's exactly why it's worth answering honestly."
  ],

  pathology: [
    "{name}, your pathology report says a lot more about your future together than most people realize.",
    "This upload stays encrypted and private, {name}, used only for your compatibility analysis.",
    "{name}, blood work sounds clinical, but it's really just your body's honest status update.",
    "We extract only what's clinically relevant here, {name} — nothing more, nothing less.",
    "{name}, plenty of couples have trusted us with exactly this kind of report already.",
    "Your numbers are just data points, {name}, not a verdict on your worth or your future.",
    "{name}, this is one of the most valuable pieces of the whole picture.",
    "Whatever this report says, {name}, it's better to know now than to guess later.",
    "{name}, real transparency about health starts with reports like this one.",
    "This detail alone often reshapes the whole compatibility picture, {name}, usually for the better."
  ],

  radiology: [
    "{name}, imaging reports like this fill in details blood work alone can't show.",
    "This stays private and is only used for your own compatibility analysis, {name}.",
    "{name}, most people never think to share this before marriage — you're ahead of the curve.",
    "Structural health matters just as much as lab numbers, {name}, and this is how we see it.",
    "{name}, this one detail can quietly resolve a lot of uncertainty.",
    "Whatever this scan shows, {name}, it's simply information, not a judgment.",
    "{name}, few couples go this deep before marriage — that says a lot about you.",
    "This is one of the more thorough steps, {name}, and it shows real commitment to clarity."
  ],

  genomics: [
    "{name}, this is the kind of insight that can genuinely shape your family's future.",
    "Genetic screening like this stays completely private to the two of you, {name}.",
    "{name}, understanding shared carrier risks now is one of the most protective things you can do.",
    "This isn't about fear, {name} — it's about informed, confident family planning.",
    "{name}, very few couples get this level of clarity before marriage.",
    "Whatever this reveals, {name}, it gives you both real choices instead of surprises.",
    "{name}, this is the deepest layer of the picture, and one of the most valuable.",
    "Genetics aren't destiny, {name}, but they're good to know together."
  ],

  routing: [
    "{name}, almost there — this next part is just logistics, not more health details.",
    "However your prospect shares their side, {name}, the process stays just as secure.",
    "{name}, you're seconds away from either their link or their profile.",
    "This step is quick, {name} — the real insight comes right after.",
    "{name}, nearly done with your side of the story."
  ],

  // Fallback pool for any step that isn't tagged with a specific category.
  general: [
    "{name}, did you know couples who understand each other's health early report far fewer surprises later?",
    "Every answer here brings your health story into sharper focus, {name}.",
    "{name}, your answers stay private between you and your match — always.",
    "Small, honest answers like this one are what make compatibility science actually useful, {name}.",
    "This is exactly the kind of clarity most couples wish they'd had before marriage, {name}.",
    "You're building something most people skip — real, honest health transparency, {name}.",
    "{name}, every question here exists because it matters for your future together, nothing filler.",
    "Your care in answering this, {name}, is what makes your results actually trustworthy.",
    "{name}, a few honest minutes now can save a lot of guesswork later.",
    "Nothing here is graded, {name} — there's no 'right' answer, only an honest one.",
    "Take your time, {name}. Thoughtful answers make for a far more useful result.",
    "{name}, thousands of couples have trusted this same process before their big day.",
    "You're closer to a clearer picture than you were a minute ago, {name}.",
    "{name}, your data is encrypted and never shared without your say-so.",
    "It's okay to not know something exactly, {name} — your best estimate is enough.",
    "This kind of openness is rare, {name}, and it's exactly what makes a match meaningful.",
    "{name}, one more honest answer, one step closer to real clarity.",
    "Every field you fill helps the two of you start this chapter better informed, {name}.",
    "{name}, you're doing something genuinely thoughtful for your relationship right now.",
    "Good health conversations start with small honest moments like this one, {name}.",
    "{name}, we built this so you'd never have to guess about what matters most.",
    "You can always come back and change this later, {name} — nothing here is permanent.",
    "{name}, the more real this is, the more useful it becomes for both of you."
  ]
};

// Per-question messages, keyed by the exact `title` string shown on screen for
// that step. Categories above are themed but generic — every question in
// "About You" shared the same pool regardless of whether it was asking about
// Gender or Waist. This is the actual point of the whisper: it should read
// like it's responding to *this* question, not just "this section." Falls
// back to the category pool (and then general) for any title not listed here.
export const TRUST_MESSAGES_BY_QUESTION = {
  // --- About ---
  "What's their name?": [
    "{name}, just so we can personalize their side of the experience too.",
    "One quick detail, {name} — the rest of their questions will feel more personal with this."
  ],
  'Gender': [
    "{name}, we ask this to route the right reference ranges and risk models to your reports.",
    "This one's simple, {name} — it just tells us which clinical benchmarks apply to what you upload."
  ],
  'Date of Birth': [
    "{name}, your exact age shapes everything from fertility windows to which risk factors we flag.",
    "This isn't just a number, {name} — age is one of the biggest levers in how we read your results."
  ],
  'City': [
    "{name}, your city helps us account for regional health patterns — nothing more.",
    "Just context, {name} — where you live can matter for things like local health baselines."
  ],
  'Height': [
    "{name}, height feeds directly into your BMI and a few other calculated markers.",
    "One quick measurement, {name} — this pairs with your weight to complete the picture."
  ],
  'Weight': [
    "{name}, this pairs with your height to calculate BMI — a genuinely useful health marker.",
    "Your honest current weight, {name}, keeps every downstream calculation accurate."
  ],
  'Waist': [
    "{name}, waist measurement is one of the better predictors of metabolic risk — worth getting right.",
    "This one number, {name}, often tells us more about health risk than weight alone."
  ],
  'How did you meet?': [
    "{name}, this is just context for your story — no health data here, promise.",
    "Just curious how this began, {name} — purely for the narrative, not the score."
  ],
  'Which platform?': [
    "{name}, just filling in the detail you already mentioned — nothing more to it.",
    "Quick follow-up, {name}, so your story reads accurately later."
  ],
  'Relationship Status': [
    "{name}, this helps us tailor the tone of your report to where you actually are.",
    "Knowing this, {name}, keeps the rest of the experience relevant to your situation."
  ],

  // --- Lifestyle ---
  'Physical Activity Level': [
    "{name}, activity level is one of the strongest predictors of long-term cardiovascular health.",
    "Be honest here, {name} — this single habit ripples into almost every health outcome we track."
  ],
  'Daily Steps': [
    "{name}, a rough daily average is all we need — no need to check your phone for the exact count.",
    "This adds real texture to your activity picture, {name}, beyond just 'active' or 'not.'"
  ],
  'Occupation & Work Style': [
    "{name}, sedentary desk work and physically demanding jobs carry very different health profiles.",
    "Your work style, {name}, quietly shapes stress levels, activity, and even sleep patterns."
  ],
  'Alcohol Drinking Habits': [
    "{name}, drinking habits matter for liver markers and a few other things we'll be checking.",
    "No judgment here, {name} — just an honest read on frequency helps us interpret your reports correctly."
  ],
  'Smoking Habits': [
    "{name}, this affects cardiovascular and respiratory risk more than almost anything else we ask.",
    "Whatever the honest answer is, {name}, it meaningfully changes how we read certain markers."
  ],
  'Tobacco Consumption': [
    "{name}, smokeless tobacco carries its own distinct risk profile worth capturing separately.",
    "This one's often missed, {name}, but it matters just as much as smoking for a few key markers."
  ],
  'Sleep Cycle Patterns': [
    "{name}, sleep quality touches almost every system in the body — it's a bigger deal than it sounds.",
    "Your real sleep pattern, {name}, not the ideal one — that's what actually helps us here."
  ],
  'Menstrual Cycle Status': [
    "{name}, cycle regularity is a genuinely useful signal for hormonal and fertility health.",
    "Totally optional, {name}, but if you know it, it adds real value to your picture."
  ],

  // --- Mental Wellbeing (titles match MENTAL_HEALTH_QUESTIONS in mentalHealthQuestions.js) ---
  'Daily energy & motivation': [
    "{name}, your typical energy level says a lot about emotional resilience day to day.",
    "Think 'most days,' {name}, not your best day or your worst one."
  ],
  'Composure under pressure': [
    "{name}, how you hold up under stress is a real predictor of relationship steadiness.",
    "There's no wrong answer, {name} — just how it honestly feels most of the time."
  ],
  'Coping reserve & adaptability': [
    "{name}, life throws curveballs — this is about how much shock absorption you naturally have.",
    "Adaptability like this, {name}, often matters more than any single crisis-response story."
  ],
  'Intellectual curiosity & flexibility': [
    "{name}, this is about comfort with new ideas, not intelligence — there's a difference.",
    "Whether you love novelty or prefer the familiar, {name}, both are valid answers here."
  ],
  'Planning, reliability & organization': [
    "{name}, this is one of the classic compatibility friction points — worth answering honestly.",
    "Spontaneous or scheduled, {name}, neither is 'better' — just different rhythms to match."
  ],
  'Social energy & engagement': [
    "{name}, introvert or extrovert, this shapes a lot of how daily life together will feel.",
    "However social you naturally are, {name}, that's the useful answer, not the 'aspirational' one."
  ],
  'Cooperation & empathetic alignment': [
    "{name}, this is about how you naturally move toward consensus versus your own position.",
    "Neither extreme is wrong here, {name} — we're just mapping your natural style."
  ],
  'Emotional regulation & steady temperament': [
    "{name}, emotional steadiness under friction is one of the strongest markers of relationship longevity.",
    "This one matters more than people think, {name} — mood stability shapes everyday life together."
  ],
  'Bonding & relationship attachment style': [
    "{name}, attachment style is one of the most researched predictors of relationship compatibility.",
    "There's no 'best' style here, {name} — just the one that's actually true for you."
  ],
  'Verbal expression & deeper sharing': [
    "{name}, how openly you share feelings shapes intimacy more than almost anything else.",
    "Whatever your natural comfort level is, {name}, that's exactly what's useful to know here."
  ],
  'Disagreement & conflict management': [
    "{name}, how you handle disagreement — not whether you avoid it — is what really predicts outcomes.",
    "Every couple argues, {name}; this is about your honest style when it happens."
  ],
  'Honesty & relationship trust': [
    "{name}, baseline trust patterns tend to carry over from relationship to relationship.",
    "This reflects your general trust style, {name}, not judgment on any one person."
  ],
  'Long-term partnership mindset': [
    "{name}, this is about where your head's at on long-term commitment right now.",
    "Wherever you honestly stand, {name}, that's the useful data point — not where you 'should' be."
  ],
  'Empathy & responsiveness': [
    "{name}, this is about showing up for a partner when they're struggling — a big one for lasting bonds.",
    "However naturally supportive you are, {name}, that's worth capturing accurately."
  ],
  'Career priorities & relocation': [
    "{name}, career alignment quietly determines a lot of major life decisions down the line.",
    "This helps flag potential friction early, {name}, while it's still easy to talk about."
  ],
  'Savings, budgets & financial views': [
    "{name}, money habits are one of the top sources of relationship friction — worth surfacing early.",
    "No judgment on spending style here, {name} — just an honest read on how you approach money."
  ],
  'Daily routines & social pacing': [
    "{name}, day-to-day rhythm compatibility matters more than people expect once you're living together.",
    "This is about pacing, {name} — early bird or night owl, homebody or social butterfly."
  ],
  'Extended family boundaries & living': [
    "{name}, in-law dynamics are one of the most common flashpoints in Indian marriages — worth mapping early.",
    "Whatever your honest boundary preference is, {name}, that's exactly the useful signal here."
  ],
  'Children timeline & parenting styles': [
    "{name}, alignment on timeline and philosophy here prevents a lot of future friction.",
    "It's fine to be undecided, {name} — an honest 'still figuring it out' is a valid answer."
  ],
  'Alcohol & lifestyle substance habits': [
    "{name}, this is about lifestyle impact, not judgment — just an honest frequency read.",
    "Whatever's true day-to-day, {name}, that's the useful answer, not the minimized one."
  ],
  'Anger control under intense stress': [
    "{name}, this is one of the more important markers for long-term relationship safety.",
    "Under real pressure, not your calmest day, {name} — that's the honest read we need here."
  ]
};

export function getTrustMessage(name, category, index, title) {
  if (!name) return null;
  const firstName = name.trim().split(/\s+/)[0];
  if (!firstName) return null;
  const pool = (title && TRUST_MESSAGES_BY_QUESTION[title])
    || TRUST_MESSAGES_BY_CATEGORY[category]
    || TRUST_MESSAGES_BY_CATEGORY.general;
  const template = pool[((index % pool.length) + pool.length) % pool.length];
  return template.replace(/{name}/g, firstName);
}
