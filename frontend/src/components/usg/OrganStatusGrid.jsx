import React from 'react';

const organs = [
  { name: 'Liver', key: 'liver' },
  { name: 'Gallbladder', key: 'gallbladder' },
  { name: 'Pancreas', key: 'pancreas' },
  { name: 'Spleen', key: 'spleen' },
  { name: 'Kidneys', key: 'kidneys' },
  { name: 'Bladder', key: 'bladder' },
  { name: 'Reproductive', key: 'reproductive' }
];

function getStatusColor(score) {
  if (score === undefined || score === null) return 'var(--color-not-assessed)';
  if (score >= 85) return 'var(--color-normal)';
  if (score >= 70) return 'var(--color-mild)';
  if (score >= 50) return 'var(--color-moderate)';
  return 'var(--color-severe)';
}

export default function OrganStatusGrid({ scoresA, scoresB, nameA = "Partner A", nameB = "Partner B" }) {
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)', fontWeight: 'bold' }}>Organ Health Status</h3>
      
      {/* Header Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--line)', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--muted)' }}>
        <div>ORGAN SYSTEM</div>
        <div style={{ textAlign: 'center', color: 'var(--partner-a)' }}>{nameA.toUpperCase()}</div>
        <div style={{ textAlign: 'center', color: 'var(--partner-b)' }}>{nameB.toUpperCase()}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {organs.map(org => {
          const scoreA = scoresA?.[org.key];
          const scoreB = scoresB?.[org.key];
          return (
            <div key={org.key} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', alignItems: 'center', padding: '8px 4px', borderBottom: '1px dashed var(--line)', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: '500' }}>{org.name}</span>
              
              {/* Partner A */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getStatusColor(scoreA) }}></div>
                <span style={{ fontSize: '0.85rem', color: scoreA !== undefined && scoreA !== null ? 'var(--foreground)' : 'var(--muted)' }}>
                  {scoreA !== undefined && scoreA !== null ? scoreA : 'N/A'}
                </span>
              </div>

              {/* Partner B */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getStatusColor(scoreB) }}></div>
                <span style={{ fontSize: '0.85rem', color: scoreB !== undefined && scoreB !== null ? 'var(--foreground)' : 'var(--muted)' }}>
                  {scoreB !== undefined && scoreB !== null ? scoreB : 'N/A'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
