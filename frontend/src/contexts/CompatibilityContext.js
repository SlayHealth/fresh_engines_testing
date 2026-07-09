'use client';

import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { API_URL } from '../config/api';
import { parsePatientMeta, findExtractedParam } from '../utils/reportParser';
import { apiFetch, setAccessToken } from '../utils/api';
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
  
  if (data.parentDiabetes) drivers.push("family history (maternal or paternal diabetes)");
  
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
  relationshipStatus: user?.relationshipStatus || 'Single',
  marriageTimeline: user?.marriageTimeline || 'Not sure yet',
  activity_level: user?.activity_level || '',
  daily_steps: user?.daily_steps || '',
  occupation_style: user?.occupation_style || '',
  drinking_habits: user?.drinking_habits || '',
  smoking_habits: user?.smoking_habits || '',
  tobacco_habits: user?.tobacco_habits || '',
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
  const [onboardingForm, setOnboardingForm] = useState({
    userName: '',
    userRelation: '',
    candidateName: '',
    candidateGender: '',
    candidateDob: '',
    candidateCity: '',
    relationshipStatus: '',
    marriageTimeline: '',
    activity_level: '',
    daily_steps: '',
    occupation_style: '',
    drinking_habits: '',
    smoking_habits: '',
    tobacco_habits: '',
    sleep_cycle: '',
    height: '',
    weight: '',
    waist: '',
    menstrualCycle: ''
  });

  const [prospectForm, setProspectForm] = useState({
    name: '',
    gender: '',
    dob: '',
    city: '',
    meetingSource: '',
    platformName: '',
    meetingStory: '',
    activity_level: '',
    daily_steps: '',
    occupation_style: '',
    drinking_habits: '',
    smoking_habits: '',
    tobacco_habits: '',
    sleep_cycle: '',
    height: '',
    weight: '',
    waist: '',
    menstrualCycle: ''
  });

  // Pathology Uploads
  const [userReport, setUserReport] = useState(null);
  const [prospectReport, setProspectReport] = useState(null);
  const [isUserUploading, setIsUserUploading] = useState(false);
  const [isProspectUploading, setIsProspectUploading] = useState(false);
  const [userUploadError, setUserUploadError] = useState(null);
  const [prospectUploadError, setProspectUploadError] = useState(null);

  // Mental wellbeing opt-in + answers, per person — shared across add-prospect's
  // wizard and the dashboard's health-profile progress cards.
  const [selfMentalOptIn, setSelfMentalOptIn] = useState(null);
  const [selfMentalAnswers, setSelfMentalAnswers] = useState({});
  const [prospectMentalOptIn, setProspectMentalOptIn] = useState(null);
  const [prospectMentalAnswers, setProspectMentalAnswers] = useState({});

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
    setOnboardingForm({
      userName: '',
      userRelation: '',
      candidateName: '',
      candidateGender: '',
      candidateDob: '',
      candidateCity: '',
      relationshipStatus: '',
      marriageTimeline: '',
      activity_level: '',
      daily_steps: '',
      occupation_style: '',
      drinking_habits: '',
      smoking_habits: '',
      tobacco_habits: '',
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
      daily_steps: '',
      occupation_style: '',
      drinking_habits: '',
      smoking_habits: '',
      tobacco_habits: '',
      sleep_cycle: '',
      height: '',
      weight: '',
      waist: '',
      menstrualCycle: ''
    });
  };

  // Load user session on mount
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const savedRefreshToken = localStorage.getItem('slayhealth_refresh_token');
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: savedRefreshToken })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.accessToken) {
            setAccessToken(data.accessToken);
            if (data.refreshToken) {
              localStorage.setItem('slayhealth_refresh_token', data.refreshToken);
            }
            if (data.user) {
              localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
              setUser(data.user);
              setRunsUsed(data.user.runs_used || 0);
              setChatsUsed(data.user.chats_used || 0);
              fetchRecentMatches(data.user.id);
              return true;
            }
          }
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
    if (!userId) return;
    setIsMatchesLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMatchesList(data);
      }
    } catch (err) {
      console.error('Failed to fetch matches list:', err);
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
    if (!prospectForm.name.trim()) missing.push("Prospect's Name");
    if (!prospectForm.dob) missing.push("Prospect's DOB");
    if (!prospectForm.city.trim()) missing.push("Prospect's City");
    if (!prospectForm.activity_level) missing.push("Prospect's Activity Level");
    if (!prospectForm.daily_steps) missing.push("Prospect's Daily Steps");
    if (!prospectForm.occupation_style) missing.push("Prospect's Occupation style");
    if (!prospectForm.drinking_habits) missing.push("Prospect's Drinking habits");
    if (!prospectForm.smoking_habits) missing.push("Prospect's Smoking habits");
    if (!prospectForm.tobacco_habits) missing.push("Prospect's Tobacco habits");
    if (!prospectForm.sleep_cycle) missing.push("Prospect's Sleep cycle");
    if (!prospectForm.height) missing.push("Prospect's Height");
    if (!prospectForm.weight) missing.push("Prospect's Weight");
    if (!prospectForm.waist) missing.push("Prospect's Waist size");
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

    const isUserMale = selfUser.gender === 'male';
    const maleManual = isUserMale ? {
      name: selfUser.name,
      age: calculateAge(selfUser.dob),
      bmi: userBmi,
      waist: classifyWaist(selfUser.waist, 'male'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    } : {
      name: prospectForm.name,
      age: calculateAge(prospectForm.dob),
      bmi: prospectBmi,
      waist: classifyWaist(prospectForm.waist, 'male'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    };

    const femaleManual = isUserMale ? {
      name: prospectForm.name,
      age: calculateAge(prospectForm.dob),
      bmi: prospectBmi,
      waist: classifyWaist(prospectForm.waist, 'female'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    } : {
      name: selfUser.name,
      age: calculateAge(selfUser.dob),
      bmi: userBmi,
      waist: classifyWaist(selfUser.waist, 'female'),
      bloodPressure: 'Normal',
      glucose: 'Normal',
      lipids: 'Normal',
      history: { parentDiabetes: false }
    };

    const sharedLifestyle = {
      diet: selfUser.drinking_habits === 'Never' && prospectForm.drinking_habits === 'Never' ? 'Healthy' : 'Mixed',
      activity: selfUser.activity_level === 'Sedentary' || prospectForm.activity_level === 'Sedentary' ? 'Sedentary' : 'Active',
      smoking: selfUser.smoking_habits === 'never' && prospectForm.smoking_habits === 'never' ? 'Never' : 'Occasional',
      drinking: selfUser.drinking_habits === 'Never' && prospectForm.drinking_habits === 'Never' ? 'Never' : 'Occasional',
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
            male_manual_data: {
              name: maleManual.name,
              age: maleManual.age,
              semenQuality: 'Normal',
              scrotalFinding: 'Normal'
            },
            female_manual_data: {
              name: femaleManual.name,
              age: femaleManual.age,
              ovarianReserve: 'Normal'
            },
            shared_lifestyle: {
              smoke: sharedLifestyle.smoking === 'Never' ? 0 : 0.5,
              bmi: isUserMale ? (userBmi > 25 ? 0.5 : 0) : (prospectBmi > 25 ? 0.5 : 0),
              act: sharedLifestyle.activity === 'Sedentary' ? 0.5 : 0,
              alc: sharedLifestyle.drinking === 'Never' ? 0 : 0.5,
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
    const isUserMale = user?.gender === 'male';
    const restoredProspectName = isUserMale 
      ? details.female_manual_data?.name 
      : details.male_manual_data?.name;

    if (restoredProspectName) {
      setProspectForm(prev => ({ ...prev, name: restoredProspectName }));
    } else if (match.prospect?.name && match.prospect.name !== 'Partner B') {
      setProspectForm(prev => ({ ...prev, name: match.prospect.name }));
    }
    
    // Clear current chat to force it to refetch the saved session
    setChatSessionId(null);
    setIsChatOpen(false);
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
      selfMentalOptIn, setSelfMentalOptIn,
      selfMentalAnswers, setSelfMentalAnswers,
      prospectMentalOptIn, setProspectMentalOptIn,
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
