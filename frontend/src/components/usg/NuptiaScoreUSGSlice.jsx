import React from 'react';

export default function NuptiaScoreUSGSlice({ contributionA, contributionB, nameA = 'Partner A', nameB = 'Partner B' }) {
  const valueA = contributionA !== undefined && contributionA !== null ? contributionA.toFixed(1) : null;
  const valueB = contributionB !== undefined && contributionB !== null ? contributionB.toFixed(1) : null;

  return (
    <div className="glass-panel text-white" style={{ padding: '20px', background: 'linear-gradient(135deg, var(--teal-d), var(--foreground))' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--surface)', fontWeight: 'bold' }}>NuptiaScore™ Contribution</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', display: 'block', fontWeight: '500' }}>{nameA}</span>
          {valueA !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--partner-a)' }}>+{valueA}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>/ 30 pts</span>
            </div>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic', display: 'block', marginTop: '6px' }}>Pending upload</span>
          )}
        </div>
        
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', display: 'block', fontWeight: '500' }}>{nameB}</span>
          {valueB !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--partner-b)' }}>+{valueB}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>/ 30 pts</span>
            </div>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontStyle: 'italic', display: 'block', marginTop: '6px' }}>Pending upload</span>
          )}
        </div>
      </div>
      
      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '12px', lineHeight: '1.4' }}>
        Calculated across Abdominal USG, Scrotum/TVS Doppler, Echo, and DEXA metrics under the Multi-Modality Radiology Engine v2.0.
      </p>
    </div>
  );
}
