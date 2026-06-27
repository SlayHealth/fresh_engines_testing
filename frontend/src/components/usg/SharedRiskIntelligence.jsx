import React from 'react';

export default function SharedRiskIntelligence({ insights }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '20px', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--teal)', fontWeight: 'bold' }}>Shared Risk Intelligence</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No shared risk flags detected for the couple.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '350px', overflowY: 'auto' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)', fontWeight: 'bold' }}>Shared Risk Intelligence</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {insights.map(i => (
          <div key={i.id} style={{ padding: '12px', background: 'var(--soft-amber)', borderLeft: '4px solid var(--color-moderate)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 4px 0', color: 'var(--amber-d)', fontSize: '0.95rem', fontWeight: 'bold' }}>{i.title}</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: '1.4' }}>{i.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
