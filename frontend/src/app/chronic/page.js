'use client';

import { useState, useRef, useMemo } from 'react';
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, Activity, HeartPulse, 
  ShieldCheck, FlaskConical, Users, Stethoscope, ClipboardList, Info, TriangleAlert, ArrowRight, Plus, RotateCcw, MessageSquare 
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import styles from './page.module.css';
import ManualInputs from '../../components/ManualInputs';
import ReportChatDrawer from '../../components/ReportChatDrawer';
import { API_URL } from '../../config/api';
import { apiFetch } from '../../utils/api';
import { parsePatientMeta, findExtractedParam } from '../../utils/reportParser';

/* ── Tiny UI atoms and helpers from HSPv2 ── */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (x) => (x == null || Number.isNaN(x) ? "—" : Math.round(x));

const SEV = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", lab: "Normal" },
  borderline: { dot: "bg-amber-500", text: "text-amber-700", lab: "Borderline" },
  high: { dot: "bg-rose-500", text: "text-rose-700", lab: "High" },
};
const BAND = {
  low: { ring: "ring-emerald-200", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", label: "Low", note: "Under 30 — high negative predictive value (95.1%); undiagnosed diabetes unlikely." },
  mod: { ring: "ring-amber-200", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500", label: "Moderate", note: "30–50 — elevated; warrants confirmatory glucose testing." },
  high: { ring: "ring-rose-200", chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500", label: "High", note: "≥ 60 — CURES screening cut-off. ~1 in 6 carry undiagnosed diabetes (PPV 17%)." },
};

function idrsBand(s) {
  if (s < 30) return BAND.low;
  if (s < 60) return BAND.mod;
  return BAND.high;
}

function flagHbA1c(v) { if (v == null) return null; return v >= 6.5 ? "high" : v >= 5.7 ? "borderline" : "ok"; }
function flagBP(s, d) { if (s == null) return null; return s >= 140 || d >= 90 ? "high" : s >= 130 || d >= 85 ? "borderline" : "ok"; }
function flagBMI(v) { if (v == null) return null; return v >= 25 ? "high" : v >= 23 ? "borderline" : "ok"; }
function flagTG(v) { if (v == null) return null; return v >= 200 ? "high" : v >= 150 ? "borderline" : "ok"; }
function flagHDL(v, sex) { if (v == null) return null; const low = sex === "male" ? 40 : 50; return v < low ? "high" : v < low + 10 ? "borderline" : "ok"; }
function flagHOMA(v) { if (v == null) return null; return v >= 2.5 ? "high" : v >= 2.0 ? "borderline" : "ok"; }
function flagCRP(v) { if (v == null) return null; return v >= 3 ? "high" : v >= 1 ? "borderline" : "ok"; }

function biomarkerFlags(p, premium) {
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

function getDriftedBiomarkers(raw, lifestyle, years, sex) {
  const drifted = { ...raw };
  
  // 1. BMI drift
  if (raw.bmi != null) {
    let bmiDrift = 0.03;
    if (lifestyle.activity === 'Sedentary' || lifestyle.diet === 'Poor') {
      bmiDrift = 0.15;
    } else if (lifestyle.activity === 'Active' && lifestyle.diet === 'Healthy') {
      bmiDrift = -0.05;
    }
    drifted.bmi = parseFloat((raw.bmi + bmiDrift * years).toFixed(1));
  }

  // 2. BP drift
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

  // 3. HbA1c drift
  if (raw.hba1c != null) {
    let hba1cDrift = 0.015;
    if (lifestyle.diet === 'Poor' || lifestyle.activity === 'Sedentary') {
      hba1cDrift = 0.04;
    } else if (lifestyle.diet === 'Healthy' && lifestyle.activity === 'Active') {
      hba1cDrift = -0.01;
    }
    drifted.hba1c = parseFloat((raw.hba1c + hba1cDrift * years).toFixed(2));
  }

  // 4. Triglycerides drift
  if (raw.tg != null) {
    let tgDrift = 1.5;
    if (lifestyle.diet === 'Poor') {
      tgDrift = 3.5;
    }
    drifted.tg = Math.round(raw.tg + tgDrift * years);
  }

  // 5. HDL drift
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

function getRiskDrivers(data, age) {
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

function Chip({ className, children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

export default function ChronicPage() {
  const defaultMaleManual = {
    name: '',
    age: '',
    waist: '',
    bloodPressure: '',
    glucose: '',
    lipids: '',
    parentDiabetes: false,
    prematureHeartDisease: false,
    parentHbp: false
  };

  const defaultFemaleManual = {
    name: '',
    age: '',
    waist: '',
    bloodPressure: '',
    glucose: '',
    lipids: '',
    parentDiabetes: false,
    prematureHeartDisease: false,
    parentHbp: false
  };

  const defaultLifestyle = {
    diet: '',
    activity: '',
    smoking: '',
    drinking: '',
    sleep: '',
    stress: ''
  };

  // State for uploads and forms
  const [maleReport, setMaleReport] = useState(null);
  const [isMaleUploading, setIsMaleUploading] = useState(false);
  const [maleError, setMaleError] = useState(null);
  const [maleManualData, setMaleManualData] = useState(defaultMaleManual);
  const maleInputRef = useRef(null);

  const [femaleReport, setFemaleReport] = useState(null);
  const [isFemaleUploading, setIsFemaleUploading] = useState(false);
  const [femaleError, setFemaleError] = useState(null);
  const [femaleManualData, setFemaleManualData] = useState(defaultFemaleManual);
  const femaleInputRef = useRef(null);

  const [lifestyleData, setLifestyleData] = useState(defaultLifestyle);

  // Analysis result states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState(null);

  // Chat/Counselor states
  const [chatSessionId, setChatSessionId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Living Timeline Slider State
  const [selectedYear, setSelectedYear] = useState(0);

  const triggerMockExtraction = async (gender) => {
    const setIsUploading = gender === 'male' ? setIsMaleUploading : setIsFemaleUploading;
    const setError = gender === 'male' ? setMaleError : setFemaleError;
    const setReport = gender === 'male' ? setMaleReport : setFemaleReport;
    const setManual = gender === 'male' ? setMaleManualData : setFemaleManualData;

    setIsUploading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
        // Pre-fill some values
        if (gender === 'male') {
          setManual(prev => ({ 
            ...prev, 
            name: 'Pranav', 
            age: 34, 
            waist: 'Borderline', 
            bloodPressure: 'Normal', 
            glucose: 'Normal', 
            lipids: 'Normal', 
            parentDiabetes: true, 
            parentHbp: false, 
            prematureHeartDisease: false 
          }));
          setLifestyleData({
            diet: 'Healthy',
            activity: 'Moderate',
            smoking: 'Never',
            drinking: 'Never',
            sleep: 'Early bird',
            stress: 'Normal'
          });
        } else {
          setManual(prev => ({ 
            ...prev, 
            name: 'Aditi', 
            age: 29, 
            waist: 'Normal', 
            bloodPressure: 'Normal', 
            glucose: 'Normal', 
            lipids: 'Normal', 
            parentDiabetes: false, 
            parentHbp: false, 
            prematureHeartDisease: false 
          }));
        }
      } else {
        setError(data.error || 'Failed to extract data');
      }
    } catch (err) {
      setError('Connection to backend failed. Make sure the server is running.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file, gender) => {
    const setIsUploading = gender === 'male' ? setIsMaleUploading : setIsFemaleUploading;
    const setError = gender === 'male' ? setMaleError : setFemaleError;
    const setReport = gender === 'male' ? setMaleReport : setFemaleReport;
    const setManual = gender === 'male' ? setMaleManualData : setFemaleManualData;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await apiFetch(`${API_URL}/api/pathology/extract`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch(e) {
          throw new Error(`Server returned status ${response.status}`);
        }
        throw new Error(errorData?.error || 'Failed to extract data');
      }

      const data = await response.json();
      if (data.success) {
        setReport(data);
        
        // Auto-extract name, age, and clinical parameters
        const rawText = data.report_metadata?.raw_ocr_text || '';
        const meta = parsePatientMeta(rawText);
        const extracted = data.sections || {};
        
        let sbp = parseFloat(findExtractedParam(extracted, 'systolic_blood_pressure')?.value);
        let dbp = parseFloat(findExtractedParam(extracted, 'diastolic_blood_pressure')?.value);
        let hba1c = parseFloat(findExtractedParam(extracted, 'hba1c')?.value);
        let tc = parseFloat(findExtractedParam(extracted, 'total_cholesterol')?.value);
        let ldl = parseFloat(findExtractedParam(extracted, 'low_density_lipoprotein_cholesterol_ldl_c')?.value || findExtractedParam(extracted, 'ldl_cholesterol')?.value);
        let tg = parseFloat(findExtractedParam(extracted, 'triglycerides')?.value);

        // Regex fallbacks for clinical parameters if not found in sections
        if (isNaN(sbp) || isNaN(dbp)) {
          const bpMatch = rawText.match(/(?:BP|Blood\s*Pressure)\s*[:\-]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i) || rawText.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
          if (bpMatch) {
            if (isNaN(sbp)) sbp = parseFloat(bpMatch[1]);
            if (isNaN(dbp)) dbp = parseFloat(bpMatch[2]);
          }
        }
        if (isNaN(hba1c)) {
          const hba1cMatch = rawText.match(/HbA1c\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i) || rawText.match(/Glycated\s*Hemoglobin\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
          if (hba1cMatch) hba1c = parseFloat(hba1cMatch[1]);
        }
        if (isNaN(tc)) {
          const tcMatch = rawText.match(/(?:Total\s*)?Cholesterol\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
          if (tcMatch) tc = parseFloat(tcMatch[1]);
        }
        if (isNaN(ldl)) {
          const ldlMatch = rawText.match(/LDL\s*(?:Cholesterol)?\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
          if (ldlMatch) ldl = parseFloat(ldlMatch[1]);
        }
        if (isNaN(tg)) {
          const tgMatch = rawText.match(/Triglycerides\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
          if (tgMatch) tg = parseFloat(tgMatch[1]);
        }

        // Determine categories
        let glucoseCat = '';
        if (!isNaN(hba1c)) {
          glucoseCat = hba1c >= 6.5 ? 'High' : hba1c >= 5.7 ? 'Borderline' : 'Normal';
        }
        
        let bpCat = '';
        if (!isNaN(sbp)) {
          bpCat = (sbp >= 140 || dbp >= 90) ? 'High' : (sbp >= 130 || dbp >= 85) ? 'Elevated' : 'Normal';
        }

        let lipidsCat = '';
        if (!isNaN(tc) || !isNaN(ldl) || !isNaN(tg)) {
          const tcVal = tc || 0;
          const ldlVal = ldl || 0;
          const tgVal = tg || 0;
          if (tcVal >= 240 || ldlVal >= 160 || tgVal >= 200) {
            lipidsCat = 'High';
          } else if ((tcVal >= 200 && tcVal <= 239) || (ldlVal >= 130 && ldlVal <= 159) || (tgVal >= 150 && tgVal <= 199)) {
            lipidsCat = 'Borderline';
          } else {
            lipidsCat = 'Normal';
          }
        }

        setManual(prev => ({
          ...prev,
          name: meta.name || prev.name,
          age: meta.age || prev.age,
          glucose: glucoseCat || prev.glucose,
          bloodPressure: bpCat || prev.bloodPressure,
          lipids: lipidsCat || prev.lipids
        }));
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out after 60 seconds.');
      } else {
        setError(err.message || 'Connection failed.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsUploading(false);
    }
  };

  const handleLifestyleChange = (e) => {
    const { name, value } = e.target;
    setLifestyleData(prev => ({ ...prev, [name]: value }));
  };

  const handleAnalyzeChronic = async () => {
    if (!maleReport || !femaleReport) return;
    
    const missing = [];
    
    // Partner A
    if (!maleManualData.name?.trim()) missing.push("Prospect A Name");
    if (!maleManualData.age) missing.push("Prospect A Age");
    if (!maleManualData.waist) missing.push("Prospect A Waist Circumference");
    if (!maleManualData.bloodPressure) missing.push("Prospect A Blood Pressure");
    if (!maleManualData.glucose) missing.push("Prospect A Fasting Glucose");
    if (!maleManualData.lipids) missing.push("Prospect A Lipids Profile");

    // Partner B
    if (!femaleManualData.name?.trim()) missing.push("Prospect B Name");
    if (!femaleManualData.age) missing.push("Prospect B Age");
    if (!femaleManualData.waist) missing.push("Prospect B Waist Circumference");
    if (!femaleManualData.bloodPressure) missing.push("Prospect B Blood Pressure");
    if (!femaleManualData.glucose) missing.push("Prospect B Fasting Glucose");
    if (!femaleManualData.lipids) missing.push("Prospect B Lipids Profile");

    // Shared Lifestyle
    if (!lifestyleData.diet) missing.push("Diet Quality");
    if (!lifestyleData.activity) missing.push("Physical Activity");
    if (!lifestyleData.smoking) missing.push("Smoking Habits");
    if (!lifestyleData.drinking) missing.push("Drinking Habits");
    if (!lifestyleData.sleep) missing.push("Sleep Cycle");
    if (!lifestyleData.stress) missing.push("Stress Level");

    if (missing.length > 0) {
      setMatchError(`Please fill in the following columns to proceed: ${missing.join(", ")}`);
      return;
    }

    setIsAnalyzing(true);
    setMatchError(null);
    setSelectedYear(0); // Reset timeline to today

    try {
      const response = await apiFetch(`${API_URL}/api/chronic/analyze`, {
        method: 'POST',
        body: JSON.stringify({
          male_report_id: maleReport.report_metadata.report_id,
          female_report_id: femaleReport.report_metadata.report_id,
          male_manual_data: maleManualData,
          female_manual_data: femaleManualData,
          shared_lifestyle_data: lifestyleData
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setMatchResult(data);
      } else {
        throw new Error(data.error || 'Failed to analyze chronic health');
      }
    } catch (err) {
      setMatchError(err.message || 'Connection to backend failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setMaleReport(null);
    setFemaleReport(null);
    setMatchResult(null);
    setMatchError(null);
    setMaleError(null);
    setFemaleError(null);
    setMaleManualData(defaultMaleManual);
    setFemaleManualData(defaultFemaleManual);
    setLifestyleData(defaultLifestyle);
    setSelectedYear(0);
    setChatSessionId(null);
    setIsChatOpen(false);
  };

  const renderTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const femaleAge = matchResult.partner_B.age + data.year;
    const maleAge = matchResult.partner_A.age + data.year;
    return (
      <div className={styles.chartTooltip}>
        <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px', marginBottom: '5px' }}>
          Year {data.year}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          Household Baseline Index: <strong style={{ color: '#FBBF24' }}>{Math.round(data.current)}</strong>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          Household Optimised Index: <strong style={{ color: '#34D399' }}>{Math.round(data.optimized)}</strong>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          {maleManualData.name || 'Prospect 1'} IDRS: <strong style={{ color: '#2dd4bf' }}>{Math.round(data.A)}</strong>
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          {femaleManualData.name || 'Prospect 2'} IDRS: <strong style={{ color: '#a78bfa' }}>{Math.round(data.B)}</strong>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', justifyContent: 'center', opacity: 0.9 }}>
          <span>F-Age: <strong>{femaleAge}</strong></span>
          <span>•</span>
          <span>M-Age: <strong>{maleAge}</strong></span>
        </div>
      </div>
    );
  };

  // Derive dynamic dashboard states based on the Selected Year
  const m = useMemo(() => {
    if (!matchResult) return null;
    
    const year = selectedYear;
    
    // 1. Get projected IDRS scores
    const sA = matchResult.projection.idrsA[year];
    const sB = matchResult.projection.idrsB[year];
    
    const rawA = matchResult.partner_A.rawValues || {};
    const rawB = matchResult.partner_B.rawValues || {};
    const lifestyleA = matchResult.partner_A.lifestyle || {};
    const lifestyleB = matchResult.partner_B.lifestyle || {};

    // 2. Compute dynamic/drifted biomarkers
    const bioA = getDriftedBiomarkers(rawA, lifestyleA, year, 'male');
    const bioB = getDriftedBiomarkers(rawB, lifestyleB, year, 'female');

    const gateFired = matchResult.diabeticRangeDetected;
    const markersFlagged = bioA.flagged + bioB.flagged;
    
    // Check if HbA1c is in diabetic range after drift
    const currentHba1cA = bioA.rows.find(r => r.k === "HbA1c")?.v || rawA.hba1c || 0;
    const currentHba1cB = bioB.rows.find(r => r.k === "HbA1c")?.v || rawB.hba1c || 0;
    const diabeticCount = (currentHba1cA >= 6.5 ? 1 : 0) + (currentHba1cB >= 6.5 ? 1 : 0);

    // 3. Dynamic compatibility state based on projection curves
    const currentScenario = matchResult.projection.currentLifestyle[year];
    const optimisedScenario = matchResult.projection.optimizedLifestyle[year];
    
    let state = 'Aligned';
    if (gateFired || currentScenario < 50) {
      state = 'Specialist conversation';
    } else if (currentScenario < 75) {
      state = 'Plan together';
    }
    
    let tier = null;
    if (state === 'Specialist conversation') {
      tier = diabeticCount === 2 || markersFlagged >= 5 ? 'escalated' : (gateFired ? 'soft' : 'baseline');
    }

    const coupleIdx = (protA, protB, w) => {
      const lo = Math.min(protA, protB), hi = Math.max(protA, protB);
      return w * lo + (1 - w) * hi;
    };

    const protA = 100 - sA;
    const protB = 100 - sB;

    const bandLo = coupleIdx(protA, protB, 0.7);
    const bandHi = coupleIdx(protA, protB, 0.5);
    const central = coupleIdx(protA, protB, 0.6);
    
    const dividend = optimisedScenario - currentScenario;
    
    return {
      sA, sB, bioA, bioB, gateFired, markersFlagged, diabeticCount,
      state, tier, bandLo, bandHi, central, currentScenario, optimisedScenario, dividend,
      bandObjA: idrsBand(sA), bandObjB: idrsBand(sB),
      proj: matchResult.projection.years.map((y, i) => ({
        year: y,
        current: matchResult.projection.currentLifestyle[i],
        optimized: matchResult.projection.optimizedLifestyle[i],
        A: matchResult.projection.idrsA[i],
        B: matchResult.projection.idrsB[i]
      }))
    };
  }, [matchResult, selectedYear]);

  return (
    <div className={`${styles.chronicThemeWrapper} ${styles.latexDoc}`}>
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.docHeader}>
            <div className={styles.docPretitle}>Premarital Cardiometabolic Healthspan Evaluator</div>
            <h1 className={styles.title}>Cardiometabolic Health Journey &mdash; HSP v2.1</h1>
            <div className={styles.docMeta}>
              Map, project, and optimize shared household metabolic trajectories over a 10-year outlook.
            </div>
          </div>

          {/* Tab Navigation */}
          <div className={styles.tabs}>
            <Link href="/" className={`${styles.tabLink} ${styles.tabInactive}`}>
              Home
            </Link>
            <Link href="/usg" className={`${styles.tabLink} ${styles.tabInactive}`}>
              USG Abdomen
            </Link>
            <Link href="/chronic" className={`${styles.tabLink} ${styles.tabActive}`}>
              Chronic Health Engine
            </Link>
            <Link href="/mfr" className={`${styles.tabLink} ${styles.tabInactive}`}>
              Fertility Analysis
            </Link>
          </div>
        </header>

        {!matchResult && (
          <>
            <div className={styles.dualUploadContainer}>
              {/* Prospect 1 Upload */}
              <div className={styles.uploadWrapper}>
                <div className={styles.uploadLabel}>
                  {maleManualData.name ? `${maleManualData.name}'s Report` : "Prospect 1's Report"}
                </div>
                <div 
                  className={styles.dropzone}
                  onClick={() => !maleReport && maleInputRef.current?.click()}
                  style={maleReport ? { borderColor: 'var(--teal)', background: 'var(--soft-teal)' } : {}}
                >
                  <input 
                    type="file" 
                    ref={maleInputRef} 
                    onChange={(e) => e.target.files.length && handleFileUpload(e.target.files[0], 'male')} 
                    accept=".pdf" 
                    style={{ display: 'none' }} 
                  />
                  
                  {isMaleUploading ? (
                    <div className={styles.loader}></div>
                  ) : maleReport ? (
                    <CheckCircle size={36} color="var(--teal)" />
                  ) : (
                    <UploadCloud className={styles.uploadIcon} />
                  )}
                  
                  <div className={styles.uploadText}>
                    {isMaleUploading ? 'Extracting...' : maleReport ? 'Upload Successful' : 'Upload Prospect 1 PDF'}
                  </div>
                  
                  {maleError && <div style={{ color: 'var(--red-d)', fontSize: '12.5px' }}>{maleError}</div>}
                  
                  {!isMaleUploading && !maleReport && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerMockExtraction('male'); }}
                      className={styles.mockButton}
                    >
                      Use Mock Data
                    </button>
                  )}
                </div>
                <ManualInputs 
                  title={maleManualData.name ? `${maleManualData.name}'s Parameters` : "Prospect 1's Parameters"} 
                  data={maleManualData} 
                  onChange={setMaleManualData} 
                  gender="male"
                />
              </div>

              {/* Prospect 2 Upload */}
              <div className={styles.uploadWrapper}>
                <div className={styles.uploadLabel}>
                  {femaleManualData.name ? `${femaleManualData.name}'s Report` : "Prospect 2's Report"}
                </div>
                <div 
                  className={styles.dropzone}
                  onClick={() => !femaleReport && femaleInputRef.current?.click()}
                  style={femaleReport ? { borderColor: 'var(--teal)', background: 'var(--soft-teal)' } : {}}
                >
                  <input 
                    type="file" 
                    ref={femaleInputRef} 
                    onChange={(e) => e.target.files.length && handleFileUpload(e.target.files[0], 'female')} 
                    accept=".pdf" 
                    style={{ display: 'none' }} 
                  />
                  
                  {isFemaleUploading ? (
                    <div className={styles.loader}></div>
                  ) : femaleReport ? (
                    <CheckCircle size={36} color="var(--teal)" />
                  ) : (
                    <UploadCloud className={styles.uploadIcon} />
                  )}
                  
                  <div className={styles.uploadText}>
                    {isFemaleUploading ? 'Extracting...' : femaleReport ? 'Upload Successful' : 'Upload Prospect 2 PDF'}
                  </div>
                  
                  {femaleError && <div style={{ color: 'var(--red-d)', fontSize: '12.5px' }}>{femaleError}</div>}
                  
                  {!isFemaleUploading && !femaleReport && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); triggerMockExtraction('female'); }}
                      className={styles.mockButton}
                    >
                      Use Mock Data
                    </button>
                  )}
                </div>
                <ManualInputs 
                  title={femaleManualData.name ? `${femaleManualData.name}'s Parameters` : "Prospect 2's Parameters"} 
                  data={femaleManualData} 
                  onChange={setFemaleManualData} 
                  gender="female"
                />
              </div>
            </div>

            {/* Shared Household Lifestyle Inputs */}
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Shared Household Lifestyle</h2>
              <p className={styles.subtitle} style={{ margin: '0 0 20px', textAlign: 'left' }}>
                Define the shared household lifestyle inputs that act as a primary modifiable risk multiplier.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Diet Quality</label>
                  <select name="diet" value={lifestyleData.diet} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Diet...</option>
                    <option value="Healthy">Healthy</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Physical Activity</label>
                  <select name="activity" value={lifestyleData.activity} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Activity...</option>
                    <option value="Active">Active</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Sedentary">Sedentary</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Smoking Habits</label>
                  <select name="smoking" value={lifestyleData.smoking} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Smoking...</option>
                    <option value="Never">Never</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Drinking Habits</label>
                  <select name="drinking" value={lifestyleData.drinking} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Drinking...</option>
                    <option value="Never">Never</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Sleep Cycle</label>
                  <select name="sleep" value={lifestyleData.sleep} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Sleep...</option>
                    <option value="Early bird">Early bird</option>
                    <option value="Irregular">Irregular</option>
                    <option value="Night owl">Night owl</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Stress Level</label>
                  <select name="stress" value={lifestyleData.stress} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Stress...</option>
                    <option value="Normal">Normal</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
            </div>

            {matchError && (
              <div style={{ color: 'var(--red-d)', textAlign: 'center', marginBottom: '20px', fontSize: '14px' }}>
                <AlertCircle size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                {matchError}
              </div>
            )}

            <button 
              className={styles.actionButton}
              disabled={!maleReport || !femaleReport || isAnalyzing}
              onClick={handleAnalyzeChronic}
            >
              {isAnalyzing ? 'Analyzing Chronic Health...' : 'Analyze Chronic Health'}
            </button>
          </>
        )}

        {matchResult && m && (
          <section className={styles.dashboard}>
            
            {/* Living Timeline Slider */}
            <div className="mb-6 rounded-xl bg-slate-900 p-6 text-white shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400">Cardiometabolic Timeline Projection Simulator</h3>
              <p className="mt-1 text-xs text-slate-400">Slide to see how age progression and shared household habits drift your risk profiles over a 10-year horizon.</p>
              
              <div className="mt-6 px-4">
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  style={{ accentColor: '#0d9488' }}
                />
                <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
                  <span className={selectedYear === 0 ? "text-teal-400 font-bold" : ""}>Year 0 (Today)</span>
                  <span className={selectedYear === 5 ? "text-teal-400 font-bold" : ""}>Year 5 (Midpoint)</span>
                  <span className={selectedYear === 10 ? "text-teal-400 font-bold" : ""}>Year 10 (Future)</span>
                </div>
                <div className="mt-4 text-center text-sm font-semibold text-teal-300">
                  {selectedYear === 0 && "Current status: Your active premarital health baseline today"}
                  {selectedYear > 0 && selectedYear < 10 && `Outlook after ${selectedYear} years of shared household drift`}
                  {selectedYear === 10 && "10-Year outlook: Long-term health profile projection"}
                </div>
              </div>
            </div>

            {/* What kind of conversation this needs */}
            {(() => {
              const stateMeta = {
                'Aligned': { c: "emerald", label: "Health profiles are aligned", icon: ShieldCheck },
                'Plan together': { c: "blue", label: "Time to make a plan together", icon: Users },
                'Specialist conversation': { c: "rose", label: "Specialist medical conversation advised", icon: Stethoscope }
              }[m.state] || { c: "slate", label: "Pending", icon: Info };
              const Icon = stateMeta.icon;
              return (
                <section className="mt-6 rounded-xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-${stateMeta.c}-50 text-${stateMeta.c}-600`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">What kind of conversation this needs</span>
                      </div>
                      <h2 className={`text-xl font-semibold text-${stateMeta.c}-700`}>{stateMeta.label}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {m.state === "Aligned" && "Your health baselines are aligned today. No immediate warning flags were detected in your clinical panels. The focus now is on protecting this strong foundation as your household routines merge."}
                        {m.state === "Plan together" && `Your health profiles show minor variations that can be managed together. ${m.markersFlagged > 0 ? `${m.markersFlagged} health signal${m.markersFlagged > 1 ? "s" : ""} to watch across both partners — ` : ""}Setting shared diet, activity, and sleep habits early on will prevent these risks from drifting upwards.`}
                        {m.state === "Specialist conversation" && m.tier === "escalated" && `Your profiles show clinical markers that warrant review. ${m.markersFlagged} flags detected${m.diabeticCount === 2 ? ", including diabetic-range glucose in both partners" : ""}. This is a genuine shared matter, best worked through with a clinician-led plan before finalizing family and household timelines. Useful information, not a verdict.`}
                        {m.state === "Specialist conversation" && m.tier === "soft" && "One established clinical marker has been flagged, with other parameters remaining reasonable. This is manageable with a clear shared routine and a clinician conversation."}
                        {m.state === "Specialist conversation" && m.tier === "baseline" && `An elevated baseline risk score${m.markersFlagged ? ` alongside ${m.markersFlagged} flagged health signals` : ""}. Worth checking in with a clinician before finalising household plans — valuable screening context, not a verdict.`}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* LAYER A: Your Risk Profiles */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-600 text-[11px] text-white">A</span>
              Your risk profiles
              <Chip className="bg-teal-50 text-teal-700"><ShieldCheck size={11} /> Validated · CURES cohort</Chip>
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              This validated screening score assesses your current likelihood of metabolic conditions based on age, waist measurement, family history, and physical activity.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ tag: maleManualData.name || "Prospect 1", s: m.sA, band: m.bandObjA, age: maleManualData.age + selectedYear, origData: maleManualData },
                { tag: femaleManualData.name || "Prospect 2", s: m.sB, band: m.bandObjB, age: femaleManualData.age + selectedYear, origData: femaleManualData }].map(({ tag, s, band, age, origData }) => (
                <div key={tag} className={`rounded-xl border-l-4 border-teal-600 bg-white p-4 ring-1 ring-slate-200`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-slate-600">{tag} <span className="font-normal text-slate-400">(Age {age})</span></span>
                    <Chip className={band.chip}>{band.label} risk</Chip>
                  </div>
                  
                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Your current diabetes risk</span>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-semibold tabular-nums text-slate-900">{s}</span>
                      <span className="text-sm text-slate-400">/ 100 points</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${band.bar}`} style={{ width: `${s}%` }} />
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">What this means today</div>
                      <p className="mt-0.5 text-xs text-slate-600">{band.note}</p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">What drove it</div>
                      <p className="mt-0.5 text-xs text-slate-600">{getRiskDrivers(origData, age)}</p>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">What to do next</div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {band.label === 'Low' && "Continue your current physical activity and diet routines to maintain this healthy baseline."}
                        {band.label === 'Moderate' && "Improving active habits (e.g., walking 15-20 minutes daily) and monitoring nutrition can lower this score substantially."}
                        {band.label === 'High' && "We recommend consulting a doctor for a standard screening test and working on a structured nutrition and exercise routine."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Asymmetry - How far apart your health baselines are */}
            <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">How far apart your health baselines are</span>
                <span className="font-mono tabular-nums text-slate-500">gap: {Math.abs(m.sA - m.sB)} pts</span>
              </div>
              <div className="relative h-8 rounded-md bg-gradient-to-r from-emerald-100 via-amber-100 to-rose-100">
                {[{ l: maleManualData.name ? maleManualData.name[0] : "1", v: m.sA }, 
                  { l: femaleManualData.name ? femaleManualData.name[0] : "2", v: m.sB }].map((d, i) => (
                  <div key={i} className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center justify-center" style={{ left: `${clamp(d.v, 0, 100)}%` }}>
                    <div className="h-8 w-0.5 bg-slate-700" />
                    <span className="absolute -top-0 rounded bg-slate-800 px-1 text-[10px] font-semibold text-white">{d.l}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {Math.abs(m.sA - m.sB) <= 10 ? 
                  "Well-matched baselines — you are starting from a very similar health tier, which makes adopting joint household routines straightforward." :
                  `${m.sA < m.sB ? (maleManualData.name || "Prospect 1") : (femaleManualData.name || "Prospect 2")} has a lower risk score and acts as the healthy anchor. Since couples tend to converge toward the less active partner's habits over time, it is vital to consciously align towards the healthier routine.`
                }
              </p>
            </div>

            {/* Health signals to watch */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[11px] text-white">+</span>
              Health signals to watch
              <Chip className="bg-slate-100 text-slate-600">Not folded into the validated score</Chip>
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              These clinical values are extracted from your pathology reports. They are kept separate from the validated score and provide critical metabolic context.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ tag: maleManualData.name || "Prospect 1", bio: m.bioA }, { tag: femaleManualData.name || "Prospect 2", bio: m.bioB }].map(({ tag, bio }) => (
                <div key={tag} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">{tag}</span>
                    <span className="text-slate-400 font-medium">{bio.flagged} of {bio.count} flagged</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bio.rows.filter((r) => r.f).map((r) => (
                      <div key={r.k} className="flex items-center justify-between py-2 text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${SEV[r.f].dot}`} />
                          {r.k}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-slate-700 font-medium">{r.v}{r.unit && <span className="text-slate-400"> {r.unit}</span>}</span>
                          <span className={`w-20 text-right text-xs font-semibold ${SEV[r.f].text}`}>{SEV[r.f].lab}</span>
                        </span>
                      </div>
                    ))}
                    {bio.flagged === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No biomarker flags detected for this year.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* LAYER B: couple influence index */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[11px] text-white">B</span>
              How much your routines shape each other
              <Chip className="bg-amber-100 text-amber-800"><TriangleAlert size={11} /> Uncalibrated · relative ordering</Chip>
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              This models how shared household routines (like shared meals, sleep cycles, and joint activity levels) will influence your individual baselines over time.
            </p>
            <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/30 p-5">
              <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                <div>
                  <span className="text-[11px] uppercase tracking-wide font-bold text-amber-700">How you affect each other (index range)</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-semibold tabular-nums text-amber-900">{fmt(m.bandLo)}–{fmt(m.bandHi)}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800/70">central score: {fmt(m.central)} at w=0.60</p>
                  <p className="mt-3 max-w-xs text-xs leading-relaxed text-amber-900/70">
                    This range represents the spectrum of convergence. If you merge routines, you will drift toward a shared average. If you adopt the less active partner's habits, you drift toward the lower band. Aligning on healthy habits pulls you toward the higher band.
                  </p>
                </div>
                <div className="space-y-4">
                  {/* band visual */}
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] font-semibold text-amber-800"><span>0 (Less Healthy Drift)</span><span>Relative convergence spectrum</span><span>100 (Optimal)</span></div>
                    <div className="relative h-6 rounded-full bg-white ring-1 ring-amber-200">
                      <div className="absolute top-0 h-6 rounded-full bg-amber-300/60" style={{ left: `${m.bandLo}%`, width: `${m.bandHi - m.bandLo}%` }} />
                      <div className="absolute top-0 h-6 w-0.5 bg-amber-700" style={{ left: `${m.central}%` }} />
                    </div>
                  </div>
                  {/* lifestyle dividend */}
                  <div className="rounded-lg bg-white/70 p-3 ring-1 ring-amber-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">How much you can improve together</span>
                      <span className="font-mono font-bold tabular-nums text-emerald-700">+{fmt(m.dividend)} points potential</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">current baseline {fmt(m.currentScenario)}</span>
                      <ArrowRight size={12} className="text-emerald-600" />
                      <span className="font-mono tabular-nums font-bold text-emerald-600">optimised routines {fmt(m.optimisedScenario)}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">This represents the recoverable dividend. If you optimize your shared kitchen, sleep, and physical activity habits, you can reclaim this points gap, directly improving your 10-year outlook.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Projection Chart */}
            <h3 className="mb-3 mt-8 text-sm font-semibold text-slate-900">10-year dual trajectory view</h3>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="h-64" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.proj} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "years", position: "insideBottomRight", fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip content={renderTooltip} />
                    
                    <ReferenceLine y={60} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "high risk ≥60", fontSize: 10, fill: "#f43f5e", position: "right" }} />
                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "mod risk ≥30", fontSize: 10, fill: "#f59e0b", position: "right" }} />
                    
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    
                    {/* Continuous Compound Probability Curve (Condition-Free) */}
                    <Line type="monotone" dataKey="current" name="Household Current Baseline" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="optimized" name="Household Optimised Routines" stroke="#10B981" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
                    
                    {/* Discrete IDRS Steps */}
                    <Line type="stepAfter" dataKey="A" name={`${maleManualData.name || 'Prospect 1'} IDRS`} stroke="#0d9488" strokeWidth={2} dot={false} />
                    <Line type="stepAfter" dataKey="B" name={`${femaleManualData.name || 'Prospect 2'} IDRS`} stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Honest by construction: IDRS steps only as a partner crosses an age band (35, 50). The household lines model continuous ageing drift and the recoverable lifestyle dividend.
              </p>
            </div>

            {/* Calibration scaffold mock */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ClipboardList size={15} className="text-slate-500" /> Calibration scaffold
            </h3>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-xs leading-relaxed text-slate-500">
                  The couple layer earns calibration only by capturing inputs against outcomes over time. Logging an assessment records the
                  de-identified feature set, the index, and the convergence assumption used.
                </p>
                <button className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40">
                  <Plus size={14} /> Log assessment (Demo)
                </button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-100">
                      {["IDRS A", "IDRS B", "Index", "State", "Flagged", "Outcome"].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums text-slate-600">
                    <tr className="border-b border-slate-50">
                      <td className="py-1.5 pr-4">{m.sA}</td><td className="py-1.5 pr-4">{m.sB}</td>
                      <td className="py-1.5 pr-4">{Math.round(m.central)}</td>
                      <td className="py-1.5 pr-4">{m.state}</td><td className="py-1.5 pr-4">{m.markersFlagged}</td>
                      <td className="py-1.5 pr-4 text-amber-600">pending</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{textAlign: 'center', marginTop: '32px', marginBottom: '40px'}}>
              <button 
                onClick={resetAll}
                className={styles.actionButton}
                style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', maxWidth: '200px' }}
              >
                <RotateCcw size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                Start New Analysis
              </button>
            </div>
          </section>
        )}
      </main>

      {matchResult && (
        <>
          <button
            onClick={() => setIsChatOpen(true)}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              border: 'none',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.25)';
            }}
          >
            <MessageSquare size={16} />
            Consult AI Counselor
          </button>
          <ReportChatDrawer
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            sessionId={chatSessionId}
            onSessionCreated={setChatSessionId}
            reportId={maleReport?.report_metadata?.report_id}
            partnerReportId={femaleReport?.report_metadata?.report_id}
            engineType="chronic"
            contextMetadata={{
              analysisResult: matchResult,
              maleReportExtracted: maleReport?.sections || null,
              femaleReportExtracted: femaleReport?.sections || null
            }}
          />
        </>
      )}
    </div>
  );
}
