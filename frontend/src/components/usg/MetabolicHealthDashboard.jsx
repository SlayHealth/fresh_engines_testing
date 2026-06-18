import React from 'react';

export default function MetabolicHealthDashboard({ metabolicIndex }) {
  const score = metabolicIndex || 0;
  return (
    <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>Metabolic Health Index</h3>
      <div style={{ fontSize: '3rem', fontWeight: 'bold', color: score >= 8 ? 'var(--color-normal)' : score >= 5 ? 'var(--color-moderate)' : 'var(--color-severe)' }}>
        {score} / 10
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '8px' }}>
        Combines fatty liver, BMI, hepatomegaly, and cholelithiasis into a single index.
      </p>
    </div>
  );
}
