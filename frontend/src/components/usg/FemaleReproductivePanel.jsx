import React from 'react';

export default function FemaleReproductivePanel({ ovaries, uterus }) {
  if (!ovaries && !uterus) return null;
  const pcos = ovaries?.pcos_morphology_bilateral || ovaries?.pcos_morphology_unilateral;
  
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: 'var(--ovary-color)' }}>Female Reproductive Panel</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>PCOS Risk Card</h4>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
          <div>Right Ovary: <strong>{ovaries?.right?.volume_cc || 'N/A'} cc</strong> {ovaries?.right?.volume_cc > 10 ? '⚠️' : '✓'}</div>
          <div>Left Ovary: <strong>{ovaries?.left?.volume_cc || 'N/A'} cc</strong> {ovaries?.left?.volume_cc > 10 ? '⚠️' : '✓'}</div>
        </div>
        {pcos && <div style={{ marginTop: '8px', padding: '8px', background: 'var(--soft-red)', color: 'var(--red-d)', borderRadius: '6px' }}>PCOS Morphology CONFIRMED — Hormonal Assay Advised</div>}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Uterine Health Card</h4>
        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
          {uterus?.size_normal ? 'Size: Normal' : 'Size: Enlarged/Abnormal'}<br/>
          {uterus?.fibroid_present && <span style={{ color: 'var(--color-severe)' }}>Fibroids present<br/></span>}
          {uterus?.collection_in_cavity && <span style={{ color: 'var(--color-severe)' }}>Collection in cavity<br/></span>}
        </div>
      </div>
    </div>
  );
}
