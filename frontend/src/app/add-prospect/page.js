'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Check, Share2 } from 'lucide-react';
import { useCompatibility, calculateAge, buildOnboardingFormFromUser } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import QuestionScreen from '../../components/wizard/QuestionScreen';
import ChoiceList from '../../components/wizard/ChoiceList';
import MeasurementSlider from '../../components/wizard/MeasurementSlider';
import CityInput from '../../components/wizard/CityInput';
import AnalysisLoadingScreen from '../../components/wizard/AnalysisLoadingScreen';
import {
  LIFESTYLE_ACTIVITIES, LIFESTYLE_STEPS, LIFESTYLE_OCCUPATIONS, LIFESTYLE_DRINKING,
  LIFESTYLE_SMOKING, LIFESTYLE_TOBACCO, LIFESTYLE_SLEEP, LIFESTYLE_MENSTRUAL,
  GENDERS, MEETING_SOURCES, MATRIMONIAL_PLATFORMS, RELATIONSHIP_STATUSES
} from '../../constants/lifestyleOptions';
import { MENTAL_HEALTH_QUESTIONS } from '../../constants/mentalHealthQuestions';

const PROSPECT_MODE_OPTIONS = [
  { val: 'self', label: "I'll enter their details myself", desc: 'Fill in your prospect’s information right now' },
  { val: 'invite', label: 'Generate a link to send them', desc: "They fill in their own details — you copy and send the link yourself" }
];

const MENTAL_OPT_IN_OPTIONS = [
  { val: 'yes', label: 'Yes, add it', desc: 'Premium — 21 quick questions' },
  { val: 'skip', label: 'Not now', desc: 'Skip — you can add this anytime from your report' }
];

const fieldInputClass = 'w-full p-4 border rounded-xl outline-none text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

export default function AddProspectPage() {
  const router = useRouter();
  const [prospectMode, setProspectMode] = useState(null); // 'self' | 'invite' | null
  const [activeInvite, setActiveInvite] = useState(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [matchRunError, setMatchRunError] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selfMentalOptIn, setSelfMentalOptIn] = useState(null); // 'yes' | 'skip' | null
  const [selfMentalAnswers, setSelfMentalAnswers] = useState({});
  const [prospectMentalOptIn, setProspectMentalOptIn] = useState(null);
  const [prospectMentalAnswers, setProspectMentalAnswers] = useState({});

  const fillByProspect = prospectMode === 'invite';

  const {
    user,
    setUser,
    runsUsed,
    isMatching,
    matchesList,
    handleLogout,
    onboardingForm,
    setOnboardingForm,
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
    matchError,
    setMatchError,
    handleCompatibilityMatch,
    handleMentalAnalysis
  } = useCompatibility();

  const isSelf = !onboardingForm.userRelation || onboardingForm.userRelation === 'Self';

  // Seed self-details form from the saved user profile once per session
  useEffect(() => {
    if (user && !onboardingForm.candidateGender) {
      setOnboardingForm(prev => ({ ...prev, ...buildOnboardingFormFromUser(user) }));
    }
  }, [user]);

  // Radiology States
  const [userRadiology, setUserRadiology] = useState(null);
  const [prospectRadiology, setProspectRadiology] = useState(null);
  const [isUserRadUploading, setIsUserRadUploading] = useState(false);
  const [isProspectRadUploading, setIsProspectRadUploading] = useState(false);
  const [userRadError, setUserRadError] = useState(null);
  const [prospectRadError, setProspectRadError] = useState(null);

  // Refs
  const userFileInputRef = useRef(null);
  const prospectFileInputRef = useRef(null);
  const userRadFileInputRef = useRef(null);
  const prospectRadFileInputRef = useRef(null);

  const goNext = () => setStepIndex((i) => i + 1);
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

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
    } else {
      if (!onboardingForm.candidateName || !onboardingForm.candidateGender || !onboardingForm.candidateDob) {
        alert("Please enter your Name, Gender, and DOB first so we can parse and store your radiology report correctly.");
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
        alert("Please enter the prospect's Name, Gender, and DOB first.");
        return;
      }
    } else {
      if (!onboardingForm.candidateName || !onboardingForm.candidateGender || !onboardingForm.candidateDob) {
        alert("Please enter your Name, Gender, and DOB first.");
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
            setTimeout(() => {
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
                setTimeout(() => {
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
          mentalAnswers: Object.keys(selfMentalAnswers).length > 0 ? selfMentalAnswers : undefined
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
    if (!confirm("Are you sure you want to revoke this invitation? The link will become immediately invalid.")) return;

    try {
      const res = await apiFetch(`${API_URL}/api/invite/revoke/${activeInvite.id}`, {
        method: 'POST'
      });
      if (res.ok) {
        setActiveInvite(null);
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
            <strong>Invitation Declined:</strong> The prospect has rejected consent to share their health data. You can revoke this link and send a new invite if desired.
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
    const missingSelf = [];
    if (!isSelf && !onboardingForm.candidateName?.trim()) missingSelf.push("Candidate's Name");
    if (!onboardingForm.candidateGender) missingSelf.push("Your Gender");
    if (!onboardingForm.candidateDob) missingSelf.push("Your DOB");
    if (!onboardingForm.candidateCity?.trim()) missingSelf.push("Your City");
    if (!onboardingForm.relationshipStatus) missingSelf.push("Relationship Status");
    if (!onboardingForm.activity_level) missingSelf.push("Your Activity Level");
    if (!onboardingForm.daily_steps) missingSelf.push("Your Daily Steps");
    if (!onboardingForm.occupation_style) missingSelf.push("Your Occupation style");
    if (!onboardingForm.drinking_habits) missingSelf.push("Your Drinking habits");
    if (!onboardingForm.smoking_habits) missingSelf.push("Your Smoking habits");
    if (!onboardingForm.tobacco_habits) missingSelf.push("Your Tobacco habits");
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
          daily_steps: onboardingForm.daily_steps,
          occupation_style: onboardingForm.occupation_style,
          drinking_habits: onboardingForm.drinking_habits,
          smoking_habits: onboardingForm.smoking_habits,
          tobacco_habits: onboardingForm.tobacco_habits,
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
    content: <ChoiceList options={options} value={value} onChange={onChange} onAdvance={goNext} />,
    canAdvance: !!value
  });

  const fieldStep = (title, value, onChange, extra = {}) => ({
    title,
    subtitle: extra.subtitle,
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
    content: <MeasurementSlider type={measureType} value={value} onChange={onChange} />,
    canAdvance: true
  });

  const cityStep = (title, value, onChange) => ({
    title,
    content: <CityInput value={value} onChange={onChange} />,
    canAdvance: !!(value && value.trim())
  });

  const buildBodyAndLifestyleSteps = (form, setForm) => {
    const set = (patch) => setForm({ ...form, ...patch });
    const arr = [
      measurementStep('Height', 'height', form.height, (v) => set({ height: v })),
      measurementStep('Weight', 'weight', form.weight, (v) => set({ weight: v })),
      measurementStep('Waist', 'waist', form.waist, (v) => set({ waist: v })),
      choiceStep('Physical Activity Level', LIFESTYLE_ACTIVITIES, form.activity_level, (v) => set({ activity_level: v })),
      choiceStep('Daily Steps', LIFESTYLE_STEPS, form.daily_steps, (v) => set({ daily_steps: v })),
      choiceStep('Occupation & Work Style', LIFESTYLE_OCCUPATIONS, form.occupation_style, (v) => set({ occupation_style: v })),
      choiceStep('Alcohol Drinking Habits', LIFESTYLE_DRINKING, form.drinking_habits, (v) => set({ drinking_habits: v })),
      choiceStep('Smoking Habits', LIFESTYLE_SMOKING, form.smoking_habits, (v) => set({ smoking_habits: v })),
      choiceStep('Tobacco Consumption', LIFESTYLE_TOBACCO, form.tobacco_habits, (v) => set({ tobacco_habits: v })),
      choiceStep('Sleep Cycle Patterns', LIFESTYLE_SLEEP, form.sleep_cycle, (v) => set({ sleep_cycle: v }))
    ];
    if (form.gender === 'Female' || form.candidateGender === 'Female') {
      arr.push(choiceStep('Menstrual Cycle Status', LIFESTYLE_MENSTRUAL, form.menstrualCycle, (v) => set({ menstrualCycle: v }), { subtitle: 'Optional' }));
    }
    return arr;
  };

  // Mental health is independent per person: an opt-in choice, then (if accepted)
  // the same 21 questions asked one at a time, just like the lifestyle block above.
  const buildMentalHealthSteps = (optIn, setOptIn, answers, setAnswers, final = {}) => {
    const arr = [{
      title: 'Add Mental Health Compatibility?',
      subtitle: 'Up to 20% deeper insight into long-term emotional & personality compatibility.',
      canAdvance: !!optIn,
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--soft-amber)' }}>
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--amber)', color: '#fff' }}>
              Premium
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--amber-d)' }}>21 quick questions</span>
          </div>
          <ChoiceList options={MENTAL_OPT_IN_OPTIONS} value={optIn} onChange={setOptIn} onAdvance={goNext} />
        </div>
      )
    }];

    if (optIn === 'yes') {
      MENTAL_HEALTH_QUESTIONS.forEach((q) => {
        arr.push(choiceStep(q.title, q.options, answers[q.id], (v) => setAnswers({ ...answers, [q.id]: v }), { subtitle: q.desc }));
      });
    }

    if (final.isFinal) {
      const last = arr[arr.length - 1];
      last.nextLabel = final.nextLabel;
      last.nextVariant = 'pink';
      last.onNext = final.onNext;
      last.canAdvance = last.canAdvance !== false && final.canAdvance !== false;
      if (final.extraContent) {
        last.content = (
          <div className="space-y-3">
            {last.content}
            {final.extraContent}
          </div>
        );
      }
    }

    return arr;
  };

  const uploadStep = ({ title, subtitle, isUploading, error, hasReport, onUpload, onMock, required, boostPct }) => ({
    title,
    subtitle,
    canAdvance: required ? !!hasReport : true,
    onSkip: required ? undefined : goNext,
    content: (
      <div className="space-y-3">
        {!required && boostPct && (
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--soft-amber)' }}>
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--amber)', color: '#fff' }}>
              Premium
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--amber-d)' }}>
              Boosts your match confidence by up to {boostPct}%
            </span>
          </div>
        )}
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
      </div>
    )
  });

  // ---- Build the full ordered step list ----
  const steps = [];

  if (onboardingForm.userRelation && onboardingForm.userRelation !== 'Self') {
    steps.push(fieldStep("What's the candidate's name?", onboardingForm.candidateName, (v) => setOnboardingForm({ ...onboardingForm, candidateName: v }), { placeholder: 'Enter their name' }));
  }

  steps.push(choiceStep('Gender', GENDERS, onboardingForm.candidateGender, (v) => setOnboardingForm({ ...onboardingForm, candidateGender: v }), {
    subtitle: !isSelf ? `For ${onboardingForm.candidateName || 'them'}` : undefined
  }));
  steps.push(fieldStep('Date of Birth', onboardingForm.candidateDob, (v) => setOnboardingForm({ ...onboardingForm, candidateDob: v }), { type: 'date' }));
  steps.push(cityStep('City', onboardingForm.candidateCity, (v) => setOnboardingForm({ ...onboardingForm, candidateCity: v })));
  steps.push(...buildBodyAndLifestyleSteps(onboardingForm, setOnboardingForm));

  // Relationship context
  steps.push(choiceStep('How did you meet?', MEETING_SOURCES, prospectForm.meetingSource, (v) => setProspectForm({
    ...prospectForm,
    meetingSource: v,
    platformName: v !== 'Matrimonial Platform' ? '' : prospectForm.platformName
  })));
  if (prospectForm.meetingSource === 'Matrimonial Platform') {
    steps.push(choiceStep('Which platform?', MATRIMONIAL_PLATFORMS, prospectForm.platformName, (v) => setProspectForm({ ...prospectForm, platformName: v })));
  }
  steps.push(choiceStep('Relationship Status', RELATIONSHIP_STATUSES, onboardingForm.relationshipStatus, (v) => setOnboardingForm({ ...onboardingForm, relationshipStatus: v })));

  // Your own report uploads always happen — regardless of how the prospect will share their details
  steps.push(uploadStep({
    title: 'Upload your Pathology Report',
    subtitle: 'PDF with parameters like HbA1c, Lipids, AMH or Semen readings',
    isUploading: isUserUploading,
    error: userUploadError,
    hasReport: !!userReport,
    required: true,
    onUpload: () => userFileInputRef.current.click(),
    onMock: () => triggerMockData(false)
  }));
  steps.push(uploadStep({
    title: 'Upload your Radiology Report',
    subtitle: 'Optional — USG, TVS, Echo, or DEXA scans',
    isUploading: isUserRadUploading,
    error: userRadError,
    hasReport: !!userRadiology,
    required: false,
    boostPct: 12,
    onUpload: () => userRadFileInputRef.current.click(),
    onMock: () => triggerMockRadiology(false)
  }));

  steps.push(...buildMentalHealthSteps(selfMentalOptIn, setSelfMentalOptIn, selfMentalAnswers, setSelfMentalAnswers));

  // Prospect routing
  steps.push(choiceStep('How will your prospect share their details?', PROSPECT_MODE_OPTIONS, prospectMode, (v) => setProspectMode(v)));

  if (prospectMode) {
    steps.push(fieldStep("What's your prospect's name?", prospectForm.name, (v) => setProspectForm({ ...prospectForm, name: v }), { placeholder: 'Enter their name' }));
  }

  if (prospectMode === 'invite') {
    steps.push({
      title: 'Ready to generate your invite link?',
      subtitle: `We'll create a secure link for ${prospectForm.name || 'them'} to fill in their own details — you copy and send it yourself.`,
      canAdvance: !isSendingInvite,
      nextLabel: isSendingInvite ? 'Generating…' : 'Generate Link',
      onNext: handleCreateInviteLink,
      content: inviteError ? (
        <div className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>{inviteError}</div>
      ) : null
    });
  } else if (prospectMode === 'self') {
    steps.push(choiceStep("Prospect's Gender", GENDERS, prospectForm.gender, (v) => setProspectForm({ ...prospectForm, gender: v })));
    steps.push(fieldStep("Prospect's Date of Birth", prospectForm.dob, (v) => setProspectForm({ ...prospectForm, dob: v }), { type: 'date' }));
    steps.push(cityStep("Prospect's City", prospectForm.city, (v) => setProspectForm({ ...prospectForm, city: v })));
    steps.push(...buildBodyAndLifestyleSteps(prospectForm, setProspectForm));

    steps.push(uploadStep({
      title: "Upload prospect's Pathology Report",
      subtitle: 'PDF with parameters like HbA1c, Lipids, AMH or Semen readings',
      isUploading: isProspectUploading,
      error: prospectUploadError,
      hasReport: !!prospectReport,
      required: true,
      onUpload: () => prospectFileInputRef.current.click(),
      onMock: () => triggerMockData(true)
    }));
    steps.push(uploadStep({
      title: "Upload prospect's Radiology Report",
      subtitle: 'Optional — USG, TVS, Echo, or DEXA scans',
      isUploading: isProspectRadUploading,
      error: prospectRadError,
      hasReport: !!prospectRadiology,
      required: false,
      boostPct: 12,
      onUpload: () => prospectRadFileInputRef.current.click(),
      onMock: () => triggerMockRadiology(true)
    }));

    // Prospect's own mental health block — its last step carries the final Generate Insights trigger
    const quotaExceeded = runsUsed >= 1;
    const extraNotices = [];
    if (quotaExceeded) {
      extraNotices.push(
        <div key="quota" className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}>
          You&apos;ve used your free match. Reset your quota from the dashboard to run another.
        </div>
      );
    }
    if (matchError) {
      extraNotices.push(
        <div key="error" className="p-3 rounded-lg text-xs font-medium" style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}>{matchError}</div>
      );
    }

    steps.push(...buildMentalHealthSteps(prospectMentalOptIn, setProspectMentalOptIn, prospectMentalAnswers, setProspectMentalAnswers, {
      isFinal: true,
      nextLabel: isSavingProfile ? 'Saving…' : isMatching ? 'Generating…' : 'Generate Insights',
      onNext: handleMatch,
      canAdvance: !isSavingProfile && !isMatching && !quotaExceeded,
      extraContent: extraNotices.length > 0 ? extraNotices : null
    }));
  }

  const clampedIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const currentStep = steps[clampedIndex];

  if (!user) return null;

  return (
    <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>New Compatibility Check</span>
          <button
            onClick={() => { handleLogout(); router.push('/'); }}
            className="text-xs font-medium transition-colors duration-150 hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            Logout
          </button>
        </div>

        {fillByProspect && activeInvite ? (
          <div className="flex-1 overflow-y-auto rounded-2xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {renderTimeline()}
          </div>
        ) : isSavingProfile || isMatching ? (
          <AnalysisLoadingScreen active />
        ) : (
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
            nextVariant={currentStep.nextVariant}
            onSkip={currentStep.onSkip}
          >
            {currentStep.content}
          </QuestionScreen>
        )}
      </div>

      <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], false)} />
      <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], true)} />
      <input type="file" ref={userRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
      <input type="file" ref={prospectRadFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
    </main>
  );
}
