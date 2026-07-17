// Small, rotating "why this matters" whispers shown beneath each questionnaire
// step. Personalized with the person's first name, kept short and warm, with
// a light touch of wit — never the visual focus of the screen, just quiet
// reassurance (with a small smile) while they answer.
// {name} is replaced with the person's first name at render time.
//
// Wit is deliberately dialed differently by category: About/Lifestyle/routing
// are low-stakes, so they can be playful. Mental Wellbeing is real
// psychological territory (trust, anger, attachment) — most of that pool
// stays sincere, with only the lighter, lower-stakes questions getting a
// gentle joke. Pathology/Radiology/Genomics touch real health data and
// sometimes real anxiety, so wit there is used sparingly and never at the
// expense of what someone might actually be nervous about reading.
//
// Messages are grouped per questionnaire (category) so "About You" doesn't
// echo the same lines as "Lifestyle" or "Mental Wellbeing" — each pool is
// themed to what that section is actually asking about, and is large enough
// that a full run through that section rarely repeats a line.

export const TRUST_MESSAGES_BY_CATEGORY = {
  about: [
    "{name}, think of this as your app's 'nice to meet you' — small talk that actually matters later.",
    "There's no gold-star answer here, {name} — no one's grading on a curve.",
    // UX8-02: was "...just to you and your match, promise" — falsely implied
    // the invited partner also gets mutual access/visibility to the result,
    // which the app's account model (Finding #0) never provides.
    "{name}, your data isn't going on a billboard — it's used only for this compatibility check, promise.",
    "We're going for an honest portrait here, {name}, not a dating-app profile pic.",
    "{name}, five seconds of honesty here beats five years of 'wait, you never told me that.'",
    "This tiny fact is doing more behind the scenes than it looks like, {name}.",
    "{name}, our engine has seen it all — nothing here raises an eyebrow.",
    "Rome wasn't built in a day, {name}, but your health profile might be — one field at a time.",
    "{name}, skip this and our engine starts guessing — and it's a terrible guesser.",
    "Consider this the warm-up lap, {name} — the real questions are just ahead.",
    "{name}, this little detail is the glue holding your whole report together.",
    "You're not a number to us, {name} — well, except for the ones you're about to type in.",
    "{name}, one more honest tap and you're that much closer to a result that actually sounds like you.",
    "This calibrates your results precisely, {name} — it's not a personality quiz for a magazine.",
    "{name}, every good story needs a chapter one — this is yours."
  ],

  lifestyle: [
    "{name}, your habits are basically running the show — more than any single test result ever could.",
    "Be honest here, {name} — this is exactly the one place fibbing shows up on a chart.",
    "{name}, small daily patterns compound like interest — except the account is your future together.",
    "No judgment on this one, {name} — we've heard it all, and worse.",
    "{name}, the good news about habits? Unlike genetics, you can actually do something about them.",
    "Your everyday rhythm, {name}, is basically a health diary you didn't know you were keeping.",
    "{name}, this is what separates 'a report' from 'your report.'",
    "There's no trick question here, {name} — just answer like nobody's watching. (We are. Kindly.)",
    "{name}, lifestyle factors like this one are often the most fixable — knowing is the first step.",
    "You'd be surprised how much one simple habit shifts a long-term picture, {name}.",
    "{name}, we're not grading your lifestyle — we're mapping it, honestly.",
    "This is how an ordinary Tuesday turns into a trend, {name}.",
    "{name}, real habits, real insight — no filters needed here.",
    "Every honest answer here sharpens the accuracy of what we can tell you both, {name}.",
    "{name}, 'wish we'd talked about this sooner' is basically our whole reason for existing."
  ],

  mental: [
    "{name}, there's no wrong answer here — only an honest one (multiple choice makes that easier, at least).",
    "Take a breath before this one, {name} — self-awareness is the whole point here.",
    "{name}, understanding yourself here is basically a cheat sheet for your future partner.",
    "This section exists because emotional compatibility matters just as much as physical health, {name}.",
    "{name}, it's okay if this one makes you pause — that's usually a sign it matters.",
    "{name}, we're not grading for the answer that sounds best in an interview — just the true one.",
    "{name}, every lasting couple has had to answer questions like this one honestly, eventually.",
    "This isn't a personality quiz you can 'win,' {name} — more of a mirror, and a kind one.",
    "{name}, the goal here is clarity, not perfection.",
    "Emotional insight like this, {name}, is the part most relationships skip and shouldn't.",
    "{name}, however you answer this, it's giving your future partner a truer picture of you.",
    "This kind of self-honesty, {name}, is what makes your mental compatibility score actually meaningful.",
    "{name}, 'still figuring it out' is a completely valid answer — we won't tell.",
    "Real emotional maturity starts with questions exactly like this one, {name}.",
    "{name}, we ask this because relationships are built on emotional patterns, not just chemistry.",
    "However you feel about this one, {name}, that feeling is useful information.",
    // UX8-02: was "...between us and your match..." — same false mutual-access framing.
    "{name}, this stays confidential — not even our engineers are nosy enough to peek.",
    "You're being remarkably thoughtful right now, {name} — that matters more than you know.",
    "{name}, understanding your own patterns is the first step to healthier ones.",
    "This is the kind of question a good therapist would ask, {name} — and you're getting it for the price of a tap.",
    "{name}, insight like this is exactly what makes a compatibility score more than just numbers.",
    "Whatever comes to mind first, {name}, is usually worth trusting here.",
    "{name}, you're building real self-knowledge with every question in this section.",
    "This one might feel personal, {name} — that's exactly why it's worth answering honestly."
  ],

  pathology: [
    "{name}, that pathology report is basically your body's tell-all memoir — minus the drama.",
    "This upload stays encrypted and private, {name} — locked up tighter than your group chat.",
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
    // UX8-02: was "...your own compatibility analysis..." — the invited
    // partner never sees any analysis, so "your own" implied an ownership/
    // access stake they don't actually have.
    "This stays private and is only used for this compatibility analysis, {name}.",
    "{name}, most people don't think to share this before marriage — look at you, overachiever.",
    "Structural health matters just as much as lab numbers, {name}, and this is how we see it.",
    "{name}, this one detail can quietly resolve a lot of uncertainty.",
    "Whatever this scan shows, {name}, it's simply information, not a judgment.",
    "{name}, few couples go this deep before marriage — that says a lot about you.",
    "This is one of the more thorough steps, {name}, and it shows real commitment to clarity."
  ],

  genomics: [
    "{name}, this is the kind of insight that can genuinely shape your family's future.",
    // UX8-02: the sharpest instance of the false mutual-access claim — was
    // "...completely private to the two of you..." for genetic/carrier data,
    // the single most sensitive category in the app.
    "Genetic screening like this stays completely confidential, {name}.",
    "{name}, understanding shared carrier risks now is one of the most protective things you can do.",
    "This isn't about fear, {name} — it's about informed, confident family planning.",
    "{name}, very few couples get this level of clarity before marriage.",
    "Whatever this reveals, {name}, it gives you both real choices instead of surprises.",
    "{name}, this is the deepest layer of the picture, and one of the most valuable.",
    "Genetics aren't destiny, {name}, but they're good to know together."
  ],

  routing: [
    "{name}, almost there — this next part is just paperwork, no more prodding questions.",
    "However your prospect shares their side, {name}, it's Fort Knox either way.",
    "{name}, you're seconds away from either their link or their profile.",
    "This bit's quick, {name} — think of it as the ad break before the main event.",
    "{name}, nearly done with your side of the story."
  ],

  // Fallback pool for any step that isn't tagged with a specific category.
  general: [
    "{name}, fun fact: couples who sort this out early report way fewer 'wait, WHAT?' moments later.",
    "Every answer here brings your health story into sharper focus, {name}.",
    // UX8-02: was "...between you and your match..." — same false mutual-access framing.
    "{name}, your answers stay private and confidential — always.",
    "Small, honest answers like this one are what make compatibility science actually useful, {name}.",
    "This is exactly the kind of clarity most couples wish they'd had before marriage, {name}.",
    "You're building something most people skip — real, honest health transparency, {name}.",
    "{name}, no filler questions here — we cut those in an early draft. This one made the final cut.",
    "Your care in answering this, {name}, is what makes your results actually trustworthy.",
    "{name}, a few honest minutes now can save a lot of guesswork later.",
    "Nothing here is graded, {name} — no gold stars, no report card, just the truth.",
    "Take your time, {name}. Thoughtful answers make for a far more useful result.",
    "{name}, thousands of couples have trusted this same process before their big day.",
    "You're closer to a clearer picture than you were a minute ago, {name}.",
    "{name}, your data is encrypted and never shared without your say-so.",
    "{name}, 'roughly' is a perfectly good answer — we're not the IRS.",
    "This kind of openness is rare, {name}, and it's exactly what makes a match meaningful.",
    "{name}, one more honest answer, one step closer to real clarity.",
    "Every field you fill helps the two of you start this chapter better informed, {name}.",
    "{name}, you're doing something genuinely thoughtful for your relationship right now.",
    "Good health conversations start with small honest moments like this one, {name}.",
    "{name}, we built this so you'd never have to guess about what matters most.",
    "You can change this later, {name} — unlike a tattoo, this one's actually editable.",
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
    "One quick detail, {name} — we promise not to just call them 'the prospect' the whole time."
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
    "Just context, {name} — and no, we're not going to show up unannounced."
  ],
  'Height': [
    "{name}, height feeds directly into your BMI and a few other calculated markers.",
    "One quick measurement, {name} — no tiptoes, we'll know."
  ],
  'Weight': [
    "{name}, this pairs with your height to calculate BMI — a genuinely useful health marker.",
    "Your honest current weight, {name} — not your 'at the doctor's office in January' weight."
  ],
  'Waist': [
    "{name}, waist measurement is one of the better predictors of metabolic risk — worth getting right.",
    "This one number, {name}, often tells us more about health risk than weight alone."
  ],
  'How did you meet?': [
    "{name}, this is just context for your story — no health data here, promise.",
    "Just curious how this began, {name} — think of it as the 'how we met' story at the wedding, minus the mic."
  ],
  'Which platform?': [
    "{name}, just filling in the detail you already mentioned — nothing more to it.",
    "Quick follow-up, {name}, so your story reads accurately later."
  ],
  // --- Lifestyle ---
  'Physical Activity Level': [
    "{name}, activity level is one of the strongest predictors of long-term cardiovascular health.",
    "Be honest here, {name} — a gym membership you haven't used since January doesn't count."
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
    "No judgment here, {name} — we've seen 'occasionally' mean everything from one glass to Fridays that start on Wednesday."
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
    "Your real sleep pattern, {name} — the one with the 2am scrolling, not the Pinterest version."
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
    "{name}, this is about comfort with new ideas, not intelligence — no IQ test hiding in here.",
    "Whether you love novelty or prefer the familiar, {name}, both are valid answers here."
  ],
  'Planning, reliability & organization': [
    "{name}, this is a classic compatibility friction point — ask any couple who's tried to pack for a trip together.",
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
    "{name}, career alignment quietly determines a lot of major life decisions down the line — like whose city you actually end up in.",
    "This helps flag potential friction early, {name}, while it's still easy to talk about."
  ],
  'Savings, budgets & financial views': [
    "{name}, money habits are one of the top sources of relationship friction — right up there with hosting duties.",
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
