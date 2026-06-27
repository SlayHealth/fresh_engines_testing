import React from 'react';

export default function EchoPanel({ echoData }) {
  if (!echoData) return null;

  const {
    lvef_percent = null,
    valves = {},
    diastolic_dysfunction_grade = null,
    pah = {},
    pericardial_effusion = false,
    rwma = false,
    thrombus = false,
    vegetation = false,
    impression_text = ''
  } = echoData;

  const getLvefColor = (ef) => {
    if (ef === null) return 'var(--muted)';
    if (ef >= 55) return '#10b981'; // normal
    if (ef >= 45) return '#f59e0b'; // mild dysfunction
    return '#ef4444'; // moderate/severe dysfunction
  };

  const getLvefLabel = (ef) => {
    if (ef === null) return 'N/A';
    if (ef >= 55) return 'Normal LV Systolic Function';
    if (ef >= 45) return 'Mildly Reduced LV Systolic Function';
    if (ef >= 35) return 'Moderately Reduced LV Systolic Function';
    return 'Severely Reduced LV Systolic Function';
  };

  const hasValveIssues = Object.values(valves).some(
    v => (v.mr_grade && v.mr_grade !== 'none') ||
         (v.ar_grade && v.ar_grade !== 'none') ||
         (v.tr_grade && v.tr_grade !== 'none') ||
         (v.pr_grade && v.pr_grade !== 'none')
  );

  return (
    <div className="glass-panel" style={{ padding: '24px', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>❤️</span> 2D Echocardiography Panel
      </h3>

      {/* LVEF Progress Bar */}
      <div style={{ marginBottom: '20px', background: 'var(--glass-bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Left Ventricular Ejection Fraction (LVEF):</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: getLvefColor(lvef_percent), marginLeft: 'auto' }}>
            {lvef_percent !== null ? `${lvef_percent}%` : 'N/A'}
          </span>
        </div>
        
        {lvef_percent !== null && (
          <>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: `${lvef_percent}%`, height: '100%', backgroundColor: getLvefColor(lvef_percent), borderRadius: '4px' }}></div>
            </div>
            <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--muted)' }}>
              {getLvefLabel(lvef_percent)}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Diastolic dysfunction & PAH */}
        <div style={{ padding: '14px', borderRadius: '8px', background: diastolic_dysfunction_grade ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.06)', border: `1px solid ${diastolic_dysfunction_grade ? '#fde047' : '#bbf7d0'}` }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: diastolic_dysfunction_grade ? '#b45309' : '#15803d', marginBottom: '6px' }}>Diastolic Function</strong>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--ink)' }}>
            {diastolic_dysfunction_grade ? `Grade ${diastolic_dysfunction_grade} Dysfunction` : 'Normal Diastolic Function'}
          </span>
        </div>

        <div style={{ padding: '14px', borderRadius: '8px', background: pah.present ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)', border: `1px solid ${pah.present ? '#fca5a5' : '#bbf7d0'}` }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: pah.present ? '#b91c1c' : '#15803d', marginBottom: '6px' }}>Pulmonary Hypertension (PAH)</strong>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--ink)' }}>
            {pah.present ? `Elevated (PASP: ${pah.pasp_mmhg || 'N/A'} mmHg)` : 'No PAH Detected'}
          </span>
        </div>
      </div>

      {/* Valvular findings */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: '600' }}>Valvular Findings</h4>
        {hasValveIssues ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {Object.entries(valves).map(([vName, vData]) => {
              const severity = vData.mr_grade || vData.ar_grade || vData.tr_grade || vData.pr_grade;
              if (!severity || severity === 'none') return null;
              return (
                <div key={vName} style={{ padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.85rem' }}>
                  <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{vName} Valve</span>: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{severity} regurgitation</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontStyle: 'italic' }}>
            ✓ All cardiac valves show normal physiological competence.
          </div>
        )}
      </div>

      {/* Other findings */}
      {(pericardial_effusion || rwma || thrombus || vegetation) && (
        <div style={{ margin: '0 0 16px 0', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '0.85rem' }}>
          <strong style={{ color: '#ef4444' }}>ALERT: Structural abnormalities detected</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {pericardial_effusion && <li>Pericardial effusion present</li>}
            {rwma && <li>Regional Wall Motion Abnormality (RWMA) detected</li>}
            {thrombus && <li>Intracardiac thrombus present</li>}
            {vegetation && <li>Valvular vegetation detected</li>}
          </ul>
        </div>
      )}

      {impression_text && (
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '3px solid var(--teal)' }}>
          <strong>Clinical Impression:</strong> {impression_text}
        </div>
      )}
    </div>
  );
}
