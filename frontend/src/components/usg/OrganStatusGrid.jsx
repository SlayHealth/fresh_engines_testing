import React from 'react';

const organs = ['Liver', 'Gallbladder', 'Pancreas', 'Spleen', 'Kidneys', 'Bladder', 'Reproductive'];

function getStatusColor(score) {
  if (score === undefined || score === null) return 'var(--color-not-assessed)';
  if (score >= 85) return 'var(--color-normal)';
  if (score >= 70) return 'var(--color-mild)';
  if (score >= 50) return 'var(--color-moderate)';
  return 'var(--color-severe)';
}

export default function OrganStatusGrid({ scores }) {
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)' }}>Organ Status Grid</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {organs.map(org => {
          const key = org.toLowerCase();
          const score = scores?.[key];
          return (
            <div key={org} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--glass-bg)', borderRadius: '8px' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: getStatusColor(score) }}></div>
              <span style={{ fontSize: '0.95rem' }}>{org}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--muted)' }}>{score ?? 'N/A'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
