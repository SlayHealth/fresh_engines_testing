'use client';

import { useState, useMemo } from 'react';
import { 
  Brain, ShieldCheck, AlertCircle, Heart, User, Check, Users, 
  ArrowRight, ArrowLeft, RefreshCw, Sparkles, Zap, Award, CheckSquare, Clipboard,
  Scale, Lock, Info, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer
} from 'recharts';
import { useCompatibility } from '../../../contexts/CompatibilityContext';
import { confirmDialog } from '../../../components/ConfirmDialog';

const surveyQuestions = [
  {
    category: "Emotional Health & Resiliency",
    desc: "Assesses daily calmness, coping capacity under pressure, and emotional energy. Frame neutrally around objective behaviors.",
    questions: [
      {
        id: "emotional_wellbeing",
        label: "Daily Energy & Positive Motivation",
        desc: "Typical daily drive, motivation level, and general emotional energy.",
        options: [
          { val: 1, label: "Frequently low/sluggish" },
          { val: 2, label: "Mild energy drops" },
          { val: 3, label: "Typical daily drive" },
          { val: 4, label: "Consistent positive energy" },
          { val: 5, label: "Highly driven and motivated" }
        ]
      },
      {
        id: "stress_worry",
        label: "Composure Under Pressure & Calmness",
        desc: "Ability to maintain steady focus and composure during daily stressors.",
        options: [
          { val: 1, label: "Easily overwhelmed" },
          { val: 2, label: "Frequent daily worry" },
          { val: 3, label: "Manageable stress level" },
          { val: 4, label: "High steady composure" },
          { val: 5, label: "Consistently calm & serene" }
        ]
      },
      {
        id: "life_stress_capacity",
        label: "Coping Reserve & Adaptability",
        desc: "Capacity to adapt to sudden changes, hardships, or life shifts.",
        options: [
          { val: 1, label: "Quickly depleted" },
          { val: 2, label: "Vulnerable to disruption" },
          { val: 3, label: "Moderate coping capacity" },
          { val: 4, label: "Strong coping reserve" },
          { val: 5, label: "Highly resilient & adaptive" }
        ]
      }
    ]
  },
  {
    category: "Personality & Attachment",
    desc: "Assesses behavioral preferences, Big Five traits, and bonding attachment styles.",
    questions: [
      {
        id: "personality_openness",
        label: "Intellectual Curiosity & Flexibility",
        desc: "Comfort with new ideas, unconventional philosophies, and routine changes.",
        options: [
          { val: 1, label: "Highly traditional / structured" },
          { val: 2, label: "Prefers familiar settings" },
          { val: 3, label: "Open to some new views" },
          { val: 4, label: "Very curious and flexible" },
          { val: 5, label: "Thrives on constant novelty" }
        ]
      },
      {
        id: "personality_conscientiousness",
        label: "Planning, Reliability & Organization",
        desc: "Preference for order, meticulous planning, and deadline tracking.",
        options: [
          { val: 1, label: "Spontaneous and loose" },
          { val: 2, label: "Moderate organization" },
          { val: 3, label: "Generally orderly and neat" },
          { val: 4, label: "Detail planner & reliable" },
          { val: 5, label: "Meticulous and systematic" }
        ]
      },
      {
        id: "personality_extraversion",
        label: "Social Energy & Engagement Needs",
        desc: "Level of extroversion, outgoing nature, and preference for group settings.",
        options: [
          { val: 1, label: "Quiet / highly reserved" },
          { val: 2, label: "Prefers intimate groups" },
          { val: 3, label: "Balanced social needs" },
          { val: 4, label: "Outgoing and engaging" },
          { val: 5, label: "Life of the party" }
        ]
      },
      {
        id: "personality_agreeableness",
        label: "Cooperation & Empathetic Alignment",
        desc: "Disposition towards consensus, helping others, and harmony-seeking.",
        options: [
          { val: 1, label: "Skeptical / direct speaker" },
          { val: 2, label: "Maintains clear boundaries" },
          { val: 3, label: "Generally cooperative" },
          { val: 4, label: "Very warm and agreeable" },
          { val: 5, label: "Highly empathetic & harmony-focused" }
        ]
      },
      {
        id: "personality_stability",
        label: "Emotional Regulation & Steady Temperament",
        desc: "Comfort in keeping a stable emotional state under stressful interactions.",
        options: [
          { val: 1, label: "Highly sensitive to friction" },
          { val: 2, label: "Prone to quick mood shifts" },
          { val: 3, label: "Generally stable mood" },
          { val: 4, label: "Strong emotional control" },
          { val: 5, label: "Extremely stable temperament" }
        ]
      },
      {
        id: "attachment_style",
        label: "Bonding & Relationship Attachment Style",
        desc: "Identify the primary attachment pattern that describes your communication preferences.",
        isSelect: true,
        options: [
          { val: "Secure", label: "Secure", desc: "Comfortable with closeness and independence; trusts easily." },
          { val: "Anxious", label: "Anxious", desc: "Desires high closeness; prone to worry about partner space." },
          { val: "Avoidant", label: "Avoidant", desc: "Values self-reliance; prefers emotional distance under stress." },
          { val: "Fearful", label: "Fearful", desc: "Desires closeness but struggles with trust and vulnerability." }
        ]
      }
    ]
  },
  {
    category: "Marriage Readiness (Gottman Factors)",
    desc: "Assesses communication safety, conflict management, and partnership commitment.",
    questions: [
      {
        id: "readiness_communication",
        label: "Verbal Expression & Deeper Sharing",
        desc: "Comfort level in sharing vulnerable feelings and active listening.",
        options: [
          { val: 1, label: "Struggles to share feelings" },
          { val: 2, label: "Prefers superficial topics" },
          { val: 3, label: "Shares general emotions" },
          { val: 4, label: "Open, deep communicator" },
          { val: 5, label: "Total verbal transparency" }
        ]
      },
      {
        id: "readiness_conflict",
        label: "Disagreement & Conflict Management",
        desc: "Manner of resolving heated differences without emotional shutdown.",
        options: [
          { val: 1, label: "Avoids conflict / shuts down" },
          { val: 2, label: "Prone to high arguments" },
          { val: 3, label: "Resolves with some friction" },
          { val: 4, label: "Constructive compromise" },
          { val: 5, label: "Calm, collaborative resolution" }
        ]
      },
      {
        id: "readiness_trust",
        label: "Honesty & Relationship Trust",
        desc: "Sense of reliability, dependability, and safety inside the bond.",
        options: [
          { val: 1, label: "Substantial trust doubts" },
          { val: 2, label: "Takes time to open up" },
          { val: 3, label: "Reasonable day-to-day trust" },
          { val: 4, label: "Strong, reliable safety" },
          { val: 5, label: "Implicit, complete trust" }
        ]
      },
      {
        id: "readiness_commitment",
        label: "Long-term Partnership Mindset",
        desc: "Dedication to working through obstacles together long-term.",
        options: [
          { val: 1, label: "Wait and see mindset" },
          { val: 2, label: "Comfortable for now" },
          { val: 3, label: "Generally long-term focused" },
          { val: 4, label: "High partnership dedication" },
          { val: 5, label: "Unwavering lifelong commitment" }
        ]
      },
      {
        id: "readiness_support",
        label: "Empathy & Responsiveness",
        desc: "Availability to offer support and emotional presence when partner is low.",
        options: [
          { val: 1, label: "Struggles to offer support" },
          { val: 2, label: "Supports only when asked" },
          { val: 3, label: "Generally supportive" },
          { val: 4, label: "Highly empathetic partner" },
          { val: 5, label: "Complete, active presence" }
        ]
      }
    ]
  },
  {
    category: "Life, Career & Family Alignment",
    desc: "Assesses compatibility regarding professional pacing, money management, and in-law boundaries.",
    questions: [
      {
        id: "career_alignment",
        label: "Career Priorities & Relocation Alignment",
        desc: "Alignment on ambition, working hours, and relocating for jobs.",
        options: [
          { val: 1, label: "Significant clashes in goals" },
          { val: 2, label: "Varying relocation flexibility" },
          { val: 3, label: "Moderate career harmony" },
          { val: 4, label: "Highly aligned milestones" },
          { val: 5, label: "Perfect professional synergy" }
        ]
      },
      {
        id: "financial_alignment",
        label: "Savings, Budgets & Financial Views",
        desc: "Agreement on spending habits, budget splits, and financial safety nets.",
        options: [
          { val: 1, label: "Opposing spending habits" },
          { val: 2, label: "Varying budget structures" },
          { val: 3, label: "Generally similar values" },
          { val: 4, label: "Aligned saving/budget views" },
          { val: 5, label: "Complete financial harmony" }
        ]
      },
      {
        id: "lifestyle_alignment",
        label: "Daily Routines & Social Pacing",
        desc: "Agreement on daily sleep schedules, social habits, and leisure pacing.",
        options: [
          { val: 1, label: "Opposing lifestyle rhythms" },
          { val: 2, label: "Different routine needs" },
          { val: 3, label: "Good day-to-day compatibility" },
          { val: 4, label: "Highly synchronized rhythm" },
          { val: 5, label: "Flawless lifestyle synergy" }
        ]
      },
      {
        id: "family_expectations",
        label: "Extended Family Boundaries & Living",
        desc: "Alignment on involvement, boundaries, and arrangements with in-laws.",
        options: [
          { val: 1, label: "Significant friction expected" },
          { val: 2, label: "Different boundary views" },
          { val: 3, label: "Generally manageable bounds" },
          { val: 4, label: "Aligned boundary expectations" },
          { val: 5, label: "Complete boundary synergy" }
        ]
      },
      {
        id: "parenting_alignment",
        label: "Children Timeline & Parenting Styles",
        desc: "Agreement on whether to have children, timeline, and philosophy.",
        options: [
          { val: 1, label: "Major differences in vision" },
          { val: 2, label: "Undecided / varying times" },
          { val: 3, label: "Generally similar outlook" },
          { val: 4, label: "Strong timeline harmony" },
          { val: 5, label: "Perfect parenting alignment" }
        ]
      }
    ]
  },
  {
    category: "Composure & Substance Habits",
    desc: "Assesses lifestyle substance patterns and calmness during critical stressors.",
    questions: [
      {
        id: "substance_concern",
        label: "Alcohol & Lifestyle Substance Habits",
        desc: "Rate frequency and impact of alcohol or other social substance use.",
        isSelect: true,
        options: [
          { val: "Low", label: "Low", desc: "Infrequent or no substance use; no lifestyle concerns." },
          { val: "Moderate", label: "Moderate", desc: "Regular social drinking; manageable habits." },
          { val: "Elevated", label: "Elevated", desc: "Frequent use or concerns regarding lifestyle impacts." }
        ]
      },
      {
        id: "anger_regulation",
        label: "Anger Control under Intense Stress",
        desc: "Capacity to self-regulate and avoid verbal aggression when angry.",
        options: [
          { val: 1, label: "Quick to anger / aggressive" },
          { val: 2, label: "Vocalizes high irritation" },
          { val: 3, label: "Typical self-regulation" },
          { val: 4, label: "Excellent anger management" },
          { val: 5, label: "Flawless emotional calm" }
        ]
      }
    ]
  }
];


const getStrengthSource = (st) => {
  if (st.includes('Communication')) return 'Pillar 3: Relationship Communication Alignment (Score >= 75)';
  if (st.includes('Trust')) return 'Pillar 3: Relationship Trust Alignment (Score >= 75)';
  if (st.includes('Ambitions') || st.includes('Career')) return 'Pillar 4: Professional Career Alignment (Score >= 75)';
  if (st.includes('Parenting') || st.includes('Family')) return 'Pillar 5: Parenting Goals & Family Expectations (Score >= 75)';
  if (st.includes('Attachment')) return 'Pillar 2: Attachment Co-regulation (Secure-Secure Match)';
  return 'Composite Questionnaire Verification';
};

const getDiscussionSource = (disc) => {
  if (disc.includes('Financial')) return 'Pillar 4: Financial Alignment Discrepancy (Gap >= 1.5)';
  if (disc.includes('Routine') || disc.includes('Lifestyle')) return 'Pillar 4: Lifestyle Alignment Discrepancy (Gap >= 1.5)';
  if (disc.includes('Career')) return 'Pillar 4: Professional Ambition Discrepancy (Gap >= 1.5)';
  if (disc.includes('Family') || disc.includes('Boundaries')) return 'Pillar 5: Domestic Roles or Family Boundary Discrepancy (Gap >= 1.5)';
  if (disc.includes('Conflict')) return 'Pillar 3: Gottman Conflict Management Discrepancy (Gap >= 1.5)';
  return 'Behavioral Checkpoint Discrepancy';
};

export default function MentalWellbeingPage() {
  const { 
    user, 
    prospectForm, 
    chronicResult,
    mentalResult, 
    setMentalResult,
    handleMentalAnalysis 
  } = useCompatibility();

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [activeTabLocal, setActiveTabLocal] = useState('couple');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  // Initialize survey states for both A (user) and B (prospect)
  const defaultAnswers = {
    emotional_wellbeing: 4,
    stress_worry: 4,
    life_stress_capacity: 4,
    personality_openness: 4,
    personality_conscientiousness: 4,
    personality_extraversion: 3,
    personality_agreeableness: 4,
    personality_stability: 4,
    attachment_style: "Secure",
    readiness_communication: 4,
    readiness_conflict: 4,
    readiness_trust: 4,
    readiness_commitment: 5,
    readiness_support: 4,
    career_alignment: 4,
    financial_alignment: 4,
    lifestyle_alignment: 4,
    family_expectations: 4,
    parenting_alignment: 4,
    substance_concern: "Low",
    anger_regulation: 4
  };

  const [answersA, setAnswersA] = useState(defaultAnswers);
  const [answersB, setAnswersB] = useState(defaultAnswers);

  const handleValueChange = (questionId, value, isPartnerB = false) => {
    if (isPartnerB) {
      setAnswersB(prev => ({ ...prev, [questionId]: value }));
    } else {
      setAnswersA(prev => ({ ...prev, [questionId]: value }));
    }
  };

  const currentCategory = surveyQuestions[currentCategoryIndex];

  const handleNext = () => {
    if (currentCategoryIndex < surveyQuestions.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
    }
  };

  const onSubmitSurvey = async () => {
    setIsAnalyzing(true);
    const success = await handleMentalAnalysis(answersA, answersB);
    setIsAnalyzing(false);
    if (success) {
      setActiveTabLocal('couple');
    }
  };

  // Compile Radar data mapping strictly compatibility dimensions
  const radarData = useMemo(() => {
    if (!mentalResult) return [];
    
    // Compatibility Dimensions ONLY
    return [
      { 
        subject: 'Stress Resilience', 
        A: mentalResult.pillar_scores.emotionalHealth.A, 
        B: mentalResult.pillar_scores.emotionalHealth.B 
      },
      { 
        subject: 'Flexibility', 
        A: mentalResult.individual_profiles.partner_A.personality.openness, 
        B: mentalResult.individual_profiles.partner_B.personality.openness 
      },
      { 
        subject: 'Conscientiousness', 
        A: mentalResult.individual_profiles.partner_A.personality.conscientiousness, 
        B: mentalResult.individual_profiles.partner_B.personality.conscientiousness 
      },
      { 
        subject: 'Agreeableness', 
        A: mentalResult.individual_profiles.partner_A.personality.agreeableness, 
        B: mentalResult.individual_profiles.partner_B.personality.agreeableness 
      },
      { 
        subject: 'Marriage Readiness', 
        A: mentalResult.pillar_scores.marriageReadiness.A, 
        B: mentalResult.pillar_scores.marriageReadiness.B 
      },
      { 
        subject: 'Goal Alignment', 
        A: mentalResult.pillar_scores.lifeCareerAlignment.A, 
        B: mentalResult.pillar_scores.lifeCareerAlignment.B 
      }
    ];
  }, [mentalResult]);

  const isUserMale = user?.gender === 'male' || (chronicResult && chronicResult.partner_A?.name === user?.name);
  const partnerAName = user?.name || (isUserMale ? chronicResult?.partner_A?.name : chronicResult?.partner_B?.name) || "Partner A";
  const partnerBName = prospectForm?.name || (isUserMale ? chronicResult?.partner_B?.name : chronicResult?.partner_A?.name) || "Partner B";

  // Render logic split: Survey vs. Results
  if (!mentalResult) {
    return (
      <div className="max-w-3xl mx-auto animate-fadeIn text-left">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
          <div className="p-3 bg-purple-50 rounded-xl">
            <Brain className="w-7 h-7 text-purple-600 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Marriage, Life & Career Readiness Profile</h2>
            <p className="text-xs text-slate-500 mt-1">
              Answer these behavior-based questions to generate your compatibility profile. Best answered collaboratively.
            </p>
          </div>
        </div>

        {/* Research-Informed Assessment Notice */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold text-slate-700">Evidence-Informed Assessment Framework</h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            This premarital alignment profile is modeled on established behavioral and relationship research frameworks, including:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            <span className="bg-white border border-slate-150 px-2 py-1.5 rounded text-[10px] text-slate-600 font-semibold">• Big Five Personality Research</span>
            <span className="bg-white border border-slate-150 px-2 py-1.5 rounded text-[10px] text-slate-600 font-semibold">• Gottman relationship dynamics</span>
            <span className="bg-white border border-slate-150 px-2 py-1.5 rounded text-[10px] text-slate-600 font-semibold">• WHO AUDIT methodology</span>
            <span className="bg-white border border-slate-150 px-2 py-1.5 rounded text-[10px] text-slate-600 font-semibold">• PHQ-9 & PSS conceptual scales</span>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            *Note: This is an educational coaching and alignment tool, not a clinical diagnostic instrument. All responses are private.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex gap-2">
            {surveyQuestions.map((cat, idx) => (
              <div 
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentCategoryIndex 
                    ? "w-8 bg-purple-600" 
                    : idx < currentCategoryIndex 
                      ? "w-4 bg-purple-300" 
                      : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">
            Step {currentCategoryIndex + 1} of {surveyQuestions.length}
          </span>
        </div>

        {/* Category Description */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50/50 p-4 rounded-xl border border-purple-100 mb-6">
          <h3 className="text-sm font-extrabold text-purple-900 uppercase tracking-wider">{currentCategory.category}</h3>
          <p className="text-xs text-purple-700/80 mt-1 leading-relaxed">{currentCategory.desc}</p>
        </div>

        {/* Questionnaire Form */}
        <div className="space-y-6">
          {currentCategory.questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{q.label}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{q.desc}</p>
              </div>

              {/* Two Column Layout (A vs B) */}
              <div className="grid md:grid-cols-2 gap-6 pt-2 border-t border-slate-50">
                {/* Partner A */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <User size={12} className="text-purple-500" />
                    {partnerAName}
                  </span>
                  
                  {q.isSelect ? (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => handleValueChange(q.id, opt.val, false)}
                          className={`w-full p-3 rounded-lg border text-left text-xs transition-all flex justify-between items-center ${
                            answersA[q.id] === opt.val
                              ? "border-purple-600 bg-purple-50/40 text-purple-900 font-semibold"
                              : "border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <div>
                            <span className="block font-bold">{opt.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</span>
                          </div>
                          {answersA[q.id] === opt.val && <Check size={14} className="text-purple-600" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input 
                        type="range"
                        min="1"
                        max="5"
                        value={answersA[q.id]}
                        onChange={(e) => handleValueChange(q.id, parseInt(e.target.value), false)}
                        className="w-full accent-purple-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-700">
                          {q.options.find(o => o.val === answersA[q.id])?.label}
                        </span>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          Score: {answersA[q.id]}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Partner B */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <Users size={12} className="text-pink-500" />
                    {partnerBName}
                  </span>

                  {q.isSelect ? (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => handleValueChange(q.id, opt.val, true)}
                          className={`w-full p-3 rounded-lg border text-left text-xs transition-all flex justify-between items-center ${
                            answersB[q.id] === opt.val
                              ? "border-pink-600 bg-pink-50/40 text-pink-900 font-semibold"
                              : "border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <div>
                            <span className="block font-bold">{opt.label}</span>
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</span>
                          </div>
                          {answersB[q.id] === opt.val && <Check size={14} className="text-pink-600" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input 
                        type="range"
                        min="1"
                        max="5"
                        value={answersB[q.id]}
                        onChange={(e) => handleValueChange(q.id, parseInt(e.target.value), true)}
                        className="w-full accent-pink-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-700">
                          {q.options.find(o => o.val === answersB[q.id])?.label}
                        </span>
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                          Score: {answersB[q.id]}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Survey actions */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentCategoryIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 disabled:opacity-40 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {currentCategoryIndex < surveyQuestions.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-md hover:scale-102 transition-all cursor-pointer"
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmitSurvey}
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-[#DE457D] hover:bg-[#c93d6f] text-white px-8 py-3 rounded-full text-xs font-bold shadow-lg shadow-pink-500/25 hover:scale-105 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Generating Profile...
                </>
              ) : (
                <>
                  Generate Readiness Profile
                  <Sparkles size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate supporting factors and growth areas dynamically
  const pillarDetails = [
    { key: 'emotionalHealth', label: 'Stress Resilience & Coping' },
    { key: 'personalityAttachment', label: 'Personality Compatibility' },
    { key: 'marriageReadiness', label: 'Gottman Relationship Readiness' },
    { key: 'lifeCareerAlignment', label: 'Life & Career Alignment' },
    { key: 'familyParentingAlignment', label: 'Family & Parenting Alignment' },
    { key: 'riskFactors', label: 'Stress Composure & Safety' }
  ];

  const supportingFactors = pillarDetails.filter(p => {
    const scores = mentalResult?.pillar_scores?.[p.key];
    return scores && scores.A >= 70 && scores.B >= 70;
  });

  const growthAreas = pillarDetails.filter(p => {
    const scores = mentalResult?.pillar_scores?.[p.key];
    if (!scores) return false;
    return scores.A < 70 || scores.B < 70 || Math.abs(scores.A - scores.B) >= 20;
  });

  // Calculate Readiness Band based on composite index
  const compositeScore = mentalResult?.overall_readiness?.score || 50;
  let readinessBand = 'Balanced Alignment';
  let bandColorClass = 'text-amber-900 bg-amber-50/50 border-amber-200';
  let bandIndicatorDot = 'bg-amber-500';

  if (compositeScore >= 80) {
    readinessBand = 'Strong Readiness & Alignment';
    bandColorClass = 'text-emerald-900 bg-emerald-50/50 border-emerald-200';
    bandIndicatorDot = 'bg-emerald-500';
  } else if (compositeScore < 60) {
    readinessBand = 'Guided Discussion Recommended';
    bandColorClass = 'text-rose-900 bg-rose-50/50 border-rose-200';
    bandIndicatorDot = 'bg-rose-500';
  }

  // Questionnaire has been submitted, render Dashboard Results View
  return (
    <div className="space-y-6 animate-fadeIn text-left">
      {/* Header Info Block */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 rounded-xl">
            <Brain className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Marriage, Life & Career Readiness Profile</h2>
            <p className="text-xs text-slate-400 mt-1">
              Comparative analysis of emotional capacity, Gottman readiness, and future alignment.
            </p>
          </div>
        </div>

        {/* Secondary Numeric Indicator for Transparency */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl">
          <div className="text-right">
            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Overall Alignment Index</span>
            <span className="block text-xs font-bold text-slate-700 mt-0.5">Composite Score</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-mono font-bold text-purple-700 text-sm border border-purple-200">
            {compositeScore}%
          </div>
        </div>
      </div>

      {/* Dynamic Readiness Band & Reliability Metrics Section */}
      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6">
        
        {/* Left Card: Readiness Band & Supporting/Growth Factors */}
        <div className={`border p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4 ${bandColorClass}`}>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">Evaluated Readiness Band</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3.5 h-3.5 rounded-full ${bandIndicatorDot} animate-pulse inline-block`} />
              <h3 className="text-lg font-black ml-1.5">{readinessBand}</h3>
            </div>
            <p className="text-xs mt-2 opacity-80 leading-relaxed">
              Based on the composite alignment check of all six dimensions, your partnership falls into the <strong>{readinessBand}</strong> band. 
              Review your dynamic strengths and focus areas below to guide premarital alignment.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-300/40">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 mb-1.5">Supporting Factors</span>
              {supportingFactors.length > 0 ? (
                <ul className="space-y-1">
                  {supportingFactors.slice(0, 3).map(f => (
                    <li key={f.key} className="text-xs font-semibold flex items-center gap-1">
                      <span className="text-emerald-600 font-bold">✓</span> {f.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs italic opacity-75">Establishing baseline...</span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 mb-1.5">Growth Focus Areas</span>
              {growthAreas.length > 0 ? (
                <ul className="space-y-1">
                  {growthAreas.slice(0, 3).map(f => (
                    <li key={f.key} className="text-xs font-semibold flex items-center gap-1">
                      <span className="text-amber-600 font-bold">⚠</span> {f.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs italic opacity-75">No immediate friction detected</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Stack: Confidence Indicator & Scope Exclusions */}
        <div className="space-y-4">
          {/* Reliability Box */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assessment Confidence</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                High Confidence
              </span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-650 font-medium">
              <li className="flex items-center gap-2 text-slate-600">
                <span className="text-emerald-500 font-bold">✓</span> Both partners completed the assessment
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="text-emerald-500 font-bold">✓</span> All 19 behavioral checkpoints evaluated
              </li>
              <li className="flex items-center gap-2 text-slate-600">
                <span className="text-emerald-500 font-bold">✓</span> Self-consistent responses (no contradictions)
              </li>
            </ul>
          </div>

          {/* Scope Disclaimer Box */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm text-xs space-y-2">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Scope and Diagnostic Limits</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="block text-[9px] font-extrabold text-emerald-700 uppercase">Evaluates:</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✓ Relationship readiness</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✓ Life goal alignment</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✓ Family expectations</span>
              </div>
              <div>
                <span className="block text-[9px] font-extrabold text-rose-700 uppercase">Does NOT Diagnose:</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✗ Clinical depression</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✗ Anxiety disorders</span>
                <span className="block text-[10px] text-slate-650 font-semibold mt-0.5">✗ Psychiatric conditions</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Tabs list */}
      <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit mx-auto mb-6">
        <button
          onClick={() => setActiveTabLocal('couple')}
          className={`py-2.5 px-6 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeTabLocal === 'couple' 
              ? "bg-white text-purple-700 shadow-sm ring-1 ring-slate-900/5" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          Couple Analysis & Alignment
        </button>
        <button
          onClick={() => setActiveTabLocal('individual')}
          className={`py-2.5 px-6 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeTabLocal === 'individual' 
              ? "bg-white text-purple-700 shadow-sm ring-1 ring-slate-900/5" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          Individual Readiness Details
        </button>
        <button
          onClick={() => setActiveTabLocal('actions')}
          className={`py-2.5 px-6 rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeTabLocal === 'actions' 
              ? "bg-white text-purple-700 shadow-sm ring-1 ring-slate-900/5" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
          }`}
        >
          Recommended Actions
        </button>
      </div>

      {/* Tab Content 1: Couple Analysis */}
      {activeTabLocal === 'couple' && (
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 items-start">
          {/* Insights column */}
          <div className="space-y-6">
            {/* Strengths */}
            <div className="bg-emerald-50/40 border border-emerald-200/60 p-5 rounded-2xl">
              <h3 className="font-extrabold text-emerald-800 text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Award size={16} />
                Shared Strengths
              </h3>
              <div className="space-y-3">
                {mentalResult.couple_analysis.strengths.map((st, idx) => (
                  <div key={idx} className="p-3 bg-white/70 border border-emerald-100 rounded-xl text-xs text-slate-700 leading-relaxed shadow-xs flex flex-col justify-between">
                    <div>{st}</div>
                    <span className="block mt-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 border-t border-emerald-100/30 pt-1">
                      Evidence Base: {getStrengthSource(st)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
 
            {/* Discussion Areas */}
            <div className="bg-amber-50/40 border border-amber-200/60 p-5 rounded-2xl">
              <h3 className="font-extrabold text-amber-800 text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle size={16} />
                Discussion Areas
              </h3>
              <div className="space-y-3">
                {mentalResult.couple_analysis.discussion_areas.map((disc, idx) => (
                  <div key={idx} className="p-3 bg-white/70 border border-amber-100 rounded-xl text-xs text-slate-700 leading-relaxed shadow-xs flex flex-col justify-between">
                    <div>{disc}</div>
                    <span className="block mt-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 border-t border-amber-100/30 pt-1">
                      Evidence Base: {getDiscussionSource(disc)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk factors (linear indicators / cards, strictly NO radar mapping) */}
            <div className="bg-rose-50/30 border border-rose-200/50 p-5 rounded-2xl">
              <h3 className="font-extrabold text-rose-800 text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
                <AlertCircle size={16} className="text-rose-500" />
                Descriptive Risk Checkpoints
              </h3>
              
              <div className="space-y-4">
                {/* Substance Indicators */}
                <div className="bg-white/80 p-3.5 border border-rose-100 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lifestyle Substance Concerns</span>
                  <div className="flex justify-between text-xs">
                    <span>{partnerAName}: <strong className="text-slate-800">{mentalResult.individual_profiles.partner_A.raw_answers.substance_concern}</strong></span>
                    <span>{partnerBName}: <strong className="text-slate-800">{mentalResult.individual_profiles.partner_B.raw_answers.substance_concern}</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`h-1.5 flex-1 rounded-full ${
                      mentalResult.individual_profiles.partner_A.raw_answers.substance_concern === 'Low' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                    <span className={`h-1.5 flex-1 rounded-full ${
                      mentalResult.individual_profiles.partner_B.raw_answers.substance_concern === 'Low' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                  </div>
                </div>

                {/* Composure Indicators */}
                <div className="bg-white/80 p-3.5 border border-rose-100 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anger Control & Composure under Stress</span>
                  <div className="flex justify-between text-xs">
                    <span>{partnerAName}: <strong className="text-slate-800">{mentalResult.individual_profiles.partner_A.raw_answers.anger_regulation}/5</strong></span>
                    <span>{partnerBName}: <strong className="text-slate-800">{mentalResult.individual_profiles.partner_B.raw_answers.anger_regulation}/5</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <span className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full bg-rose-400" style={{ width: `${mentalResult.individual_profiles.partner_A.raw_answers.anger_regulation * 20}%` }} />
                    </span>
                    <span className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full bg-rose-400" style={{ width: `${mentalResult.individual_profiles.partner_B.raw_answers.anger_regulation * 20}%` }} />
                    </span>
                  </div>
                </div>

                {mentalResult.couple_analysis.risk_factors.map((risk, idx) => (
                  <div key={idx} className="p-3 bg-white/70 border border-rose-100 rounded-xl text-xs text-rose-800 leading-relaxed font-semibold">
                    {risk}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Radar Chart side */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-4 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={15} className="text-purple-500" />
                Readiness & Compatibility Radar
              </h3>
              <div className="flex gap-3 text-[10px] font-bold">
                <span className="text-purple-600 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  {partnerAName}
                </span>
                <span className="text-pink-500 flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block" />
                  {partnerBName}
                </span>
              </div>
            </div>

            <div className="h-[380px] w-full bg-slate-50/50 rounded-xl p-3 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="55%" data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={partnerAName} dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} />
                  <Radar name={partnerBName} dataKey="B" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Radar strictly evaluates compatibility dimensions (Resilience, Personality traits, and Gottman scores). Specific risk concern meters are isolated to descriptive panels.
            </p>
          </div>
        </div>
      )}

      {/* Tab Content 2: Individual Analysis */}
      {activeTabLocal === 'individual' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Partner A Profile */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
                {partnerAName[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{partnerAName} Readiness</h3>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  Individual Score: {mentalResult.overall_readiness.partner_A_overall}/100
                </span>
              </div>
            </div>

            {/* Emotional Health Non-Clinical Labels */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Emotional Energy & Composure</h4>
              <div className="grid gap-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Energy Outlook</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_A.emotional_health.wellbeing}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Steady Composure</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_A.emotional_health.calmness}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Coping Reserves</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_A.emotional_health.coping}</span>
                </div>
              </div>
            </div>

            {/* Personality Trait bars */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Big Five Personality Traits</h4>
              <div className="space-y-2">
                {[
                  { label: "Openness", val: mentalResult.individual_profiles.partner_A.personality.openness },
                  { label: "Conscientiousness", val: mentalResult.individual_profiles.partner_A.personality.conscientiousness },
                  { label: "Extraversion", val: mentalResult.individual_profiles.partner_A.personality.extraversion },
                  { label: "Agreeableness", val: mentalResult.individual_profiles.partner_A.personality.agreeableness },
                  { label: "Stability", val: mentalResult.individual_profiles.partner_A.personality.stability }
                ].map(trait => (
                  <div key={trait.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>{trait.label}</span>
                      <span>{trait.val}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full" style={{ width: `${trait.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonding Style */}
            <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
              <span className="block text-[9px] font-extrabold text-purple-700 uppercase tracking-wider">Bonding Attachment Style</span>
              <span className="block font-bold text-purple-900 text-sm mt-1">{mentalResult.individual_profiles.partner_A.attachment_style}</span>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {mentalResult.individual_profiles.partner_A.attachment_style === 'Secure' && 'Comfortable with emotional intimacy, shares thoughts directly, and maintains positive trust frameworks.'}
                {mentalResult.individual_profiles.partner_A.attachment_style === 'Anxious' && 'Thrives on high levels of reassurance and validation. Highly responsive to changes in partner connection.'}
                {mentalResult.individual_profiles.partner_A.attachment_style === 'Avoidant' && 'Values self-reliance and independence highly. Prefers cognitive processing during heated stressors.'}
                {mentalResult.individual_profiles.partner_A.attachment_style === 'Fearful' && 'Deeply desires emotional closeness but struggles with trust or vulnerability under strain.'}
              </p>
            </div>
          </div>

          {/* Partner B Profile */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-lg">
                {partnerBName[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{partnerBName} Readiness</h3>
                <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                  Individual Score: {mentalResult.overall_readiness.partner_B_overall}/100
                </span>
              </div>
            </div>

            {/* Emotional Health Non-Clinical Labels */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Emotional Energy & Composure</h4>
              <div className="grid gap-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Energy Outlook</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_B.emotional_health.wellbeing}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Steady Composure</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_B.emotional_health.calmness}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Coping Reserves</span>
                  <span className="block font-medium text-slate-700 mt-0.5">{mentalResult.individual_profiles.partner_B.emotional_health.coping}</span>
                </div>
              </div>
            </div>

            {/* Personality Trait bars */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Big Five Personality Traits</h4>
              <div className="space-y-2">
                {[
                  { label: "Openness", val: mentalResult.individual_profiles.partner_B.personality.openness },
                  { label: "Conscientiousness", val: mentalResult.individual_profiles.partner_B.personality.conscientiousness },
                  { label: "Extraversion", val: mentalResult.individual_profiles.partner_B.personality.extraversion },
                  { label: "Agreeableness", val: mentalResult.individual_profiles.partner_B.personality.agreeableness },
                  { label: "Stability", val: mentalResult.individual_profiles.partner_B.personality.stability }
                ].map(trait => (
                  <div key={trait.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-600">
                      <span>{trait.label}</span>
                      <span>{trait.val}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 rounded-full" style={{ width: `${trait.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonding Style */}
            <div className="bg-pink-50/50 border border-pink-100 p-4 rounded-xl">
              <span className="block text-[9px] font-extrabold text-pink-700 uppercase tracking-wider">Bonding Attachment Style</span>
              <span className="block font-bold text-pink-900 text-sm mt-1">{mentalResult.individual_profiles.partner_B.attachment_style}</span>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {mentalResult.individual_profiles.partner_B.attachment_style === 'Secure' && 'Comfortable with emotional intimacy, shares thoughts directly, and maintains positive trust frameworks.'}
                {mentalResult.individual_profiles.partner_B.attachment_style === 'Anxious' && 'Thrives on high levels of reassurance and validation. Highly responsive to changes in partner connection.'}
                {mentalResult.individual_profiles.partner_B.attachment_style === 'Avoidant' && 'Values self-reliance and independence highly. Prefers cognitive processing during heated stressors.'}
                {mentalResult.individual_profiles.partner_B.attachment_style === 'Fearful' && 'Deeply desires emotional closeness but struggles with trust or vulnerability under strain.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 3: Recommended Actions */}
      {activeTabLocal === 'actions' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clipboard className="text-purple-600 w-5 h-5" />
              Action Recommendations
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cooperative action points generated dynamically based on your readiness alignment profile.
            </p>
          </div>

          <div className="grid gap-3">
            {mentalResult.couple_analysis.recommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-slate-50/80 transition-colors">
                <div className="shrink-0 mt-0.5">
                  <CheckSquare className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-xs text-slate-700 font-medium leading-relaxed">
                  {rec}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Research Foundations & Scoring Methodology Collapsible Dropdown */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl mt-8 overflow-hidden shadow-xs transition-all duration-300">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-100/50 transition-colors text-left focus:outline-none cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Research Foundations & Scoring Methodology</h3>
          </div>
          <div className="text-slate-400">
            {showMethodology ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showMethodology && (
          <div className="p-6 pt-0 border-t border-slate-200/60 space-y-6 animate-fadeIn">
            <div className="space-y-3 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Assessment Foundations</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                This readiness profile is an evidence-informed alignment assessment designed for premarital coaching. Assessment domains are informed by established relationship science and behavioral research frameworks, including:
              </p>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-purple-600 bg-purple-50 px-2 py-0.5 rounded uppercase">Personality Paradigm</span>
                  <h4 className="text-xs font-bold text-slate-800">Big Five Personality Model</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Modeled on the NEO-PI-R paradigm to evaluate compatibility across Openness, Conscientiousness, Extraversion, Agreeableness, and Emotional Stability.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded uppercase">Relationship Science</span>
                  <h4 className="text-xs font-bold text-slate-800">Gottman Relationship Research</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Inspired by Gottman relationship concepts, focusing on conflict communication patterns, trust indicators, and collaborative support.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Habits & Lifestyle</span>
                  <h4 className="text-xs font-bold text-slate-800">WHO AUDIT Methodology</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Neutral, behavior-based screening inspired by the World Health Organization AUDIT guidelines to identify and describe lifestyle habits.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase">Emotional Outlook</span>
                  <h4 className="text-xs font-bold text-slate-800">PHQ-9 & PSS Concept Scales</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Behavioral questions conceptualized around PHQ-9 mood items and Cohen's Perceived Stress Scale (PSS) to describe stress coping levels.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Bonding Style</span>
                  <h4 className="text-xs font-bold text-slate-800">Attachment Theory (ECR-R)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Bonding patterns derived from the Experiences in Close Relationships-Revised scale, highlighting Secure, Anxious, Avoidant, and Fearful communication patterns.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-2 shadow-sm">
                  <span className="text-[9px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase">Domestic & Alignment</span>
                  <h4 className="text-xs font-bold text-slate-800">Family Systems Research</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Cooperative scoring analyzing family boundaries, domestic expectations, career pacing offsets, and parenting visions.
                  </p>
                </div>
              </div>
            </div>

            {/* Scoring Pipeline Process Flow */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">2. Scoring & Analysis Pipeline</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your results are calculated through a multi-tiered analysis engine, ensuring transparency and explainability at every stage:
              </p>
              
              <div className="flex flex-col md:flex-row items-stretch justify-between gap-2.5 pt-2">
                <div className="flex-1 bg-white border border-slate-150 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Step 1</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">Responses</div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    19 behavior-based grades collected independently from both partners.
                  </p>
                </div>
                
                <div className="hidden md:flex items-center text-slate-350 font-bold">➔</div>
                
                <div className="flex-1 bg-white border border-slate-150 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Step 2</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">Pillar Scores</div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Values scaled 0-100 across 6 distinct readiness and personality pillars.
                  </p>
                </div>

                <div className="hidden md:flex items-center text-slate-350 font-bold">➔</div>

                <div className="flex-1 bg-white border border-slate-150 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Step 3</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">Compatibility Check</div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Comparing individual scores to calculate alignment percentages and gap offsets.
                  </p>
                </div>

                <div className="hidden md:flex items-center text-slate-350 font-bold">➔</div>

                <div className="flex-1 bg-white border border-slate-150 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Step 4</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">Narrative Rules</div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Deductive insights generated dynamically for gaps crossing specific thresholds.
                  </p>
                </div>

                <div className="hidden md:flex items-center text-slate-350 font-bold">➔</div>

                <div className="flex-1 bg-white border border-slate-150 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Step 5</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">Readiness Profile</div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Readiness Band classification, supporting factors, and recommended joint actions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Retake Profile Questionnaire */}
      <div className="text-center pt-6">
        <button
          onClick={async () => {
            const ok = await confirmDialog({ title: 'Clear this profile?', message: 'Are you sure you want to clear this profile and retake the survey?', confirmLabel: 'Clear', danger: true });
            if (ok) {
              setMentalResult(null);
            }
          }}
          className="text-xs font-bold text-purple-600 hover:text-purple-700 underline cursor-pointer"
        >
          Retake Readiness Questionnaire
        </button>
      </div>
    </div>
  );
}
