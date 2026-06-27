import React from 'react';

export default function ScrotalHealthPanel({ scrotumData }) {
  if (!scrotumData) return null;

  const {
    right_testis = {},
    left_testis = {},
    right_epididymis = {},
    left_epididymis = {},
    varicocele = {},
    hydrocele = {},
    spermatic_cord_normal = true,
    inguinal_hernia = false,
    impression_text = ''
  } = scrotumData;

  const hasVaricocele = varicocele.present;
  const varicoceleGradeText = varicocele.grade ? `Grade ${varicocele.grade}` : 'Ungraded';

  return (
    <div className="glass-panel" style={{ padding: '24px', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🩻</span> Scrotal & Doppler Health Panel
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Right Testis */}
        <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: '600' }}>Right Testis</h4>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Size: {right_testis.length_mm || '—'} × {right_testis.width_mm || '—'} × {right_testis.height_mm || '—'} mm</li>
            <li>Volume: {right_testis.volume_cc ? `${right_testis.volume_cc} cc` : '—'}</li>
            <li>Echopattern: <span style={{ color: right_testis.echopattern_normal ? 'var(--success)' : 'var(--error)' }}>{right_testis.echopattern_normal ? 'Normal' : 'Abnormal'}</span></li>
            <li>Vascularity: <span style={{ color: right_testis.vascularity_normal !== false ? 'var(--success)' : 'var(--error)' }}>{right_testis.vascularity_normal !== false ? 'Normal' : 'Abnormal'}</span></li>
            {right_testis.focal_lesion && <li style={{ color: 'var(--error)', fontWeight: 'bold' }}>Focal Lesion Detected</li>}
          </ul>
        </div>

        {/* Left Testis */}
        <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: '600' }}>Left Testis</h4>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Size: {left_testis.length_mm || '—'} × {left_testis.width_mm || '—'} × {left_testis.height_mm || '—'} mm</li>
            <li>Volume: {left_testis.volume_cc ? `${left_testis.volume_cc} cc` : '—'}</li>
            <li>Echopattern: <span style={{ color: left_testis.echopattern_normal ? 'var(--success)' : 'var(--error)' }}>{left_testis.echopattern_normal ? 'Normal' : 'Abnormal'}</span></li>
            <li>Vascularity: <span style={{ color: left_testis.vascularity_normal !== false ? 'var(--success)' : 'var(--error)' }}>{left_testis.vascularity_normal !== false ? 'Normal' : 'Abnormal'}</span></li>
            {left_testis.focal_lesion && <li style={{ color: 'var(--error)', fontWeight: 'bold' }}>Focal Lesion Detected</li>}
          </ul>
        </div>
      </div>

      {/* Pathology findings: Varicocele & Hydrocele */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ padding: '14px', borderRadius: '8px', background: hasVaricocele ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.06)', border: `1px solid ${hasVaricocele ? '#fca5a5' : '#bbf7d0'}` }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: hasVaricocele ? '#b91c1c' : '#15803d', marginBottom: '6px' }}>Varicocele</strong>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--ink)' }}>
            {hasVaricocele ? `Present (${varicoceleGradeText} on ${varicocele.side || 'unknown'} side)` : 'No Varicocele Detected'}
          </span>
        </div>

        <div style={{ padding: '14px', borderRadius: '8px', background: hydrocele.present ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.06)', border: `1px solid ${hydrocele.present ? '#fde047' : '#bbf7d0'}` }}>
          <strong style={{ display: 'block', fontSize: '0.85rem', color: hydrocele.present ? '#b45309' : '#15803d', marginBottom: '6px' }}>Hydrocele</strong>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--ink)' }}>
            {hydrocele.present ? `Present (${hydrocele.significant ? 'Significant' : 'Mild'} on ${hydrocele.side || 'unknown'} side)` : 'No Hydrocele Detected'}
          </span>
        </div>
      </div>

      {/* Additional structural flags */}
      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <div>Spermatic Cord: <strong>{spermatic_cord_normal ? 'Normal' : 'Abnormal'}</strong></div>
        <div>Inguinal Hernia: <strong style={{ color: inguinal_hernia ? 'var(--error)' : 'inherit' }}>{inguinal_hernia ? 'Yes (Detected)' : 'No'}</strong></div>
      </div>

      {impression_text && (
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '3px solid var(--teal)' }}>
          <strong>Clinical Impression:</strong> {impression_text}
        </div>
      )}
    </div>
  );
}
