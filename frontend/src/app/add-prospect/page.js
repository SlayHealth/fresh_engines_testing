'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, Check, Share2, UserRound, HeartPulse, Brain, FlaskConical, ScanLine, Dna } from 'lucide-react';
import { useCompatibility, calculateAge, buildOnboardingFormFromUser } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import { toast } from '../../components/Toast';
import { confirmDialog } from '../../components/ConfirmDialog';
import QuestionScreen from '../../components/wizard/QuestionScreen';
import ChoiceList from '../../components/wizard/ChoiceList';
import MeasurementSlider from '../../components/wizard/MeasurementSlider';
import CityInput from '../../components/wizard/CityInput';
import AnalysisLoadingScreen from '../../components/wizard/AnalysisLoadingScreen';
import CategoryHub from '../../components/wizard/CategoryHub';
import MobileSectionList from '../../components/mobile/MobileSectionList';
import Ico from '../../components/mobile/Ico';
import { toMobileSections } from '../../utils/mobileSections';
import useIsMobile from '../../hooks/useIsMobile';
import {
  LIFESTYLE_ACTIVITIES, LIFESTYLE_DRINKING,
  LIFESTYLE_SMOKING_TOBACCO, LIFESTYLE_SLEEP, LIFESTYLE_MENSTRUAL,
  GENDERS, MEETING_SOURCES, MATRIMONIAL_PLATFORMS, RELATIONSHIP_STATUSES,
  FAMILY_HISTORY_DIABETES
} from '../../constants/lifestyleOptions';
import { MENTAL_HEALTH_QUESTIONS, MENTAL_HEALTH_CATEGORIES, mentalCategoryProgress } from '../../constants/mentalHealthQuestions';
import MentalSubHub from '../../components/wizard/MentalSubHub';
import { deriveSubstanceConcern } from '../../utils/mentalAutofill';
import { SUGGESTED_PATHOLOGY_TESTS, SUGGESTED_RADIOLOGY_TESTS, SUGGESTED_GENOMICS_TESTS } from '../../constants/suggestedTests';
import { aboutProgress as aboutProgressShared, aboutCounts as aboutCountsShared, lifestyleProgress, lifestyleCounts, mentalProgress, mentalCounts, computeConfidence, RELIABLE_THRESHOLD } from '../../utils/healthProfileProgress';
import { estimateTimeLeft } from '../../utils/estimateTime';

// Radiology upload state lives only in this page (not the shared Context), so it needs
// its own small draft-persistence mirror — same pattern/reasoning as the profile draft
// in CompatibilityContext.js: namespaced per logged-in user id so a refresh doesn't lose
// an already-parsed radiology report, and switching accounts never leaks one user's
// upload into another's session.
let cachedRadiologyDraft;

function getStoredUserId() {
  try {
    const raw = localStorage.getItem('slayhealth_user');
    return raw ? JSON.parse(raw)?.id : null;
  } catch (e) {
    return null;
  }
}

function radiologyDraftKey() {
  return `slayhealth_radiology_draft_${getStoredUserId() || 'anon'}`;
}

function loadRadiologyDraft() {
  if (cachedRadiologyDraft !== undefined) return cachedRadiologyDraft;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(radiologyDraftKey()) : null;
    cachedRadiologyDraft = raw ? JSON.parse(raw) : null;
  } catch (e) {
    cachedRadiologyDraft = null;
  }
  return cachedRadiologyDraft;
}

const PROSPECT_MODE_OPTIONS = [
  { val: 'self', label: "I'll enter their details myself", desc: 'Fill in your prospect’s information right now' },
  { val: 'invite', label: 'Generate a link to send them', desc: "They fill in their own details — you copy and send the link yourself" }
];

const fieldInputClass = 'w-full p-4 border rounded-xl text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

// Real, per-upload test coverage from the backend's ontology-based extraction
// (see backend/src/services/pathology/testCoverage.service.js) — which named
// tests this specific PDF contained vs. didn't, and what each missing one
// means for the report, not just a raw "N parameters found" count.
function TestCoverageSummary({ coverage }) {
  const [showMissing, setShowMissing] = useState(false);
  if (!coverage) return null;
  const { available, missing } = coverage;

  return (
    <div className="rounded-xl border p-3.5 text-left" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink)' }}>
        {available.length} of {available.length + missing.length} tests found in this report
      </p>
      {available.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2">
          {available.map((t) => (
            <li key={t.test} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>
              {t.test}
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            className="text-xs font-semibold underline"
            style={{ color: 'var(--muted)' }}
          >
            {showMissing ? 'Hide' : 'Show'} {missing.length} missing test{missing.length === 1 ? '' : 's'} — and what you&apos;ll miss
          </button>
          {showMissing && (
            <ul className="mt-2 space-y-1.5">
              {missing.map((t) => (
                <li key={t.test} className="text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--ink)' }}>{t.test}</span> — {t.impacts} will show as not yet assessed
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function AddProspectPage() {
  return (
    <Suspense fallback={null}>
      <AddProspectPageInner />
    </Suspense>
  );
}

function AddProspectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkCategory = searchParams.get('enter');

  // ---- Flow-level navigation state ----
  // Whether the paid Radiology engine has been unlocked for this session. There's no
  // payment gateway wired up yet — this just tracks the demo "Unlock" click from the hub.
  const [radiologyUnlocked, setRadiologyUnlocked] = useState(false);
  const [activePerson, setActivePerson] = useState('self'); // 'self' | 'prospect'
  const [activeCategory, setActiveCategory] = useState(null); // null = hub view
  const [showRouting, setShowRouting] = useState(false); // the "how will your prospect share" transition screen

  const [prospectMode, setProspectMode] = useState(null); // 'self' | 'invite' | null
  const [activeInvite, setActiveInvite] = useState(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  // UX8-01: "self" mode previously had zero consent artifact — this gates
  // entering the prospect's own clinical/psychological data behind an
  // explicit, logged acknowledgment from the account holder.
  const [selfEntryConsentConfirmed, setSelfEntryConsentConfirmed] = useState(false);
  const [isLoggingSelfEntryConsent, setIsLoggingSelfEntryConsent] = useState(false);
  const [selfEntryConsentError, setSelfEntryConsentError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [matchRunError, setMatchRunError] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [stepIndex, setStepIndex] = useState(0); // index within the active category / routing sub-flow
  const [cameFromDeepLink, setCameFromDeepLink] = useState(false); // entered directly from a Dashboard health-profile card
  const [activeMentalSubcategory, setActiveMentalSubcategory] = useState(null); // null = show the mental sub-hub cards
  const isMobile = useIsMobile();

  const fillByProspect = prospectMode === 'invite';

  const {
    user,
    setUser,
    runsUsed,
    isMatching,
    matchesList,
    onboardingForm,
    setOnboardingForm,
    prospectForm,
    setProspectForm,
    userReport,
    setUserReport,
    prospectReport,
    setProspectReport,
    selfMentalAnswers, setSelfMentalAnswers,
    prospectMentalAnswers, setProspectMentalAnswers,
    isUserUploading,
    setIsUserUploading,
    isProspectUploading,
    setIsProspectUploading,
    userUploadError,
    setUserUploadError,
    prospectUploadError,
    setProspectUploadError,
    matchError,
    setMatchError,
    handleCompatibilityMatch,
    handleMentalAnalysis,
    restoreMatchSession,
    fetchActiveMatchDetails,
    chronicResult,
    mfrResult,
    activeMatchId
  } = useCompatibility();

  const isSelf = !onboardingForm.userRelation || onboardingForm.userRelation === 'Self';

  // Seed self-details form from the saved user profile once per session
  useEffect(() => {
    if (user && !onboardingForm.candidateGender) {
      setOnboardingForm(prev => ({ ...prev, ...buildOnboardingFormFromUser(user) }));
    }
  }, [user]);

  // Radiology States
  const [userRadiology, setUserRadiology] = useState(() => loadRadiologyDraft()?.userRadiology || null);
  const [prospectRadiology, setProspectRadiology] = useState(() => loadRadiologyDraft()?.prospectRadiology || null);
  const [isUserRadUploading, setIsUserRadUploading] = useState(false);
  const [isProspectRadUploading, setIsProspectRadUploading] = useState(false);
  const [userRadError, setUserRadError] = useState(null);
  const [prospectRadError, setProspectRadError] = useState(null);

  // Mirrors radiology upload state into localStorage on every change (see
  // loadRadiologyDraft above for why this lives here instead of the shared Context).
  useEffect(() => {
    try {
      localStorage.setItem(radiologyDraftKey(), JSON.stringify({ userRadiology, prospectRadiology }));
    } catch (e) {
      // Storage full/unavailable — draft persistence is best-effort only.
    }
  }, [userRadiology, prospectRadiology]);

  // Refs
  const userFileInputRef = useRef(null);
  const prospectFileInputRef = useRef(null);
  const userRadFileInputRef = useRef(null);
  const prospectRadFileInputRef = useRef(null);

  const goNext = () => setStepIndex((i) => i + 1);
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const enterCategory = (key) => {
    setActiveCategory(key);
    if (key === 'mental') {
      // Always lands on the sub-hub cards first, never mid-question — the
      // whole point of this screen is picking which subcategory to do next.
      setActiveMentalSubcategory(null);
      setStepIndex(0);
      return;
    }
    // Resume at the first unanswered step rather than always restarting at 0.
    const steps = getCategorySteps(key, activePerson);
    const firstIncomplete = steps.findIndex((s) => s.canAdvance === false);
    setStepIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
  };

  // Entry point from the mental sub-hub's cards — autofills the drinking/
  // smoking question from Lifestyle's already-answered questions the one time
  // the Habits & Calm subcategory is opened with it still blank, so it isn't
  // asked a third time from scratch. Still fully editable, never hidden.
  const handleEnterMentalSubcategory = (categoryKey) => {
    if (categoryKey === 'habits') {
      const adapter = activePerson === 'self' ? selfAdapter : prospectAdapter;
      const answers = activePerson === 'self' ? selfMentalAnswers : prospectMentalAnswers;
      const setAnswers = activePerson === 'self' ? setSelfMentalAnswers : setProspectMentalAnswers;
      if (answers.substance_concern === undefined) {
        const derived = deriveSubstanceConcern(adapter.form.drinking_habits, adapter.form.smoking_habits);
        if (derived) setAnswers({ ...answers, substance_concern: derived });
      }
    }
    setActiveMentalSubcategory(categoryKey);
    setStepIndex(0);
  };
  // Real answers are never lost by leaving (they live in Context for the rest
  // of this session, and enterCategory already resumes at the first
  // unanswered step) — but a match can't be generated, and the eventual
  // analysis is weaker, until About/Lifestyle/Pathology (the only genuinely
  // required sections — see isPersonReady below) are done. Radiology/Mental/
  // Genomics are deliberately optional and never trigger this prompt.
  const confirmLeaveIncomplete = async (person) => {
    const cats = buildCategories(person);
    const required = cats.filter((c) => ['about', 'lifestyle', 'pathology'].includes(c.key));
    const incomplete = required.filter((c) => (c.progress || 0) < 100);
    if (incomplete.length === 0) return true;
    return confirmDialog({
      title: 'Leave with an incomplete profile?',
      message: `${incomplete.length} required section${incomplete.length === 1 ? '' : 's'} — ${incomplete.map((c) => c.label).join(', ')} — still need${incomplete.length === 1 ? 's' : ''} finishing. Your answers are saved and you can pick up right where you left off, but you won't be able to run a compatibility check until this is done.`,
      confirmLabel: 'Leave anyway',
      cancelLabel: 'Keep going',
      danger: true
    });
  };

  // Forward "advance" callback for a completed category — never confirms,
  // since finishing a section is progress, not abandonment.
  const exitToHub = () => {
    // Someone who deep-linked in from a single Dashboard health-profile card never
    // chose to start the full "New Compatibility Check" flow — completing that
    // one category naturally returns them to the Dashboard.
    if (cameFromDeepLink) {
      router.push('/dashboard');
      return;
    }
    setActiveCategory(null);
    setStepIndex(0);
  };

  // User-initiated "leave the Questionnaire" — the hub's own back button, or
  // backing out of a category's very first (still-unanswered) step while
  // deep-linked. This is the one that confirms if required work is unfinished.
  const handleBackToDashboard = async () => {
    const ok = await confirmLeaveIncomplete(activePerson);
    if (ok) router.push('/dashboard');
  };

  const handleCategoryBackOut = async () => {
    if (cameFromDeepLink) {
      await handleBackToDashboard();
      return;
    }
    setActiveCategory(null);
    setStepIndex(0);
  };

  // Mental Wellbeing is deferred/optional — most commonly reached from the
  // Analysis screen's own "Add Mental Wellbeing" pull-back CTA once a match
  // already exists, rather than during initial onboarding. If both partners
  // have now finished all 21 questions AND a match is already active, merge
  // the result into that existing match immediately instead of routing
  // through the pre-match hub flow.
  const handleMentalCategoryAdvance = async () => {
    const hasActiveMatch = !!(activeMatchId && chronicResult && mfrResult);
    const selfComplete = Object.keys(selfMentalAnswers).length >= MENTAL_HEALTH_QUESTIONS.length;
    const prospectComplete = Object.keys(prospectMentalAnswers).length >= MENTAL_HEALTH_QUESTIONS.length;
    if (hasActiveMatch && selfComplete && prospectComplete) {
      const ok = await handleMentalAnalysis(selfMentalAnswers, prospectMentalAnswers, activeMatchId);
      if (ok) {
        toast.success('Mental Wellbeing added to your report.');
        // handleMentalAnalysis only updates the in-memory mentalResult — the Analysis
        // screen reads activeMatchDetails.presentation_json (already-persisted, re-gated
        // composite), which was just overwritten in the DB by this same merge, so it
        // must be re-fetched or the screen would keep showing the pre-merge score.
        await fetchActiveMatchDetails(activeMatchId);
        router.push('/core-engine/story');
        return;
      }
    }
    // Finishing every mental subcategory ("Finish Mental Wellbeing") is
    // forward progress, not abandonment — route like any other completed
    // category (never confirms), the same as exitToHub, even though Mental
    // itself is optional and excluded from confirmLeaveIncomplete's check.
    // Only bailing out early ("Back to Questionnaire" with subcategories
    // still unanswered) should go through the leave-with-incomplete-profile
    // prompt via handleCategoryBackOut.
    //
    // A completed match is the same durable "already done" evidence
    // MentalSubHub's allDone/hasEvidence already used to show the "Finish"
    // label in the first place — checking only the raw live answers here
    // would disagree with what the button just told the user, sending them
    // through handleCategoryBackOut's incomplete-profile prompt instead
    // (which then confusingly flags some *other* unrelated section).
    const hasMentalEvidence = activePerson === 'self' && !!(matchesList && matchesList.some((m) => m?.analysis?.mentalResult));
    const activePersonMentalComplete = hasMentalEvidence || (activePerson === 'self' ? selfComplete : prospectComplete);
    if (activePersonMentalComplete) {
      exitToHub();
      return;
    }
    await handleCategoryBackOut();
  };

  // Radiology Upload Handler
  const handleRadiologyUpload = async (file, isProspect) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid radiology report (PDF).');
      return;
    }

    if (isProspect) {
      if (!prospectForm.name || !prospectForm.gender || !prospectForm.dob) {
        toast.error("Please enter the prospect's Name, Gender, and DOB first so we can parse and store their radiology report correctly.");
        return;
      }
    } else {
      if (!onboardingForm.candidateName || !onboardingForm.candidateGender || !onboardingForm.candidateDob) {
        toast.error("Please enter your Name, Gender, and DOB first so we can parse and store your radiology report correctly.");
        return;
      }
    }

    const setIsUploading = isProspect ? setIsProspectRadUploading : setIsUserRadUploading;
    const setError = isProspect ? setProspectRadError : setUserRadError;
    const setReport = isProspect ? setProspectRadiology : setUserRadiology;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    const sexVal = isProspect
      ? (prospectForm.gender === 'Male' ? 'Male' : 'Female')
      : (onboardingForm.candidateGender === 'Male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(onboardingForm.candidateDob);
    const nameVal = isProspect ? prospectForm.name : onboardingForm.candidateName;

    formData.append('patientSlayId', nameVal);
    formData.append('sex', sexVal);
    formData.append('age', ageVal);

    try {
      const response = await apiFetch(`${API_URL}/api/radiology/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Radiology extraction failed');
      }

      const data = await response.json();
      if (data.reportId) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Radiology Mock Trigger
  const triggerMockRadiology = async (isProspect) => {
    if (isProspect) {
      if (!prospectForm.name || !prospectForm.gender || !prospectForm.dob) {
        toast.error("Please enter the prospect's Name, Gender, and DOB first.");
        return;
      }
    } else {
      if (!onboardingForm.candidateName || !onboardingForm.candidateGender || !onboardingForm.candidateDob) {
        toast.error("Please enter your Name, Gender, and DOB first.");
        return;
      }
    }

    const setIsUploading = isProspect ? setIsProspectRadUploading : setIsUserRadUploading;
    const setError = isProspect ? setProspectRadError : setUserRadError;
    const setReport = isProspect ? setProspectRadiology : setUserRadiology;

    setIsUploading(true);
    setError(null);

    const sexVal = isProspect
      ? (prospectForm.gender === 'Male' ? 'Male' : 'Female')
      : (onboardingForm.candidateGender === 'Male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(onboardingForm.candidateDob);
    const nameVal = isProspect ? prospectForm.name : onboardingForm.candidateName;

    try {
      const mockScrotum = sexVal === 'Male' ? {
        right_testis: { length_mm: 42, width_mm: 24, height_mm: 31, volume_cc: 16, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
        left_testis: { length_mm: 41, width_mm: 23, height_mm: 30, volume_cc: 15, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
        right_epididymis: { normal: true, thickened: false, cyst_present: false },
        left_epididymis: { normal: true, thickened: false, cyst_present: false },
        varicocele: { present: true, side: 'right', grade: 2 },
        hydrocele: { present: false, side: 'none', significant: false },
        spermatic_cord_normal: true,
        inguinal_hernia: false,
        impression_normal: false,
        impression_text: 'Right varicocele Grade II'
      } : null;

      const mockTvs = sexVal === 'Female' ? {
        uterus: { length_mm: 75, width_mm: 40, height_mm: 30, volume_cc: null, endometrial_thickness_mm: 7.2, fibroids_present: false },
        ovaries: {
          right: { length_mm: 35, width_mm: 22, height_mm: 20, volume_cc: 8.1, follicles_count: 14, dominant_follicle_present: false },
          left: { length_mm: 34, width_mm: 21, height_mm: 19, volume_cc: 7.8, follicles_count: 15, dominant_follicle_present: false },
          pcos_morphology_bilateral: true,
          pcos_morphology_unilateral: false
        }
      } : null;

      const mockFindings = {
        USG_ABDOMEN: {
          liver: { fatty_grade: sexVal === 'Male' ? 2 : 0, hepatomegaly: sexVal === 'Male', ihbr_dilated: false, focal_lesions: [] },
          gallbladder: { present: true, calculi_present: false, polyp_present: false, wall_thickness_normal: true },
          pancreas: { size_normal: true, echotexture_normal: true, focal_lesion: false, calcifications: false },
          spleen: { size_normal: true, size_category: 'normal', focal_lesion: false },
          kidneys: {
            right: { calculi_present: sexVal === 'Male', size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' },
            left: { calculi_present: false, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' }
          },
          urinary_bladder: { wall_thickness_normal: true, calculi_present: false, post_void_residual_cc: 0, mass_present: false },
          ...(sexVal === 'Male' ? {
            prostate: { _applicable: true, size_normal: false, grade: 'Grade_I', volume_cc: 24, weight_grams: null }
          } : {
            uterus: mockTvs.uterus,
            ovaries: mockTvs.ovaries
          })
        },
        ...(sexVal === 'Male' ? { USG_SCROTUM_DOPPLER: mockScrotum } : { USG_TVS: mockTvs }),
        ECHO: {
          lvef_percent: sexVal === 'Male' ? 48 : 62,
          valves: {
            mitral: { mr_grade: sexVal === 'Male' ? 'mild' : 'none' }
          },
          diastolic_dysfunction_grade: sexVal === 'Male' ? 2 : null,
          pah: { present: false, pasp_mmhg: sexVal === 'Male' ? 28 : 20 },
          pericardial_effusion: false,
          rwma: false,
          thrombus: false,
          vegetation: false
        },
        DEXA: {
          lowest_t_score_value: sexVal === 'Male' ? -2.2 : -0.5,
          lowest_t_score_site: sexVal === 'Male' ? 'left femoral neck' : 'lumbar spine',
          overall_who_classification: sexVal === 'Male' ? 'osteopenia' : 'normal'
        }
      };

      const mockScores = {
        organ_scores: {
          USG_ABDOMEN: sexVal === 'Male' ? 82.5 : 95.0,
          ...(sexVal === 'Male' ? { USG_SCROTUM_DOPPLER: 75.0 } : { USG_TVS: 95.0 }),
          ECHO: sexVal === 'Male' ? 65.0 : 95.0,
          DEXA: sexVal === 'Male' ? 55.0 : 90.0
        },
        radiology_nuptia_contribution: sexVal === 'Male' ? 18.71 : 27.5,
        max_possible: 30,
        modalities_scored: ['USG_ABDOMEN', sexVal === 'Male' ? 'USG_SCROTUM_DOPPLER' : 'USG_TVS', 'ECHO', 'DEXA']
      };

      const mockRiskFlags = sexVal === 'Male' ? [
        { flag_id: 'FATTY_LIVER_2', flag_label: 'Grade II Fatty Liver', severity: 'moderate', fertility_relevance: 'Metabolic markers affect spermatogenesis' },
        { flag_id: 'RENAL_CALCULUS', flag_label: 'Right Kidney Stone (4mm)', severity: 'mild', fertility_relevance: 'No direct impact on fertility, watch hydration' },
        { flag_id: 'VARICOCELE_GR2', flag_label: 'Right Varicocele Grade II', severity: 'severe', fertility_relevance: 'Impaired spermatogenesis and semen quality' },
        { flag_id: 'ECHO_DIASTOLIC_DYSFUNCTION_G2', flag_label: 'Grade II Diastolic Dysfunction', severity: 'moderate', fertility_relevance: 'Cardiovascular assessment advised' },
        { flag_id: 'DEXA_OSTEOPENIA', flag_label: 'Osteopenia (T-score -2.2)', severity: 'mild', fertility_relevance: 'Assess vitamin D and calcium balance' }
      ] : [
        { flag_id: 'PCOS_MORPHOLOGY', flag_label: 'Bilateral PCOS Ovarian Morphology', severity: 'moderate', fertility_relevance: 'Ovulatory subfertility risk, lifestyle reset advised' }
      ];

      const response = await apiFetch(`${API_URL}/api/radiology/report`, {
        method: 'POST',
        body: JSON.stringify({
          patient_slay_id: nameVal,
          sex: sexVal,
          age: ageVal,
          modalities_detected: ['USG_ABDOMEN', sexVal === 'Male' ? 'USG_SCROTUM_DOPPLER' : 'USG_TVS', 'ECHO', 'DEXA'],
          findings: mockFindings,
          scores: mockScores,
          risk_flags: mockRiskFlags,
          raw_ocr_text: `MOCK PREMARITAL PORTAL UPLOAD FOR ${nameVal.toUpperCase()}`
        })
      });

      const data = await response.json();
      if (data.reportId) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to trigger mock report');
      }
    } catch (err) {
      setError(err.message || 'Mock failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Auth check & Redirect
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    }
  }, [router]);

  // Deep link from the dashboard's health-profile cards (?enter=lifestyle etc.) —
  // jump straight into that category for "self", skipping the routing screen.
  useEffect(() => {
    if (deepLinkCategory) {
      setActivePerson('self');
      setCameFromDeepLink(true);
      enterCategory(deepLinkCategory);
      // Consume the query param immediately so it can never re-trigger this effect
      // (e.g. on a later re-render or fast-refresh) and re-enter the category.
      router.replace('/add-prospect');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkCategory]);

  // A completed invite never surfaces a persisted matchId to the frontend — the SSE payload
  // has a transient one, but prospect_invites has no match_id column at all, so polling can't
  // see it — and chronicResult/mfrResult/mentalResult still need to be loaded into context
  // before navigating, otherwise core-engine/layout.js's own guard (`!chronicResult ||
  // !mfrResult`) immediately bounces back to /dashboard since nothing populated them for this
  // brand-new match. The invite's own match is always the most recent one for this user
  // (matches are ordered by created_at DESC), so load that instead of needing an exact id.
  const loadCompletedInviteMatch = async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches?userId=${user.id}`);
      if (res.ok) {
        const matches = await res.json();
        if (matches[0]) restoreMatchSession(matches[0]);
      }
    } catch (err) {
      console.error('Failed to load completed invite match:', err);
    }
  };

  // Load active invites on mount
  useEffect(() => {
    const fetchInviteStatus = async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/invite/status`);
        if (res.ok) {
          const invites = await res.json();
          const active = invites.find(i => !['completed', 'revoked', 'expired'].includes(i.status));
          if (active) {
            setActiveInvite(active);
            setProspectMode('invite');
            setShowRouting(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch invite status:", err);
      }
    };
    fetchInviteStatus();
  }, []);

  // SSE Stream for real-time invite updates
  useEffect(() => {
    const inviteId = activeInvite?.id;
    if (!inviteId) return;

    const eventSource = new EventSource(`${API_URL}/api/invite/stream`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'invite_update' && data.inviteId === inviteId) {
          setActiveInvite(prev => {
            if (prev && prev.status === data.status && prev.matchId === data.matchId) {
              return prev;
            }
            return {
              ...prev,
              status: data.status,
              ...data
            };
          });

          if (data.status === 'completed') {
            setTimeout(async () => {
              await loadCompletedInviteMatch();
              router.push('/core-engine/story');
            }, 2500);
          }
        }
      } catch (e) {
        console.error("SSE parsing failed:", e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeInvite?.id, router]);

  // Polling fallback/complement for invite status updates
  useEffect(() => {
    const inviteId = activeInvite?.id;
    if (!inviteId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/invite/status`);
        if (res.ok) {
          const invites = await res.json();
          const current = invites.find(i => i.id === inviteId);
          if (current) {
            if (current.status !== activeInvite.status) {
              setActiveInvite(prev => {
                if (!prev) return current;
                return {
                  ...prev,
                  status: current.status,
                  ...current
                };
              });

              if (current.status === 'completed') {
                setTimeout(async () => {
                  await loadCompletedInviteMatch();
                  router.push('/core-engine/story');
                }, 2500);
              }
            }
          }
        }
      } catch (err) {
        console.error("Polling invite status failed:", err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeInvite?.id, activeInvite?.status, router]);

  // Sync running match spinner state with active invite status
  useEffect(() => {
    if (activeInvite?.status && activeInvite.status !== 'processing') {
      setIsRunningMatch(false);
    }
  }, [activeInvite?.status]);

  const handleCreateInviteLink = async () => {
    if (!prospectForm.name) {
      setInviteError("Please enter the prospect's name first.");
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);

    try {
      const res = await apiFetch(`${API_URL}/api/invite/send`, {
        method: 'POST',
        body: JSON.stringify({
          prospectName: prospectForm.name,
          mentalAnswers: Object.keys(selfMentalAnswers).length > 0 ? selfMentalAnswers : undefined,
          // UX8-05: the backend previously built the invite link from a static
          // APP_URL env value that had drifted from this app's real serving
          // origin, handing out dead links. The browser always knows its own
          // real origin — sent here so the backend can use it directly.
          appOrigin: typeof window !== 'undefined' ? window.location.origin : undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate invite link');
      }

      const data = await res.json();
      setActiveInvite(data.invite);
    } catch (err) {
      setInviteError(err.message || 'Failed to generate invite link');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // UX8-01: logs the account holder's explicit acknowledgment before "self"
  // mode proceeds into entering the prospect's own clinical/psychological
  // data — this path previously had zero consent artifact at all.
  const handleConfirmSelfEntryConsent = async (onDone) => {
    if (!selfEntryConsentConfirmed) return;
    setIsLoggingSelfEntryConsent(true);
    setSelfEntryConsentError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/invite/self-entry-consent`, {
        method: 'POST',
        body: JSON.stringify({ prospectName: prospectForm.name })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record acknowledgment');
      }
      onDone();
    } catch (err) {
      setSelfEntryConsentError(err.message || 'Failed to record acknowledgment');
    } finally {
      setIsLoggingSelfEntryConsent(false);
    }
  };

  const getInviteLink = () => {
    if (!activeInvite) return '';
    if (activeInvite.link) return activeInvite.link;
    if (typeof window !== 'undefined' && activeInvite.token) {
      return `${window.location.origin}/invite/${activeInvite.token}`;
    }
    return '';
  };

  const handleCopyLink = async () => {
    const link = getInviteLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleShareLink = async () => {
    const link = getInviteLink();
    if (!link || !navigator.share) return;
    try {
      await navigator.share({ title: 'SlayHealth Compatibility Check', text: 'Please fill in your details for our compatibility check:', url: link });
    } catch (err) {
      // user cancelled share sheet — ignore
    }
  };

  const handleRevokeInvite = async () => {
    if (!activeInvite) return;
    const ok = await confirmDialog({
      title: 'Revoke this invitation?',
      message: 'The link will become immediately invalid.',
      confirmLabel: 'Revoke',
      danger: true
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`${API_URL}/api/invite/revoke/${activeInvite.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        setActiveInvite(null);
      } else {
        toast.error("Failed to revoke invite");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunMatch = async () => {
    if (!activeInvite) return;
    setIsRunningMatch(true);
    setMatchRunError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/invite/run-match/${activeInvite.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterPathologyId: userReport?.report_metadata?.report_id || null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start compatibility matching');
      }
    } catch (err) {
      setMatchRunError(err.message || 'Error starting match');
      setIsRunningMatch(false);
    }
  };

  const renderTimeline = () => {
    if (!activeInvite) return null;
    const status = activeInvite.status;
    const link = getInviteLink();

    const timelineSteps = [
      { key: 'sent', label: 'Link Generated', desc: 'Ready to share', activeStates: ['sent', 'delivered', 'opened', 'consent_pending', 'consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'opened', label: 'Opened', desc: 'Prospect opened the invite link', activeStates: ['opened', 'consent_pending', 'consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'consent', label: 'Consent Decision', desc: status === 'consent_rejected' ? 'Consent Rejected ✗' : 'Consent Accepted ✓', activeStates: ['consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'], isError: status === 'consent_rejected' },
      { key: 'started', label: 'Filling Form', desc: 'Prospect is answering questions', activeStates: ['questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'submitted', label: 'Form Submitted', desc: 'Details and reports received', activeStates: ['questionnaire_submitted', 'processing', 'completed'] }
    ];

    return (
      <div className="space-y-5">
        <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--soft-pink)', border: '1px solid var(--pink)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--pink-d)' }}>Your invite link — copy and send it to {activeInvite.prospectName || 'your prospect'}</p>
          <div className="p-2.5 rounded-lg text-xs break-all" style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
            {link}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5"
              style={{ background: linkCopied ? 'var(--teal)' : 'var(--pink)', color: '#fff' }}
            >
              {linkCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : 'Copy Link'}
            </button>
            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button
                type="button"
                onClick={handleShareLink}
                className="px-4 py-2.5 rounded-lg text-xs font-bold transition-colors duration-150 flex items-center justify-center gap-1.5"
                style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' }}
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Live Onboarding Status</h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold capitalize" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>
            {status === 'processing' || status === 'completed' ? 'Form Submitted' : status.replace('_', ' ')}
          </span>
        </div>

        <div className="relative border-l-2 ml-3.5 space-y-6" style={{ borderColor: 'var(--line)' }}>
          {timelineSteps.map((step) => {
            const isDone = step.activeStates.includes(status);

            return (
              <div key={step.key} className="relative pl-6">
                <div
                  className="absolute left-[-9px] top-1 w-4 h-4 rounded-full border-2"
                  style={{
                    background: step.isError ? 'var(--danger)' : isDone ? 'var(--pink)' : 'var(--surface)',
                    borderColor: step.isError ? 'var(--danger)' : isDone ? 'var(--pink)' : 'var(--line)'
                  }}
                />
                <div className="text-left">
                  <span className="block text-xs font-bold" style={{ color: step.isError ? 'var(--danger-d)' : isDone ? 'var(--ink)' : 'var(--muted)' }}>
                    {step.label}
                  </span>
                  <span className="block text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    {step.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {status === 'failed' && (
          <div className="p-3.5 rounded-xl text-xs font-medium text-left" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>
            <strong>Analysis Failed:</strong> We encountered an error processing reports. Please revoke this link and try again.
          </div>
        )}

        {status === 'consent_rejected' && (
          <div className="p-3.5 rounded-xl text-xs font-medium text-left" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>
            {/* UX8-03: previously showed this same "nothing was shared" copy
                even when the prospect had already submitted real data and
                asked for it to be deleted afterward — false in that case. */}
            {activeInvite.erased_after_submission ? (
              <><strong>Data Deleted:</strong> Your prospect submitted their information, then asked SlayHealth to delete it. Their reports and profile have been removed — no compatibility analysis was run. You can revoke this link and send a new invite if desired.</>
            ) : (
              <><strong>Invitation Declined:</strong> The prospect has rejected consent to share their health data. You can revoke this link and send a new invite if desired.</>
            )}
          </div>
        )}

        {(status === 'questionnaire_submitted' || status === 'processing' || status === 'failed' || status === 'completed') && (
          <div className="space-y-3">
            {matchRunError && <span className="text-xs font-semibold block" style={{ color: 'var(--danger-d)' }}>{matchRunError}</span>}
            <button
              type="button"
              onClick={handleRunMatch}
              disabled={isRunningMatch || status === 'processing' || status === 'completed' || (!userReport && matchesList.length === 0)}
              className="w-full py-3 px-6 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {isRunningMatch || status === 'processing' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Starting Health Scan...</span>
                </>
              ) : status === 'completed' ? (
                <span>Redirecting to Results...</span>
              ) : (
                <span>Run Compatibility Match Scan</span>
              )}
            </button>
            {!userReport && matchesList.length === 0 && (
              <p className="text-xs font-semibold leading-normal text-center" style={{ color: 'var(--amber-d)' }}>
                ⚠️ Please upload your own Pathology PDF first to run the scan.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleRevokeInvite}
          className="w-full py-2.5 px-4 font-bold text-xs rounded-xl transition-all"
          style={{ background: 'var(--line)', color: 'var(--muted)' }}
        >
          Revoke Invitation Link
        </button>
      </div>
    );
  };

  // File Upload parsing
  const handleFileUpload = async (file, isProspect) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid pathology report (PDF).');
      return;
    }

    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setError = isProspect ? setProspectUploadError : setUserUploadError;
    const setReport = isProspect ? setProspectReport : setUserReport;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await apiFetch(`${API_URL}/api/pathology/extract`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Pathology extraction failed');
      }

      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger Mock extraction
  const triggerMockData = async (isProspect) => {
    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setError = isProspect ? setProspectUploadError : setUserUploadError;
    const setReport = isProspect ? setProspectReport : setUserReport;

    setIsUploading(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to get mock extraction');
      }
    } catch (err) {
      setError(err.message || 'Mock extraction failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMatch = async () => {
    const missingSelf = [];
    if (!isSelf && !onboardingForm.candidateName?.trim()) missingSelf.push("Candidate's Name");
    if (!onboardingForm.candidateGender) missingSelf.push("Your Gender");
    if (!onboardingForm.candidateDob) missingSelf.push("Your DOB");
    if (!onboardingForm.candidateCity?.trim()) missingSelf.push("Your City");
    if (!onboardingForm.relationshipStatus) missingSelf.push("Relationship Status");
    if (!onboardingForm.activity_level) missingSelf.push("Your Activity Level");
    if (!onboardingForm.drinking_habits) missingSelf.push("Your Drinking habits");
    if (!onboardingForm.smoking_habits) missingSelf.push("Your Smoking & Tobacco habits");
    if (!onboardingForm.sleep_cycle) missingSelf.push("Your Sleep cycle");
    if (!onboardingForm.height) missingSelf.push("Your Height");
    if (!onboardingForm.weight) missingSelf.push("Your Weight");
    if (!onboardingForm.waist) missingSelf.push("Your Waist size");

    if (missingSelf.length > 0) {
      setMatchError(`Please fill in the following columns to proceed: ${missingSelf.join(", ")}`);
      return;
    }

    setIsSavingProfile(true);
    setMatchError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/profile`, {
        method: 'POST',
        body: JSON.stringify({
          id: user.id,
          name: onboardingForm.candidateName,
          gender: onboardingForm.candidateGender,
          dob: onboardingForm.candidateDob,
          city: onboardingForm.candidateCity,
          activity_level: onboardingForm.activity_level,
          drinking_habits: onboardingForm.drinking_habits,
          smoking_habits: onboardingForm.smoking_habits,
          sleep_cycle: onboardingForm.sleep_cycle,
          height: onboardingForm.height,
          weight: onboardingForm.weight,
          waist: onboardingForm.waist
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save your details');
      }

      const mergedUser = {
        ...data.user,
        userRelation: onboardingForm.userRelation,
        userName: onboardingForm.userName || user.userName || user.name,
        candidateName: onboardingForm.candidateName,
        relationshipStatus: onboardingForm.relationshipStatus,
        marriageTimeline: onboardingForm.marriageTimeline,
        menstrualCycle: onboardingForm.menstrualCycle
      };
      localStorage.setItem('slayhealth_user', JSON.stringify(mergedUser));
      setUser(mergedUser);

      const matchResult = await handleCompatibilityMatch(mergedUser);
      if (matchResult.success) {
        const hasMentalAnswers = Object.keys(selfMentalAnswers).length > 0 || Object.keys(prospectMentalAnswers).length > 0;
        if (hasMentalAnswers) {
          await handleMentalAnalysis(selfMentalAnswers, prospectMentalAnswers, matchResult.matchId);
        }
        router.push('/core-engine/story');
      }
    } catch (err) {
      setMatchError(err.message || 'Failed to save your details.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ---- Wizard step builders ----
  const choiceStep = (title, options, value, onChange, extra = {}) => ({
    title,
    subtitle: extra.subtitle,
    section: extra.section,
    kind: 'choice',
    content: <ChoiceList options={options} value={value} onChange={onChange} />,
    canAdvance: !!value
  });

  const fieldStep = (title, value, onChange, extra = {}) => ({
    title,
    subtitle: extra.subtitle,
    kind: 'field',
    content: (
      <input
        type={extra.type || 'text'}
        inputMode={extra.inputMode}
        placeholder={extra.placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        autoFocus
        className={fieldInputClass}
        style={fieldInputStyle}
      />
    ),
    canAdvance: !!(value && value.toString().trim())
  });

  const measurementStep = (title, measureType, value, onChange) => ({
    title,
    kind: 'measurement',
    content: <MeasurementSlider type={measureType} value={value} onChange={onChange} />,
    canAdvance: true
  });

  const cityStep = (title, value, onChange) => ({
    title,
    kind: 'city',
    content: <CityInput value={value} onChange={onChange} />,
    canAdvance: !!(value && value.trim())
  });

  // Rewires the last step of a category's array so its Next button returns to
  // the hub instead of walking off the end of a now-category-scoped step list.
  const finalizeSteps = (arr, advance) => {
    if (arr.length === 0) return arr;
    const lastIdx = arr.length - 1;
    const last = { ...arr[lastIdx] };
    last.onNext = advance;
    return [...arr.slice(0, lastIdx), last];
  };

  const uploadStep = ({ title, subtitle, isUploading, error, hasReport, testCoverage, onUpload, onMock, required, advance }) => ({
    title,
    subtitle,
    kind: 'upload',
    canAdvance: required ? !!hasReport : true,
    onNext: advance,
    onSkip: required ? undefined : advance,
    content: (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onUpload}
          className="w-full py-4 rounded-xl border-2 font-semibold text-sm transition-colors duration-150"
          style={{
            borderColor: hasReport ? 'var(--teal)' : 'var(--line)',
            background: hasReport ? 'var(--soft-teal)' : 'var(--surface)',
            color: hasReport ? 'var(--teal-d)' : 'var(--ink)'
          }}
        >
          {isUploading ? 'Parsing PDF…' : hasReport ? 'Report uploaded ✓' : 'Upload PDF'}
        </button>
        <button
          type="button"
          onClick={onMock}
          className="text-xs font-medium underline block mx-auto transition-opacity duration-150 hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          Use a mock report instead
        </button>
        {error && <p className="text-xs font-medium text-center" style={{ color: 'var(--danger-d)' }}>{error}</p>}
        {hasReport && <TestCoverageSummary coverage={testCoverage} />}
      </div>
    )
  });

  // ---- Category step builders (person-agnostic; take a form/setForm pair) ----
  const buildAboutSteps = (adapter, advance) => {
    const { form, setForm, nameField, genderField, dobField, cityField, isSelfPerson, needsNameStep } = adapter;
    const set = (patch) => setForm({ ...form, ...patch });
    const arr = [];

    // The prospect's name is always collected on the routing screen before this hub
    // is reached; the "self" candidate only needs it here when someone else (a
    // parent/sibling/etc.) is filling the form in on the candidate's behalf.
    if (needsNameStep) {
      arr.push(fieldStep("What's their name?", form[nameField], (v) => set({ [nameField]: v }), { placeholder: 'Enter their name' }));
    }
    arr.push(choiceStep('Gender', GENDERS, form[genderField], (v) => set({ [genderField]: v })));
    arr.push(fieldStep('Date of Birth', form[dobField], (v) => set({ [dobField]: v }), { type: 'date' }));
    arr.push(cityStep('City', form[cityField], (v) => set({ [cityField]: v })));
    arr.push(measurementStep('Height', 'height', form.height, (v) => set({ height: v })));
    arr.push(measurementStep('Weight', 'weight', form.weight, (v) => set({ weight: v })));
    arr.push(measurementStep('Waist', 'waist', form.waist, (v) => set({ waist: v })));

    if (isSelfPerson) {
      arr.push(choiceStep('How did you meet?', MEETING_SOURCES, prospectForm.meetingSource, (v) => setProspectForm({
        ...prospectForm,
        meetingSource: v,
        platformName: v !== 'Matrimonial Platform' ? '' : prospectForm.platformName
      })));
      if (prospectForm.meetingSource === 'Matrimonial Platform') {
        arr.push(choiceStep('Which platform?', MATRIMONIAL_PLATFORMS, prospectForm.platformName, (v) => setProspectForm({ ...prospectForm, platformName: v })));
      }
      arr.push(choiceStep('Relationship Status', RELATIONSHIP_STATUSES, form.relationshipStatus, (v) => set({ relationshipStatus: v })));
    }

    return finalizeSteps(arr, advance);
  };

  const buildLifestyleSteps = (form, setForm, advance) => {
    const set = (patch) => setForm({ ...form, ...patch });
    const arr = [
      choiceStep('Physical Activity Level', LIFESTYLE_ACTIVITIES, form.activity_level, (v) => set({ activity_level: v })),
      choiceStep('Alcohol Drinking Habits', LIFESTYLE_DRINKING, form.drinking_habits, (v) => set({ drinking_habits: v })),
      choiceStep('Smoking & Tobacco Habits', LIFESTYLE_SMOKING_TOBACCO, form.smoking_habits, (v) => set({ smoking_habits: v })),
      choiceStep('Sleep Cycle Patterns', LIFESTYLE_SLEEP, form.sleep_cycle, (v) => set({ sleep_cycle: v })),
      choiceStep('Family History of Diabetes', FAMILY_HISTORY_DIABETES, form.parentDiabetes, (v) => set({ parentDiabetes: v }))
    ];
    if (form.gender === 'Female' || form.candidateGender === 'Female') {
      arr.push(choiceStep('Menstrual Cycle Status', LIFESTYLE_MENSTRUAL, form.menstrualCycle, (v) => set({ menstrualCycle: v }), { subtitle: 'Optional' }));
    }
    return finalizeSteps(arr, advance);
  };

  // Mental health: entering a subcategory from the sub-hub walks just that
  // subcategory's own questions (2-6 of them), then returns to the sub-hub —
  // no more flat 21-question walk with a nested "section within section" bar.
  const buildMentalSteps = (categoryKey, answers, setAnswers, advance) => {
    const questions = MENTAL_HEALTH_QUESTIONS.filter((q) => q.category === categoryKey);
    const arr = questions.map((q) =>
      choiceStep(q.title, q.options, answers[q.id], (v) => setAnswers({ ...answers, [q.id]: v }), { subtitle: q.desc })
    );
    return finalizeSteps(arr, advance);
  };

  // ---- Progress calculations for the hub (shared with the dashboard's cards) ----
  const aboutProgress = (adapter) => aboutProgressShared(adapter, prospectForm);
  const aboutCounts = (adapter) => aboutCountsShared(adapter, prospectForm);

  // ---- Build category set for whichever person is active ----
  const selfAdapter = {
    form: onboardingForm, setForm: setOnboardingForm,
    nameField: 'candidateName', genderField: 'candidateGender', dobField: 'candidateDob', cityField: 'candidateCity',
    isSelfPerson: true,
    // If the account holder is filling this in on behalf of someone else
    // (parent/sibling/etc.), that candidate's name still needs collecting here.
    needsNameStep: !isSelf
  };
  const prospectAdapter = {
    form: prospectForm, setForm: setProspectForm,
    nameField: 'name', genderField: 'gender', dobField: 'dob', cityField: 'city',
    isSelfPerson: false,
    needsNameStep: false // always collected on the routing screen before this hub is reached
  };

  const buildCategories = (person) => {
    const isSelfTurn = person === 'self';
    const adapter = isSelfTurn ? selfAdapter : prospectAdapter;
    const label = isSelfTurn ? 'you' : (prospectForm.name || 'your prospect');

    const aboutC = aboutCounts(adapter);
    const lifestyleC = lifestyleCounts(adapter.form);
    const mentalAnswersForPerson = isSelfTurn ? selfMentalAnswers : prospectMentalAnswers;
    const rawMentalC = mentalCounts(mentalAnswersForPerson);

    // Pathology/mental answers live only in this tab's React state plus a
    // device-local draft — unlike About/Lifestyle they're never rehydrated
    // from the backend on a fresh session, so a returning user would see
    // "Start" here even with real data on file. Scoped to self only: a
    // completed match is durable proof self's report/mental data existed
    // (matches can't be created without both reports, and mentalResult is
    // only ever non-null once mental was completed) — but that evidence
    // says nothing about a *different*, not-yet-matched prospect, so it
    // never applies to the prospect adapter.
    const hasPathologyEvidence = isSelfTurn && !!(matchesList && matchesList.length > 0);
    const hasMentalEvidence = isSelfTurn && !!(matchesList && matchesList.some((m) => m?.analysis?.mentalResult));
    const mentalC = hasMentalEvidence ? { answered: rawMentalC.total, total: rawMentalC.total } : rawMentalC;

    return [
      {
        key: 'about', label: isSelfTurn ? 'About You' : `About ${prospectForm.name || 'Your Prospect'}`,
        desc: 'Basics, body & relationship context', icon: UserRound,
        progress: aboutProgress(adapter), answered: aboutC.answered, total: aboutC.total, required: true
      },
      {
        key: 'lifestyle', label: 'Lifestyle & Habits', desc: 'Activity, sleep, drinking & more', icon: HeartPulse,
        progress: lifestyleProgress(adapter.form), answered: lifestyleC.answered, total: lifestyleC.total
      },
      {
        key: 'pathology', label: 'Pathology Reports', desc: `Blood work for ${label}`, icon: FlaskConical,
        progress: isSelfTurn ? ((userReport || hasPathologyEvidence) ? 100 : 0) : (prospectReport ? 100 : 0),
        suggestedTests: SUGGESTED_PATHOLOGY_TESTS
      },
      {
        key: 'radiology', label: 'Radiology Reports', desc: `Scans for ${label}`, icon: ScanLine,
        progress: isSelfTurn ? (userRadiology ? 100 : 0) : (prospectRadiology ? 100 : 0),
        locked: !radiologyUnlocked,
        price: '₹999',
        suggestedTests: SUGGESTED_RADIOLOGY_TESTS
      },
      // Deferred/optional, not part of the core "get your first match" path —
      // sits last (before Genomics) rather than beside About/Lifestyle so it
      // isn't implied to be a required step; still always tappable here or
      // from the Analysis screen's own "Add Mental Wellbeing" pull-back CTA.
      {
        key: 'mental', label: 'Mental Wellbeing', desc: 'Optional — 21 quick questions', icon: Brain,
        progress: hasMentalEvidence ? 100 : (isSelfTurn ? mentalProgress(selfMentalAnswers) : mentalProgress(prospectMentalAnswers)),
        answered: mentalC.answered, total: mentalC.total
      },
      {
        key: 'genomics', label: 'Genomics Report', desc: 'Carrier & hereditary risk screening', icon: Dna,
        comingSoon: true, locked: true,
        suggestedTests: SUGGESTED_GENOMICS_TESTS
      }
    ];
  };

  const getCategorySteps = (categoryKey, person) => {
    const isSelfTurn = person === 'self';
    const adapter = isSelfTurn ? selfAdapter : prospectAdapter;

    if (categoryKey === 'about') return buildAboutSteps(adapter, exitToHub);
    if (categoryKey === 'lifestyle') return buildLifestyleSteps(adapter.form, adapter.setForm, exitToHub);
    if (categoryKey === 'mental') {
      const returnToSubHub = () => setActiveMentalSubcategory(null);
      return isSelfTurn
        ? buildMentalSteps(activeMentalSubcategory, selfMentalAnswers, setSelfMentalAnswers, returnToSubHub)
        : buildMentalSteps(activeMentalSubcategory, prospectMentalAnswers, setProspectMentalAnswers, returnToSubHub);
    }
    if (categoryKey === 'pathology') {
      return [uploadStep({
        title: isSelfTurn ? 'Upload your Pathology Report' : "Upload prospect's Pathology Report",
        subtitle: 'PDF with parameters like HbA1c, Lipids, AMH or Semen readings',
        isUploading: isSelfTurn ? isUserUploading : isProspectUploading,
        error: isSelfTurn ? userUploadError : prospectUploadError,
        hasReport: isSelfTurn ? !!userReport : !!prospectReport,
        testCoverage: isSelfTurn ? userReport?.testCoverage : prospectReport?.testCoverage,
        required: true,
        advance: exitToHub,
        onUpload: () => (isSelfTurn ? userFileInputRef : prospectFileInputRef).current.click(),
        onMock: () => triggerMockData(!isSelfTurn)
      })];
    }
    if (categoryKey === 'radiology') {
      return [uploadStep({
        title: isSelfTurn ? 'Upload your Radiology Report' : "Upload prospect's Radiology Report",
        subtitle: 'USG, TVS, Echo, or DEXA scans',
        isUploading: isSelfTurn ? isUserRadUploading : isProspectRadUploading,
        error: isSelfTurn ? userRadError : prospectRadError,
        hasReport: isSelfTurn ? !!userRadiology : !!prospectRadiology,
        required: false,
        advance: exitToHub,
        onUpload: () => (isSelfTurn ? userRadFileInputRef : prospectRadFileInputRef).current.click(),
        onMock: () => triggerMockRadiology(!isSelfTurn)
      })];
    }
    return [];
  };

  const isPersonReady = (person) => {
    const cats = buildCategories(person);
    const about = cats.find((c) => c.key === 'about');
    const lifestyle = cats.find((c) => c.key === 'lifestyle');
    const pathology = cats.find((c) => c.key === 'pathology');
    return about.progress >= 100 && lifestyle.progress >= 100 && pathology.progress >= 100;
  };

  if (!user) return null;

  // ---- Loading overlay while the final match is computing ----
  const isLoadingResults = isSavingProfile || isMatching;

  // ---- Invite-status timeline (unchanged legacy path) ----
  if (fillByProspect && activeInvite) {
    return (
      <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-4 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Invite Status</span>
            <button
              onClick={() => router.push('/profile')}
              className="text-xs font-medium transition-colors duration-150 hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              Profile
            </button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-2xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {renderTimeline()}
          </div>
        </div>
      </main>
    );
  }

  let body;
  let headerTitle = 'New Compatibility Check';
  if (isLoadingResults) {
    body = <AnalysisLoadingScreen active />;
  } else if (showRouting) {
    // Distinct from the initial "New Compatibility Check" engine-selection screen —
    // reusing that title here made it look like the flow was restarting from scratch
    // partway through the same session.
    headerTitle = 'Add Your Prospect';
    const routingSteps = [];
    routingSteps.push(choiceStep('How will your prospect share their details?', PROSPECT_MODE_OPTIONS, prospectMode, (v) => setProspectMode(v)));
    if (prospectMode) {
      routingSteps.push(fieldStep("What's your prospect's name?", prospectForm.name, (v) => setProspectForm({ ...prospectForm, name: v }), { placeholder: 'Enter their name' }));
    }
    if (prospectMode === 'invite') {
      routingSteps.push({
        title: 'Ready to generate your invite link?',
        subtitle: `We'll create a secure link for ${prospectForm.name || 'them'} to fill in their own details — you copy and send it yourself.`,
        canAdvance: !isSendingInvite,
        nextLabel: isSendingInvite ? 'Generating…' : 'Generate Link',
        onNext: handleCreateInviteLink,
        content: inviteError ? (
          <div className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>{inviteError}</div>
        ) : null
      });
    }

    const advanceToProspectHub = () => {
      setShowRouting(false);
      setActivePerson('prospect');
      setActiveCategory(null);
      setStepIndex(0);
    };

    // UX8-01: "self" mode previously routed straight from the name field into
    // entering the prospect's own clinical/psychological data, with zero
    // consent artifact — no prospect_invites row, no acknowledgment, nothing.
    // This step requires an explicit, logged confirmation first.
    if (prospectMode === 'self') {
      routingSteps.push({
        title: `Before you enter ${prospectForm.name || "your prospect's"} details…`,
        subtitle: `You're about to enter health information on ${prospectForm.name || 'their'} behalf, including sensitive results (STI screening, fertility markers, mental wellbeing).`,
        canAdvance: selfEntryConsentConfirmed && !isLoggingSelfEntryConsent,
        nextLabel: isLoggingSelfEntryConsent ? 'Confirming…' : 'Confirm & Continue',
        onNext: () => handleConfirmSelfEntryConsent(advanceToProspectHub),
        content: (
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
              <input
                type="checkbox"
                checked={selfEntryConsentConfirmed}
                onChange={(e) => setSelfEntryConsentConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm" style={{ color: 'var(--ink)' }}>
                I confirm I have {prospectForm.name || "my prospect's"}'s permission to enter their health information.
              </span>
            </label>
            {selfEntryConsentError ? (
              <div className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>{selfEntryConsentError}</div>
            ) : null}
          </div>
        )
      });
    }

    const clamped = Math.max(0, Math.min(stepIndex, routingSteps.length - 1));
    const step = routingSteps[clamped];
    const defaultOnNext = goNext;
    body = (
      <QuestionScreen
        key={`routing-${clamped}`}
        stepIndex={clamped}
        totalSteps={routingSteps.length}
        title={step.title}
        subtitle={step.subtitle}
        onBack={clamped > 0 ? goBack : () => { setShowRouting(false); setActiveCategory(null); }}
        onNext={step.onNext || defaultOnNext}
        nextLabel={step.nextLabel || 'Next'}
        nextDisabled={step.canAdvance === false}
      >
        {step.content}
      </QuestionScreen>
    );
  } else if (activeCategory === 'mental' && !activeMentalSubcategory) {
    headerTitle = 'Mental Wellbeing';
    const mentalAnswers = activePerson === 'self' ? selfMentalAnswers : prospectMentalAnswers;
    // Same evidence used on the hub cards (a completed match proves all 21
    // were answered before, even though the live session/draft holding the
    // actual per-question answers is gone) — without this, the card grid
    // would show every subcategory at 0/N right below a hub tile that just
    // told the user this category was already done.
    const hasMentalEvidence = activePerson === 'self' && !!(matchesList && matchesList.some((m) => m?.analysis?.mentalResult));
    const allSubcategoriesDone = hasMentalEvidence || MENTAL_HEALTH_CATEGORIES.every((c) => mentalCategoryProgress(c.key, mentalAnswers) >= 100);
    body = (
      <MentalSubHub
        answers={mentalAnswers}
        onEnter={handleEnterMentalSubcategory}
        onDone={handleMentalCategoryAdvance}
        allDone={allSubcategoriesDone}
        hasEvidence={hasMentalEvidence}
      />
    );
  } else if (activeCategory) {
    const steps = getCategorySteps(activeCategory, activePerson);
    const clamped = Math.max(0, Math.min(stepIndex, steps.length - 1));
    const step = steps[clamped];
    const isMentalSubcategory = activeCategory === 'mental' && !!activeMentalSubcategory;
    headerTitle = isMentalSubcategory
      ? MENTAL_HEALTH_CATEGORIES.find((c) => c.key === activeMentalSubcategory)?.label || 'Mental Wellbeing'
      : buildCategories(activePerson).find((c) => c.key === activeCategory)?.label || headerTitle;
    // Upload gates (pathology/radiology) are a single yes/no step, not a
    // multi-question journey — a countdown there would be meaningless noise.
    const timeLeftLabel = steps.length > 1 ? estimateTimeLeft(steps.slice(clamped)) : null;
    body = (
      <QuestionScreen
        key={`${activePerson}-${activeCategory}-${activeMentalSubcategory}-${clamped}`}
        stepIndex={clamped}
        totalSteps={steps.length}
        title={step.title}
        subtitle={step.subtitle}
        onBack={clamped > 0 ? goBack : (isMentalSubcategory ? () => setActiveMentalSubcategory(null) : handleCategoryBackOut)}
        onNext={step.onNext || goNext}
        nextLabel={step.nextLabel || 'Next'}
        nextDisabled={step.canAdvance === false}
        nextVariant={step.nextVariant}
        onSkip={step.onSkip}
        userName={onboardingForm.userName || user?.userName || user?.name}
        trustCategory={activeCategory}
        sectionInfo={step.section}
        timeLeftLabel={timeLeftLabel}
      >
        {step.content}
      </QuestionScreen>
    );
  } else {
    // Hub view for the active person
    const quotaExceeded = runsUsed >= 1;
    const ready = isPersonReady(activePerson);
    const categoriesForHub = buildCategories(activePerson);
    headerTitle = activePerson === 'self' ? 'Your Health Profile' : `${prospectForm.name || 'Prospect'}'s Health Profile`;
    const primaryLabel = activePerson === 'self'
      ? 'Continue'
      : isSavingProfile ? 'Saving…' : isMatching ? 'Generating…' : 'Generate Insights';
    const primaryDisabled = activePerson === 'self' ? !ready : (!ready || quotaExceeded);
    const primaryHint = activePerson === 'prospect' && quotaExceeded
      ? "You've used your free match. Reset your quota from the dashboard to run another."
      : matchError || undefined;
    const onPrimary = () => {
      if (activePerson === 'self') {
        setShowRouting(true);
        setStepIndex(0);
      } else {
        handleMatch();
      }
    };

    // Mobile hub = the mockup's Questionnaire view (target-to-70% bar + compact
    // section list), rendered as its own full mshell screen.
    if (isMobile) {
      const conf = computeConfidence(categoriesForHub);
      const hubSections = toMobileSections(categoriesForHub);
      return (
        <div className="mshell" data-mtheme="light" style={{ minHeight: '100dvh' }}>
          <main className="scroll" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <button
              type="button"
              onClick={handleBackToDashboard}
              aria-label="Back to Dashboard"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6, color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600 }}
            >
              <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><Ico name="chev" sm /></span>
              Dashboard
            </button>
            <h1 className="vtitle serif">{activePerson === 'self' ? 'Health profile' : `${prospectForm.name || 'Prospect'}'s profile`}</h1>
            <p className="vsub">Five sections. The engine weighs them differently — finish the heavy ones first.</p>

            <div className="target card">
              <div className="t-top"><b className="serif tnum">{conf}%</b><span>Target {RELIABLE_THRESHOLD}%</span></div>
              <div className="tbar">
                <i style={{ width: `${conf}%` }} />
                <span className="mark" style={{ left: `${RELIABLE_THRESHOLD}%` }} />
                <span className="lbl" style={{ left: `${RELIABLE_THRESHOLD}%` }}>reliable</span>
              </div>
              <p className="t-note">Below {RELIABLE_THRESHOLD}% we&apos;ll still run a check — we just flag which parts of the report are guesswork.</p>
            </div>

            <MobileSectionList
              sections={hubSections}
              compact
              onOpen={(s) => enterCategory(s.id)}
              onUnlock={(s) => { if (s.id === 'radiology') setRadiologyUnlocked(true); }}
            />

            <div style={{ marginTop: 18 }}>
              {primaryHint && <p style={{ fontSize: 12, textAlign: 'center', marginBottom: 8, color: 'var(--h-gold)' }}>{primaryHint}</p>}
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                style={{ width: '100%', height: 48, borderRadius: 15, background: 'var(--mag-600)', color: '#fff', fontWeight: 600, fontSize: 14, opacity: primaryDisabled ? 0.45 : 1 }}
              >
                {primaryLabel}
              </button>
            </div>
          </main>
          <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], false)} />
          <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], true)} />
          <input type="file" ref={userRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
          <input type="file" ref={prospectRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
        </div>
      );
    }

    body = (
      <CategoryHub
        subheading="Pick up right where you left off — each card reflects what's already saved."
        categories={categoriesForHub}
        onEnter={enterCategory}
        onUnlock={(key) => { if (key === 'radiology') setRadiologyUnlocked(true); }}
        confidenceLabel={activePerson === 'self' ? 'Your Confidence' : `${prospectForm.name || 'Prospect'}'s Confidence`}
        primaryLabel={primaryLabel}
        primaryDisabled={primaryDisabled}
        primaryHint={primaryHint}
        onPrimary={onPrimary}
      />
    );
  }

  return (
    <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-4 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>{headerTitle}</span>
        </div>

        {body}
      </div>

      <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], false)} />
      <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], true)} />
      <input type="file" ref={userRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
      <input type="file" ref={prospectRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
    </main>
  );
}
