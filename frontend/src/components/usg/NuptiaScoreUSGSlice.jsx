import React from 'react';

export default function NuptiaScoreUSGSlice({ contribution }) {
  const value = contribution ? contribution.toFixed(1) : 0;
  return (
    <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--teal-d), var(--background))' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--surface)' }}>NuptiaScore™ Contribution</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-normal)' }}>+{value}</span>
        <span style={{ color: 'var(--muted)' }}>/ 15 points</span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--line)', marginTop: '8px' }}>
        Calculated from 4 pillars: Metabolic (30%), Reproductive (35%), Renal (15%), Abdominal (20%).
      </p>
    </div>
  );
}
