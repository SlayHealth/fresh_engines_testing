import React from 'react';

export default function FattyLiverVisual({ grade }) {
  const g = grade || 0;
  let color = 'var(--color-normal)';
  let text = 'Clean liver silhouette. Normal.';
  if (g === 1) { color = 'var(--color-mild)'; text = 'Mild echogenicity. Grade I.'; }
  else if (g === 2) { color = 'var(--color-moderate)'; text = 'Moderate — periportal echoes obscured. Grade II.'; }
  else if (g === 3) { color = 'var(--color-severe)'; text = 'Severe — vessel borders unclear. Grade III.'; }

  return (
    <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Fatty Liver Visual</h3>
      <div style={{ margin: '20px auto', width: '120px', height: '80px', background: color, borderRadius: '40px 60px 40px 10px', transition: 'all 0.5s ease', boxShadow: `0 0 20px ${color}` }}></div>
      <p style={{ fontWeight: '600', marginBottom: '8px' }}>Grade {g}</p>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>{text}</p>
      {g > 1 && <p style={{ fontSize: '0.8rem', color: 'var(--color-moderate)', marginTop: '12px' }}>Associated with insulin resistance. Commonly reversible with lifestyle changes.</p>}
    </div>
  );
}
