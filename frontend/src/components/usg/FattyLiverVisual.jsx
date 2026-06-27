import React from 'react';

export default function FattyLiverVisual({ gradeA, gradeB, nameA = "Partner A", nameB = "Partner B" }) {
  const getGradeDetails = (g) => {
    if (g === null || g === undefined) {
      return {
        color: '#e2e8f0',
        label: 'Pending',
        desc: 'No report',
        val: null
      };
    }
    const val = Number(g) || 0;
    if (val === 0) return { color: 'var(--color-normal)', label: 'Grade 0', desc: 'Normal silhouette.', val };
    if (val === 1) return { color: 'var(--color-mild)', label: 'Grade I', desc: 'Mild fatty liver.', val };
    if (val === 2) return { color: 'var(--color-moderate)', label: 'Grade II', desc: 'Moderate fatty liver.', val };
    return { color: 'var(--color-severe)', label: 'Grade III', desc: 'Severe fatty liver.', val };
  };

  const a = getGradeDetails(gradeA);
  const b = getGradeDetails(gradeB);

  return (
    <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: 'bold' }}>Fatty Liver Assessment</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '500' }}>{nameA}</span>
          <div style={{ 
            margin: '12px auto 8px auto', 
            width: '60px', 
            height: '40px', 
            background: a.color, 
            borderRadius: '20px 30px 20px 5px', 
            transition: 'all 0.5s ease', 
            boxShadow: a.val !== null ? `0 0 12px ${a.color}` : 'none'
          }}></div>
          <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: '2px 0' }}>{a.label}</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem', lineHeight: '1.3' }}>{a.desc}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderLeft: '1px solid var(--line)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '500' }}>{nameB}</span>
          <div style={{ 
            margin: '12px auto 8px auto', 
            width: '60px', 
            height: '40px', 
            background: b.color, 
            borderRadius: '20px 30px 20px 5px', 
            transition: 'all 0.5s ease', 
            boxShadow: b.val !== null ? `0 0 12px ${b.color}` : 'none'
          }}></div>
          <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: '2px 0' }}>{b.label}</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem', lineHeight: '1.3' }}>{b.desc}</p>
        </div>
      </div>
      
      {((a.val !== null && a.val > 0) || (b.val !== null && b.val > 0)) && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-moderate)', marginTop: '12px', lineHeight: '1.3' }}>
          Fatty liver changes are highly reversible with targeted dietary and metabolic reset.
        </p>
      )}
    </div>
  );
}
