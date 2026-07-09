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

export function getTrustMessage(name, category, index) {
  if (!name) return null;
  const firstName = name.trim().split(/\s+/)[0];
  if (!firstName) return null;
  const pool = TRUST_MESSAGES_BY_CATEGORY[category] || TRUST_MESSAGES_BY_CATEGORY.general;
  const template = pool[((index % pool.length) + pool.length) % pool.length];
  return template.replace(/{name}/g, firstName);
}
