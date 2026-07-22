'use client';

import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { API_URL } from '../config/api';
import { parsePatientMeta, findExtractedParam } from '../utils/reportParser';
import { apiFetch, setAccessToken, refreshAuthSession } from '../utils/api';
import { toast } from '../components/Toast';

const CompatibilityContext = createContext(null);

/* ── Clinical Calculations & Constants ── */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const fmt = (x) => (x == null || Number.isNaN(x) ? "—" : Math.round(x));

export const SEV = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", lab: "Normal" },
  borderline: { dot: "bg-amber-500", text: "text-amber-700", lab: "Borderline" },
  high: { dot: "bg-rose-500", text: "text-rose-700", lab: "High" },
};

export const BAND = {
  low: { ring: "ring-emerald-200", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", label: "Low", note: "Under 30 — high negative predictive value (95.1%); undiagnosed diabetes unlikely." },
  mod: { ring: "ring-amber-200", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500", label: "Moderate", note: "30–50 — elevated; warrants confirmatory glucose testing." },
  high: { ring: "ring-rose-200", chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500", label: "High", note: "≥ 60 — CURES screening cut-off. ~1 in 6 carry undiagnosed diabetes (PPV 17%)." },
};

export function idrsBand(s) {
  if (s < 30) return BAND.low;
  if (s < 60) return BAND.mod;
  return BAND.high;
}

export function flagHbA1c(v) { if (v == null) return null; return v >= 6.5 ? "high" : v >= 5.7 ? "borderline" : "ok"; }
export function flagBP(s, d) { if (s == null) return null; return s >= 140 || d >= 90 ? "high" : s >= 130 || d >= 85 ? "borderline" : "ok"; }
export function flagBMI(v) { if (v == null) return null; return v >= 25 ? "high" : v >= 23 ? "borderline" : "ok"; }
export function flagTG(v) { if (v == null) return null; return v >= 200 ? "high" : v >= 150 ? "borderline" : "ok"; }
export function flagHDL(v, sex) { if (v == null) return null; const low = sex === "male" ? 40 : 50; return v < low ? "high" : v < low + 10 ? "borderline" : "ok"; }
export function flagHOMA(v) { if (v == null) return null; return v >= 2.5 ? "high" : v >= 2.0 ? "borderline" : "ok"; }
export function flagCRP(v) { if (v == null) return null; return v >= 3 ? "high" : v >= 1 ? "borderline" : "ok"; }

export function biomarkerFlags(p, premium) {
  const rows = [
    { k: "HbA1c", v: p.hba1c, unit: "%", f: flagHbA1c(p.hba1c) },
    { k: "Blood pressure", v: p.sbp != null ? (p.dbp != null ? `${p.sbp}/${p.dbp}` : p.sbp) : null, unit: "mmHg", f: flagBP(p.sbp, p.dbp) },
    { k: "BMI", v: p.bmi, unit: "kg/m²", f: flagBMI(p.bmi) },
    { k: "Triglycerides", v: p.tg, unit: "mg/dL", f: flagTG(p.tg) },
    { k: "HDL", v: p.hdl, unit: "mg/dL", f: flagHDL(p.hdl, p.sex) },
  ];
  if (premium) {
    rows.push({ k: "HOMA-IR", v: p.homa, unit: "", f: flagHOMA(p.homa), prem: true });
    rows.push({ k: "hs-CRP", v: p.crp, unit: "mg/L", f: flagCRP(p.crp), prem: true });
  }
  const present = rows.filter((r) => r.f);
  const flagged = present.filter((r) => r.f !== "ok").length;
  const high = present.filter((r) => r.f === "high").length;
  return { rows, flagged, high, count: present.length };
}

export function getDriftedBiomarkers(raw, lifestyle, years, sex) {
  const drifted = { ...raw };
  
  if (raw.bmi != null) {
    let bmiDrift = 0.03;
    if (lifestyle.activity === 'Sedentary' || lifestyle.diet === 'Poor') {
      bmiDrift = 0.15;
    } else if (lifestyle.activity === 'Active' && lifestyle.diet === 'Healthy') {
      bmiDrift = -0.05;
    }
    drifted.bmi = parseFloat((raw.bmi + bmiDrift * years).toFixed(1));
  }

  if (raw.sbp != null) {
    let sbpDrift = 0.5;
    let dbpDrift = 0.3;
    if (lifestyle.stress === 'High' || lifestyle.smoking === 'Regular') {
      sbpDrift = 1.2;
      dbpDrift = 0.7;
    }
    drifted.sbp = Math.round(raw.sbp + sbpDrift * years);
    if (raw.dbp != null) {
      drifted.dbp = Math.round(raw.dbp + dbpDrift * years);
    }
  }

  if (raw.hba1c != null) {
    let hba1cDrift = 0.015;
    if (lifestyle.diet === 'Poor' || lifestyle.activity === 'Sedentary') {
      hba1cDrift = 0.04;
    } else if (lifestyle.diet === 'Healthy' && lifestyle.activity === 'Active') {
      hba1cDrift = -0.01;
    }
    drifted.hba1c = parseFloat((raw.hba1c + hba1cDrift * years).toFixed(2));
  }

  if (raw.tg != null) {
    let tgDrift = 1.5;
    if (lifestyle.diet === 'Poor') {
      tgDrift = 3.5;
    }
    drifted.tg = Math.round(raw.tg + tgDrift * years);
  }

  if (raw.hdl != null) {
    let hdlDrift = -0.2;
    if (lifestyle.smoking === 'Regular') {
      hdlDrift = -0.5;
    } else if (lifestyle.activity === 'Active') {
      hdlDrift = 0.1;
    }
    drifted.hdl = Math.round(raw.hdl + hdlDrift * years);
  }

  return biomarkerFlags({ ...drifted, sex }, false);
}

export function getRiskDrivers(data, age) {
  const drivers = [];
  if (age >= 50) drivers.push("age progression (over 50)");
  else if (age >= 35) drivers.push("age category (35-49)");
  
  if (data.waist === 'High') drivers.push("elevated waist circumference");
  else if (data.waist === 'Borderline') drivers.push("borderline waist circumference");
  
  if (data.activity === 'Sedentary') drivers.push("sedentary physical patterns");
  else if (data.activity === 'Moderate') drivers.push("moderate daily activity");
  
  // parentDiabetes is the 'None'/'One'/'Both' string (WS1A04/WS3B01) — 'None' is
  // itself a non-empty, truthy string, so a bare truthy check would wrongly list
  // "family history" as a driver even when there isn't one.
  if (data.parentDiabetes === 'One' || data.parentDiabetes === 'Both' || data.parentDiabetes === true) drivers.push("family history (maternal or paternal diabetes)");
  
  if (drivers.length === 0) return "No primary clinical drivers detected at this baseline.";
  return "Influenced primarily by: " + drivers.join(", ") + ".";
}

export const calculateAge = (dobString) => {
  if (!dobString) return 30;
  const birthDate = new Date(dobString);
  const difference = Date.now() - birthDate.getTime();
  const ageDate = new Date(difference);
  return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
};

export const buildOnboardingFormFromUser = (user) => ({
  userName: user?.userName || user?.name || '',
  userRelation: user?.userRelation || 'Self',
  candidateName: user?.candidateName || user?.name || '',
  candidateGender: user?.gender || '',
  candidateDob: user?.dob || '',
  candidateCity: user?.city || '',
  marriageTimeline: user?.marriageTimeline || 'Not sure yet',
  activity_level: user?.activity_level || '',
  drinking_habits: user?.drinking_habits || '',
  smoking_habits: user?.smoking_habits || '',
  sleep_cycle: user?.sleep_cycle || '',
  height: user?.height || '',
  weight: user?.weight || '',
  waist: user?.waist || '',
  menstrualCycle: user?.menstrualCycle || ''
});

export const classifyWaist = (waistVal, gender) => {
  const val = parseFloat(waistVal);
  if (isNaN(val)) return 'Normal';
  if (gender === 'male') {
    if (val >= 90) return 'High';
    if (val >= 85) return 'Borderline';
    return 'Normal';
  } else {
    if (val >= 80) return 'High';
    if (val >= 75) return 'Borderline';
    return 'Normal';
  }
};

// Draft persistence for the multi-step questionnaire (About/Lifestyle/Mental/Pathology
// answers) — this previously lived only in memory, so any page refresh silently wiped
// every answer already given. Namespaced per logged-in user id (read directly out of
// localStorage rather than the `user` state, since that's only populated asynchronously
// after mount) so switching accounts on the same device never rehydrates someone else's
// in-progress draft.
let cachedDraft;

function getStoredUserId() {
  try {
    const raw = localStorage.getItem('slayhealth_user');
    return raw ? JSON.parse(raw)?.id : null;
  } catch (e) {
    return null;
  }
}

function draftStorageKey() {
  return `slayhealth_profile_draft_${getStoredUserId() || 'anon'}`;
}

function loadDraft() {
  if (cachedDraft !== undefined) return cachedDraft;
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(draftStorageKey()) : null;
    cachedDraft = raw ? JSON.parse(raw) : null;
  } catch (e) {
    cachedDraft = null;
  }
  return cachedDraft;
}

export function CompatibilityProvider({ children }) {
  // Authentication & Profile
  const [user, setUser] = useState(null);
  const [authPhone, setAuthPhone] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authStep, setAuthStep] = useState('phone');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Quotas
  const [runsUsed, setRunsUsed] = useState(0);
  const [chatsUsed, setChatsUsed] = useState(0);
  const [isUpgradingQuota, setIsUpgradingQuota] = useState(false);

  // Matches list
  const [matchesList, setMatchesList] = useState([]);
  const [isMatchesLoading, setIsMatchesLoading] = useState(false);

  // Forms state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingForm, setOnboardingForm] = useState(() => ({
    userName: '',
    userRelation: '',
    candidateName: '',
    candidateGender: '',
    candidateDob: '',
    candidateCity: '',
    marriageTimeline: '',
    activity_level: '',
    drinking_habits: '',
    smoking_habits: '',
    sleep_cycle: '',
    height: '',
    weight: '',
    waist: '',
    menstrualCycle: '',
    ...(loadDraft()?.onboardingForm || {})
  }));

  const [prospectForm, setProspectForm] = useState(() => ({
    name: '',
    gender: '',
    dob: '',
    city: '',
    meetingSource: '',
    platformName: '',
    meetingStory: '',
    activity_level: '',
    drinking_habits: '',
    smoking_habits: '',
    sleep_cycle: '',
    height: '',
    weight: '',
    waist: '',
    menstrualCycle: '',
    ...(loadDraft()?.prospectForm || {})
  }));

  // Pathology Uploads
  const [userReport, setUserReport] = useState(() => loadDraft()?.userReport || null);
  const [prospectReport, setProspectReport] = useState(() => loadDraft()?.prospectReport || null);
  const [isUserUploading, setIsUserUploading] = useState(false);
  const [isProspectUploading, setIsProspectUploading] = useState(false);
  const [userUploadError, setUserUploadError] = useState(null);
  const [prospectUploadError, setProspectUploadError] = useState(null);

  // Mental wellbeing answers, per person — entering the category from the hub
  // is the opt-in (mirrors About You/Lifestyle, no separate yes/no gate) —
  // shared across add-prospect's wizard and the dashboard's progress cards.
  const [selfMentalAnswers, setSelfMentalAnswers] = useState(() => loadDraft()?.selfMentalAnswers || {});
  const [prospectMentalAnswers, setProspectMentalAnswers] = useState(() => loadDraft()?.prospectMentalAnswers || {});

  // Results State
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState(null);
  const [chronicResult, setChronicResult] = useState(null);
  const [mfrResult, setMfrResult] = useState(null);
  const [mentalResult, setMentalResult] = useState(null);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [activeMatchDetails, setActiveMatchDetails] = useState(null);
  const [selectedTab, setSelectedTab] = useState('story');
  const [selectedProjYear, setSelectedProjYear] = useState(0);

  // AI Chat counselor
  const [chatSessionId, setChatSessionId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);

  const clearAllSessionStates = () => {
    // Deliberately does NOT delete the saved profile draft
    // (slayhealth_profile_draft_<uid>). It used to (removeItem(draftStorageKey())
    // here), which meant a logout — including a spurious one from a transient
    // token-refresh failure — permanently destroyed the user's in-progress
    // profile: on logging back in they saw a fresh 0% onboarding with no way to
    // recover. The draft key is already namespaced per user id, so leaving it in
    // localStorage can't leak into a different account, and lets the same user's
    // work restore on re-login (see the rehydrate-on-auth effect below). Only
    // `cachedDraft` is reset, so the next loadDraft() re-reads from storage
    // rather than serving a stale in-memory copy.
    cachedDraft = undefined;
    setAccessToken(null);
    localStorage.removeItem('slayhealth_user');
    localStorage.removeItem('slayhealth_refresh_token');
    setUser(null);
    setRunsUsed(0);
    setChatsUsed(0);
    setMatchesList([]);
    setChronicResult(null);
    setMfrResult(null);
    setMentalResult(null);
    setActiveMatchId(null);
    setActiveMatchDetails(null);
    setChatSessionId(null);
    setUserReport(null);
    setProspectReport(null);
    setSelfMentalAnswers({});
    setProspectMentalAnswers({});
    setOnboardingForm({
      userName: '',
      userRelation: '',
      candidateName: '',
      candidateGender: '',
      candidateDob: '',
      candidateCity: '',
      marriageTimeline: '',
      activity_level: '',
      drinking_habits: '',
      smoking_habits: '',
      sleep_cycle: '',
      height: '',
      weight: '',
      waist: '',
      menstrualCycle: ''
    });
    setProspectForm({
      name: '',
      gender: '',
      dob: '',
      city: '',
      meetingSource: '',
      platformName: '',
      meetingStory: '',
      activity_level: '',
      drinking_habits: '',
      smoking_habits: '',
      sleep_cycle: '',
      height: '',
      weight: '',
      waist: '',
      menstrualCycle: ''
    });
  };

  // Persist the in-progress questionnaire so a refresh (or a phone backgrounding the
  // tab) doesn't silently wipe answers already given — mirrored into localStorage on
  // every change and rehydrated via the lazy useState initializers above.
  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey(), JSON.stringify({
        onboardingForm,
        prospectForm,
        userReport,
        prospectReport,
        selfMentalAnswers,
        prospectMentalAnswers
      }));
    } catch (e) {
      // Storage full/unavailable — draft persistence is best-effort only.
    }
  }, [onboardingForm, prospectForm, userReport, prospectReport, selfMentalAnswers, prospectMentalAnswers]);

  // Re-hydrate a saved profile draft when a user session is (re-)established on
  // this already-mounted provider — the important case being logging back in
  // after a logout. Login navigates client-side (router.push), so the provider
  // is NOT re-mounted and the one-time useState draft initializers above don't
  // re-run; clearAllSessionStates also blanked the in-memory forms. The draft
  // itself now survives in localStorage (see clearAllSessionStates), but without
  // this it would never repopulate the UI, so the user would still see a fresh
  // 0% profile after logging back in. Only fills forms still at their empty
  // defaults, so it can never clobber edits already made this session.
  const hydratedDraftUserId = useRef(null);
  useEffect(() => {
    const uid = user?.id;
    // Logged out — reset the guard so a subsequent re-login (even as the same
    // user id) rehydrates instead of being skipped as "already hydrated".
    if (!uid) { hydratedDraftUserId.current = null; return; }
    if (hydratedDraftUserId.current === uid) return;
    hydratedDraftUserId.current = uid;

    cachedDraft = undefined; // force a fresh read scoped to this user id
    const draft = loadDraft();
    if (!draft) return;

    const isBlank = (obj) => !obj || Object.values(obj).every((v) => v === '' || v === undefined || v === null);
    if (draft.onboardingForm && isBlank(onboardingForm)) setOnboardingForm((prev) => ({ ...prev, ...draft.onboardingForm }));
    if (draft.prospectForm && isBlank(prospectForm)) setProspectForm((prev) => ({ ...prev, ...draft.prospectForm }));
    if (draft.userReport && !userReport) setUserReport(draft.userReport);
    if (draft.prospectReport && !prospectReport) setProspectReport(draft.prospectReport);
    if (draft.selfMentalAnswers && Object.keys(selfMentalAnswers).length === 0) setSelfMentalAnswers(draft.selfMentalAnswers);
    if (draft.prospectMentalAnswers && Object.keys(prospectMentalAnswers).length === 0) setProspectMentalAnswers(draft.prospectMentalAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load user session on mount
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        // Shared single-flight refresh (see utils/api.js). Previously this did
        // its own separate raw fetch that didn't coordinate with apiFetch's
        // refresh, so the two could POST the same refresh token concurrently
        // (or twice under a StrictMode double-mount) and race the backend's
        // rotate-and-revoke — the second hitting a revoked token → 401 → a
        // spurious logout. refreshAuthSession() collapses all of them into one.
        const data = await refreshAuthSession();
        if (data?.user) {
          localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
          setUser(data.user);
          setRunsUsed(data.user.runs_used || 0);
          setChatsUsed(data.user.chats_used || 0);
          fetchRecentMatches(data.user.id);
          return true;
        }
      } catch (err) {
        console.error('Silent refresh failed on mount:', err);
      }
      return false;
    };

    // Pages a logged-out visitor is meant to land on — never bounce away from these.
    const isPublicPath = (pathname) =>
      pathname === '/' || pathname === '' || pathname === '/login' || pathname.startsWith('/invite/');

    const handleSessionExpired = () => {
      clearAllSessionStates();
      if (!isPublicPath(window.location.pathname)) {
        window.location.href = '/';
      }
    };
    window.addEventListener('auth_session_expired', handleSessionExpired);

    silentRefresh().then((success) => {
      if (!success) {
        clearAllSessionStates();
        if (!isPublicPath(window.location.pathname)) {
          window.location.href = '/';
        }
        return;
      }
      const savedUser = localStorage.getItem('slayhealth_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (!parsed.name || !parsed.gender || !parsed.activity_level) {
            setOnboardingStep(1);
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => {
      window.removeEventListener('auth_session_expired', handleSessionExpired);
    };
  }, []);

  const fetchRecentMatches = async (userId) => {
    if (!userId) return [];
    setIsMatchesLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMatchesList(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch matches list:', err);
      return [];
    } finally {
      setIsMatchesLoading(false);
    }
  };

  const fetchActiveMatchDetails = async (matchId) => {
    if (!matchId) return;
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches/${matchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.match) {
          setActiveMatchDetails(data.match);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active match details:', err);
    }
  };

  const handleResetQuota = async () => {
    if (!user) return;
    setIsUpgradingQuota(true);
    try {
      const res = await apiFetch(`${API_URL}/api/auth/reset-quota`, {
        method: 'POST',
        body: JSON.stringify({ id: user.id })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
        setUser(data.user);
        setRunsUsed(0);
        setChatsUsed(0);
        setChronicResult(null);
        setMfrResult(null);
        setMentalResult(null);
        setActiveMatchId(null);
        setChatSessionId(null);
        setIsChatOpen(false);
        toast.success('Quota has been reset! (Free Match and Counselor messages restored)');
      }
    } catch (err) {
      console.error('Quota reset failed:', err);
      toast.error('Quota reset failed');
    } finally {
      setIsUpgradingQuota(false);
    }
  };

  const handleLogout = async () => {
    try {
      const savedRefreshToken = localStorage.getItem('slayhealth_refresh_token');
      await apiFetch(`${API_URL}/api/auth/logout`, { 
        method: 'POST',
        body: JSON.stringify({ refreshToken: savedRefreshToken })
      });
    } catch (err) {
      console.error('Failed to logout cleanly from server:', err);
    }
    clearAllSessionStates();
    setAuthPhone('');
    setAuthOtp('');
    setAuthStep('phone');
    setOnboardingStep(0);
    setIsChatOpen(false);
    setUserReport(null);
    setProspectReport(null);
  };

  const responseJson = async (res) => {
    try { return await res.json(); } catch (e) { return {}; }
  };

  // Run Compatibility Matching
  const handleCompatibilityMatch = async (selfUser = user) => {
    if (!userReport || !prospectReport) {
      toast.error('Please upload pathology reports for both yourself and your prospect first.');
      return;
    }

    const missing = [];
    if (!prospectForm.name.trim()) missing.push("Partner's Name");
    if (!prospectForm.dob) missing.push("Partner's DOB");
    if (!prospectForm.city.trim()) missing.push("Partner's City");
    if (!prospectForm.activity_level) missing.push("Partner's Activity Level");
    if (!prospectForm.drinking_habits) missing.push("Partner's Drinking habits");
    if (!prospectForm.smoking_habits) missing.push("Partner's Smoking & Tobacco habits");
    if (!prospectForm.sleep_cycle) missing.push("Partner's Sleep cycle");
    if (!prospectForm.height) missing.push("Partner's Height");
    if (!prospectForm.weight) missing.push("Partner's Weight");
    if (!prospectForm.waist) missing.push("Partner's Waist size");
    if (!prospectForm.meetingSource) missing.push("How you met");
    if (prospectForm.meetingSource === 'Matrimonial Platform' && !prospectForm.platformName) missing.push("Matrimonial platform name");

    if (missing.length > 0) {
      setMatchError(`Please fill in the following columns to proceed: ${missing.join(", ")}`);
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setSelectedProjYear(0);

    const userWeight = parseFloat(selfUser.weight) || 70;
    const userHeight = parseFloat(selfUser.height) || 170;
    const userBmi = parseFloat((userWeight / Math.pow(userHeight / 100, 2)).toFixed(1));
    const prospectWeight = parseFloat(prospectForm.weight) || 70;
    const prospectHeight = parseFloat(prospectForm.height) || 170;
    const prospectBmi = parseFloat((prospectWeight / Math.pow(prospectHeight / 100, 2)).toFixed(1));

    // Case-insensitive on purpose: the real gender picker (GENDERS in
    // lifestyleOptions.js) stores capitalized 'Male'/'Female', and the profile save/
    // load round-trip (auth.controller.js's updateProfile) never normalizes it — a
    // bare === 'male' check here was always false for every real user, silently
    // swapping which partner's manual data AND which partner's actual uploaded
    // report (male_report_id/female_report_id below) fed which sex-specific scoring
    // path for every match created through the live UI.
    const isUserMale = selfUser.gender?.toLowerCase() === 'male';
    const maleManual = isUserMale ? {
      name: selfUser.name,
      age: calculateAge(selfUser.dob),
      bmi: userBmi,
      waist: classifyWaist(selfUser.waist, 'male'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      // WS1A04/WS3B01: was hardcoded false regardless of a person's real family
      // history — now reads the wizard's Family History of Diabetes answer
      // ('None'/'One'/'Both'), defaulting to 'None' only when genuinely unanswered.
      history: { parentDiabetes: selfUser.parentDiabetes || 'None' }
    } : {
      name: prospectForm.name,
      age: calculateAge(prospectForm.dob),
      bmi: prospectBmi,
      waist: classifyWaist(prospectForm.waist, 'male'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: prospectForm.parentDiabetes || 'None' }
    };

    const femaleManual = isUserMale ? {
      name: prospectForm.name,
      age: calculateAge(prospectForm.dob),
      bmi: prospectBmi,
      waist: classifyWaist(prospectForm.waist, 'female'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: prospectForm.parentDiabetes || 'None' }
    } : {
      name: selfUser.name,
      age: calculateAge(selfUser.dob),
      bmi: userBmi,
      waist: classifyWaist(selfUser.waist, 'female'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: selfUser.parentDiabetes || 'None' }
    };

    // Not currently drinking/smoking covers both 'Never' and 'Quit' — someone
    // who has stopped isn't a current user, same reasoning as
    // chronic.controller.js's LIFESTYLE_LRS.alcohol/smoking 'Quit' entries.
    const notCurrentlyDrinking = (habit) => habit === 'Never' || habit === 'Quit';
    const notCurrentlySmoking = (habit) => habit === 'Never' || habit === 'Quit';

    const sharedLifestyle = {
      diet: selfUser.drinking_habits === 'Never' && prospectForm.drinking_habits === 'Never' ? 'Healthy' : 'Mixed',
      activity: selfUser.activity_level === 'Sedentary' || prospectForm.activity_level === 'Sedentary' ? 'Sedentary' : 'Active',
      // Value comparison updated from lowercase 'never' (LIFESTYLE_SMOKING_TOBACCO
      // used to be lowercase-valued) to 'Never', and the else-branch value from
      // the now-dead 'Occasional' (no longer a LIFESTYLE_LRS.smoking key) to
      // 'Occasionally' — see chronic.controller.js's LIFESTYLE_LRS.smoking comment.
      smoking: notCurrentlySmoking(selfUser.smoking_habits) && notCurrentlySmoking(prospectForm.smoking_habits) ? 'Never' : 'Occasionally',
      // Key renamed from 'drinking' to 'alcohol': chronic.controller.js's
      // getEffectiveLifestyleLR reads shared_lifestyle_data?.alcohol
      // specifically (LIFESTYLE_LRS.alcohol) — the old 'drinking' key was
      // never read at all, so this fallback value never reached scoring
      // regardless of what either partner actually answered. Value updated
      // from the now-dead 'Occasional' (no longer a key in
      // LIFESTYLE_LRS.alcohol) to 'Occasionally', a real entry.
      alcohol: notCurrentlyDrinking(selfUser.drinking_habits) && notCurrentlyDrinking(prospectForm.drinking_habits) ? 'Never' : 'Occasionally',
      sleep: selfUser.sleep_cycle === 'irregular' || prospectForm.sleep_cycle === 'irregular' ? 'Irregular' : 'Normal',
      stress: 'Moderate'
    };

    try {
      const [chronicResponse, mfrResponse] = await Promise.all([
        apiFetch(`${API_URL}/api/chronic/analyze`, {
          method: 'POST',
          body: JSON.stringify({
            userId: selfUser.id,
            male_report_id: isUserMale ? userReport.report_metadata.report_id : prospectReport.report_metadata.report_id,
            female_report_id: isUserMale ? prospectReport.report_metadata.report_id : userReport.report_metadata.report_id,
            male_manual_data: maleManual,
            female_manual_data: femaleManual,
            shared_lifestyle_data: sharedLifestyle,
            match_id: activeMatchId
          })
        }),
        apiFetch(`${API_URL}/api/mfr/analyze`, {
          method: 'POST',
          body: JSON.stringify({
            userId: selfUser.id,
            male_report_id: isUserMale ? userReport.report_metadata.report_id : prospectReport.report_metadata.report_id,
            female_report_id: isUserMale ? prospectReport.report_metadata.report_id : userReport.report_metadata.report_id,
            // semenQuality/ovarianReserve used to be hardcoded 'Normal' here —
            // mfr.controller.js resolves them as
            // `male_manual_data.semenQuality || calculatedSemen?.category || 'Not Assessed'`
            // (manual data checked FIRST), so that literal always won outright over
            // calculatedSemen/calculatedReserve, the REAL classification the backend
            // computes from this exact match's uploaded pathology report a few lines
            // above — discarding it every time, for every couple, regardless of what
            // was actually uploaded. Omitting these fields entirely lets that real,
            // per-couple classification (or the backend's own honest 'Not Assessed'
            // when no report/marker is present) reach the score, the barrier gate,
            // and the AI-generated findings/summary.
            male_manual_data: {
              name: maleManual.name,
              age: maleManual.age
            },
            female_manual_data: {
              name: femaleManual.name,
              age: femaleManual.age
            },
            shared_lifestyle: {
              smoke: sharedLifestyle.smoking === 'Never' ? 0 : 0.5,
              bmi: isUserMale ? (userBmi > 25 ? 0.5 : 0) : (prospectBmi > 25 ? 0.5 : 0),
              act: sharedLifestyle.activity === 'Sedentary' ? 0.5 : 0,
              alc: sharedLifestyle.alcohol === 'Never' ? 0 : 0.5,
              stress: 0.2,
              freq: 0.92,
              lifestyle_index: sharedLifestyle.overall_score || 85
            },
            barriers: {
              b_tubal: false,
              b_azoo: false,
              b_uterus: false
            },
            match_id: activeMatchId
          })
        })
      ]);

      if (chronicResponse.status === 403) {
        throw new Error('Quota exceeded. You have already used your 1 free compatibility match run. Please upgrade to premium!');
      }

      if (!chronicResponse.ok || !mfrResponse.ok) {
        throw new Error('Clinical engines evaluation failed.');
      }

      const cData = await responseJson(chronicResponse);
      const mData = await responseJson(mfrResponse);

      // Save match to backend
      let savedMatchId = null;
      try {
        const saveRes = await apiFetch(`${API_URL}/api/compatibility/save-match`, {
          method: 'POST',
          body: JSON.stringify({
            userId: selfUser.id,
            chronicResult: cData,
            mfrResult: mData,
            maleManual: maleManual,
            femaleManual: femaleManual,
            maleReportId: isUserMale ? userReport?.report_metadata?.report_id : prospectReport?.report_metadata?.report_id,
            femaleReportId: isUserMale ? prospectReport?.report_metadata?.report_id : userReport?.report_metadata?.report_id
          })
        });
        const saveData = await saveRes.json();
        if (saveData.success && saveData.match_id) {
          savedMatchId = saveData.match_id;
          setActiveMatchId(saveData.match_id);
          fetchActiveMatchDetails(saveData.match_id);
        }
      } catch (saveErr) {
        console.error('Failed to save match to history', saveErr);
      }

      setChronicResult(cData);
      setMfrResult(mData);
      setMentalResult(null); // Reset mental result for the new match scan
      setRunsUsed(prev => prev + 1);
      fetchRecentMatches(selfUser.id);
      return { success: true, matchId: savedMatchId }; // Match succeeded
    } catch (err) {
      setMatchError(err.message || 'Failed to match profiles.');
      return { success: false, matchId: null }; // Match failed
    } finally {
      setIsMatching(false);
    }
  };

  const restoreMatchSession = (match) => {
    if (!match || !match.analysis) return;
    
    if (match.analysis.chronicResult) {
      setChronicResult(match.analysis.chronicResult);
    }
    if (match.analysis.mfrResult) {
      setMfrResult(match.analysis.mfrResult);
    }
    if (match.analysis.mentalResult) {
      setMentalResult(match.analysis.mentalResult);
    } else {
      setMentalResult(null);
    }
    setActiveMatchId(match.id);
    fetchActiveMatchDetails(match.id);

    // Restore prospect details from stored manual data or matches list
    const details = match.analysis.details || {};
    // Case-insensitive on purpose — the real gender picker (GENDERS in
    // lifestyleOptions.js) stores capitalized 'Male'/'Female', so a bare === 'male'
    // check here would always be false and silently mis-derive the prospect's
    // restored gender. The same bare lowercase comparison also existed at
    // handleCompatibilityMatch's isUserMale (~line 572), which drives which
    // report/manual-data slot each partner's real data lands in during live match
    // creation — fixed there too.
    const isUserMale = user?.gender?.toLowerCase() === 'male';
    const restoredProspectName = isUserMale
      ? details.female_manual_data?.name
      : details.male_manual_data?.name;

    if (restoredProspectName) {
      setProspectForm(prev => ({ ...prev, name: restoredProspectName }));
    } else if (match.prospect?.name && match.prospect.name !== 'Partner B') {
      setProspectForm(prev => ({ ...prev, name: match.prospect.name }));
    }

    // WS6-05: this previously restored only the prospect's name — gender and DOB
    // were left at whatever prospectForm already held (often blank), so reopening a
    // saved match and then uploading the prospect's radiology report could silently
    // score a real male prospect as Female/age-defaulted. Gender is always knowable
    // with certainty here (it's the mirror of the current user's own gender, which
    // manual_data slot — male_manual_data vs female_manual_data — the prospect's data
    // lives in is exactly that mirror), so it's restored unconditionally rather than
    // left to whatever stale value prospectForm happened to hold. DOB is not
    // restored: only a derived age number was ever persisted (age = calculateAge(dob)
    // at match time, see handleCompatibilityMatch), not the real DOB itself, and
    // synthesizing a fake DOB from that number would just be a subtler version of
    // the same fabrication this fix exists to remove — the upload-time guard added
    // in usg/page.js already blocks with an actionable message when DOB is genuinely
    // unknown, rather than silently defaulting it.
    setProspectForm(prev => ({ ...prev, gender: isUserMale ? 'Female' : 'Male' }));

    // Clear current chat to force it to refetch the saved session
    setChatSessionId(null);
    setIsChatOpen(false);
  };

  // WS8-01: report pages (core-engine/*) previously read match data ONLY from this
  // context's in-memory state, which never survives a hard refresh/deep-link/shared
  // URL — landing the user back on /dashboard with the report silently gone. This
  // hydrates the same state a normal click-through from the dashboard would set,
  // but from a matchId alone (e.g. read from a ?match= URL param), by fetching the
  // raw match row and reusing restoreMatchSession's existing restoration logic
  // (gender/name rehydration, chat session reset, etc.) rather than duplicating it.
  // Returns true if there was real data to hydrate, false otherwise.
  const hydrateFromMatchId = async (matchId) => {
    if (!matchId) return false;
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches/${matchId}`);
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success || !data.match) return false;

      const raw = data.match;
      let analysis = raw.analysis_json || {};
      if (typeof analysis === 'string') {
        try { analysis = JSON.parse(analysis); } catch (e) { analysis = {}; }
      }
      if (!analysis.chronicResult || !analysis.mfrResult) return false;

      restoreMatchSession({
        id: raw.id,
        analysis,
        prospect: { name: analysis.details?.female_manual_data?.name || 'Partner B' }
      });
      return true;
    } catch (err) {
      console.error('Failed to hydrate from matchId:', err);
      return false;
    }
  };

  const handleMentalAnalysis = async (partnerAAnswers, partnerBAnswers, matchIdOverride) => {
    try {
      const res = await apiFetch(`${API_URL}/api/mental/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          partner_A_answers: partnerAAnswers,
          partner_B_answers: partnerBAnswers,
          match_id: matchIdOverride ?? activeMatchId
        })
      });
      if (!res.ok) {
        throw new Error('Analysis request failed on server');
      }
      const data = await res.json();
      if (data.success && data.mentalResult) {
        setMentalResult(data.mentalResult);
        fetchRecentMatches(user.id);
        return true;
      } else {
        throw new Error(data.error || 'Failed to process mental profile analysis.');
      }
    } catch (err) {
      toast.error(err.message || 'An error occurred during profiling.');
      return false;
    }
  };

  return (
    <CompatibilityContext.Provider value={{
      user, setUser,
      authPhone, setAuthPhone,
      authOtp, setAuthOtp,
      authStep, setAuthStep,
      isAuthLoading, setIsAuthLoading,
      authError, setAuthError,
      runsUsed, setRunsUsed,
      chatsUsed, setChatsUsed,
      isUpgradingQuota, setIsUpgradingQuota,
      matchesList, setMatchesList,
      isMatchesLoading, setIsMatchesLoading,
      onboardingStep, setOnboardingStep,
      onboardingForm, setOnboardingForm,
      prospectForm, setProspectForm,
      userReport, setUserReport,
      prospectReport, setProspectReport,
      selfMentalAnswers, setSelfMentalAnswers,
      prospectMentalAnswers, setProspectMentalAnswers,
      isUserUploading, setIsUserUploading,
      isProspectUploading, setIsProspectUploading,
      userUploadError, setUserUploadError,
      prospectUploadError, setProspectUploadError,
      isMatching, setIsMatching,
      matchError, setMatchError,
      chronicResult, setChronicResult,
      mfrResult, setMfrResult,
      mentalResult, setMentalResult,
      activeMatchId, setActiveMatchId,
      activeMatchDetails, setActiveMatchDetails,
      selectedTab, setSelectedTab,
      selectedProjYear, setSelectedProjYear,
      chatSessionId, setChatSessionId,
      fetchActiveMatchDetails,
      isChatOpen, setIsChatOpen,
      showCalculations, setShowCalculations,
      fetchRecentMatches,
      restoreMatchSession,
      hydrateFromMatchId,
      handleResetQuota,
      handleLogout,
      handleCompatibilityMatch,
      handleMentalAnalysis
    }}>
      {children}
    </CompatibilityContext.Provider>
  );
}

export function useCompatibility() {
  const context = useContext(CompatibilityContext);
  if (!context) {
    throw new Error('useCompatibility must be used within a CompatibilityProvider');
  }
  return context;
}
