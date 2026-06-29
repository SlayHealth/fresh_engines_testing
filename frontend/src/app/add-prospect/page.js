'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, LogOut, Activity, MessageSquare, User, Lock, 
  MapPin, Heart, ChevronDown, Check, ArrowLeft, ArrowRight,
  FlaskConical, AlertCircle, RefreshCw, Trophy, Zap, Footprints,
  Briefcase, Beer, Moon, Flame, Coffee, Calendar, Users, ShieldCheck,
  Share2, Send, CheckCircle, XCircle
} from 'lucide-react';
import { useCompatibility, calculateAge, classifyWaist } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import styles from '../page.module.css';

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

const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' }
];

export default function AddProspectPage() {
  const router = useRouter();
  const [fillByProspect, setFillByProspect] = useState(false);
  const [prospectCountry, setProspectCountry] = useState('+91');
  const [prospectPhoneInput, setProspectPhoneInput] = useState('');
  const [activeInvite, setActiveInvite] = useState(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [matchRunError, setMatchRunError] = useState(null);

  const { 
    user, 
    runsUsed, 
    chatsUsed, 
    isUpgradingQuota, 
    handleResetQuota, 
    handleLogout,
    prospectForm, 
    setProspectForm,
    userReport, 
    setUserReport,
    prospectReport, 
    setProspectReport,
    isUserUploading, 
    setIsUserUploading,
    isProspectUploading, 
    setIsProspectUploading,
    userUploadError, 
    setUserUploadError,
    prospectUploadError, 
    setProspectUploadError,
    isMatching,
    matchError, 
    setMatchError,
    handleCompatibilityMatch
  } = useCompatibility();

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  // Dropdown States
  const [isProspectGenderDropdownOpen, setIsProspectGenderDropdownOpen] = useState(false);
  const [isMeetingDropdownOpen, setIsMeetingDropdownOpen] = useState(false);
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);

  // Radiology States
  const [userRadiology, setUserRadiology] = useState(null);
  const [prospectRadiology, setProspectRadiology] = useState(null);
  const [isUserRadUploading, setIsUserRadUploading] = useState(false);
  const [isProspectRadUploading, setIsProspectRadUploading] = useState(false);
  const [userRadError, setUserRadError] = useState(null);
  const [prospectRadError, setProspectRadError] = useState(null);

  // Refs
  const prospectGenderDropdownRef = useRef(null);
  const meetingDropdownRef = useRef(null);
  const platformDropdownRef = useRef(null);
  const userFileInputRef = useRef(null);
  const prospectFileInputRef = useRef(null);
  const userRadFileInputRef = useRef(null);
  const prospectRadFileInputRef = useRef(null);

  // Radiology Upload Handler
  const handleRadiologyUpload = async (file, isProspect) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid radiology report (PDF).');
      return;
    }

    if (isProspect) {
      if (!prospectForm.name || !prospectForm.gender || !prospectForm.dob) {
        alert("Please enter the prospect's Name, Gender, and DOB first so we can parse and store their radiology report correctly.");
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
      : (user.gender.toLowerCase() === 'male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(user.dob);
    const nameVal = isProspect ? prospectForm.name : user.name;

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
        alert("Please enter the prospect's Name, Gender, and DOB first.");
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
      : (user.gender.toLowerCase() === 'male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(user.dob);
    const nameVal = isProspect ? prospectForm.name : user.name;

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
            setFillByProspect(true);
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
          console.log(`SSE Update received: ${data.status}`);
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
            setTimeout(() => {
              router.push('/core-engine/chronic');
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

  const handleSendInvite = async () => {
    if (!prospectForm.name || !prospectPhoneInput) {
      alert("Please enter the prospect's name and WhatsApp number first.");
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);

    const fullPhone = `${prospectCountry}${prospectPhoneInput.replace(/\D/g, '')}`;

    try {
      const res = await apiFetch(`${API_URL}/api/invite/send`, {
        method: 'POST',
        body: JSON.stringify({
          prospectName: prospectForm.name,
          prospectPhone: fullPhone
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      const data = await res.json();
      setActiveInvite(data.invite);
    } catch (err) {
      setInviteError(err.message || 'Failed to send invite');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!activeInvite) return;
    if (!confirm("Are you sure you want to revoke this invitation? The link will become immediately invalid.")) return;

    try {
      const res = await apiFetch(`${API_URL}/api/invite/revoke/${activeInvite.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        setActiveInvite(null);
        setProspectPhoneInput('');
      } else {
        alert("Failed to revoke invite");
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

    const steps = [
      { key: 'sent', label: 'Invite Sent', desc: 'Message sent via WhatsApp', activeStates: ['sent', 'delivered', 'opened', 'consent_pending', 'consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'delivered', label: 'Delivered', desc: 'Received on prospect\'s phone', activeStates: ['delivered', 'opened', 'consent_pending', 'consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'opened', label: 'Opened', desc: 'Prospect opened the invite link', activeStates: ['opened', 'consent_pending', 'consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'consent', label: 'Consent Decision', desc: status === 'consent_rejected' ? 'Consent Rejected ✗' : 'Consent Accepted ✓', activeStates: ['consent_accepted', 'consent_rejected', 'questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'], isError: status === 'consent_rejected' },
      { key: 'started', label: 'Filling Form', desc: 'Prospect is answering questions', activeStates: ['questionnaire_started', 'questionnaire_submitted', 'processing', 'completed'] },
      { key: 'submitted', label: 'Form Submitted', desc: 'Details and reports received', activeStates: ['questionnaire_submitted', 'processing', 'completed'] },
      { key: 'processing', label: 'AI Compatibility Matching', desc: status === 'failed' ? 'Analysis Failed ✗' : 'Running health scan', activeStates: ['processing', 'completed', 'failed'], isError: status === 'failed', isSpinning: status === 'processing' },
      { key: 'completed', label: 'Completed', desc: 'Results ready', activeStates: ['completed'] }
    ];

    return (
      <div className="space-y-6 mt-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Live Onboarding Status</h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-50 text-[#DE457D] capitalize animate-pulse">
            {status.replace('_', ' ')}
          </span>
        </div>

        <div className="relative border-l-2 border-slate-200 ml-3.5 space-y-6">
          {steps.map((step) => {
            const isDone = step.activeStates.includes(status);
            const isCurrent = status === step.key || (step.key === 'consent' && ['consent_accepted', 'consent_rejected'].includes(status)) || (step.key === 'processing' && ['processing', 'failed'].includes(status));
            
            return (
              <div key={step.key} className="relative pl-6">
                <div className={cn(
                  "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                  step.isError 
                    ? "bg-rose-500 border-rose-500 text-white"
                    : isDone
                      ? "bg-[#DE457D] border-[#DE457D] text-white"
                      : "bg-white border-slate-300"
                )}>
                  {step.isSpinning && (
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#DE457D]" />
                  )}
                </div>

                <div className="text-left">
                  <span className={cn(
                    "block text-xs font-bold",
                    step.isError
                      ? "text-rose-600"
                      : isDone
                        ? "text-slate-800"
                        : "text-slate-400"
                  )}>
                    {step.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {step.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {status === 'failed' && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium text-left">
            <strong>Delivery or Analysis Failed:</strong> We encountered an error dispatching the invite or processing reports. Please revoke this link and try again.
          </div>
        )}

        {status === 'consent_rejected' && (
          <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium text-left">
            <strong>Invitation Declined:</strong> The prospect has rejected consent to share their health data. You can revoke this link and send a new invite if desired.
          </div>
        )}

        {status === 'completed' && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium text-left flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 animate-bounce" />
            <span><strong>Scan Complete!</strong> Redirecting to the match results...</span>
          </div>
        )}

        {(status === 'questionnaire_submitted' || status === 'failed') && (
          <div className="p-3.5 bg-[#DE457D]/5 border border-[#DE457D]/20 rounded-xl text-left space-y-2.5">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              <strong>Questionnaire Received!</strong> The prospect has uploaded their medical parameters. Run the compatibility match scan now.
            </p>
            {matchRunError && (
              <span className="text-[10px] text-rose-500 block font-semibold">{matchRunError}</span>
            )}

            {!userReport && matchesList.length === 0 && (
              <p className="text-[10px] text-amber-600 font-semibold leading-normal">
                ⚠️ Please upload your own Pathology PDF under "Your Information" on the left first to run the scan.
              </p>
            )}

            <button
              type="button"
              onClick={handleRunMatch}
              disabled={isRunningMatch || (!userReport && matchesList.length === 0)}
              className="w-full py-2 bg-[#DE457D] hover:bg-[#c93d6f] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all"
            >
              {isRunningMatch ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Starting Health Scan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Compatibility Match Scan</span>
                </>
              )}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleRevokeInvite}
          className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
        >
          Revoke Invitation Link
        </button>
      </div>
    );
  };

  // Click outside dropdowns handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (prospectGenderDropdownRef.current && !prospectGenderDropdownRef.current.contains(event.target)) {
        setIsProspectGenderDropdownOpen(false);
      }
      if (meetingDropdownRef.current && !meetingDropdownRef.current.contains(event.target)) {
        setIsMeetingDropdownOpen(false);
      }
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target)) {
        setIsPlatformDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute User BMI dynamically
  const userBmi = useMemo(() => {
    if (!user || !user.weight || !user.height) return null;
    const heightInMeters = user.height / 100;
    return parseFloat((user.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }, [user]);

  // File Upload parsing
  const handleFileUpload = async (file, isProspect) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid pathology report (PDF).');
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
    const success = await handleCompatibilityMatch();
    if (success) {
      router.push('/core-engine/chronic');
    }
  };

  if (!user) return null;

  return (
    <main className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Portal Header */}
      <header className={styles.portalHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} style={{ color: '#28c79a' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#2b2b3f', margin: 0 }}>SlayHealth Premarital Portal</h1>
        </div>
        
        <div className={styles.userInfoBadge}>
          <div className={styles.userAvatar}>
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#2b2b3f' }}>{user.name || 'User Profile'}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{user.phone_number}</span>
          </div>
          <button className={styles.logoutBtn} onClick={() => { handleLogout(); router.push('/'); }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Free Tier Quota Panel */}
      <section className={styles.quotaWidget}>
        <div className={styles.quotaText}>
          <h3 className={styles.quotaTitle}>Free Plan Active</h3>
          <p className={styles.quotaSubtitle}>Enrolled by default. Experience our clinical match matrix and counselor chat.</p>
        </div>

        <div className={styles.quotaBadgesList}>
          <span className={styles.quotaLimitBadge}>
            <Activity size={14} style={{ color: '#28c79a' }} />
            Match scan left: <strong>{Math.max(0, 1 - runsUsed)}/1</strong>
          </span>
          <span className={styles.quotaLimitBadge}>
            <MessageSquare size={14} style={{ color: '#d94386' }} />
            Counselor chat left: <strong>{Math.max(0, 5 - chatsUsed)}/5</strong>
          </span>
          
          {(runsUsed > 0 || chatsUsed > 0) && (
            <button 
              className={styles.upgradeTextBtn} 
              onClick={handleResetQuota}
              disabled={isUpgradingQuota}
            >
              {isUpgradingQuota ? 'Resetting...' : 'Reset Quota / Demo Premium'}
            </button>
          )}
        </div>
      </section>

      {/* Add Prospect Workspace */}
      <div className="max-w-4xl mx-auto mt-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">New Compatibility Check</h1>
          <p className="text-slate-600 font-medium text-sm">Add your prospect's details and medical reports to begin the match scan</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Your Information (Locked) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-fit text-left">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
              <User className="w-5 h-5 text-primary" style={{ color: '#DE457D' }} />
              <h2 className="text-lg font-bold text-slate-900">Your Information</h2>
              <Lock className="w-4 h-4 text-slate-400 ml-auto" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                  {user.name}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Age</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                    {calculateAge(user.dob)} Yrs
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gender</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium capitalize">
                    {user.gender}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">City</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium capitalize">
                    {user.city}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">BMI</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                    {userBmi} ({userBmi >= 25 ? 'High' : userBmi >= 23 ? 'Borderline' : 'Normal'})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Prospect Information Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5 text-left h-fit">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-500" />
                <h2 className="text-lg font-bold text-slate-900">Prospect Information</h2>
              </div>
              
              {!activeInvite && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fillByProspect}
                    onChange={(e) => setFillByProspect(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#DE457D] relative"></div>
                  <span className="text-xs font-semibold text-slate-600">Invite via WhatsApp</span>
                </label>
              )}
            </div>

            {fillByProspect ? (
              activeInvite ? (
                renderTimeline()
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter the prospect's name and WhatsApp number. We will send them a secure temporary link to fill their profile details and upload their own reports.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Prospect's Name</label>
                    <input
                      type="text"
                      placeholder="Enter prospect's name"
                      value={prospectForm.name || ''}
                      onChange={(e) => setProspectForm({ ...prospectForm, name: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">WhatsApp Phone Number</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={prospectCountry}
                        onChange={(e) => setProspectCountry(e.target.value)}
                        className="p-3 border border-slate-300 rounded-lg outline-none bg-white text-slate-900 cursor-pointer min-w-[95px] text-sm"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={prospectPhoneInput}
                        onChange={(e) => setProspectPhoneInput(e.target.value)}
                        className="flex-1 p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 text-xs font-medium">
                      {inviteError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSendInvite}
                    disabled={isSendingInvite || !prospectForm.name || !prospectPhoneInput}
                    className="w-full mt-2 py-3 bg-[#DE457D] hover:bg-[#c93d6f] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    {isSendingInvite ? 'Sending...' : 'Send WhatsApp Invite'}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="Enter prospect's name"
                    value={prospectForm.name || ''}
                    onChange={(e) => setProspectForm({ ...prospectForm, name: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                  <div className="relative" ref={prospectGenderDropdownRef}>
                    <button
                      type="button"
                      className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] outline-none bg-white flex justify-between items-center text-slate-900"
                      onClick={() => setIsProspectGenderDropdownOpen(!isProspectGenderDropdownOpen)}
                    >
                      <span className={cn(!prospectForm.gender && "text-slate-400")}>
                        {prospectForm.gender || "Select Gender"}
                      </span>
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </button>

                    {isProspectGenderDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                        {["Male", "Female", "Other"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => {
                              setProspectForm({ ...prospectForm, gender: g });
                              setIsProspectGenderDropdownOpen(false);
                            }}
                          >
                            <span className={cn("font-medium", prospectForm.gender === g ? "text-[#DE457D]" : "text-slate-700")}>{g}</span>
                            {prospectForm.gender === g && <Check className="w-4 h-4 text-[#DE457D]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">DOB</label>
                    <input
                      type="date"
                      value={prospectForm.dob || ''}
                      onChange={(e) => setProspectForm({ ...prospectForm, dob: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                    <input
                      type="text"
                      placeholder="Enter city"
                      value={prospectForm.city || ''}
                      onChange={(e) => setProspectForm({ ...prospectForm, city: e.target.value })}
                      className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How Did You Meet & Relationship Context */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-4 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Heart className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900">How did you meet?</h2>
          </div>

          <div className="relative" ref={meetingDropdownRef}>
            <button
              type="button"
              className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] bg-white flex justify-between items-center text-slate-900"
              onClick={() => setIsMeetingDropdownOpen(!isMeetingDropdownOpen)}
            >
              <span className={cn(!prospectForm.meetingSource && "text-slate-400")}>
                {prospectForm.meetingSource || "Select how you met"}
              </span>
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </button>

            {isMeetingDropdownOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                {["Family Introduction", "Matrimonial Platform", "Work/College", "Friends", "Other"].map((source) => (
                  <button
                    key={source}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => {
                      setProspectForm({ ...prospectForm, meetingSource: source, platformName: source !== 'Matrimonial Platform' ? '' : prospectForm.platformName });
                      setIsMeetingDropdownOpen(false);
                    }}
                  >
                    <span className={cn("font-medium", prospectForm.meetingSource === source ? "text-[#DE457D]" : "text-slate-700")}>{source}</span>
                    {prospectForm.meetingSource === source && <Check className="w-4 h-4 text-[#DE457D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {prospectForm.meetingSource === 'Matrimonial Platform' && (
            <div className="relative" ref={platformDropdownRef}>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Platform Name</label>
              <button
                type="button"
                className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] bg-white flex justify-between items-center text-slate-900"
                onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
              >
                <span className={cn(!prospectForm.platformName && "text-slate-400")}>
                  {prospectForm.platformName || "Select platform"}
                </span>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </button>

              {isPlatformDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                  {["Shaadi.com", "BharatMatrimony", "Jeevansathi", "Elite Matrimony", "Other"].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                      onClick={() => {
                        setProspectForm({ ...prospectForm, platformName: platform });
                        setIsPlatformDropdownOpen(false);
                      }}
                    >
                      <span className={cn("font-medium", prospectForm.platformName === platform ? "text-[#DE457D]" : "text-slate-700")}>{platform}</span>
                      {prospectForm.platformName === platform && <Check className="w-4 h-4 text-[#DE457D]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {prospectForm.meetingSource && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tell us your story (optional)</label>
              <textarea
                value={prospectForm.meetingStory || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, meetingStory: e.target.value })}
                placeholder="Share how you met, what drew you together..."
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] resize-none h-24 text-slate-900"
              />
            </div>
          )}
        </div>

        {!fillByProspect && (
          <>
            {/* Prospect Lifestyle & Metrics Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-6 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Activity className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-bold text-slate-900">Prospect Lifestyle & Habits</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Height (cm)</label>
              <input
                type="number"
                placeholder="e.g. 175"
                value={prospectForm.height || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, height: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Weight (kg)</label>
              <input
                type="number"
                placeholder="e.g. 70"
                value={prospectForm.weight || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, weight: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Waist (inches)</label>
              <input
                type="number"
                placeholder="e.g. 32"
                value={prospectForm.waist || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, waist: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
          </div>

          {/* Habits Grid */}
          <div className="space-y-4">
            {/* Physical Activity Level */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <label className="block text-sm font-bold text-slate-800">Physical Activity Level</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_ACTIVITIES.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.activity_level === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, activity_level: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-emerald-500" />
                <label className="block text-sm font-bold text-slate-800">Daily Steps</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_STEPS.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.daily_steps === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, daily_steps: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Occupation Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-500" />
                <label className="block text-sm font-bold text-slate-800">Occupation & Work Style</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_OCCUPATIONS.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.occupation_style === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, occupation_style: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drinking habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Beer className="w-5 h-5 text-amber-500" />
                <label className="block text-sm font-bold text-slate-800">Alcohol Drinking Habits</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_DRINKING.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.drinking_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, drinking_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoking habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                <label className="block text-sm font-bold text-slate-800">Smoking Habits</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_SMOKING.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.smoking_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, smoking_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tobacco habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                <label className="block text-sm font-bold text-slate-800">Tobacco consumption (Chewing/etc)</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_TOBACCO.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.tobacco_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, tobacco_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sleep cycle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-indigo-500" />
                <label className="block text-sm font-bold text-slate-800">Sleep Cycle patterns</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_SLEEP.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.sleep_cycle === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, sleep_cycle: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menstrual cycle (conditional if female) */}
            {prospectForm.gender === 'Female' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-pink-500" />
                  <label className="block text-sm font-bold text-slate-800">Menstrual Cycle Status (Optional)</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LIFESTYLE_MENSTRUAL.map(opt => {
                    const IconComponent = opt.icon;
                    const isSelected = prospectForm.menstrualCycle === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                          isSelected
                            ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                            : "border-slate-200 bg-white hover:bg-slate-50/60"
                        )}
                        onClick={() => setProspectForm({ ...prospectForm, menstrualCycle: opt.val })}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pathology Uploader */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-4 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <FlaskConical className="w-5 h-5 text-primary" style={{ color: '#DE457D' }} />
            <h2 className="text-lg font-bold text-slate-900">Upload Pathology Reports</h2>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload blood & pathology files containing parameters like HbA1c, Lipids, AMH or Semen readings.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Your Pathology PDF</span>
              <button
                type="button"
                onClick={() => userFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  userReport ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                {isUserUploading ? 'Parsing PDF...' : userReport ? 'My Report ✓' : 'Upload My PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockData(false)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-[#DE457D] cursor-pointer"
              >
                Trigger My Mock Report
              </button>
            </div>

            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Prospect's Pathology PDF</span>
              <button
                type="button"
                onClick={() => prospectFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  prospectReport ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                {isProspectUploading ? 'Parsing PDF...' : prospectReport ? 'Prospect PDF ✓' : 'Upload Prospect PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockData(true)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-[#DE457D] cursor-pointer"
              >
                Trigger Prospect Mock Report
              </button>
            </div>
          </div>

          <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], false)} />
          <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], true)} />
        </div>

        {/* Radiology Uploader */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-4 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Upload Radiology Reports (Optional)</h2>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload radiology reports (PDFs) containing scans such as Abdomen USG, TVS, Scrotal Doppler, Echocardiography (Echo), or DEXA.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Your Radiology PDF</span>
              <button
                type="button"
                onClick={() => userRadFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  userRadiology ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                {isUserRadUploading ? 'Parsing PDF...' : userRadiology ? 'My Radiology ✓' : 'Upload My PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockRadiology(false)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-teal-600 cursor-pointer"
              >
                Trigger My Mock Report
              </button>
              {userRadError && <span className="text-[10px] text-rose-500 block">{userRadError}</span>}
            </div>

            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Prospect's Radiology PDF</span>
              <button
                type="button"
                disabled={!prospectForm.name || !prospectForm.gender || !prospectForm.dob}
                onClick={() => prospectRadFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  prospectRadiology ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                )}
              >
                {isProspectRadUploading ? 'Parsing PDF...' : prospectRadiology ? 'Prospect Radiology ✓' : 'Upload Prospect PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockRadiology(true)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-teal-600 cursor-pointer"
              >
                Trigger Prospect Mock Report
              </button>
              {prospectRadError && <span className="text-[10px] text-rose-500 block">{prospectRadError}</span>}
            </div>
          </div>

          <input type="file" ref={userRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
          <input type="file" ref={prospectRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
        </div>

        {matchError && (
          <div className="mt-6 p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 flex items-center gap-2 text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{matchError}</p>
          </div>
        )}
      </>
    )}

        {/* Form navigation buttons */}
        <div className="mt-8 flex justify-between items-center pb-12">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          
          {!fillByProspect && (
            <button
              onClick={handleMatch}
              disabled={!userReport || !prospectReport || isMatching || runsUsed >= 1}
              className="bg-[#DE457D] hover:bg-[#c93d6f] text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-pink-500/25 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 text-sm"
            >
              {isMatching ? 'Generating...' : 'Generate Insights'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
