import React from 'react';

export default function MetabolicHealthDashboard({ indexA, indexB, nameA = "Partner A", nameB = "Partner B" }) {
  const getScoreColor = (score) => {
    if (score >= 8) return 'var(--color-normal)';
    if (score >= 5) return 'var(--color-moderate)';
    return 'var(--color-severe)';
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', textAlign: 'center', fontWeight: 'bold' }}>Metabolic Health Index</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', fontWeight: '500' }}>{nameA}</span>
          {indexA !== undefined && indexA !== null ? (
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: getScoreColor(indexA), marginTop: '4px' }}>
              {indexA} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/ 10</span>
            </div>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', display: 'block', marginTop: '8px' }}>Pending</span>
          )}
        </div>

        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', fontWeight: '500' }}>{nameB}</span>
          {indexB !== undefined && indexB !== null ? (
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: getScoreColor(indexB), marginTop: '4px' }}>
              {indexB} <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/ 10</span>
            </div>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', display: 'block', marginTop: '8px' }}>Pending</span>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '12px', textAlign: 'center', lineHeight: '1.4' }}>
        Combines fatty liver, BMI, hepatomegaly, and cholelithiasis into a single index.
      </p>
    </div>
  );
}
