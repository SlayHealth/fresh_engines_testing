import React from 'react';

export default function MaleReproductivePanel({ prostate, age }) {
  if (!prostate) return null;
  const grade = prostate.grade || 'normal';
  
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: 'var(--prostate-color)' }}>Male Reproductive Panel</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Prostate Health</h4>
        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          Volume: <strong>{prostate.volume_cc || prostate.weight_grams || 'N/A'} {prostate.volume_cc ? 'cc' : 'g'}</strong><br/>
          Status: <strong style={{ color: grade !== 'normal' ? 'var(--color-moderate)' : 'var(--color-normal)' }}>{grade.replace('_', ' ')}</strong><br/>
          {grade !== 'normal' && <span style={{ color: 'var(--color-severe)' }}>Prostatomegaly detected. Urology consult advised.</span>}
        </div>
      </div>
    </div>
  );
}
