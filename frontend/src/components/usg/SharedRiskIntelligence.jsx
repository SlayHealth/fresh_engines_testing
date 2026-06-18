import React from 'react';

export default function SharedRiskIntelligence({ insights }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)' }}>Shared Risk Intelligence</h3>
        <p style={{ color: 'var(--muted)' }}>No shared risk flags detected for the couple.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)' }}>Shared Risk Intelligence</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {insights.map(i => (
          <div key={i.id} style={{ padding: '16px', background: 'var(--glass-bg)', borderLeft: '4px solid var(--color-moderate)', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--surface)' }}>{i.title}</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--line)', lineHeight: '1.4' }}>{i.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
