'use client';

import { useState, useEffect } from 'react';
import { useCompatibility } from '../../../contexts/CompatibilityContext';
import { API_URL } from '../../../config/api';
import { apiFetch } from '../../../utils/api';
import { toast } from '../../../components/Toast';
import {
  Heart, Sparkles, ChevronDown, ChevronUp, Info,
  CheckCircle2, AlertTriangle, ShieldCheck, HeartPulse, Dna, ClipboardList, Loader2
} from 'lucide-react';

// Users choose a projection checkpoint, not a raw year count — only these stops are
// ever selectable, though the underlying projection curves still hold every year 0-10.
const PROJECTION_YEARS = [0, 3, 5, 7, 10];

// Sub-component to animate numeric reveals inside threads
function RevealedCount({ targetValue, suffix = '' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = Math.round(targetValue);
    if (start === end) {
      setCount(end);
      return;
    }
    const duration = 500; // ms
    const steps = 15;
    const stepTime = Math.round(duration / steps);
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const val = Math.round(start + (end * (currentStep / steps)));
      setCount(val);
      if (currentStep >= steps) {
        setCount(end);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetValue]);

  return <span className="font-extrabold text-slate-800 font-sans">{count}{suffix}</span>;
}

export default function YourStoryPage() {
  const { 
    activeMatchId, 
    activeMatchDetails, 
    fetchActiveMatchDetails, 
    mfrResult, 
    chronicResult, 
    mentalResult,
    user,
    prospectForm
  } = useCompatibility();

  const [isClinicalMode, setIsClinicalMode] = useState(false);
  const [isAct, setIsAct] = useState(true);
  const [selectedYear, setSelectedYear] = useState(0);
  const [expandedThreads, setExpandedThreads] = useState({});
  const [revealedNumbers, setRevealedNumbers] = useState({});
  const [radiologyData, setRadiologyData] = useState(null);
  const [radLoading, setRadLoading] = useState(false);
  const [radError, setRadError] = useState(null);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  // Sync match details on mount
  useEffect(() => {
    if (activeMatchId && !activeMatchDetails) {
      fetchActiveMatchDetails(activeMatchId);
    }
  }, [activeMatchId, activeMatchDetails]);

  // Fetch Radiology data
  useEffect(() => {
    const fetchRad = async () => {
      if (!activeMatchId) return;
      setRadLoading(true);
      setRadError(null);
      try {
        const res = await apiFetch(`${API_URL}/api/compatibility/matches/${activeMatchId}/radiology`);
        if (!res.ok) {
          throw new Error('Could not load radiology scan data.');
        }
        const json = await res.json();
        setRadiologyData(json);
      } catch (err) {
        console.error('Failed to fetch radiology data:', err);
        setRadError(err.message || 'Could not load radiology scan data.');
      } finally {
        setRadLoading(false);
      }
    };
    fetchRad();
  }, [activeMatchId]);

  const handleDownloadPdf = async () => {
    if (!activeMatchId) return;
    setIsPdfDownloading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches/${activeMatchId}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF report.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slayhealth-report-${activeMatchId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || 'Could not download PDF report.');
    } finally {
      setIsPdfDownloading(false);
    }
  };

  // Partner Names
  const partnerAName = user?.name || 'Partner A';
  const partnerBName = prospectForm?.name || 'Partner B';
  const coupleHeader = partnerAName && partnerBName 
    ? `${partnerAName} & ${partnerBName}` 
    : 'Your health';

  // Real carrier-pair genetics status for the "tracked markers" reveal below — mirrors
  // the same thalassemia status logic already used in the composite score calculation
  // (see the Genetics block inside calculateDynamicScore), instead of the reveal being
  // unconditionally hardcoded to "100% / Clear" regardless of what carrier_pair_risk
  // actually says (a couple flagged elsewhere on this same page as "Needs attention"
  // could previously still see a reassuring 100%/Clear here).
  const genomicsReveal = () => {
    const thal = activeMatchDetails?.presentation_json?.carrier_pair_risk?.thalassemia;
    if (thal?.male_status === 'red' || thal?.female_status === 'red') {
      return { value: 50, label: 'Needs attention' };
    }
    if (thal?.male_status === 'yellow' || thal?.female_status === 'yellow') {
      return { value: 75, label: 'Worth a look' };
    }
    if (thal?.male_status === 'gray' || thal?.female_status === 'gray') {
      return { value: null, label: 'Not fully assessed' };
    }
    return { value: 100, label: 'Clear' };
  };

  // Dynamic cross-domain score calculation
  const calculateDynamicScore = (year, actBranch) => {
    let sumScores = 0;
    let sumWeights = 0;

    // 1. Chronic: weight = 35%
    if (chronicResult) {
      const currentCurve = chronicResult?.projection?.currentLifestyle || chronicResult?.projection?.current || [];
      const optimizedCurve = chronicResult?.projection?.optimizedLifestyle || chronicResult?.projection?.optimized || [];
      const chronicScore = actBranch ? (optimizedCurve[year] ?? 85) : (currentCurve[year] ?? 85);
      sumScores += chronicScore * 0.35;
      sumWeights += 0.35;
    }

    // 2. Fertility (MFR): weight = 25%
    if (mfrResult) {
      const currentCurve = mfrResult?.projection?.current || [];
      const optimizedCurve = mfrResult?.projection?.optimised || mfrResult?.projection?.optimized || [];
      const mfrMonthly = actBranch ? (optimizedCurve[year] ?? 15) : (currentCurve[year] ?? 15);
      const mfrCumulative = (1.0 - Math.pow(1.0 - mfrMonthly / 100, 12)) * 100;
      sumScores += mfrCumulative * 0.25;
      sumWeights += 0.25;
    }

    // 3. Mental: weight = 20%
    if (mentalResult) {
      const mentalScore = mentalResult.overall_readiness?.score || 80;
      sumScores += mentalScore * 0.20;
      sumWeights += 0.20;
    }

    // 4. Radiology: weight = 10%
    const hasRadA = radiologyData?.partner_A && Object.keys(radiologyData.partner_A).length > 0;
    const hasRadB = radiologyData?.partner_B && Object.keys(radiologyData.partner_B).length > 0;
    if (radiologyData && hasRadA && hasRadB) {
      // The backend deliberately reports a genuine catastrophic-finding score as a
      // real 0 (not null) so it can never be diluted away — `|| 25` would treat that
      // real 0 as falsy and silently substitute a much better-looking 25 instead,
      // undermining that exact safeguard.
      const rawRadContribution = radiologyData.partner_A.scores_json?.radiology_nuptia_contribution;
      const radScore = (typeof rawRadContribution === 'number' ? rawRadContribution : 25) / 30 * 100;
      sumScores += radScore * 0.10;
      sumWeights += 0.10;
    }

    // 5. Genetics: weight = 10%
    const isGeneticCovered = activeMatchDetails?.presentation_json?.report_confidence?.domains?.genetic?.covered;
    if (isGeneticCovered) {
      const cpr = activeMatchDetails.presentation_json.carrier_pair_risk || {};
      let genScore = 100;
      if (cpr.thalassemia?.male_status === 'red' || cpr.thalassemia?.female_status === 'red') {
        genScore = 50;
      } else if (cpr.thalassemia?.male_status === 'yellow' || cpr.thalassemia?.female_status === 'yellow') {
        genScore = 75;
      }
      sumScores += genScore * 0.10;
      sumWeights += 0.10;
    }

    // No domain has produced a result yet — there is nothing real to report.
    return sumWeights > 0 ? Math.round(sumScores / sumWeights) : null;
  };

  const targetScore = calculateDynamicScore(selectedYear, isAct);
  const hasScoreData = targetScore !== null;

  // Score transition counters, scale pulsing, and shimmers
  const [displayScore, setDisplayScore] = useState(targetScore ?? 0);
  const [prevScore, setPrevScore] = useState(targetScore ?? 0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isShimmering, setIsShimmering] = useState(false);

  useEffect(() => {
    if (targetScore === null) return;
    if (targetScore > prevScore) {
      setIsPulsing(true);
      setIsShimmering(true);
      const timerP = setTimeout(() => setIsPulsing(false), 400);
      const timerS = setTimeout(() => setIsShimmering(false), 600);
      setPrevScore(targetScore);
      
      let start = displayScore;
      const end = targetScore;
      const duration = 400;
      const range = end - start;
      let currentStep = 0;
      const steps = 20;
      const stepTime = Math.round(duration / steps);
      const timerCount = setInterval(() => {
        currentStep++;
        const val = Math.round(start + (range * (currentStep / steps)));
        setDisplayScore(val);
        if (currentStep >= steps) {
          setDisplayScore(end);
          clearInterval(timerCount);
        }
      }, stepTime);

      return () => {
        clearTimeout(timerP);
        clearTimeout(timerS);
        clearInterval(timerCount);
      };
    } else if (targetScore < prevScore) {
      setPrevScore(targetScore);
      let start = displayScore;
      const end = targetScore;
      const duration = 400;
      const range = end - start;
      let currentStep = 0;
      const steps = 20;
      const stepTime = Math.round(duration / steps);
      const timerCount = setInterval(() => {
        currentStep++;
        const val = Math.round(start + (range * (currentStep / steps)));
        setDisplayScore(val);
        if (currentStep >= steps) {
          setDisplayScore(end);
          clearInterval(timerCount);
        }
      }, stepTime);

      return () => clearInterval(timerCount);
    }
  }, [targetScore]);

  // Three distinct score categories, progress ring colors, and radial glows
  let scoreBand = "Steady";
  let ringStrokeColor = "#F4A100"; // Brand Amber
  let radialGlowStyle = "radial-gradient(circle, rgba(244, 161, 0, 0.06) 0%, transparent 70%)";

  if (displayScore >= 80) {
    scoreBand = "Strong";
    ringStrokeColor = "#18CC96"; // Brand Teal
    radialGlowStyle = "radial-gradient(circle, rgba(24, 204, 150, 0.06) 0%, transparent 70%)";
  } else if (displayScore < 60) {
    scoreBand = "Worth attention";
    ringStrokeColor = "#E0555B"; // Brand Danger
    radialGlowStyle = "radial-gradient(circle, rgba(224, 85, 91, 0.06) 0%, transparent 70%)";
  }

  // Dynamic continuous narrative prose generator
  const generateChapterProse = (year, actBranch) => {
    const paragraphs = [];
    const namesText = partnerAName && partnerBName ? `${partnerAName} and ${partnerBName}` : 'the two of you';
    
    if (year === 0) {
      paragraphs.push(`This is the story of ${namesText}, captured today at your premarital baseline. Right now, your paths converge at a healthy and cooperative starting point. The choices you make together from here will map your shared trajectory over the next ten years.`);
    } else {
      paragraphs.push(`Looking ahead to Year ${year}, we see how the decisions made at your baseline start to compound. Depending on your lifestyle routines and preventative steps, your health parameters diverge along two distinct pathways.`);
    }

    // Fertility (MFR)
    if (mfrResult) {
      const isMfrGood = mfrResult.state === 'Aligned';
      const currentCurve = mfrResult?.projection?.current || [];
      const optimizedCurve = mfrResult?.projection?.optimised || mfrResult?.projection?.optimized || [];
      
      const valNow = (currentCurve[0] ?? 15) / 100;
      const cumNow = Math.round((1.0 - Math.pow(1.0 - valNow, 12)) * 100);
      const valCur = (currentCurve[year] ?? 15) / 100;
      const cumCur = Math.round((1.0 - Math.pow(1.0 - valCur, 12)) * 100);
      const valOpt = (optimizedCurve[year] ?? 15) / 100;
      const cumOpt = Math.round((1.0 - Math.pow(1.0 - valOpt, 12)) * 100);

      if (year === 0) {
        if (isMfrGood) {
          paragraphs.push(`When it comes to starting a family, your biological baselines are fully aligned. Based on your current age profiles, your conception success rate today is standard at ${cumNow}%, with an average time-to-conceive of around ${mfrResult.time_to_conceive || '5 months'}.`);
        } else {
          paragraphs.push(`When it comes to starting a family, a couple of indicators suggest natural family planning may take more time, giving you a baseline conception likelihood of ${cumNow}% today.`);
        }
      } else {
        if (actBranch) {
          paragraphs.push(`If you actively follow your fertility wellness recommendations—focusing on nutritional timing, increased physical activity, and precise cycle tracking—your conception likelihood remains highly optimized, yielding a success rate of ${cumOpt}% at Year ${year}.`);
        } else {
          paragraphs.push(`If you leave things to chance, the natural biological age curve will gradually influence your fertility baseline. By Year ${year}, your conception success rate is projected to decline to ${cumCur}%, meaning family planning could require clinical tracking or external assistance.`);
        }
      }
    }

    // Chronic Risk
    if (chronicResult) {
      const isChronicGood = chronicResult.state === 'Aligned';
      const currentCurve = chronicResult?.projection?.currentLifestyle || chronicResult?.projection?.current || [];
      const optimizedCurve = chronicResult?.projection?.optimizedLifestyle || chronicResult?.projection?.optimized || [];
      const coupleScoreNow = Math.round(currentCurve[0] ?? 85);
      const coupleScoreCur = Math.round(currentCurve[year] ?? 85);
      const coupleScoreOpt = Math.round(optimizedCurve[year] ?? 85);

      if (year === 0) {
        if (isChronicGood) {
          paragraphs.push(`Your long-term metabolic health shows strong resilience. Biomarkers for blood sugar regulation, cholesterol, and blood pressure are steady and within normal reference margins, giving you a protective baseline score of ${coupleScoreNow}/100.`);
        } else {
          paragraphs.push(`Your metabolic checks identified a few baseline indicators—such as elevated IDRS or borderline glucose/pressure markers—that warrant attention, starting you at a protective baseline of ${coupleScoreNow}/100.`);
        }
      } else {
        if (actBranch) {
          paragraphs.push(`If you act on metabolic goals—adopting moderate physical activity, stabilizing sleep schedules, and tracking dietary sugar—your metabolic resilience compounds positively. By Year ${year}, your protective health score rises to ${coupleScoreOpt}/100, successfully shielding both of you from metabolic concerns.`);
        } else {
          paragraphs.push(`If nothing changes, metabolic strain and natural aging will cause your protective baseline score to drop to ${coupleScoreCur}/100 by Year ${year}. Borderline markers could escalate into active blood pressure or insulin issues, requiring medical management.`);
        }
      }
    }

    // Mental Wellbeing (Static)
    if (mentalResult) {
      const isMentalGood = mentalResult.overall_readiness?.label === 'Highly Aligned';
      if (isMentalGood) {
        paragraphs.push(`On the relational and emotional front, you share a highly compatible foundation (${mentalResult.overall_readiness?.score || 80}% attachment alignment). You communicate constructively and hold identical expectations, providing a solid anchor to navigate these long-term physical health goals together.`);
      } else {
        paragraphs.push(`On the relational front, you share a compatible foundation, though a few differences in communication styles or expectations are present. Regular check-ins will help align your goals as you navigate your physical health trajectories.`);
      }
    }

    // Radiology (Static)
    const hasRadA = radiologyData?.partner_A && Object.keys(radiologyData.partner_A).length > 0;
    const hasRadB = radiologyData?.partner_B && Object.keys(radiologyData.partner_B).length > 0;
    if (radiologyData && hasRadA && hasRadB) {
      const allFlags = [...(radiologyData.partner_A.risk_flags_json || []), ...(radiologyData.partner_B.risk_flags_json || [])];
      if (allFlags.length === 0) {
        paragraphs.push(`Your structural wellness scans (including abdominal, scrotal, and pelvic ultrasounds) show completely standard organ anatomy, verifying there are no organic blocks or anatomical issues.`);
      } else {
        paragraphs.push(`Your structural wellness scans identified a couple of organic findings—such as minor fat accumulation in the liver or anatomical variations—that are steady but helpful to track through standard physicals.`);
      }
    }

    // Genetics (Static)
    const isGeneticCovered = activeMatchDetails?.presentation_json?.report_confidence?.domains?.genetic?.covered;
    if (isGeneticCovered) {
      const cpr = activeMatchDetails.presentation_json.carrier_pair_risk || {};
      const hasOverlap = cpr.thalassemia?.male_status === 'red' || cpr.thalassemia?.female_status === 'red';
      if (hasOverlap) {
        paragraphs.push(`Finally, premarital genetic screening identified overlapping thalassemia carrier traits. This is important knowledge for family planning: it indicates a probability of passing traits to future children, making genetic counseling a recommended path.`);
      } else {
        paragraphs.push(`Finally, premarital genetic screening and HPLC testing confirm that you do not quietly share overlapping carrier traits for thalassemia or standard blood variants, ensuring a clear inherited baseline for your future children.`);
      }
    }

    return paragraphs;
  };

  const activeProse = generateChapterProse(selectedYear, isAct);

  // Prose cross-dissolve fade states
  const [displayedProse, setDisplayedProse] = useState(activeProse);
  const [fadeStatus, setFadeStatus] = useState('opacity-100');

  useEffect(() => {
    setFadeStatus('opacity-0');
    const timer = setTimeout(() => {
      setDisplayedProse(activeProse);
      setFadeStatus('opacity-100');
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedYear, isAct, mfrResult, chronicResult]);

  // Extract first letter for dropping caps in editorial style
  const firstParagraph = displayedProse[0] || '';
  const restParagraphs = displayedProse.slice(1);
  const firstLetter = firstParagraph ? firstParagraph.charAt(0) : '';
  const restOfFirstParagraph = firstParagraph ? firstParagraph.slice(1) : '';

  // Calculate dynamic summaries inside Scrubber Card subpanels
  const getSubCardsData = () => {
    let mfrOpt = '';
    let mfrCur = '';
    let chronicOpt = '';
    let chronicCur = '';

    if (mfrResult) {
      const currentCurve = mfrResult?.projection?.current || [];
      const valCur = (currentCurve[selectedYear] ?? 15) / 100;
      const cumCur = Math.round((1.0 - Math.pow(1.0 - valCur, 12)) * 100);
      const optimizedCurve = mfrResult?.projection?.optimised || mfrResult?.projection?.optimized || [];
      const valOpt = (optimizedCurve[selectedYear] ?? 15) / 100;
      const cumOpt = Math.round((1.0 - Math.pow(1.0 - valOpt, 12)) * 100);

      mfrOpt = `Optimal range remains open. Conception success rate is highly optimized at ${cumOpt}% with nutritional planning.`;
      mfrCur = `Biological age curve drops likelihood to ${cumCur}% by Year ${selectedYear} without cycle tracking.`;
    } else {
      mfrOpt = "Reproductive markers are stable. Cycle mapping is recommended in Year 3.";
      mfrCur = "Natural age progression gradually affects conception window durations.";
    }

    if (chronicResult) {
      const currentCurve = chronicResult?.projection?.currentLifestyle || chronicResult?.projection?.current || [];
      const optimizedCurve = chronicResult?.projection?.optimizedLifestyle || chronicResult?.projection?.optimized || [];
      const coupleScoreCur = Math.round(currentCurve[selectedYear] ?? 85);
      const coupleScoreOpt = Math.round(optimizedCurve[selectedYear] ?? 85);

      chronicOpt = `Stable. Protective convergence index rises to ${coupleScoreOpt}/100. Maintain sleep and moderate exercise routines.`;
      chronicCur = `Resilience drops to ${coupleScoreCur}/100. Borderline blood sugar or blood pressure trends watch advised.`;
    } else {
      chronicOpt = "Resilient protective score maintained by lifestyle goals.";
      chronicCur = "Standard baseline checks watch for chronic biomarkers variations.";
    }

    return {
      fertilityText: isAct ? mfrOpt : mfrCur,
      chronicText: isAct ? chronicOpt : chronicCur
    };
  };

  const { fertilityText, chronicText } = getSubCardsData();

  // Health Character state machine resolvers
  const getThreadState = (id, year, actBranch) => {
    if (id === 'fertility') {
      if (!mfrResult) return 'Pending';
      const mfrState = mfrResult.state || 'Aligned';
      if (mfrState === 'Aligned') return 'Resolved';
      if (mfrState === 'Specialist conversation') return 'Needs attention';
      if (year === 0) return 'Steady watch';
      return actBranch ? 'Improving' : 'Steady watch';
    }
    
    if (id === 'chronic') {
      if (!chronicResult) return 'Pending';
      const chronicState = chronicResult.state || 'Aligned';
      if (chronicState === 'Aligned') return 'Resolved';
      if (chronicState === 'Specialist conversation') return 'Needs attention';
      if (year === 0) return 'Steady watch';
      return actBranch ? 'Improving' : 'Steady watch';
    }

    if (id === 'mental') {
      if (!mentalResult) return 'Pending';
      const label = mentalResult.overall_readiness?.label || 'Highly Aligned';
      if (label === 'Highly Aligned') return 'Resolved';
      if (label === 'Discussion Recommended') return 'Needs attention';
      return 'Steady watch';
    }

    if (id === 'radiology') {
      const hasRadA = radiologyData?.partner_A && Object.keys(radiologyData.partner_A).length > 0;
      const hasRadB = radiologyData?.partner_B && Object.keys(radiologyData.partner_B).length > 0;
      if (!radiologyData || !hasRadA || !hasRadB) return 'Pending';
      
      const allFlags = [...(radiologyData.partner_A.risk_flags_json || []), ...(radiologyData.partner_B.risk_flags_json || [])];
      const hasSevere = allFlags.some(f => ['high', 'critical', 'severe'].includes(f.severity?.toLowerCase()));
      const hasMild = allFlags.some(f => ['moderate', 'low', 'mild'].includes(f.severity?.toLowerCase()));
      
      if (hasSevere) return 'Needs attention';
      if (hasMild) return 'Steady watch';
      return 'Resolved';
    }

    if (id === 'genetics') {
      const isGeneticCovered = activeMatchDetails?.presentation_json?.report_confidence?.domains?.genetic?.covered;
      if (!isGeneticCovered) return 'Pending';
      const cpr = activeMatchDetails?.presentation_json?.carrier_pair_risk || {};
      const hasSevere = cpr.thalassemia?.male_status === 'red' || cpr.thalassemia?.female_status === 'red';
      if (hasSevere) return 'Needs attention';
      return 'Resolved';
    }

    return 'Resolved';
  };

  const getThreadBadgeStyle = (state) => {
    switch (state) {
      case 'Resolved':
        return { badge: 'bg-emerald-50 text-[#10b981] border-emerald-100', dot: 'bg-emerald-500', bar: 'border-l-[#10b981]' };
      case 'Improving':
        return { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-400', bar: 'border-l-[#10b981]' };
      case 'Steady watch':
        return { badge: 'bg-amber-50 text-(--amber-d) border-amber-100', dot: 'bg-amber-500', bar: 'border-l-amber-500' };
      case 'Needs attention':
        return { badge: 'bg-amber-50 text-(--amber-d) border-amber-100', dot: 'bg-amber-600', bar: 'border-l-(--amber-d)' };
      default:
        return { badge: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400', bar: 'border-l-slate-300' };
    }
  };

  // Defining the stateful findings list
  const threads = [
    {
      id: 'fertility',
      name: 'Starting a family',
      icon: Heart,
      plain: {
        why: mfrResult?.summary || "Your biological parameters and age baselines resolution.",
        revealBtnText: "The conception likelihood, if you want it",
        revealDetail: () => {
          const curve = isAct ? (mfrResult?.projection?.optimised || mfrResult?.projection?.optimized || []) : (mfrResult?.projection?.current || []);
          const val = (curve[selectedYear] ?? 15) / 100;
          const cum = Math.round((1.0 - Math.pow(1.0 - val, 12)) * 100);
          return { value: cum, suffix: '%', text: `Cumulative likelihood of natural conception ${selectedYear === 0 ? 'today' : `by Year ${selectedYear}`} is ` };
        }
      },
      clinical: {
        why: mfrResult?.summary || "Fecundity calculations based on AMH reserves and age values.",
        revealBtnText: "See clinical MFR indices",
        revealDetail: () => {
          const curve = isAct ? (mfrResult?.projection?.optimised || mfrResult?.projection?.optimized || []) : (mfrResult?.projection?.current || []);
          const val = curve[selectedYear] ?? 0;
          return { value: val, suffix: '%', text: `Monthly Fecundity Rate parameter resolves to ` };
        }
      }
    },
    {
      id: 'chronic',
      name: 'Blood sugar & metabolic health',
      icon: HeartPulse,
      plain: {
        why: chronicResult?.dynamic_insights?.conversation_needed_summary || "Premarital cardiometabolic checks indicate stable sugar and cholesterol regulation.",
        revealBtnText: "The metabolic health score, if you want it",
        revealDetail: () => {
          const curve = isAct ? (chronicResult?.projection?.optimizedLifestyle || chronicResult?.projection?.optimized || []) : (chronicResult?.projection?.currentLifestyle || chronicResult?.projection?.current || []);
          const score = Math.round(curve[selectedYear] ?? 85);
          return { value: score, suffix: '/100', text: `Your metabolic protective index is projected to be ` };
        }
      },
      clinical: {
        why: chronicResult?.dynamic_insights?.conversation_needed_summary || "Biomarker indices and lifestyle variables aggregated to calculate protective score.",
        revealBtnText: "See protective convergence index",
        revealDetail: () => {
          const curve = isAct ? (chronicResult?.projection?.optimizedLifestyle || chronicResult?.projection?.optimized || []) : (chronicResult?.projection?.currentLifestyle || chronicResult?.projection?.current || []);
          const score = Math.round(curve[selectedYear] ?? 85);
          return { value: score, suffix: '/100', text: `Cardiometabolic index: ` };
        }
      }
    },
    {
      id: 'mental',
      name: 'Psychometric alignment',
      icon: Sparkles,
      plain: {
        why: mentalResult?.couple_analysis?.attachment_insight || "Attachment style compatibility, expectation alignments, and conflict indices mapped.",
        revealBtnText: "The compatibility index, if you want it",
        revealDetail: () => ({ value: Math.round(mentalResult?.overall_readiness?.score || 80), suffix: '%', text: `Overall psychometric compatibility score: ` })
      },
      clinical: {
        why: mentalResult?.couple_analysis?.attachment_insight || "Big Five compatibility metrics and Gottman questionnaire assessments.",
        revealBtnText: "See compatibility calculations",
        revealDetail: () => ({ value: Math.round(mentalResult?.overall_readiness?.score || 80), suffix: '/100', text: `Compatibility index resolves to ` })
      }
    },
    {
      id: 'radiology',
      name: 'Organ structural wellness',
      icon: ShieldCheck,
      plain: {
        why: "Anatomical checkups, pelvic structural wellness, and cardiac ECHO outputs mapped.",
        revealBtnText: "The organ score contribution, if you want it",
        revealDetail: () => {
          // See the note on the same `|| 25` pattern above — a genuine 0 (the worst
          // possible finding) must not be displayed as a reassuring 25.
          const raw = radiologyData?.partner_A?.scores_json?.radiology_nuptia_contribution;
          const score = Math.round(typeof raw === 'number' ? raw : 25);
          return { value: score, suffix: '/30', text: `Organ scans contribution resolves to ` };
        }
      },
      clinical: {
        why: "USG Abdomen, TVS/scrotal Doppler, Echocardiography outputs mapped.",
        revealBtnText: "See radiology score contribution",
        revealDetail: () => {
          const raw = radiologyData?.partner_A?.scores_json?.radiology_nuptia_contribution;
          const score = Math.round(typeof raw === 'number' ? raw : 25);
          return { value: score, suffix: '/30', text: `Nuptia USG contribution resolves to ` };
        }
      }
    },
    {
      id: 'genetics',
      name: "Future kids' genetic baseline",
      icon: Dna,
      plain: {
        why: activeMatchDetails?.presentation_json?.carrier_pair_risk?.thalassemia?.narrative || "Autosomal recessive trait carrier pair risk matching.",
        revealBtnText: "The genetic carrier analysis, if you want it",
        revealDetail: () => {
          const status = genomicsReveal();
          return {
            value: status.value,
            suffix: status.value !== null ? `% (${status.label})` : status.label,
            text: `Genetic screening indicates overlapping trait safety profile at `
          };
        }
      },
      clinical: {
        why: activeMatchDetails?.presentation_json?.carrier_pair_risk?.thalassemia?.clinical_footnote || "Carrier screening for inherited mutations.",
        revealBtnText: "See carrier variant status",
        revealDetail: () => {
          const status = genomicsReveal();
          return {
            value: status.value,
            suffix: status.value !== null ? ` (${status.label})` : status.label,
            text: `HPLC beta-thalassemia and variant overlap compatibility: `
          };
        }
      }
    }
  ];

  // Action items inside path forward
  const actions = [];
  const flaggedCount = calculateDynamicScore(0, false) < 80;
  if (flaggedCount) {
    actions.push("Book a professional clinical session to review metabolic and reproductive markers.");
    actions.push("Establish a couple-centered tracking timeline (diet, exercise, sleep habits) for the next 90 days.");
  } else {
    actions.push("No immediate medical interventions needed — maintain standard yearly physical checkups.");
    actions.push("Maintain healthy baseline exercises and balanced nutritional profiles together.");
  }

  // Pending domains
  const pendingDomains = [];
  if (!mfrResult) pendingDomains.push("fertility");
  if (!chronicResult) pendingDomains.push("long-term health");
  if (!mentalResult) pendingDomains.push("mental wellness");
  const hasRadAData = radiologyData?.partner_A && Object.keys(radiologyData.partner_A).length > 0;
  const hasRadBData = radiologyData?.partner_B && Object.keys(radiologyData.partner_B).length > 0;
  if (!radiologyData || !hasRadAData || !hasRadBData) pendingDomains.push("radiology");
  const isGeneticCovered = activeMatchDetails?.presentation_json?.report_confidence?.domains?.genetic?.covered;
  if (!isGeneticCovered) pendingDomains.push("genetics");

  const selectedYearIndex = Math.max(0, PROJECTION_YEARS.indexOf(selectedYear));
  const rangePercent = (selectedYearIndex / (PROJECTION_YEARS.length - 1)) * 100;

  return (
    <div className="w-full text-left select-none relative">
      <style>{`
        /* Entrance animations */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Pulse scale */
        @keyframes scalePulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-scale-pulse {
          animation: scalePulse 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Shimmer sparkle glow */
        @keyframes shimmerEffect {
          0% { filter: brightness(1) drop-shadow(0 0 0px rgba(0,122,140,0)); }
          50% { filter: brightness(1.15) drop-shadow(0 0 12px rgba(0,122,140,0.25)); }
          100% { filter: brightness(1) drop-shadow(0 0 0px rgba(0,122,140,0)); }
        }
        .animate-shimmer {
          animation: shimmerEffect 0.6s ease-in-out forwards;
        }

        /* Custom range slider styling */
        input[type="range"]::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--teal);
          box-shadow: 0 4px 12px rgba(0, 122, 140, 0.2);
          cursor: pointer;
          margin-top: -8px;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 14px rgba(0, 122, 140, 0.3);
        }
        input[type="range"]::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }
        input[type="range"]::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }
        input[type="range"]::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--teal);
          box-shadow: 0 4px 12px rgba(0, 122, 140, 0.2);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 14px rgba(0, 122, 140, 0.3);
        }
      `}</style>

      {/* Main Grid: direct siblings to allow flexible row grids on desktop and custom ordering on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">
        
        {/* 1. Index Score Card (Desktop top-right sidebar, Mobile top-1) */}
        <section 
          className={`order-1 lg:col-start-2 lg:col-end-3 lg:row-start-1 lg:row-end-2 lg:sticky lg:top-6 lg:self-start bg-white border border-(--line) rounded-3xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.025)] flex flex-col gap-4 transition-all duration-300 animate-fade-in-up ${
            isPulsing ? 'animate-scale-pulse' : ''
          } ${isShimmering ? 'animate-shimmer' : ''}`}
          style={{ animationDelay: '50ms' }}
        >
          <div>
            <span className="text-[9px] tracking-wider uppercase font-bold text-slate-400 block mb-1 font-sans">
              Your combined score
            </span>
            <h3 className="text-xl font-normal text-slate-800 font-serif mb-1 tracking-tight">Health Together Index</h3>
            <p className="text-[10px] text-slate-400 font-sans tracking-normal leading-normal">Combined vitality score based on current data.</p>
          </div>

          {hasScoreData ? (
            <>
              {/* SVG Progress Ring */}
              <div
                className="relative flex items-center justify-center p-3 rounded-full flex-shrink-0 mx-auto"
                style={{ background: radialGlowStyle }}
              >
                <svg className="w-24 h-24 transform -rotate-90 select-none flex-shrink-0" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="41"
                    stroke="#F1F5F9"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="41"
                    stroke={ringStrokeColor}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray="257.6"
                    strokeDashoffset={257.6 - (257.6 * displayScore) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-800 tracking-tighter leading-none font-sans">{displayScore}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 font-sans">pts</span>
                </div>
              </div>

              {/* Status tag */}
              <div className="mx-auto mt-1">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-bold bg-(--soft-teal) border border-(--teal)/25 text-(--teal-d) uppercase tracking-wider font-sans">
                  {scoreBand === 'Strong' ? 'Excellent Synergy' : scoreBand === 'Steady' ? 'Moderate Synergy' : 'Watch Synergy'}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              {radLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
              ) : (
                <Info className="w-8 h-8 text-slate-300" />
              )}
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed max-w-[180px]">
                {radLoading ? 'Loading your results…' : 'Complete an assessment to see your combined score.'}
              </p>
            </div>
          )}
        </section>

        {/* 2. Timeline Projection Card (Desktop Row 2 Left column, Mobile top-2) */}
        <section
          className="order-2 lg:col-start-1 lg:col-end-2 lg:row-start-2 lg:row-end-3 bg-white border border-(--line) rounded-3xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.025)] animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-normal text-slate-800 font-serif">Timeline Projection</h3>
            <span className="text-[10px] font-extrabold text-(--teal) bg-(--soft-teal) border border-(--teal)/25 px-3 py-1 rounded-full uppercase tracking-wider font-sans">
              {selectedYear === 0 ? 'Today (Baseline)' : `Year ${selectedYear}`}
            </span>
          </div>

          {/* Range Slider Scrubber */}
          <div className="relative pt-4 pb-2">
            {/* Tooltip badge */}
            <div
              className="absolute -top-3 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-md pointer-events-none transition-all duration-150 -translate-x-1/2 flex items-center justify-center min-w-[28px] font-sans"
              style={{
                left: `${rangePercent}%`,
                background: 'linear-gradient(to right, var(--teal), var(--pink))'
              }}
            >
              {targetScore ?? '–'}
            </div>

            <input
              type="range"
              min="0"
              max={PROJECTION_YEARS.length - 1}
              step="1"
              value={selectedYearIndex}
              onChange={(e) => setSelectedYear(PROJECTION_YEARS[parseInt(e.target.value)])}
              aria-label="Select projection checkpoint, from today to 10 years out"
              aria-valuetext={selectedYear === 0 ? 'Today (Baseline)' : `Year ${selectedYear}`}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none transition-all"
              style={{
                background: `linear-gradient(to right, var(--teal) 0%, var(--teal) ${rangePercent}%, #E2E8F0 ${rangePercent}%, #E2E8F0 100%)`
              }}
            />
          </div>

          {/* Scrubber Label scale */}
          <div className="relative w-full h-6 mt-3 select-none font-sans text-[10px] border-b border-(--line) pb-5">
            {[
              { yr: 0, text: 'Now', pos: 0 },
              { yr: 3, text: 'Y3', pos: 25 },
              { yr: 5, text: 'Y5', pos: 50 },
              { yr: 7, text: 'Y7', pos: 75 },
              { yr: 10, text: 'Y10', pos: 100 }
            ].map((item) => {
              const distance = Math.abs(item.yr - selectedYear);
              let labelStyle = "text-slate-400 font-normal scale-95";
              if (distance === 0) {
                labelStyle = "text-(--teal) font-extrabold scale-110";
              } else if (distance <= 1) {
                labelStyle = "text-slate-600 font-bold scale-100";
              }
              return (
                <button
                  key={item.yr}
                  type="button"
                  onClick={() => setSelectedYear(item.yr)}
                  aria-label={`Jump to ${item.yr === 0 ? 'today (baseline)' : `year ${item.yr}`}`}
                  aria-current={distance === 0 ? 'true' : undefined}
                  className={`absolute cursor-pointer transition-all duration-200 hover:text-slate-800 -translate-x-1/2 bg-transparent border-0 p-0 ${labelStyle}`}
                  style={{ left: `${item.pos}%` }}
                >
                  {item.text}
                </button>
              );
            })}
          </div>

          {/* Action Switch Fork */}
          <div className="pt-5 pb-5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3 font-sans">Your Move</span>
            <div className="relative grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200 select-none">
              <div
                className="absolute top-1 bottom-1 left-1 bg-white rounded-lg shadow-sm border border-slate-200 transition-transform duration-300 ease-out"
                style={{
                  width: 'calc(50% - 4px)',
                  transform: isAct ? 'translateX(0)' : 'translateX(100%)'
                }}
              />

              <button
                onClick={() => setIsAct(true)}
                className={`relative z-10 py-2 text-xs font-bold rounded-lg transition-all duration-300 font-sans ${
                  isAct
                    ? 'text-(--teal) font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                If you act on this
              </button>
              <button
                onClick={() => setIsAct(false)}
                className={`relative z-10 py-2 text-xs font-bold rounded-lg transition-all duration-300 font-sans ${
                  !isAct
                    ? 'text-slate-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                If you don't
              </button>
            </div>
          </div>

          {/* Dynamic subcards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-(--line)">
            {/* Fertility Window */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-(--teal) font-sans mb-1.5 uppercase tracking-wider">Fertility Window</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{fertilityText}</p>
            </div>

            {/* Cardiometabolic Risk */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-(--pink) font-sans mb-1.5 uppercase tracking-wider">Cardiovascular Risk</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{chronicText}</p>
            </div>
          </div>
        </section>

        {/* 3. Your Health Story (Desktop Row 1 Left column, Mobile top-3) */}
        <section
          className="order-3 lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-2 bg-white border border-(--line) rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.025)] animate-fade-in-up"
          style={{ animationDelay: '150ms' }}
        >
          <div className="flex items-center gap-3 border-b border-(--line) pb-4 mb-6">
            <div className="p-2 bg-(--soft-teal) border border-(--teal)/25 rounded-xl text-(--teal) flex-shrink-0">
              <ClipboardList size={18} />
            </div>
            <h3 className="text-xl font-normal text-slate-800 font-serif">Your Health Story</h3>
          </div>

          {/* Book page layout */}
          <div
            className={`text-slate-800 transition-opacity duration-150 leading-relaxed font-serif ${fadeStatus}`}
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {firstParagraph && (
              <p className="text-sm leading-relaxed text-slate-800 font-serif">
                {firstLetter && (
                  <span className="float-left text-5xl font-serif text-(--amber-d) mr-2.5 mt-1 select-none font-normal leading-[0.8]">
                    {firstLetter}
                  </span>
                )}
                {restOfFirstParagraph}
              </p>
            )}
            {restParagraphs.map((para, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-800 font-serif mt-4">{para}</p>
            ))}
          </div>
        </section>

        {/* 4. Tracked Markers List (Desktop pinned Row 2 right column under Index, Mobile top-4) */}
        <section 
          className="order-4 lg:col-start-2 lg:col-end-3 lg:row-start-2 lg:row-end-3 lg:sticky lg:top-[310px] lg:self-start space-y-4 animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex items-center justify-between px-1 gap-2">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans">
              tracked markers
            </h3>
            <button
              type="button"
              onClick={() => setIsClinicalMode(!isClinicalMode)}
              title="Switch the wording used in the details below between plain and clinical language"
              className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-(--line) text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors font-sans whitespace-nowrap"
            >
              {isClinicalMode ? 'Plain words' : 'Clinical terms'}
            </button>
          </div>
          {radError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] font-sans" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{radError} Your other results are unaffected.</span>
            </div>
          )}
          <div className="space-y-3">
            {threads.map((thread) => {
              const state = getThreadState(thread.id, selectedYear, isAct);
              if (state === 'Pending') return null;

              const isExpanded = !!expandedThreads[thread.id];
              const isNumRevealed = !!revealedNumbers[thread.id];
              const style = getThreadBadgeStyle(state);
              const copy = isClinicalMode ? thread.clinical : thread.plain;
              const DomainIcon = thread.icon || Heart;

              return (
                <div 
                  key={thread.id} 
                  className={`bg-white border rounded-2xl transition-all duration-300 shadow-[0_4px_15px_rgba(15,23,42,0.015)] ${style.bar} border-l-4 ${
                    isExpanded ? 'shadow-md border-slate-300 scale-[1.01]' : 'hover:-translate-y-0.5 hover:shadow-sm border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedThreads(prev => ({ ...prev, [thread.id]: !prev[thread.id] }))}
                    aria-expanded={isExpanded}
                    className="w-full text-left p-4 flex items-center justify-between cursor-pointer select-none bg-transparent border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${style.badge} shrink-0`}>
                        <DomainIcon size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 font-sans">{thread.name}</h4>
                        <span className="text-[10px] text-slate-500 block font-sans mt-0.5 font-medium">{state}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-50 pt-3 text-[11px] text-slate-600 space-y-3 font-sans">
                      <p className="leading-relaxed">{copy.why}</p>
                      
                      <div className="pt-1">
                        <button
                          onClick={() => setRevealedNumbers(prev => ({ ...prev, [thread.id]: !prev[thread.id] }))}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-bold underline decoration-dotted cursor-pointer font-sans"
                        >
                          <Info size={10} />
                          {copy.revealBtnText}
                        </button>

                        {isNumRevealed && (
                          <div className="mt-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-500 font-semibold leading-relaxed transition-all font-sans">
                            {(() => {
                              const detailsObj = copy.revealDetail();
                              // A null value means genuinely not-yet-assessed (e.g.
                              // carrier screening incomplete for one partner) — showing
                              // the animated counter would coerce it to a misleading
                              // "0", so fall back to plain text instead.
                              return (
                                <p>
                                  {detailsObj.text}
                                  {detailsObj.value !== null && detailsObj.value !== undefined
                                    ? <RevealedCount targetValue={detailsObj.value} suffix={detailsObj.suffix} />
                                    : <span>{detailsObj.suffix}</span>}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Closing path forward card (Desktop span 2 columns, Mobile bottom) */}
        <section 
          className="order-5 lg:col-span-2 bg-(--ink) text-white rounded-3xl p-6 sm:p-8 border-l-4 border-l-(--teal) shadow-lg animate-fade-in-up mt-4"
          style={{ animationDelay: '250ms' }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <span className="text-[10px] tracking-widest uppercase font-bold text-slate-400 block mb-2 font-sans">
                Your path forward
              </span>
              <h3 className="text-xl font-normal text-slate-100 mb-4 font-serif">
                What to do next
              </h3>
              <ul className="space-y-3 pl-4 list-decimal text-slate-300 text-xs font-sans">
                {actions.map((act, i) => (
                  <li key={i} className="leading-relaxed">{act}</li>
                ))}
              </ul>

              {pendingDomains.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-800 text-slate-400 italic text-[11px] space-y-1.5 text-left font-sans">
                  {pendingDomains.map((domain) => (
                    <p key={domain}>• Once your {domain} results are in, we'll add that chapter.</p>
                  ))}
                </div>
              )}
            </div>

            {/* CTA action buttons inside dark card */}
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              {activeMatchId && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isPdfDownloading}
                  className="bg-(--teal) hover:bg-(--teal-d) disabled:opacity-60 text-white rounded-xl px-5 py-2.5 font-bold font-sans text-xs transition-all duration-300 cursor-pointer text-center"
                >
                  {isPdfDownloading ? 'Preparing…' : 'Download PDF Report'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-400 leading-relaxed max-w-md mx-auto pt-8 mt-12 border-t border-(--line) font-sans">
        An estimate, not a verdict — based on your reports. Biology varies couple to couple. Your data stays private to the two of you.
      </footer>
    </div>
  );
}
