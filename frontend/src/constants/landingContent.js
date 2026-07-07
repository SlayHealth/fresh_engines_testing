export const HEALTH_TOPICS = ['Family Planning', 'Family Health', 'Chronic Disease', 'Lifestyle', 'Mental Health'];

export const STORIES = [
  {
    id: 1,
    emoji: '💊',
    category: 'INFERTILITY',
    categoryColor: 'bg-red-100 text-red-600',
    tabDescription: '₹8-15L average cost after marriage',
    quote: '"We spent our entire savings on IVF. Three failed cycles. Nobody warned us that a simple check before marriage could have changed everything."',
    attribution: '— Couple, married 3 years, Bangalore',
    stat: '1 in 4',
    statDescription: 'face fertility challenges in India. Most discover it only after 2-5 years of trying.',
    insight: 'PCOS is manageable when caught early. A basic semen analysis takes 15 minutes. Knowing before marriage means planning together — not panicking alone.',
    source: 'JAMA Network Open 2024 · PMC Reproductive Biology Study · ICMR'
  },
  {
    id: 2,
    emoji: '🛡️',
    category: 'STDs & STIs',
    categoryColor: 'bg-orange-100 text-orange-600',
    tabDescription: "Most carriers don't know they're infected",
    quote: '"He seemed perfectly healthy. Six months after our wedding, I tested positive for Hepatitis B. He was a carrier and never knew."',
    attribution: '— Woman, 28, Delhi',
    stat: '80%',
    statDescription: 'of STI carriers show zero symptoms. You cannot tell by looking. You cannot tell by asking.',
    insight: "A simple blood test can detect Hepatitis B, HIV, and syphilis. HPV screening is available. These are not moral judgments — they're medical facts that protect both partners.",
    source: 'WHO 2023 · NACO India · CDC STI Surveillance'
  },
  {
    id: 3,
    emoji: '💊',
    category: 'CHRONIC DISEASE',
    categoryColor: 'bg-blue-100 text-blue-600',
    tabDescription: 'Hidden conditions that surface after marriage',
    quote: '"Nobody in his family mentioned his father\'s diabetes and heart condition. Three years in, he was diagnosed with both. Now our entire life revolves around managing it."',
    attribution: '— Woman, 32, Mumbai',
    stat: '1 in 3',
    statDescription: "will develop a chronic disease before age 40. Family history doubles your risk — but most families don't disclose.",
    insight: "Chronic diseases are manageable — but only when you know about them. A pre-marriage health check gives you a baseline, not a verdict. It's the difference between planning and panic.",
    source: 'ICMR 2023 · Lancet India · WHO NCD Report'
  },
  {
    id: 4,
    emoji: '🧬',
    category: 'GENETIC DISORDERS',
    categoryColor: 'bg-green-100 text-green-700',
    tabDescription: 'Both healthy parents. Affected child.',
    quote: '"Both of us were perfectly healthy. Nobody told us we were carriers. Now our child needs blood transfusions every month — for life."',
    attribution: '— Couple, married 5 years, Gujarat',
    stat: '4 Crore',
    statDescription: 'Indians silently carry the Thalassemia gene. Carriers are completely healthy — but if both partners carry it, every pregnancy has a 25% risk.',
    insight: "A ₹500 blood test can identify if you're a carrier. Know before marriage, not after birth. This isn't about blame — it's about giving your future children the best chance.",
    source: 'National Health Mission · Indian Thalassemia Society'
  }
];

export const TESTIMONIALS = [
  {
    id: 1,
    names: 'Priya & Amit',
    location: 'Mumbai',
    type: 'ARRANGED MARRIAGE',
    quote: 'Traditional arranged marriage, 5 meetings before engagement. We discovered after our son was born he needs blood transfusions every 3 weeks for life. A ₹1,500 test before marriage could have helped us make an informed choice.',
    highlight: 'We Both Carried Thalassemia Trait',
    impact: 'Cost impact: ₹40,000/month lifelong treatment',
    color: 'amber'
  },
  {
    id: 2,
    names: 'Sneha & Rohan',
    location: 'Bangalore',
    type: 'LOVE MARRIAGE',
    quote: "We thought love was enough. Then we got screened and found my AMH was 0.8 and his sperm count was 12M. Both treatable! If we'd waited until 'trying,' we'd have wasted 2 years and lakhs on IVF.",
    highlight: 'We Dated 3 Years But Never Discussed This',
    impact: 'Saved: 2 years + ₹3-5 lakhs in IVF costs',
    color: 'pink'
  },
  {
    id: 3,
    names: 'Kavita S.',
    location: 'Delhi',
    type: 'REMARRIAGE',
    quote: "Divorced at 32. My ex-husband had undiagnosed diabetes that became severe. This time, I insisted both of us get screened. We discovered his pre-diabetic markers early. I'll never go into marriage blind again.",
    highlight: 'My First Marriage Had Hidden Health Issues',
    impact: 'Result: Prevented repeated trauma, built trust',
    color: 'teal'
  }
];

export const PRICING_PLANS = [
  {
    id: 'basic',
    title: 'Individual Health Clarity',
    price: '₹799',
    per: '/person',
    description: 'I want to understand my health first',
    features: [
      'Personal health analysis (50+ markers)',
      'Fertility readiness score',
      'Chronic disease screening',
      'Genetic risk assessment',
      'Lifestyle recommendations',
      'Next steps guide'
    ],
    outcome: 'Sleep better knowing YOUR health status',
    cta: 'Check My Health',
    popular: false
  },
  {
    id: 'couple',
    title: 'Complete Compatibility',
    price: '₹1,499',
    per: '/couple',
    save: 'Save ₹600',
    description: "We're both ready to share and decide together",
    features: [
      'Everything in Individual (×2 people)',
      'Genetic compatibility analysis',
      'Partner matching score',
      'Fertility alignment assessment',
      'Combined risk report',
      "Couple's discussion guide",
      'Joint PDF with shared + private sections'
    ],
    outcome: 'Make your decision with complete clarity',
    cta: 'Join 2,847 Couples Who Know',
    popular: true
  },
  {
    id: 'premium',
    title: 'Expert-Reviewed Confidence',
    price: '₹2,499',
    per: '/couple',
    description: 'I want a doctor’s personal guidance',
    features: [
      'Everything in Couple plan',
      'Doctor reviews your report personally',
      '30-min video consultation',
      'Personalized action plan',
      'Retest recommendations',
      'Priority support (24-hour response)'
    ],
    outcome: 'Expert validation + clear action plan',
    cta: 'Get Doctor Guidance',
    popular: false
  }
];

export const PERSONAS = [
  {
    id: 'arranged',
    title: 'Arranged Marriage',
    desc: 'Families verify horoscope. We verify hereditary risk.',
    icon: 'Users',
    color: 'pink',
    needs: [
      'Genetic carrier screening (Thalassemia, Sickle Cell)',
      'Family health history cross-verification',
      'Chronic disease & mental health baseline'
    ],
    warningStat: '72% of hereditary conditions go undisclosed in arranged marriage negotiations.',
    price: '2,999'
  },
  {
    id: 'love',
    title: 'Love Marriage',
    desc: "You've shared everything — except medical records.",
    icon: 'Heart',
    color: 'teal',
    needs: [
      'STD/STI panel (HIV, Hepatitis B, HPV, Herpes)',
      'Reproductive health & fertility alignment',
      'Genetic + mental health compatibility screen'
    ],
    warningStat: '43% of love marriage couples have never discussed reproductive health before wedding.',
    price: '2,999'
  },
  {
    id: 'planning',
    title: 'Planning a Baby',
    desc: "Don't start trying. Start by knowing.",
    icon: 'Baby',
    color: 'amber',
    needs: [
      'Complete fertility baseline (both partners)',
      'Genetic carrier testing for 50+ conditions',
      'Pre-conception hormonal & metabolic panel'
    ],
    warningStat: '1 in 4 couples face fertility challenges. Most discover it after 2-5 years of trying.',
    price: '2,999'
  },
  {
    id: 'remarriage',
    title: 'Remarriage',
    desc: 'Once bitten. Now verified.',
    icon: 'RefreshCw',
    color: 'danger',
    needs: [
      'Full chronic disease & STI screening',
      'Mental health assessment',
      'Complete transparency report'
    ],
    warningStat: '3x more likely to request health verification compared to first marriages.',
    price: '2,999'
  },
  {
    id: 'concerned',
    title: 'Concerned Parents',
    desc: "You verified kundli & salary. Why not their family's health history?",
    icon: 'Shield',
    color: 'info',
    needs: [
      'Independent health verification of prospective match',
      'Genetic carrier screening — both families',
      'Confidential doctor-reviewed risk report for your child'
    ],
    warningStat: '82% of parents say they had no way to verify health claims made during rishta discussions.',
    price: '2,999'
  }
];

export const ANALYSIS_AREAS = [
  {
    icon: 'Dna',
    title: 'Genetic Compatibility',
    score: '25%',
    desc: 'Thalassemia, Sickle Cell, Blood Group',
    detail: '1 in 8 Indians carry thalassemia trait. If both carry, 25% risk for child.'
  },
  {
    icon: 'Baby',
    title: 'Fertility Potential',
    score: '25%',
    desc: 'AMH, FSH, Sperm Parameters',
    detail: '40% of couples face fertility challenges. Know your timeline expectations.'
  },
  {
    icon: 'Heart',
    title: 'Chronic Health Match',
    score: '20%',
    desc: 'Diabetes, BP, Liver/Kidney',
    detail: 'Pre-diabetes often undetected. Identify manageable conditions now.'
  },
  {
    icon: 'Activity',
    title: 'Infection Status',
    score: '10%',
    desc: 'HIV, Hepatitis B/C, STDs',
    detail: "STDs don't always show symptoms. Ensure complete transparency."
  },
  {
    icon: 'Brain',
    title: 'Mental & Metabolic',
    score: '10%',
    desc: 'Vitamins, Stress Markers',
    detail: 'Deficiencies affect mood & energy. Simple fixes for better health.'
  },
  {
    icon: 'Users',
    title: 'Lifestyle & Habits',
    score: '10%',
    desc: 'Habits, Family History',
    detail: 'Lifestyle alignment predicts relationship health long-term.'
  }
];
