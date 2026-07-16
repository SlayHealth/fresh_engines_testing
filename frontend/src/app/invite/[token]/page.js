'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ShieldAlert, ShieldCheck, Heart, Sparkles, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';
import { API_URL } from '../../../config/api';
import { apiFetch, safeJson } from '../../../utils/api';
import { toast } from '../../../components/Toast';
import QuestionScreen from '../../../components/wizard/QuestionScreen';
import ChoiceList from '../../../components/wizard/ChoiceList';
import MeasurementSlider from '../../../components/wizard/MeasurementSlider';
import CityInput from '../../../components/wizard/CityInput';
import {
  LIFESTYLE_ACTIVITIES, LIFESTYLE_DRINKING,
  LIFESTYLE_SMOKING_TOBACCO, LIFESTYLE_SLEEP, LIFESTYLE_MENSTRUAL, GENDERS
} from '../../../constants/lifestyleOptions';
import { MENTAL_HEALTH_QUESTIONS, MENTAL_HEALTH_CATEGORIES } from '../../../constants/mentalHealthQuestions';
import { estimateTimeLeft } from '../../../utils/estimateTime';

const fieldInputClass = 'w-full p-4 border rounded-xl text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

export default function ProspectOnboardingPage() {
  const { token } = useParams();
  const router = useRouter();

  // Onboarding Page States
  const [isValidating, setIsValidating] = useState(true);
  const [invite, setInvite] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Consent Screen States
  const [consentDecided, setConsentDecided] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isConsentSubmitting, setIsConsentSubmitting] = useState(false);

  // Wizard position
  const [stepIndex, setStepIndex] = useState(0);

  // Questionnaire States
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');

  // Lifestyle Habits States
  const [activityLevel, setActivityLevel] = useState('');
  const [drinkingHabits, setDrinkingHabits] = useState('');
  const [smokingHabits, setSmokingHabits] = useState('');
  const [sleepCycle, setSleepCycle] = useState('');
  const [menstrualCycle, setMenstrualCycle] = useState('');

  // Optional mental health questionnaire — entering this section is the opt-in
  const [mentalAnswers, setMentalAnswers] = useState({});

  // Upload Reports States
  const [pathologyFile, setPathologyFile] = useState(null);
  const [radiologyFile, setRadiologyFile] = useState(null);
  const [useMockPathology, setUseMockPathology] = useState(false);
  const [useMockRadiology, setUseMockRadiology] = useState(false);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // UX8-03: real post-submission withdrawal — previously reloading after
  // submission re-showed the original consent gate, and rejecting there
  // falsely claimed "no data collected" while the report/profile remained
  // in the database untouched.
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);

  // Progress persistence
  const [isHydrated, setIsHydrated] = useState(false);

  // Refs
  const pathFileInputRef = useRef(null);
  const radFileInputRef = useRef(null);

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  const goNext = () => setStepIndex((i) => i + 1);
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  // Validate Token on Load
  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`${API_URL}/api/invite/validate/${token}`);
        if (!res.ok) {
          const data = await safeJson(res);
          throw new Error(data.error || 'Invitation link is invalid or expired.');
        }
        const data = await safeJson(res);
        setInvite(data.invite);
        const status = data.invite.status;
        if (status === 'consent_accepted') {
          setConsentDecided(true);
          setConsentAccepted(true);
        } else if (status === 'consent_rejected') {
          setConsentDecided(true);
          setConsentAccepted(false);
        } else if (['questionnaire_submitted', 'processing', 'completed'].includes(status)) {
          // UX8-03: any status this far along means real data was already
          // submitted — must never fall through to the original consent gate
          // again (previously only the two literal accept/reject strings were
          // recognized here, so reloading after submission silently re-showed
          // "Accept Consent / Reject Consent" as if nothing had happened).
          setConsentDecided(true);
          setConsentAccepted(true);
          setSubmitSuccess(true);
        }
      } catch (err) {
        setValidationError(err.message);
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [token]);

  // Restore persisted progress for this invite token, if any
  useEffect(() => {
    if (!token) return;
    try {
      const raw = localStorage.getItem(`slayhealth_invite_progress_${token}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.dob) setDob(saved.dob);
        if (saved.city) setCity(saved.city);
        if (saved.gender) setGender(saved.gender);
        if (saved.height) setHeight(saved.height);
        if (saved.weight) setWeight(saved.weight);
        if (saved.waist) setWaist(saved.waist);
        if (saved.activityLevel) setActivityLevel(saved.activityLevel);
        if (saved.drinkingHabits) setDrinkingHabits(saved.drinkingHabits);
        if (saved.smokingHabits) setSmokingHabits(saved.smokingHabits);
        if (saved.sleepCycle) setSleepCycle(saved.sleepCycle);
        if (saved.menstrualCycle) setMenstrualCycle(saved.menstrualCycle);
        if (saved.mentalAnswers) setMentalAnswers(saved.mentalAnswers);
        if (typeof saved.stepIndex === 'number') setStepIndex(saved.stepIndex);
      }
    } catch (err) {
      // corrupt or unavailable localStorage — proceed with a blank form
    } finally {
      setIsHydrated(true);
    }
  }, [token]);

  // Persist progress as the user answers, so a reload doesn't lose it
  useEffect(() => {
    if (!token || !isHydrated || submitSuccess) return;
    const progress = {
      dob, city, gender, height, weight, waist,
      activityLevel, drinkingHabits,
      smokingHabits, sleepCycle, menstrualCycle,
      mentalAnswers, stepIndex
    };
    try {
      localStorage.setItem(`slayhealth_invite_progress_${token}`, JSON.stringify(progress));
    } catch (err) {
      // localStorage unavailable (private mode, quota exceeded) — progress won't persist
    }
  }, [
    token, isHydrated, submitSuccess, dob, city, gender, height, weight, waist,
    activityLevel, drinkingHabits, smokingHabits,
    sleepCycle, menstrualCycle, mentalAnswers, stepIndex
  ]);

  // Clear persisted progress once the questionnaire has been submitted
  useEffect(() => {
    if (submitSuccess && token) {
      localStorage.removeItem(`slayhealth_invite_progress_${token}`);
    }
  }, [submitSuccess, token]);

  const handleConsent = async (accepted) => {
    setIsConsentSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/invite/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accepted })
      });

      if (!res.ok) throw new Error('Failed to record consent');

      setConsentDecided(true);
      setConsentAccepted(accepted);
    } catch (err) {
      toast.error(err.message || 'Error recording consent. Please try again.');
    } finally {
      setIsConsentSubmitting(false);
    }
  };

  // UX8-03: a real withdrawal request after submission — the backend now
  // actually deletes the submitted report(s) and profile fields for this
  // exact same endpoint/payload shape once it sees the invite is past
  // questionnaire_submitted, rather than just flipping a status flag.
  const handleWithdrawAfterSubmission = async () => {
    setIsWithdrawing(true);
    setWithdrawError(null);
    try {
      const res = await fetch(`${API_URL}/api/invite/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accepted: false })
      });
      if (!res.ok) throw new Error('Failed to process your request. Please try again.');
      setWithdrawn(true);
    } catch (err) {
      setWithdrawError(err.message || 'Failed to process your request. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSubmit = async () => {
    if (!dob || !city || !gender || !height || !weight || !waist || !activityLevel || !drinkingHabits || !smokingHabits || !sleepCycle) {
      setSubmitError('Please answer all required metrics and lifestyle questions.');
      return;
    }

    if (!pathologyFile && !useMockPathology) {
      setSubmitError('Please upload your Pathology Report PDF or select mock parsing.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    formData.append('token', token);
    formData.append('dob', dob);
    formData.append('city', city);
    formData.append('gender', gender);
    formData.append('height', height);
    formData.append('weight', weight);
    formData.append('waist', waist);
    formData.append('activity_level', activityLevel);
    formData.append('drinking_habits', drinkingHabits);
    formData.append('smoking_habits', smokingHabits);
    formData.append('sleep_cycle', sleepCycle);
    if (gender === 'Female' && menstrualCycle) {
      formData.append('menstrualCycle', menstrualCycle);
    }
    if (Object.keys(mentalAnswers).length > 0) {
      formData.append('mentalAnswers', JSON.stringify(mentalAnswers));
    }

    if (pathologyFile) {
      formData.append('pathologyReport', pathologyFile);
    } else {
      formData.append('useMockPathology', 'true');
    }

    if (radiologyFile) {
      formData.append('radiologyReport', radiologyFile);
    } else if (useMockRadiology) {
      formData.append('useMockRadiology', 'true');
    }

    try {
      const res = await fetch(`${API_URL}/api/invite/submit`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || 'Failed to submit questionnaire');
      }

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-[#DE457D]" size={36} />
        <span className="text-slate-500 font-semibold text-sm">Verifying invitation link...</span>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-5">
          <div className="inline-flex p-4 bg-rose-50 text-rose-500 rounded-full mx-auto">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Invalid Link</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {validationError}
          </p>
          <p className="text-xs text-slate-400">
            Please ask your partner to send a new invitation link.
          </p>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    // UX8-03: a real, working post-submission withdrawal — this actually
    // deletes the submitted report(s) and profile data server-side, so this
    // confirmation is true rather than a status flag with nothing behind it.
    if (withdrawn) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-6">
            <div className="inline-flex p-4 bg-emerald-50 text-emerald-500 rounded-full mx-auto">
              <CheckCircle size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Your Data Has Been Deleted</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your submitted reports and profile details have been permanently removed from SlayHealth. No compatibility analysis will be run using your information.
            </p>
            <p className="text-[11px] text-slate-400">
              You can close this tab now.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-6">
          <div className="inline-flex p-4 bg-emerald-50 text-emerald-500 rounded-full mx-auto">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Details Submitted!</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Thank you, {invite.prospectName}! Your lifestyle questionnaire and health reports have been successfully submitted.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 leading-relaxed text-left">
            <strong>What happens next?</strong> SlayHealth's clinical match matrix will now analyze your reports and basic metrics in the background. Your partner will receive the compatibility insights directly on their dashboard in real-time.
          </div>
          <p className="text-[11px] text-slate-400">
            You can close this tab now.
          </p>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 mb-2">
              Changed your mind? You can ask SlayHealth to delete what you submitted.
            </p>
            <button
              onClick={handleWithdrawAfterSubmission}
              disabled={isWithdrawing}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
            >
              {isWithdrawing ? 'Deleting your data…' : 'Delete my submitted data'}
            </button>
            {withdrawError ? (
              <p className="text-[11px] text-rose-500 mt-2">{withdrawError}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // 1. Consent Screen Flow
  if (!consentDecided) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl space-y-6">
          <header style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={24} style={{ color: '#18CC96' }} />
            <h1 className="text-xl font-bold text-slate-800">SlayHealth Premarital Portal</h1>
          </header>

          <div className="space-y-4 text-left">
            <div className="p-4 bg-pink-50/30 rounded-2xl border border-pink-100/50 flex items-start gap-3">
              <Heart className="text-[#DE457D] shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Health Compatibility Request</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  <strong>{invite.inviterName}</strong> has invited you ({invite.prospectName}) to share your health details to generate a reproductive and metabolic compatibility match score.
                </p>
              </div>
            </div>

            <h3 className="font-bold text-slate-800 text-sm mt-6">Consent & Data Handling Disclosure</h3>

            <div className="space-y-3 text-xs text-slate-500 leading-relaxed">
              <p>
                By accepting this invitation, you agree to submit your basic clinical details, lifestyle habits, and upload your pathology/radiology reports (PDF) to the SlayHealth portal.
              </p>
              <div>
                <strong>How SlayHealth uses your data:</strong>
                <ul className="list-disc pl-5 mt-1.5 space-y-1.5">
                  <li>To securely extract biomarkers (e.g. Hemoglobin, AMH, metabolic parameters) from your uploaded PDFs.</li>
                  <li>To run premarital and genetic compatibility matching against {invite.inviterName}'s records.</li>
                  <li>Your raw information will be processed securely using clinical ontologies. You can withdraw your consent at any time before clicking "Submit Form".</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => handleConsent(false)}
              disabled={isConsentSubmitting}
              className="py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm transition-all hover:bg-slate-50 disabled:opacity-50"
            >
              Reject Consent
            </button>
            <button
              onClick={() => handleConsent(true)}
              disabled={isConsentSubmitting}
              className="py-3 px-4 rounded-xl bg-[#DE457D] hover:bg-[#c93d6f] disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
            >
              {isConsentSubmitting ? 'Recording...' : 'Accept Consent'}
              <ShieldCheck size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If consent was rejected
  if (consentDecided && !consentAccepted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center space-y-5">
          <div className="inline-flex p-4 bg-rose-50 text-rose-500 rounded-full mx-auto">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Consent Declined</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            You rejected the consent terms. SlayHealth will not collect your health details or run compatibility testing.
          </p>
          <p className="text-xs text-slate-400">
            You can close this tab now.
          </p>
        </div>
      </div>
    );
  }

  // ---- Wizard step builders ----
  const choiceStep = (title, options, value, onChange, extra = {}) => ({
    title,
    subtitle: extra.subtitle,
    category: extra.category,
    section: extra.section,
    kind: 'choice',
    content: <ChoiceList options={options} value={value} onChange={onChange} />,
    canAdvance: !!value
  });

  const fieldStep = (title, value, onChange, extra = {}) => ({
    title,
    subtitle: extra.subtitle,
    category: extra.category,
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

  const measurementStep = (title, measureType, value, onChange, category) => ({
    title,
    category,
    kind: 'measurement',
    content: <MeasurementSlider type={measureType} value={value} onChange={onChange} />,
    canAdvance: true
  });

  // 2. Questionnaire & File Upload wizard
  const steps = [
    choiceStep('Gender', GENDERS, gender, setGender, { category: 'about' }),
    fieldStep('Date of Birth', dob, setDob, { type: 'date', category: 'about' }),
    {
      title: 'City',
      category: 'about',
      kind: 'city',
      content: <CityInput value={city} onChange={setCity} />,
      canAdvance: !!(city && city.trim())
    },
    measurementStep('Height', 'height', height, setHeight, 'about'),
    measurementStep('Weight', 'weight', weight, setWeight, 'about'),
    measurementStep('Waist', 'waist', waist, setWaist, 'about'),
    choiceStep('Physical Activity Level', LIFESTYLE_ACTIVITIES, activityLevel, setActivityLevel, { category: 'lifestyle' }),
    choiceStep('Alcohol Drinking Habits', LIFESTYLE_DRINKING, drinkingHabits, setDrinkingHabits, { category: 'lifestyle' }),
    choiceStep('Smoking & Tobacco Habits', LIFESTYLE_SMOKING_TOBACCO, smokingHabits, setSmokingHabits, { category: 'lifestyle' }),
    choiceStep('Sleep Cycle Patterns', LIFESTYLE_SLEEP, sleepCycle, setSleepCycle, { category: 'lifestyle' })
  ];

  if (gender === 'Female') {
    steps.push(choiceStep('Menstrual Cycle Status', LIFESTYLE_MENSTRUAL, menstrualCycle, setMenstrualCycle, { subtitle: 'Optional', category: 'lifestyle' }));
  }

  steps.push({
    title: 'Upload your Pathology Report',
    subtitle: 'Required — PDF with your blood/pathology parameters',
    category: 'pathology',
    kind: 'upload',
    canAdvance: !!pathologyFile || useMockPathology,
    content: (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => pathFileInputRef.current.click()}
          className="w-full py-4 rounded-xl border font-semibold text-sm transition-colors duration-150"
          style={{
            borderColor: pathologyFile ? 'var(--teal)' : 'var(--line)',
            background: pathologyFile ? 'var(--soft-teal)' : 'var(--surface)',
            color: pathologyFile ? 'var(--teal-d)' : 'var(--ink)'
          }}
        >
          {pathologyFile ? 'Report added ✓' : 'Upload PDF'}
        </button>
        <label className="flex items-center justify-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useMockPathology}
            onChange={(e) => {
              setUseMockPathology(e.target.checked);
              if (e.target.checked) setPathologyFile(null);
            }}
            className="rounded"
            style={{ accentColor: 'var(--teal)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Use a mock report instead</span>
        </label>
      </div>
    )
  });

  steps.push({
    title: 'Upload your Radiology Report',
    subtitle: 'Optional — USG, TVS, Echo, or DEXA scans',
    category: 'radiology',
    kind: 'upload',
    canAdvance: true,
    onSkip: goNext,
    content: (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => radFileInputRef.current.click()}
          className="w-full py-4 rounded-xl border font-semibold text-sm transition-colors duration-150"
          style={{
            borderColor: radiologyFile ? 'var(--teal)' : 'var(--line)',
            background: radiologyFile ? 'var(--soft-teal)' : 'var(--surface)',
            color: radiologyFile ? 'var(--teal-d)' : 'var(--ink)'
          }}
        >
          {radiologyFile ? 'Report added ✓' : 'Upload PDF'}
        </button>
        <label className="flex items-center justify-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useMockRadiology}
            onChange={(e) => {
              setUseMockRadiology(e.target.checked);
              if (e.target.checked) setRadiologyFile(null);
            }}
            className="rounded"
            style={{ accentColor: 'var(--teal)' }}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Use a mock report instead</span>
        </label>
      </div>
    )
  });

  // Optional mental health block — no separate opt-in screen; the first
  // question itself offers a "Skip this section" out (straight to submit),
  // and its last question carries the final Submit trigger.
  const mentalSteps = MENTAL_HEALTH_QUESTIONS.map((q) => {
    const cat = MENTAL_HEALTH_CATEGORIES[q.sectionIndex];
    return choiceStep(q.title, q.options, mentalAnswers[q.id], (v) => setMentalAnswers({ ...mentalAnswers, [q.id]: v }), {
      subtitle: q.desc,
      category: 'mental',
      section: {
        label: cat.label, color: cat.color, soft: cat.soft,
        index: q.sectionIndex, total: MENTAL_HEALTH_CATEGORIES.length,
        position: q.sectionPosition, length: q.sectionLength,
        allColors: MENTAL_HEALTH_CATEGORIES.map((c) => c.color)
      }
    });
  });
  mentalSteps[0].onSkip = handleSubmit;
  mentalSteps[0].skipLabel = isSubmitting ? 'Submitting…' : 'Skip this section';
  const lastMentalStep = mentalSteps[mentalSteps.length - 1];
  lastMentalStep.nextLabel = isSubmitting ? 'Submitting…' : 'Submit Health Details';
  lastMentalStep.nextVariant = 'pink';
  lastMentalStep.onNext = handleSubmit;
  lastMentalStep.canAdvance = lastMentalStep.canAdvance !== false && !isSubmitting;
  if (submitError) {
    lastMentalStep.content = (
      <div className="space-y-3">
        {lastMentalStep.content}
        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {submitError}
        </div>
      </div>
    );
  }
  steps.push(...mentalSteps);

  const clampedIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const currentStep = steps[clampedIndex];
  // How many earlier steps share this step's category — keeps each section's
  // trust message starting fresh at index 0 instead of a raw flow-wide index.
  const trustSeed = steps.slice(0, clampedIndex).filter((s) => s.category === currentStep.category).length;
  const timeLeftLabel = estimateTimeLeft(steps.slice(clampedIndex));

  return (
    <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-5 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-5 overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-4 shrink-0">
          <Sparkles className="w-5 h-5" style={{ color: 'var(--pink)' }} />
          <span className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Premarital Onboarding Questionnaire</span>
        </div>

        <QuestionScreen
          key={clampedIndex}
          stepIndex={clampedIndex}
          totalSteps={steps.length}
          title={currentStep.title}
          subtitle={currentStep.subtitle}
          onBack={clampedIndex > 0 ? goBack : undefined}
          onNext={currentStep.onNext || goNext}
          nextLabel={currentStep.nextLabel || 'Next'}
          nextDisabled={currentStep.canAdvance === false}
          userName={invite?.prospectName}
          trustCategory={currentStep.category}
          trustSeed={trustSeed}
          sectionInfo={currentStep.section}
          timeLeftLabel={timeLeftLabel}
        >
          {currentStep.content}
        </QuestionScreen>
      </div>

      <input
        type="file"
        ref={pathFileInputRef}
        style={{ display: 'none' }}
        accept=".pdf"
        onChange={(e) => {
          if (e.target.files[0]) {
            setPathologyFile(e.target.files[0]);
            setUseMockPathology(false);
          }
        }}
      />
      <input
        type="file"
        ref={radFileInputRef}
        style={{ display: 'none' }}
        accept=".pdf"
        onChange={(e) => {
          if (e.target.files[0]) {
            setRadiologyFile(e.target.files[0]);
            setUseMockRadiology(false);
          }
        }}
      />
    </main>
  );
}
