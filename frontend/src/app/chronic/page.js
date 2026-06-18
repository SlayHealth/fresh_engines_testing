'use client';

import { useState, useRef, useMemo } from 'react';
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, Activity, HeartPulse, 
  ShieldCheck, FlaskConical, Users, Stethoscope, ClipboardList, Info, TriangleAlert, ArrowRight, Plus, RotateCcw 
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import styles from './page.module.css';
import ManualInputs from '../../components/ManualInputs';
import { API_URL } from '../../config/api';

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

function Chip({ className, children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

export default function ChronicPage() {
  const defaultMaleManual = {
    name: 'Prospect 1',
    age: 30,
    waist: 'Normal',
    bloodPressure: 'Normal',
    glucose: 'Normal',
    lipids: 'Normal',
    parentDiabetes: false,
    prematureHeartDisease: false,
    parentHbp: false
  };

  const defaultFemaleManual = {
    name: 'Prospect 2',
    age: 30,
    waist: 'Normal',
    bloodPressure: 'Normal',
    glucose: 'Normal',
    lipids: 'Normal',
    parentDiabetes: false,
    prematureHeartDisease: false,
    parentHbp: false
  };

  const defaultLifestyle = {
    diet: 'Healthy',
    activity: 'Moderate',
    smoking: 'Never',
    drinking: 'Never',
    sleep: 'Early bird',
    stress: 'Normal'
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
  const [showCalculations, setShowCalculations] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const triggerMockExtraction = async (gender) => {
    const setIsUploading = gender === 'male' ? setIsMaleUploading : setIsFemaleUploading;
    const setError = gender === 'male' ? setMaleError : setFemaleError;
    const setReport = gender === 'male' ? setMaleReport : setFemaleReport;

    setIsUploading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
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
      const response = await fetch(`${API_URL}/api/pathology/extract`, {
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

  const handleAnalyzeChronic = async () => {
    if (!maleReport || !femaleReport) return;
    
    setIsAnalyzing(true);
    setMatchError(null);

    try {
      const response = await fetch(`${API_URL}/api/chronic/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        
        // Auto-fill form overrides with values parsed from reports
        if (data.partner_A?.detected_categories) {
          setMaleManualData(prev => ({
            ...prev,
            waist: data.partner_A.detected_categories.waist,
            bloodPressure: data.partner_A.detected_categories.bloodPressure,
            glucose: data.partner_A.detected_categories.glucose,
            lipids: data.partner_A.detected_categories.lipids
          }));
        }
        if (data.partner_B?.detected_categories) {
          setFemaleManualData(prev => ({
            ...prev,
            waist: data.partner_B.detected_categories.waist,
            bloodPressure: data.partner_B.detected_categories.bloodPressure,
            glucose: data.partner_B.detected_categories.glucose,
            lipids: data.partner_B.detected_categories.lipids
          }));
        }
      } else {
        throw new Error(data.error || 'Failed to analyze chronic health');
      }
    } catch (err) {
      setMatchError(err.message || 'Connection to backend failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLifestyleChange = (e) => {
    const { name, value } = e.target;
    setLifestyleData(prev => ({
      ...prev,
      [name]: value
    }));
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
  };

  const getBadgeStyle = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('specialist') || s.includes('conversation') || s.includes('escalated')) {
      return { badge: styles.badgeCritical, dot: styles.dotCritical };
    }
    if (s.includes('together') || s.includes('plan')) {
      return { badge: styles.badgeCaution, dot: styles.dotCaution };
    }
    if (s.includes('aligned')) {
      return { badge: styles.badgeAligned, dot: styles.dotAligned };
    }
    return { badge: styles.badgePlanning, dot: styles.dotPlanning };
  };

  // SVG Chart rendering for condition-free probability curve
  const renderSvgChart = (currentProj, optProj) => {
    if (!currentProj || !optProj) return null;

    const chartWidth = 600;
    const chartHeight = 320;
    const paddingLeft = 55;
    const paddingRight = 140;
    const paddingTop = 30;
    const paddingBottom = 45;

    const getCoords = (val, idx) => {
      const x = paddingLeft + (idx / 10) * (chartWidth - paddingLeft - paddingRight);
      const y = chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
      return `${x},${y}`;
    };

    const currentPoints = currentProj.map((val, idx) => getCoords(val, idx)).join(' ');
    const optimisedPoints = optProj.map((val, idx) => getCoords(val, idx)).join(' ');

    const getYCoord = (val) => {
      return chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
    };

    const femaleBaseAge = matchResult?.partner_B?.age || 30;
    const maleBaseAge = matchResult?.partner_A?.age || 30;
    const yr40 = 40 - femaleBaseAge;
    const yr45 = 45 - femaleBaseAge;

    const xStart = paddingLeft;
    const xEnd = chartWidth - paddingRight;
    const chartAreaWidth = chartWidth - paddingLeft - paddingRight;

    const t40 = Math.max(0, Math.min(10, yr40));
    const t45 = Math.max(0, Math.min(10, yr45));

    const x40 = paddingLeft + (t40 / 10) * chartAreaWidth;
    const x45 = paddingLeft + (t45 / 10) * chartAreaWidth;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="chronic-line-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={chartHeight}>
              <stop offset={`${(getYCoord(100) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(85) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(72.5) / chartHeight) * 100}%`} stopColor="var(--amber)" />
              <stop offset={`${(getYCoord(60) / chartHeight) * 100}%`} stopColor="#EF4444" />
              <stop offset={`${(getYCoord(0) / chartHeight) * 100}%`} stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Shading / Bands */}
          {/* Green Zone (85% - 100%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(100)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(85) - getYCoord(100)}
            fill="rgba(16, 185, 129, 0.05)"
          />
          {/* Yellow Zone (60% - 85%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(85)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(60) - getYCoord(85)}
            fill="rgba(245, 158, 11, 0.05)"
          />
          {/* Red Zone (0% - 60%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(60)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(0) - getYCoord(60)}
            fill="rgba(239, 68, 68, 0.05)"
          />

          {/* Zone separator lines */}
          <line x1={paddingLeft} y1={getYCoord(85)} x2={chartWidth - paddingRight} y2={getYCoord(85)} stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="3,3" />
          <line x1={paddingLeft} y1={getYCoord(60)} x2={chartWidth - paddingRight} y2={getYCoord(60)} stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1" strokeDasharray="3,3" />

          {/* Zone Labels (Right-aligned) */}
          <text x={chartWidth - paddingRight + 8} y={getYCoord(92.5) + 4} fontSize="10.5" fontWeight="600" fill="var(--teal-d)" opacity="0.9">Decent (&ge;85%)</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(72.5) + 4} fontSize="10.5" fontWeight="600" fill="var(--amber)" opacity="0.9">Moderate (60%-85%)</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(30) + 4} fontSize="10.5" fontWeight="600" fill="#E53E3E" opacity="0.9">Requires Attention (&lt;60%)</text>

          {/* Vertical Regions Background Shading */}
          {/* Zone 1: Active Reproductive (Age < 40) */}
          {x40 > xStart && (
            <rect 
              x={xStart} 
              y={paddingTop} 
              width={x40 - xStart} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(16, 185, 129, 0.015)" 
            />
          )}
          {/* Zone 2: Premenopause (Age 40 - 45) */}
          {x45 > x40 && (
            <rect 
              x={x40} 
              y={paddingTop} 
              width={x45 - x40} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(245, 158, 11, 0.025)" 
            />
          )}
          {/* Zone 3: Menopause (Age >= 45) */}
          {xEnd > x45 && (
            <rect 
              x={x45} 
              y={paddingTop} 
              width={xEnd - x45} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(239, 68, 68, 0.035)" 
            />
          )}

          {/* Vertical boundary lines and text labels */}
          {yr40 >= 0 && yr40 <= 10 && (
            <g key="vertical-premenopause">
              <line 
                x1={x40} 
                y1={paddingTop - 12} 
                x2={x40} 
                y2={chartHeight - paddingBottom} 
                stroke="rgba(217, 119, 6, 0.5)" 
                strokeWidth="1.2" 
                strokeDasharray="3,3" 
              />
            </g>
          )}

          {yr45 >= 0 && yr45 <= 10 && (
            <g key="vertical-menopause">
              <line 
                x1={x45} 
                y1={paddingTop - 12} 
                x2={x45} 
                y2={chartHeight - paddingBottom} 
                stroke="rgba(220, 38, 38, 0.5)" 
                strokeWidth="1.2" 
                strokeDasharray="3,3" 
              />
            </g>
          )}

          {/* Region Label Texts */}
          {x40 - xStart > 45 && (
            <text 
              x={xStart + (x40 - xStart) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="var(--teal-d)" 
              textAnchor="middle"
            >
              Reproductive (&lt;40)
            </text>
          )}
          {x45 - x40 > 45 && (
            <text 
              x={x40 + (x45 - x40) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="#D97706" 
              textAnchor="middle"
            >
              Premenopause (40-45)
            </text>
          )}
          {xEnd - x45 > 45 && (
            <text 
              x={x45 + (xEnd - x45) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="#DC2626" 
              textAnchor="middle"
            >
              Menopause (&ge;45)
            </text>
          )}

          {/* Grid lines */}
          {[0, 20, 40, 60, 80, 100].map((level, i) => {
            const y = getYCoord(level);
            return (
              <g key={i}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={chartWidth - paddingRight} 
                  y2={y} 
                  stroke="var(--line)" 
                  strokeWidth="0.5" 
                  strokeDasharray="2,2" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 3} 
                  fontSize="9.5" 
                  fill="var(--muted)" 
                  textAnchor="end"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* X axis years */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((yr, i) => {
            const x = paddingLeft + (yr / 10) * (chartWidth - paddingLeft - paddingRight);
            return (
              <g key={i}>
                <line 
                  x1={x} 
                  y1={chartHeight - paddingBottom} 
                  x2={x} 
                  y2={chartHeight - paddingBottom + 4} 
                  stroke="var(--line)" 
                  strokeWidth="0.8" 
                />
                <text 
                  x={x} 
                  y={chartHeight - paddingBottom + 16} 
                  fontSize="9.5" 
                  fill="var(--muted)" 
                  textAnchor="middle"
                >
                  Yr {yr}
                </text>
              </g>
            );
          })}

          {/* Y Axis Label */}
          <text
            x={-(chartHeight - paddingBottom - paddingTop) / 2 - paddingTop}
            y="15"
            fontSize="10"
            fontWeight="600"
            fill="var(--muted)"
            transform="rotate(-90)"
            textAnchor="middle"
          >
            Remaining Condition-Free (%)
          </text>

          {/* X Axis Label */}
          <text
            x={paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2}
            y={chartHeight - 8}
            fontSize="10.5"
            fontWeight="600"
            fill="var(--muted)"
            textAnchor="middle"
          >
            Time Horizon (Years)
          </text>

          {/* Hover helper vertical line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.cx}
              y1={paddingTop}
              x2={hoveredPoint.cx}
              y2={chartHeight - paddingBottom}
              stroke="var(--line)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
          )}

          {/* Projections */}
          <polyline 
            fill="none" 
            stroke="url(#chronic-line-grad)" 
            strokeWidth="3.5" 
            strokeDasharray="5,4" 
            points={currentPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />
          <polyline 
            fill="none" 
            stroke="url(#chronic-line-grad)" 
            strokeWidth="3.5" 
            points={optimisedPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />

          {/* Visible circles for nodes */}
          {currentProj.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProj[idx], idx).split(',');

            const isCurHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Current';
            const isOptHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Optimized';

            const getNodeColor = (v) => {
              if (v >= 85) return '#10B981';
              if (v >= 60) return 'var(--amber)';
              return '#EF4444';
            };

            return (
              <g key={idx}>
                {/* Current Path Node */}
                <circle 
                  cx={coordsCur[0]} 
                  cy={coordsCur[1]} 
                  r={isCurHovered ? "6" : "4.5"} 
                  fill="var(--paper)" 
                  stroke={getNodeColor(val)} 
                  strokeWidth={isCurHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
                {/* Optimised Path Node */}
                <circle 
                  cx={coordsOpt[0]} 
                  cy={coordsOpt[1]} 
                  r={isOptHovered ? "6" : "4.5"} 
                  fill="var(--paper)" 
                  stroke={getNodeColor(optProj[idx])} 
                  strokeWidth={isOptHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
              </g>
            );
          })}

          {/* Interactive Invisible Overlay Circles (Easier to hover) */}
          {currentProj.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProj[idx], idx).split(',');

            return (
              <g key={`interactive-${idx}`}>
                {/* Current */}
                <circle
                  cx={coordsCur[0]}
                  cy={coordsCur[1]}
                  r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const containerRect = e.currentTarget.closest(`.${styles.svgChartContainer}`).getBoundingClientRect();
                    setHoveredPoint({
                      val,
                      idx,
                      type: 'Current',
                      cx: parseFloat(coordsCur[0]),
                      cy: parseFloat(coordsCur[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: maleBaseAge + idx
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {/* Optimised */}
                <circle
                  cx={coordsOpt[0]}
                  cy={coordsOpt[1]}
                  r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const containerRect = e.currentTarget.closest(`.${styles.svgChartContainer}`).getBoundingClientRect();
                    setHoveredPoint({
                      val: optProj[idx],
                      idx,
                      type: 'Optimized',
                      cx: parseFloat(coordsOpt[0]),
                      cy: parseFloat(coordsOpt[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: maleBaseAge + idx
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredPoint && (
          <div 
            style={{
              position: 'absolute',
              left: `${hoveredPoint.left}px`,
              top: `${hoveredPoint.top}px`,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(17, 24, 39, 0.95)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              lineHeight: '1.4',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 100,
              width: '180px',
              border: `1px solid ${hoveredPoint.type === 'Current' ? 'var(--amber)' : 'var(--teal)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '3px' }}>
              <span style={{ fontWeight: 'bold', color: hoveredPoint.type === 'Current' ? 'var(--amber)' : 'var(--teal-l, #4FD1C5)' }}>
                {hoveredPoint.type} Path
              </span>
              <span style={{ opacity: 0.8 }}>Year {hoveredPoint.idx}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '2px 0' }}>
              Condition-Free: <span style={{ color: '#fff' }}>{hoveredPoint.val.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: '4px', opacity: 0.95 }}>
              {hoveredPoint.val >= 85 ? (
                <span style={{ color: '#34D399' }}>● Decent condition-free chance</span>
              ) : hoveredPoint.val >= 60 ? (
                <span style={{ color: '#FBBF24' }}>● Moderate health risk</span>
              ) : (
                <span style={{ color: '#F87171' }}>● Attention: High health risk</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', justifyContent: 'center', opacity: 0.9 }}>
              <span>F-Age: <strong>{hoveredPoint.femaleAge}</strong></span>
              <span>•</span>
              <span>M-Age: <strong>{hoveredPoint.maleAge}</strong></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const m = useMemo(() => {
    if (!matchResult) return null;
    const sA = matchResult.calculations.partnerA.idrs;
    const sB = matchResult.calculations.partnerB.idrs;
    
    const rawA = matchResult.partner_A.rawValues || {};
    const bioA = biomarkerFlags({ ...rawA, sex: matchResult.partner_A.sex === 'M' ? 'male' : 'female' }, false);
    const rawB = matchResult.partner_B.rawValues || {};
    const bioB = biomarkerFlags({ ...rawB, sex: matchResult.partner_B.sex === 'M' ? 'male' : 'female' }, false);

    const gateFired = matchResult.diabeticRangeDetected;
    const markersFlagged = bioA.flagged + bioB.flagged;
    const diabeticCount = (rawA.hba1c >= 6.5 ? 1 : 0) + (rawB.hba1c >= 6.5 ? 1 : 0);

    let state = matchResult.state;
    let tier = null;
    if (state === 'Specialist conversation') {
      tier = diabeticCount === 2 || markersFlagged >= 5 ? 'escalated' : (gateFired ? 'soft' : 'baseline');
    }

    const coupleIdx = (protA, protB, w) => {
      const lo = Math.min(protA, protB), hi = Math.max(protA, protB);
      return w * lo + (1 - w) * hi;
    };

    const bandLo = coupleIdx(matchResult.calculations.partnerA.protectiveScore, matchResult.calculations.partnerB.protectiveScore, 0.7);
    const bandHi = coupleIdx(matchResult.calculations.partnerA.protectiveScore, matchResult.calculations.partnerB.protectiveScore, 0.5);
    const central = matchResult.calculations.coupleIndex;
    const currentScenario = matchResult.projection.currentLifestyle[0];
    const optimisedScenario = matchResult.projection.optimizedLifestyle[0];
    const dividend = matchResult.lifestyleDividend;
    
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
  }, [matchResult]);

  return (
    <div className={`${styles.chronicThemeWrapper} ${styles.latexDoc}`}>
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.docHeader}>
            <div className={styles.docPretitle}>Two-Layer Cardiometabolic Compatibility Model</div>
            <h1 className={styles.title}>Mathematical Specification &mdash; HSP v2.1</h1>
            <div className={styles.docMeta}>
              Evaluate 10-year cardiometabolic healthspan, condition-free probabilities, and temporal lifestyle projections.
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
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Diet Quality</label>
                  <select name="diet" value={lifestyleData.diet} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="Healthy">Healthy</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Physical Activity</label>
                  <select name="activity" value={lifestyleData.activity} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="Active">Active</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Sedentary">Sedentary</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Smoking Habits</label>
                  <select name="smoking" value={lifestyleData.smoking} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="Never">Never</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Drinking Habits</label>
                  <select name="drinking" value={lifestyleData.drinking} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="Never">Never</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Sleep Cycle</label>
                  <select name="sleep" value={lifestyleData.sleep} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="Early bird">Early bird</option>
                    <option value="Irregular">Irregular</option>
                    <option value="Night owl">Night owl</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#9ca3af', fontSize: '0.85rem', fontWeight: '500' }}>Stress Level</label>
                  <select name="stress" value={lifestyleData.stress} onChange={handleLifestyleChange} className={styles.formSelect}>
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
            {/* Compatibility state */}
            {(() => {
              const stateMeta = {
                'Aligned': { c: "emerald", label: "Aligned", icon: ShieldCheck },
                'Plan together': { c: "blue", label: "Plan together", icon: Users },
                'Specialist conversation': { c: "rose", label: "Specialist conversation", icon: Stethoscope }
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
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">Compatibility state</span>
                      </div>
                      <h2 className={`text-xl font-semibold text-${stateMeta.c}-700`}>{stateMeta.label}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {m.state === "Aligned" && "Strong shared baseline and a clean biomarker panel. The work here is protecting what already exists as routines merge."}
                        {m.state === "Plan together" && `A head start, not a barrier. ${m.markersFlagged > 0 ? `${m.markersFlagged} marker${m.markersFlagged > 1 ? "s" : ""} flagged across both partners — ` : ""}set specific household habits early.`}
                        {m.state === "Specialist conversation" && m.tier === "escalated" && `Both of you carry load — ${m.markersFlagged} markers flagged${m.diabeticCount === 2 ? ", including diabetic-range glucose in both partners" : ""}. A genuine shared matter, best worked through with a clinician-led plan before family planning. Information, not a verdict.`}
                        {m.state === "Specialist conversation" && m.tier === "soft" && "One established marker, otherwise reasonable. Manageable with a clear shared plan and a clinician conversation."}
                        {m.state === "Specialist conversation" && m.tier === "baseline" && `A high screening band${m.markersFlagged ? ` and ${m.markersFlagged} flagged markers` : ""}. Worth a clinician before finalising plans — useful information, not a verdict.`}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* LAYER A: validated individual risk */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-600 text-[11px] text-white">A</span>
              Individual validated risk
              <Chip className="bg-teal-50 text-teal-700"><ShieldCheck size={11} /> Validated · CURES cohort</Chip>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ tag: maleManualData.name || "Prospect 1", s: m.sA, band: m.bandObjA },
                { tag: femaleManualData.name || "Prospect 2", s: m.sB, band: m.bandObjB }].map(({ tag, s, band }) => (
                <div key={tag} className={`rounded-xl border-l-4 border-teal-600 bg-white p-4 ring-1 ring-slate-200`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-500">{tag}</span>
                    <Chip className={band.chip}>{band.label} risk</Chip>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-semibold tabular-nums text-slate-900">{s}</span>
                    <span className="text-sm text-slate-400">/ 100 IDRS</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${band.bar}`} style={{ width: `${s}%` }} />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{band.note}</p>
                </div>
              ))}
            </div>

            {/* Asymmetry */}
            <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">Asymmetry between partners</span>
                <span className="font-mono tabular-nums text-slate-500">gap {Math.abs(m.sA - m.sB)} pts</span>
              </div>
              <div className="relative h-8 rounded-md bg-gradient-to-r from-emerald-100 via-amber-100 to-rose-100">
                {[{ l: "A", v: m.sA }, { l: "B", v: m.sB }].map((d) => (
                  <div key={d.l} className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center justify-center" style={{ left: `${clamp(d.v, 0, 100)}%` }}>
                    <div className="h-8 w-0.5 bg-slate-700" />
                    <span className="absolute -top-0 rounded bg-slate-800 px-1 text-[10px] font-semibold text-white">{d.l}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {Math.abs(m.sA - m.sB) <= 10 ? "Well-matched — neither partner is the anchor." :
                  `${m.sA < m.sB ? (maleManualData.name || "Prospect 1") : (femaleManualData.name || "Prospect 2")} is the healthier anchor; the gap is what the convergence assumption acts on.`}
              </p>
            </div>

            {/* Biomarker context */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[11px] text-white">+</span>
              Biomarker context
              <Chip className="bg-slate-100 text-slate-600">Not folded into the validated score</Chip>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ tag: maleManualData.name || "Prospect 1", bio: m.bioA }, { tag: femaleManualData.name || "Prospect 2", bio: m.bioB }].map(({ tag, bio }) => (
                <div key={tag} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">{tag}</span>
                    <span className="text-slate-400">{bio.flagged} of {bio.count} flagged</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {bio.rows.filter((r) => r.f).map((r) => (
                      <div key={r.k} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className={`h-2 w-2 rounded-full ${SEV[r.f].dot}`} />
                          {r.k}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-slate-700">{r.v}{r.unit && <span className="text-slate-400"> {r.unit}</span>}</span>
                          <span className={`w-16 text-right text-xs ${SEV[r.f].text}`}>{SEV[r.f].lab}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Biomarker depth improves the conversation and discrimination, but adding inputs to an uncalibrated index does not make it more valid. Treated as clinical context, surfaced separately.
            </p>

            {/* LAYER B: couple influence index */}
            <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[11px] text-white">B</span>
              Couple influence index
              <Chip className="bg-amber-100 text-amber-800"><TriangleAlert size={11} /> Uncalibrated · relative ordering</Chip>
            </h3>
            <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/30 p-5">
              <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-amber-700">Index band (higher = better)</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-semibold tabular-nums text-amber-900">{fmt(m.bandLo)}–{fmt(m.bandHi)}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800/70">central {fmt(m.central)} at w=0.60</p>
                  <p className="mt-3 max-w-xs text-xs leading-relaxed text-amber-900/70">
                    The range <i>is</i> the honesty: it's what the index spans as the convergence assumption moves. No single number is claimed.
                  </p>
                </div>
                <div className="space-y-4">
                  {/* band visual */}
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-amber-800"><span>0</span><span>relative position</span><span>100</span></div>
                    <div className="relative h-6 rounded-full bg-white ring-1 ring-amber-200">
                      <div className="absolute top-0 h-6 rounded-full bg-amber-300/60" style={{ left: `${m.bandLo}%`, width: `${m.bandHi - m.bandLo}%` }} />
                      <div className="absolute top-0 h-6 w-0.5 bg-amber-700" style={{ left: `${m.central}%` }} />
                    </div>
                  </div>
                  {/* lifestyle dividend */}
                  <div className="rounded-lg bg-white/70 p-3 ring-1 ring-amber-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">Recoverable lifestyle dividend</span>
                      <span className="font-mono tabular-nums text-emerald-700">+{fmt(m.dividend)} pts</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono tabular-nums">current {fmt(m.currentScenario)}</span>
                      <ArrowRight size={12} className="text-emerald-600" />
                      <span className="font-mono tabular-nums">optimised {fmt(m.optimisedScenario)}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">The gap between current and lifestyle-optimised household habits — the part that's recoverable.</p>
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
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    
                    <ReferenceLine y={60} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "high ≥60", fontSize: 10, fill: "#f43f5e", position: "right" }} />
                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "mod ≥30", fontSize: 10, fill: "#f59e0b", position: "right" }} />
                    
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    
                    {/* Continuous Compound Probability Curve (Condition-Free) */}
                    <Line type="monotone" dataKey="current" name="Household Current" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="optimized" name="Household Optimised" stroke="#10B981" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
                    
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
    </div>
  );
}
