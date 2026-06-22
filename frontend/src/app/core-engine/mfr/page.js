'use client';

import { useState, useMemo } from 'react';
import { 
  HeartPulse, AlertCircle, Award 
} from 'lucide-react';
import { useCompatibility } from '../../../contexts/CompatibilityContext';

export default function MfrEnginePage() {
  const { 
    user, 
    prospectForm, 
    mfrResult, 
    selectedProjYear, 
    showCalculations, 
    setShowCalculations 
  } = useCompatibility();

  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Compute User BMI dynamically
  const userBmi = useMemo(() => {
    if (!user || !user.weight || !user.height) return null;
    const heightInMeters = user.height / 100;
    return parseFloat((user.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }, [user]);

  // Compute Prospect BMI dynamically
  const prospectBmi = useMemo(() => {
    if (!prospectForm.weight || !prospectForm.height) return null;
    const heightInMeters = prospectForm.height / 100;
    return parseFloat((prospectForm.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }, [prospectForm]);

  const mfrTimeline = useMemo(() => {
    if (!mfrResult || !mfrResult.projection) return null;
    const year = selectedProjYear;
    const currentCurve = mfrResult.projection.current || [];
    const optimizedCurve = mfrResult.projection.optimised || mfrResult.projection.optimized || [];
    
    const mfrCurY = (currentCurve[year] ?? 0) / 100;
    const cumCurY = (1.0 - Math.pow(1.0 - mfrCurY, 12)) * 100;
    const mfrOptY = (optimizedCurve[year] ?? 0) / 100;
    const cumOptY = (1.0 - Math.pow(1.0 - mfrOptY, 12)) * 100;

    let timeToConceive = 'N/A';
    if (mfrResult.details?.gate) {
      timeToConceive = 'Blocked';
    } else if (mfrCurY > 0) {
      timeToConceive = `~${Math.max(1, Math.round(1 / mfrCurY))} mo`;
    }

    return {
      monthlyChance: mfrResult.details?.gate ? '0%' : `${(mfrCurY * 100).toFixed(1)}%`,
      cumChance: `${cumCurY.toFixed(1)}%`,
      monthlyChanceOpt: `${(mfrOptY * 100).toFixed(1)}%`,
      cumChanceOpt: `${cumOptY.toFixed(1)}%`,
      timeToConceive,
      dividend: cumOptY - cumCurY
    };
  }, [mfrResult, selectedProjYear]);

  // Dynamic SVG Chart Renderer
  const renderSvgChart = (currentProj, optProj) => {
    if (!currentProj || !optProj) return null;

    const currentProjCum = currentProj.map(val => (1.0 - Math.pow(1.0 - val / 100, 12)) * 100);
    const optProjCum = optProj.map(val => (1.0 - Math.pow(1.0 - val / 100, 12)) * 100);

    const chartWidth = 800;
    const chartHeight = 420;
    const paddingLeft = 65;
    const paddingRight = 175;
    const paddingTop = 40;
    const paddingBottom = 55;

    const getCoords = (val, idx) => {
      const x = paddingLeft + (idx / 10) * (chartWidth - paddingLeft - paddingRight);
      const y = chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
      return `${x},${y}`;
    };

    const currentPoints = currentProjCum.map((val, idx) => getCoords(val, idx)).join(' ');
    const optimisedPoints = optProjCum.map((val, idx) => getCoords(val, idx)).join(' ');

    const getYCoord = (val) => {
      return chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
    };

    const femaleBaseAge = mfrResult?.details?.female_age || 30;
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
            <linearGradient id="mfr-line-grad-core" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={chartHeight}>
              <stop offset={`${(getYCoord(100) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(85) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(72.5) / chartHeight) * 100}%`} stopColor="#d97706" />
              <stop offset={`${(getYCoord(60) / chartHeight) * 100}%`} stopColor="#EF4444" />
              <stop offset={`${(getYCoord(0) / chartHeight) * 100}%`} stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Shading / Bands */}
          <rect x={paddingLeft} y={getYCoord(100)} width={chartWidth - paddingLeft - paddingRight} height={getYCoord(85) - getYCoord(100)} fill="rgba(16, 185, 129, 0.05)" />
          <rect x={paddingLeft} y={getYCoord(85)} width={chartWidth - paddingLeft - paddingRight} height={getYCoord(60) - getYCoord(85)} fill="rgba(245, 158, 11, 0.05)" />
          <rect x={paddingLeft} y={getYCoord(60)} width={chartWidth - paddingLeft - paddingRight} height={getYCoord(0) - getYCoord(60)} fill="rgba(239, 68, 68, 0.05)" />

          {/* Zone separator lines */}
          <line x1={paddingLeft} y1={getYCoord(85)} x2={chartWidth - paddingRight} y2={getYCoord(85)} stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="3,3" />
          <line x1={paddingLeft} y1={getYCoord(60)} x2={chartWidth - paddingRight} y2={getYCoord(60)} stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1" strokeDasharray="3,3" />

          {/* Zone Labels on the Right */}
          <text x={chartWidth - paddingRight + 8} y={getYCoord(92.5)} fontSize="10" fontWeight="600" fill="#0f766e" opacity="0.9">Good to Go (Decent)</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(92.5) + 11} fontSize="9" fill="#64748b" opacity="0.85">Chance &ge; 85%</text>

          <text x={chartWidth - paddingRight + 8} y={getYCoord(72.5)} fontSize="10" fontWeight="600" fill="#d97706" opacity="0.9">Consultation Advised</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(72.5) + 11} fontSize="9" fill="#64748b" opacity="0.85">Moderate: 60% - 85%</text>

          <text x={chartWidth - paddingRight + 8} y={getYCoord(30)} fontSize="10" fontWeight="600" fill="#E53E3E" opacity="0.9">IVF / Egg Freezing</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(30) + 11} fontSize="9" fill="#64748b" opacity="0.85">Requires Attention: &lt; 60%</text>

          {/* Grid lines */}
          {[0, 20, 40, 60, 80, 100].map((level, i) => {
            const y = getYCoord(level);
            return (
              <g key={i}>
                <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2,2" />
                <text x={paddingLeft - 8} y={y + 3} fontSize="9.5" fill="#64748b" textAnchor="end">{level}%</text>
              </g>
            );
          })}

          {/* X axis years */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((yr, i) => {
            const x = paddingLeft + (yr / 10) * (chartWidth - paddingLeft - paddingRight);
            return (
              <g key={i}>
                <line x1={x} y1={chartHeight - paddingBottom} x2={x} y2={chartHeight - paddingBottom + 4} stroke="#e2e8f0" strokeWidth="0.8" />
                <text x={x} y={chartHeight - paddingBottom + 16} fontSize="9.5" fill="#64748b" textAnchor="middle">Yr {yr}</text>
              </g>
            );
          })}

          {/* Vertical Regions Background Shading */}
          {x40 > xStart && (
            <rect x={xStart} y={paddingTop} width={x40 - xStart} height={chartHeight - paddingTop - paddingBottom} fill="rgba(16, 185, 129, 0.015)" />
          )}
          {x45 > x40 && (
            <rect x={x40} y={paddingTop} width={x45 - x40} height={chartHeight - paddingTop - paddingBottom} fill="rgba(245, 158, 11, 0.025)" />
          )}
          {xEnd > x45 && (
            <rect x={x45} y={paddingTop} width={xEnd - x45} height={chartHeight - paddingTop - paddingBottom} fill="rgba(239, 68, 68, 0.035)" />
          )}

          {/* Vertical boundary lines */}
          {yr40 >= 0 && yr40 <= 10 && (
            <g key="vertical-premenopause">
              <line x1={x40} y1={paddingTop - 12} x2={x40} y2={chartHeight - paddingBottom} stroke="rgba(217, 119, 6, 0.5)" strokeWidth="1.2" strokeDasharray="3,3" />
            </g>
          )}

          {yr45 >= 0 && yr45 <= 10 && (
            <g key="vertical-menopause">
              <line x1={x45} y1={paddingTop - 12} x2={x45} y2={chartHeight - paddingBottom} stroke="rgba(220, 38, 38, 0.5)" strokeWidth="1.2" strokeDasharray="3,3" />
            </g>
          )}

          {/* Region Label Texts */}
          {x40 - xStart > 45 && (
            <text x={xStart + (x40 - xStart) / 2} y={paddingTop - 6} fontSize="8.5" fontWeight="700" fill="#0f766e" textAnchor="middle">Reproductive (&lt;40)</text>
          )}
          {x45 - x40 > 45 && (
            <text x={x40 + (x45 - x40) / 2} y={paddingTop - 6} fontSize="8.5" fontWeight="700" fill="#D97706" textAnchor="middle">Premenopause (40-45)</text>
          )}
          {xEnd - x45 > 45 && (
            <text x={x45 + (xEnd - x45) / 2} y={paddingTop - 6} fontSize="8.5" fontWeight="700" fill="#DC2626" textAnchor="middle">Menopause (&ge;45)</text>
          )}

          {/* Y Axis Label */}
          <text x={-(chartHeight - paddingBottom - paddingTop) / 2 - paddingTop} y="15" fontSize="10" fontWeight="600" fill="#64748b" transform="rotate(-90)" textAnchor="middle">Yearly Conception Chance (%)</text>

          {/* X Axis Label */}
          <text x={paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2} y={chartHeight - 8} fontSize="10.5" fontWeight="600" fill="#64748b" textAnchor="middle">Time Horizon (Years)</text>

          {/* Hover helper vertical line */}
          {hoveredPoint && (
            <line x1={hoveredPoint.cx} y1={paddingTop} x2={hoveredPoint.cx} y2={chartHeight - paddingBottom} stroke="#e2e8f0" strokeWidth="1.2" strokeDasharray="3,3" />
          )}

          {/* Projections */}
          <polyline 
            fill="none" 
            stroke="url(#mfr-line-grad-core)" 
            strokeWidth="3.5" 
            strokeDasharray="5,4" 
            points={currentPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />
          <polyline 
            fill="none" 
            stroke="url(#mfr-line-grad-core)" 
            strokeWidth="3.5" 
            points={optimisedPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />

          {/* Visible circles for nodes */}
          {currentProjCum.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProjCum[idx], idx).split(',');

            const isCurHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Current';
            const isOptHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Optimised';

            const getNodeColor = (v) => {
              if (v >= 85) return '#10B981';
              if (v >= 60) return '#d97706';
              return '#EF4444';
            };

            return (
              <g key={idx}>
                {/* Current Path Node */}
                <circle 
                  cx={coordsCur[0]} 
                  cy={coordsCur[1]} 
                  r={isCurHovered ? "6" : "4.5"} 
                  fill="#ffffff" 
                  stroke={getNodeColor(val)} 
                  strokeWidth={isCurHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
                {/* Optimised Path Node */}
                <circle 
                  cx={coordsOpt[0]} 
                  cy={coordsOpt[1]} 
                  r={isOptHovered ? "6" : "4.5"} 
                  fill="#ffffff" 
                  stroke={getNodeColor(optProjCum[idx])} 
                  strokeWidth={isOptHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
              </g>
            );
          })}

          {/* Interactive Invisible Overlay Circles (Easier to hover) */}
          {currentProjCum.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProjCum[idx], idx).split(',');

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
                    const containerRect = e.currentTarget.closest('div').getBoundingClientRect();
                    setHoveredPoint({
                      val,
                      idx,
                      type: 'Current',
                      cx: parseFloat(coordsCur[0]),
                      cy: parseFloat(coordsCur[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: (mfrResult?.details?.male_age || mfrResult?.partner_A?.age || 32) + idx
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
                    const containerRect = e.currentTarget.closest('div').getBoundingClientRect();
                    setHoveredPoint({
                      val: optProjCum[idx],
                      idx,
                      type: 'Optimised',
                      cx: parseFloat(coordsOpt[0]),
                      cy: parseFloat(coordsOpt[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: (mfrResult?.details?.male_age || mfrResult?.partner_A?.age || 32) + idx
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
              border: `1px solid ${hoveredPoint.type === 'Current' ? '#d97706' : '#10B981'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '3px' }}>
              <span style={{ fontWeight: 'bold', color: hoveredPoint.type === 'Current' ? '#d97706' : '#34D399' }}>
                {hoveredPoint.type} Path
              </span>
              <span style={{ opacity: 0.8 }}>Year {hoveredPoint.idx}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '2px 0' }}>
              12-Month Chance: <span style={{ color: '#fff' }}>{hoveredPoint.val.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: '4px', opacity: 0.95 }}>
              {hoveredPoint.val >= 85 ? (
                <span style={{ color: '#34D399' }}>● Decent baseline chance</span>
              ) : hoveredPoint.val >= 60 ? (
                <span style={{ color: '#FBBF24' }}>● Moderate/reduced chance</span>
              ) : (
                <span style={{ color: '#F87171' }}>● IVF / Clinical consult</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', justifyContent: 'center', opacity: 0.8 }}>
              <span>F-Age: <strong>{hoveredPoint.femaleAge}</strong></span>
              <span>•</span>
              <span>M-Age: <strong>{hoveredPoint.maleAge}</strong></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!mfrResult) return null;

  const suggestions = [];
  if (user.smoking_habits !== 'never' || prospectForm.smoking_habits !== 'never') suggestions.push("Quit smoking");
  const uBmi = userBmi;
  const pBmi = prospectBmi;
  if (uBmi > 25 || pBmi > 25) suggestions.push("Optimise body weight/BMI");
  if (user.activity_level === 'Sedentary' || prospectForm.activity_level === 'Sedentary') suggestions.push("Increase physical activity");
  if (user.drinking_habits !== 'Never' || prospectForm.drinking_habits !== 'Never') suggestions.push("Reduce alcohol intake");
  suggestions.push("Increase intercourse frequency");

  const hasOptimisation = suggestions.length > 0;
  const currentCurve = mfrResult.projection.current || [];
  const optimizedCurve = mfrResult.projection.optimised || mfrResult.projection.optimized || [];

  const mfrCurY = (currentCurve[selectedProjYear] ?? 0) / 100;
  const cumCurY = (1.0 - Math.pow(1.0 - mfrCurY, 12)) * 100;
  const mfrCur0 = (currentCurve[0] ?? 0) / 100;
  const cumCur0 = (1.0 - Math.pow(1.0 - mfrCur0, 12)) * 100;
  const declineCur = cumCur0 - cumCurY;

  const mfrOptY = (optimizedCurve[selectedProjYear] ?? 0) / 100;
  const cumOptY = (1.0 - Math.pow(1.0 - mfrOptY, 12)) * 100;
  const mfrOpt0 = (optimizedCurve[0] ?? 0) / 100;
  const cumOpt0 = (1.0 - Math.pow(1.0 - mfrOpt0, 12)) * 100;
  const declineOpt = cumOpt0 - cumOptY;

  let timeToConceiveY = 'N/A';
  if (mfrResult.details?.gate) {
    timeToConceiveY = 'Blocked';
  } else if (mfrCurY > 0) {
    const medianMonths = Math.max(1, Math.round(1 / mfrCurY));
    timeToConceiveY = `~${medianMonths} mo`;
  } else {
    timeToConceiveY = 'Extremely low';
  }

  const getBadgeStyleLocal = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('blocked') || s.includes('specialist')) {
      return { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
    }
    if (s.includes('reduced') || s.includes('plan together')) {
      return { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
    return { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
  };

  const badgeObj = getBadgeStyleLocal(mfrResult.state);

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Chance of Getting Pregnant per Month (Conception Success Rate)
        </div>
        <div className="text-5xl font-bold text-slate-900 my-2" style={{ fontFamily: 'Georgia, serif' }}>
          {mfrResult.details?.gate ? '0%' : `${mfrResult.monthly_chance_current.toFixed(1)}%`}
        </div>
        <p className="text-xs text-slate-500 max-w-md mb-3">
          This is the probability of conceiving in any single month of active trying. Over a year of trying, these monthly chances add up to your cumulative yearly success rate.
        </p>
        
        <div className={`inline-flex items-center gap-1.5 font-semibold text-xs px-3 py-1.5 rounded-full border ${badgeObj.badge}`}>
          <span className={`w-2 h-2 rounded-full ${badgeObj.dot}`}></span>
          <span>Status: {mfrResult.state}</span>
        </div>

        {mfrResult.validation_issue && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-left flex items-start gap-3 w-full">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="text-xs">{mfrResult.validation_issue}</span>
          </div>
        )}

        {/* Radiology & Genomics Warnings */}
        {((mfrResult.rad_warnings && mfrResult.rad_warnings.length > 0) || 
          (mfrResult.genomic_warnings && mfrResult.genomic_warnings.length > 0)) && (
          <div className="w-full mt-4 space-y-3 text-left">
            {mfrResult.rad_warnings && mfrResult.rad_warnings.length > 0 && (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
                <h4 className="font-bold flex items-center gap-2 text-sm mb-2 text-amber-900">
                  <AlertCircle size={16} />
                  Radiology Assessment Flags (USG/HSG)
                </h4>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {mfrResult.rad_warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {mfrResult.genomic_warnings && mfrResult.genomic_warnings.length > 0 && (
              <div className="p-4 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
                <h4 className="font-bold flex items-center gap-2 text-sm mb-2 text-rose-900">
                  <AlertCircle size={16} />
                  Genomics Assessment Flags
                </h4>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  {mfrResult.genomic_warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strengths */}
      {mfrResult.positive_findings && mfrResult.positive_findings.length > 0 && (
        <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl">
          <h3 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2">
            <Award size={18} />
            Clinical Strengths & Positive Markers
          </h3>
          <ul className="list-disc pl-5 text-xs text-slate-800 space-y-1">
            {mfrResult.positive_findings.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Row Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Current MFR 12m Cumulative Chance */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Chance of Pregnancy in 12 Months (Year {selectedProjYear})
          </div>
          <div className="text-5xl font-bold text-slate-900 my-2" style={{ fontFamily: 'Georgia, serif' }}>
            {mfrResult.details?.gate ? '—' : `${cumCurY.toFixed(1)}%`}
          </div>
          <div className="text-sm text-slate-600">
            {mfrResult.details?.gate ? '—' : `Drop in success rate if you wait: -${Math.abs(declineCur).toFixed(1)}%`}
          </div>
        </div>

        {/* Optimised MFR 12m Cumulative Chance */}
        {hasOptimisation && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-6">
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Chance of Pregnancy (With Lifestyle Improvements, Year {selectedProjYear})
              </div>
              <div className="text-5xl font-bold text-emerald-700 my-2" style={{ fontFamily: 'Georgia, serif' }}>
                {mfrResult.details?.gate ? '—' : `${cumOptY.toFixed(1)}%`}
              </div>
              <div className="text-sm text-slate-600">
                {mfrResult.details?.gate ? '—' : `Drop if you wait (optimised): -${Math.abs(declineOpt).toFixed(1)}%`}
              </div>
            </div>
            <div className="flex-1 border-l border-slate-100 pl-6 self-stretch flex flex-col justify-center">
              <div className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider mb-2">
                WHAT TO OPTIMISE:
              </div>
              <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
                {suggestions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Middle Row Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Typical Time to Conceive */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Average Time to Get Pregnant
          </div>
          <div className="text-5xl font-bold text-slate-900 my-2" style={{ fontFamily: 'Georgia, serif' }}>
            {timeToConceiveY}
          </div>
          <div className="text-sm text-slate-600">
            {mfrResult.details?.gate ? 'Pathways physically blocked' : `Expected months of trying (Year {selectedProjYear})`}
          </div>
        </div>

        {/* Cost of waiting */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Loss in success rate by waiting {selectedProjYear} {selectedProjYear === 1 ? 'year' : 'years'}
          </div>
          <div className="text-5xl font-bold text-amber-800 my-2" style={{ fontFamily: 'Georgia, serif' }}>
            {mfrResult.details?.gate ? '—' : `-${Math.abs(declineCur).toFixed(1)}%`}
          </div>
          <div className="text-sm text-slate-600">
            Drop in pregnancy chance compared to starting today
          </div>
        </div>
      </div>

      {/* 10-Year Fertility Decay Curve */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-1">10-Year Fertility Decay Curve</h3>
        <p className="text-xs text-slate-500 mb-6">
          Year-by-year monthly conception chance, current vs optimised lifestyle.
        </p>
        <div className="w-full h-[460px] bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-center">
          {renderSvgChart(currentCurve, optimizedCurve)}
        </div>
        <div className="flex justify-center gap-6 mt-4 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 inline-block bg-[#d97706]"></span>
            Current Lifestyle Path
          </span>
          {hasOptimisation && (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-2.5 inline-block bg-[#0f766e]"></span>
              Optimised Lifestyle Path
            </span>
          )}
        </div>
      </div>

      {/* Clinician Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Clinician Assessment Summary</h3>
        <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-xl text-sm leading-relaxed text-slate-700">
          {mfrResult.summary}
        </div>
      </div>

      {/* Working Trace */}
      {mfrResult.calculations && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm">In-depth Calculations Trace</h3>
            <button 
              onClick={() => setShowCalculations(!showCalculations)}
              className="text-xs font-semibold text-teal-600 hover:underline cursor-pointer"
            >
              {showCalculations ? 'Hide Working Trace' : 'View Working Trace'}
            </button>
          </div>
          {showCalculations && (
            <div className="p-6 bg-white space-y-6 text-sm">
              <div className="border-l-4 border-teal-600 pl-4 py-1">
                <h4 className="font-bold text-slate-900 mb-2">1. Biological Score Components</h4>
                <p className="text-xs text-slate-500 mb-3">Base interpolation curve from age, plus adjustments for reserve and semen:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h5 className="font-bold text-xs text-blue-600 mb-2">{mfrResult.partner_A?.name || 'Partner A'}</h5>
                    <ul className="text-xs space-y-1 text-slate-600">
                      <li><strong>Age Base Score:</strong> {mfrResult.calculations.male_base_score?.toFixed(1)}</li>
                      <li><strong>Semen Adj Points:</strong> {mfrResult.calculations.male_semen_adj}</li>
                      <li><strong>Final Biological Score:</strong> {mfrResult.calculations.male_final_score?.toFixed(1)}</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h5 className="font-bold text-xs text-pink-600 mb-2">{mfrResult.partner_B?.name || 'Partner B'}</h5>
                    <ul className="text-xs space-y-1 text-slate-600">
                      <li><strong>Age Base Score:</strong> {mfrResult.calculations.female_base_score?.toFixed(1)}</li>
                      <li><strong>Reserve Adj Points:</strong> {mfrResult.calculations.female_reserve_adj}</li>
                      <li><strong>Final Biological Score:</strong> {mfrResult.calculations.female_final_score?.toFixed(1)}</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-700">
                  Combined Biological MFR Baseline: {(mfrResult.calculations.bio_mfr * 100).toFixed(2)}%
                </div>
              </div>

              <div className="border-l-4 border-amber-500 pl-4 py-1">
                <h4 className="font-bold text-slate-900 mb-2">2. Lifestyle Penalty & Timing Multipliers</h4>
                <p className="text-xs text-slate-500 mb-3">Shared household lifestyle and frequency modify the biological base probability:</p>
                <ul className="text-xs space-y-1 text-slate-600 font-mono">
                  <li><strong>Shared Lifestyle Index (L):</strong> {mfrResult.calculations.lifestyle_index} / 100</li>
                  <li><strong>Intercourse Frequency Modifier (&lambda;):</strong> {mfrResult.calculations.lambda_current} (Current) vs {mfrResult.calculations.lambda_optimised || mfrResult.calculations.lambda_optimized} (Optimised)</li>
                </ul>
              </div>

              <div className="border-l-4 border-rose-500 pl-4 py-1">
                <h4 className="font-bold text-slate-900 mb-2">3. Absolute Barriers</h4>
                <p className="text-xs text-slate-500 mb-3">Any absolute barriers physically prevent natural conception, overriding the model to zero.</p>
                <ul className="text-xs space-y-1 text-slate-600 font-mono">
                  <li><strong>Barrier present:</strong> {mfrResult.details?.gate ? 'Yes' : 'No'}</li>
                </ul>
              </div>

              <div className="border-l-4 border-slate-500 pl-4 py-1">
                <h4 className="font-bold text-slate-900 mb-2">4. Final Year 0 Baseline Outputs</h4>
                <ul className="text-xs space-y-1 text-slate-600 font-mono">
                  <li><strong>P_monthly_current:</strong> {(mfrResult.calculations.p_monthly_current * 100).toFixed(2)}%</li>
                  <li><strong>P_monthly_optimised:</strong> {(mfrResult.calculations.p_monthly_optimised * 100).toFixed(2)}%</li>
                  <li><strong>12-Month Current (Year 0):</strong> {mfrResult.calculations.p_12m_current?.toFixed(1)}%</li>
                  <li><strong>12-Month Optimised (Year 0):</strong> {mfrResult.calculations.p_12m_optimised?.toFixed(1)}%</li>
                </ul>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4 py-1">
                <h4 className="font-bold text-slate-900 mb-2">5. Time-Horizon & Slider-Driven Calculations (Year {selectedProjYear})</h4>
                <p className="text-xs text-slate-500 mb-3">Calculations for Year {selectedProjYear} starting parameters relative to Year 0 (Now):</p>
                <ul className="text-xs space-y-2 text-slate-600 font-mono">
                  <li><strong>Selected Year MFR (Current):</strong> {mfrResult.projection.current[selectedProjYear]?.toFixed(2)}%</li>
                  <li><strong>Selected Year MFR (Optimised):</strong> {optimizedCurve[selectedProjYear]?.toFixed(2)}%</li>
                  <li>
                    <strong>12-Month Cumulative Conception Chance (Current):</strong>
                    <br />
                    <span className="text-[11px] text-slate-500">
                      Formula: 1 - (1 - MFR_Y)^12 = 1 - (1 - {mfrCurY.toFixed(4)})^12 = <strong>{cumCurY.toFixed(2)}%</strong>
                    </span>
                  </li>
                  <li>
                    <strong>12-Month Cumulative Conception Chance (Optimised):</strong>
                    <br />
                    <span className="text-[11px] text-slate-500">
                      Formula: 1 - (1 - MFR_Y_opt)^12 = 1 - (1 - {mfrOptY.toFixed(4)})^12 = <strong>{cumOptY.toFixed(2)}%</strong>
                    </span>
                  </li>
                  <li>
                    <strong>Typical Time to Conceive (Current):</strong>
                    <br />
                    <span className="text-[11px] text-slate-500">
                      Formula: 1 / MFR_Y = 1 / {mfrCurY.toFixed(4)} = <strong>{timeToConceiveY}</strong>
                    </span>
                  </li>
                  <li>
                    <strong>Cost of Waiting to Year {selectedProjYear}:</strong>
                    <br />
                    <span className="text-[11px] text-slate-500">
                      Formula: Cum_0 - Cum_Y = {cumCur0.toFixed(2)}% - {cumCurY.toFixed(2)}% = <strong>-{declineCur.toFixed(2)}%</strong>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
