'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ShieldAlert, ShieldCheck, Heart, Sparkles, Check, ChevronDown, 
  Upload, AlertCircle, CheckCircle, RefreshCw,
  Moon, Coffee, Footprints, Briefcase, Beer, Flame, Zap, Trophy, Calendar
} from 'lucide-react';
import { API_URL } from '../../../config/api';
import { apiFetch } from '../../../utils/api';

const LIFESTYLE_ACTIVITIES = [
  { val: 'Sedentary', label: 'Sedentary', desc: 'Little to no regular exercise', icon: Coffee },
  { val: 'Moderate', label: 'Moderate', desc: 'Light exercise 1-3 times/week', icon: Footprints },
  { val: 'Active', label: 'Active', desc: 'Exercise 3-5 times/week', icon: Zap },
  { val: 'Athletic', label: 'Athletic', desc: 'Daily intense exercise/sports', icon: Trophy }
];

const LIFESTYLE_STEPS = [
  { val: '<3,000', label: 'Less than 3,000', desc: 'Mostly sitting', icon: Footprints },
  { val: '3,000 - 5,000', label: '3,000 - 5,000', desc: 'Light walking', icon: Footprints },
  { val: '5,000 - 10,000', label: '5,000 - 10,000', desc: 'Active day', icon: Footprints },
  { val: '10,000+', label: '10,000+', desc: 'Very active', icon: Footprints }
];

const LIFESTYLE_OCCUPATIONS = [
  { val: 'Sitting 8h+', label: 'Sitting 8h+', desc: 'Desk bound, high sedentary time', icon: Briefcase },
  { val: 'Sitting 4h+', label: 'Sitting 4h+', desc: 'Moderate movement during work', icon: Briefcase },
  { val: 'travelling', label: 'Travelling', desc: 'On the move frequently', icon: Briefcase },
  { val: 'other', label: 'Other', desc: 'Varying work environment', icon: Briefcase }
];

const LIFESTYLE_DRINKING = [
  { val: 'Never', label: 'Never', desc: 'No alcohol consumption', icon: Beer },
  { val: 'socially', label: 'Socially', desc: 'Occasional drinks with company', icon: Beer },
  { val: 'regularly', label: 'Regularly', desc: 'Regular weekly drinks', icon: Beer },
  { val: 'heavily', label: 'Heavily', desc: 'High frequency/binge drinking', icon: Beer },
  { val: 'other', label: 'Other', desc: 'Varying patterns', icon: Beer }
];

const LIFESTYLE_SMOKING = [
  { val: 'never', label: 'Never', desc: 'No tobacco smoking', icon: Flame },
  { val: 'occasion', label: 'Occasion', desc: 'Occasional social smoking', icon: Flame },
  { val: 'regular', label: 'Regular', desc: 'Daily smoking', icon: Flame },
  { val: 'chain', label: 'Chain', desc: 'High frequency smoking', icon: Flame }
];

const LIFESTYLE_TOBACCO = [
  { val: 'never', label: 'Never', desc: 'No tobacco use', icon: Sparkles },
  { val: 'occasional', label: 'Occasional', desc: 'Occasional usage', icon: Sparkles },
  { val: 'regular', label: 'Regular', desc: 'Daily usage', icon: Sparkles }
];

const LIFESTYLE_SLEEP = [
  { val: 'Early Bird', label: 'Early Bird', desc: 'Sleep early, wake early', icon: Moon },
  { val: 'night owl', label: 'Night Owl', desc: 'Sleep late, wake late', icon: Moon },
  { val: 'irregular', label: 'Irregular', desc: 'Shifting sleep schedule', icon: Moon },
  { val: 'insomniac', label: 'Insomniac', desc: 'Difficulty sleeping', icon: Moon }
];

const LIFESTYLE_MENSTRUAL = [
  { val: 'Regular', label: 'Regular', desc: 'Normal cycle monthly pattern', icon: Calendar },
  { val: 'Irregular', label: 'Irregular', desc: 'Inconsistent start times', icon: Calendar },
  { val: 'Menopause', label: 'Menopause', desc: 'Permanent cessation of cycle', icon: Calendar },
  { val: 'Other', label: 'Other', desc: 'Other patterns', icon: Calendar }
];

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

  // Questionnaire States
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);

  // Lifestyle Habits States
  const [activityLevel, setActivityLevel] = useState('');
  const [dailySteps, setDailySteps] = useState('');
  const [occupationStyle, setOccupationStyle] = useState('');
  const [drinkingHabits, setDrinkingHabits] = useState('');
  const [smokingHabits, setSmokingHabits] = useState('');
  const [tobaccoHabits, setTobaccoHabits] = useState('');
  const [sleepCycle, setSleepCycle] = useState('');
  const [menstrualCycle, setMenstrualCycle] = useState('');

  // Upload Reports States
  const [pathologyFile, setPathologyFile] = useState(null);
  const [radiologyFile, setRadiologyFile] = useState(null);
  const [useMockPathology, setUseMockPathology] = useState(false);
  const [useMockRadiology, setUseMockRadiology] = useState(false);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Refs
  const genderDropdownRef = useRef(null);
  const pathFileInputRef = useRef(null);
  const radFileInputRef = useRef(null);

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  // Validate Token on Load
  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`${API_URL}/api/invite/validate/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Invitation link is invalid or expired.');
        }
        const data = await res.json();
        setInvite(data.invite);
        if (data.invite.status === 'consent_accepted') {
          setConsentDecided(true);
          setConsentAccepted(true);
        } else if (data.invite.status === 'consent_rejected') {
          setConsentDecided(true);
          setConsentAccepted(false);
        }
      } catch (err) {
        setValidationError(err.message);
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [token]);

  // Click outside listener for Gender dropdown
  useEffect(() => {
    const clickOutside = (e) => {
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(e.target)) {
        setGenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

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
      alert(err.message || 'Error recording consent. Please try again.');
    } finally {
      setIsConsentSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!dob || !city || !gender || !height || !weight || !waist || !activityLevel || !dailySteps || !occupationStyle || !drinkingHabits || !smokingHabits || !tobaccoHabits || !sleepCycle) {
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
    formData.append('daily_steps', dailySteps);
    formData.append('occupation_style', occupationStyle);
    formData.append('drinking_habits', drinkingHabits);
    formData.append('smoking_habits', smokingHabits);
    formData.append('tobacco_habits', tobaccoHabits);
    formData.append('sleep_cycle', sleepCycle);
    if (gender === 'Female' && menstrualCycle) {
      formData.append('menstrualCycle', menstrualCycle);
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
        const data = await res.json();
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
            <Sparkles size={24} style={{ color: '#28c79a' }} />
            <h1 className="text-xl font-bold text-slate-800">SlayHealth Premarital Portal</h1>
          </header>

          <div className="space-y-4 text-left">
            <div className="p-4 bg-pink-50/30 rounded-2xl border border-pink-100/50 flex items-start gap-3">
              <Heart className="text-[#DE457D] flex-shrink-0 mt-0.5" size={20} />
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
              <p>
                <strong>How SlayHealth uses your data:</strong>
                <ul className="list-disc pl-5 mt-1.5 space-y-1.5">
                  <li>To securely extract biomarkers (e.g. Hemoglobin, AMH, metabolic parameters) from your uploaded PDFs.</li>
                  <li>To run premarital and genetic compatibility matching against {invite.inviterName}'s records.</li>
                  <li>Your raw information will be processed securely using clinical ontologies. You can withdraw your consent at any time before clicking "Submit Form".</li>
                </ul>
              </p>
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

  // 2. Questionnaire & File Upload Screen Flow
  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl space-y-8 text-left">
        <header className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Sparkles size={24} style={{ color: '#28c79a' }} />
          <h1 className="text-xl font-bold text-slate-800">Premarital Onboarding Questionnaire</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Profile Details */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-sm pb-1.5 border-b border-slate-100">1. Basic Profile</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Gender</label>
                <div className="relative" ref={genderDropdownRef}>
                  <button
                    type="button"
                    className="w-full p-3 text-left border border-slate-300 rounded-lg bg-white flex justify-between items-center text-slate-900 text-sm"
                    onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                  >
                    <span>{gender || "Select Gender"}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {genderDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                      {["Male", "Female", "Other"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between text-sm"
                          onClick={() => {
                            setGender(g);
                            setGenderDropdownOpen(false);
                          }}
                        >
                          <span className={cn("font-medium", gender === g ? "text-[#DE457D]" : "text-slate-700")}>{g}</span>
                          {gender === g && <Check className="w-4 h-4 text-[#DE457D]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Height (cm)</label>
                <input
                  type="number"
                  placeholder="e.g. 165"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Waist (inches)</label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">City</label>
              <input
                type="text"
                placeholder="Enter city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 text-sm"
                required
              />
            </div>
          </div>

          {/* Section 2: Lifestyle Habits */}
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-sm pb-1.5 border-b border-slate-100">2. Lifestyle & Habits</h3>

            {/* Activity Level */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Physical Activity Level</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_ACTIVITIES.map(opt => {
                  const isSelected = activityLevel === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setActivityLevel(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Steps */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Daily Steps</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_STEPS.map(opt => {
                  const isSelected = dailySteps === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setDailySteps(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Work Style */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Occupation & Work Style</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_OCCUPATIONS.map(opt => {
                  const isSelected = occupationStyle === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setOccupationStyle(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drinking Habits */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Alcohol Consumption</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_DRINKING.map(opt => {
                  const isSelected = drinkingHabits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setDrinkingHabits(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoking Habits */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Smoking Habits</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_SMOKING.map(opt => {
                  const isSelected = smokingHabits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setSmokingHabits(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tobacco consumption */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Tobacco Consumption</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_TOBACCO.map(opt => {
                  const isSelected = tobaccoHabits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setTobaccoHabits(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sleep cycle */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase">Sleep Cycle</label>
              <div className="grid grid-cols-2 gap-3">
                {LIFESTYLE_SLEEP.map(opt => {
                  const isSelected = sleepCycle === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                        isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setSleepCycle(opt.val)}
                    >
                      <opt.icon size={16} className="text-slate-400" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menstrual cycle (conditional if female) */}
            {gender === 'Female' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase">Menstrual Cycle Status (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  {LIFESTYLE_MENSTRUAL.map(opt => {
                    const isSelected = menstrualCycle === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        className={cn(
                          "p-3 rounded-xl border text-left cursor-pointer transition-all w-full flex items-center gap-2",
                          isSelected ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]" : "border-slate-200 bg-white hover:bg-slate-50/60"
                        )}
                        onClick={() => setMenstrualCycle(opt.val)}
                      >
                        <opt.icon size={16} className="text-slate-400" />
                        <div>
                          <span className="block font-bold text-slate-800 text-xs">{opt.label}</span>
                          <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Upload Pathology Report */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-sm pb-1.5 border-b border-slate-100">3. Upload Reports</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/40 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Pathology PDF (Required)</span>
                
                <button
                  type="button"
                  onClick={() => pathFileInputRef.current.click()}
                  className={cn(
                    "w-full py-2.5 px-3 rounded-xl border font-bold text-xs transition-all",
                    pathologyFile ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {pathologyFile ? 'Report Added ✓' : 'Upload Pathology'}
                </button>
                
                <div className="flex items-center justify-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="mockPath"
                    checked={useMockPathology}
                    onChange={(e) => {
                      setUseMockPathology(e.target.checked);
                      if (e.target.checked) setPathologyFile(null);
                    }}
                    className="rounded text-[#DE457D]"
                  />
                  <label htmlFor="mockPath" className="text-[10px] text-slate-500 cursor-pointer">Use Mock Report</label>
                </div>
              </div>

              <div className="p-4 border border-dashed border-slate-300 rounded-2xl text-center bg-slate-50/40 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Radiology PDF (Optional)</span>
                
                <button
                  type="button"
                  onClick={() => radFileInputRef.current.click()}
                  className={cn(
                    "w-full py-2.5 px-3 rounded-xl border font-bold text-xs transition-all",
                    radiologyFile ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {radiologyFile ? 'Report Added ✓' : 'Upload Radiology'}
                </button>
                
                <div className="flex items-center justify-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="mockRad"
                    checked={useMockRadiology}
                    onChange={(e) => {
                      setUseMockRadiology(e.target.checked);
                      if (e.target.checked) setRadiologyFile(null);
                    }}
                    className="rounded text-[#DE457D]"
                  />
                  <label htmlFor="mockRad" className="text-[10px] text-slate-500 cursor-pointer">Use Mock Report</label>
                </div>
              </div>
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
          </div>

          {submitError && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#DE457D] hover:bg-[#c93d6f] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-pink-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                <span>Uploading & Submitting...</span>
              </>
            ) : (
              <span>Submit Health Details</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
