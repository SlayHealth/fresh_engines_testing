import React from 'react';

export default function DexaPanel({ dexaData }) {
  if (!dexaData) return null;

  const {
    sites = [],
    lowest_t_score_site = '',
    lowest_t_score_value = null,
    overall_who_classification = ''
  } = dexaData;

  const getClassificationColor = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('normal')) return '#10b981'; // green
    if (s.includes('osteopenia')) return '#f59e0b'; // amber
    if (s.includes('osteoporosis')) return '#ef4444'; // red
    return 'var(--muted)';
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', height: '100%' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🦴</span> DEXA Bone Densitometry Panel
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* T-score score box */}
        <div style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '10px', border: '1px solid var(--line)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Lowest T-score</span>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: getClassificationColor(overall_who_classification) }}>
            {lowest_t_score_value !== null ? lowest_t_score_value.toFixed(1) : '—'}
          </span>
          {lowest_t_score_site && (
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
              Measured at: {lowest_t_score_site}
            </span>
          )}
        </div>

        {/* WHO Classification status */}
        <div style={{ padding: '16px', borderRadius: '10px', background: `${getClassificationColor(overall_who_classification)}15`, border: `1px solid ${getClassificationColor(overall_who_classification)}33`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>WHO Classification</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getClassificationColor(overall_who_classification), textTransform: 'uppercase', textAlign: 'center' }}>
            {overall_who_classification || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Sites list */}
      {sites.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: '600' }}>Evaluation Sites & Scan Metrics</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            {sites.map((site, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'between', padding: '10px 14px', background: 'var(--glass-bg)', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{site.site || 'Unnamed site'}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
                  T-score: <strong style={{ color: site.t_score <= -2.5 ? '#ef4444' : site.t_score <= -1.0 ? '#f59e0b' : '#10b981' }}>{site.t_score !== null ? site.t_score.toFixed(1) : 'N/A'}</strong> | Z-score: {site.z_score !== null ? site.z_score.toFixed(1) : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overall_who_classification.toLowerCase().includes('osteopenia') && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', fontSize: '0.8rem', color: '#b45309' }}>
          <strong>Lifestyle Tip:</strong> Osteopenia indicates lower bone mineral density. Focus on calcium-rich nutrition, vitamin D-3, and weight-bearing exercises to improve bone health baseline.
        </div>
      )}

      {overall_who_classification.toLowerCase().includes('osteoporosis') && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', fontSize: '0.8rem', color: '#b91c1c' }}>
          <strong>Clinical Advisory:</strong> Osteoporosis indicates significantly thinned bone structure. Urology/Gynecology and Orthopedic consultation is recommended before planning family activities.
        </div>
      )}
    </div>
  );
}
