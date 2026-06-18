import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const getSeverityValue = (severity) => {
  if (severity === 'high') return 3;
  if (severity === 'moderate') return 2;
  return 1;
};
const getFertilityValue = (rel) => {
  if (rel === 'critical') return 4;
  if (rel === 'high') return 3;
  if (rel === 'moderate') return 2;
  if (rel === 'low') return 1;
  return 0;
};

export default function RiskMatrix({ flags }) {
  if (!flags || flags.length === 0) return <div className="glass-panel" style={{ padding: '20px' }}>No risk flags detected.</div>;
  
  const data = flags.map(f => ({
    x: getFertilityValue(f.fertility_relevance),
    y: getSeverityValue(f.severity),
    name: f.flag_label,
    desc: f.clinical_note
  }));

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '350px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)' }}>Risk Flag Priority Matrix</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="x" name="Fertility Relevance" ticks={[0, 1, 2, 3, 4]} domain={[0, 4]} tickFormatter={v => ['None', 'Low', 'Moderate', 'High', 'Critical'][v]} />
          <YAxis type="number" dataKey="y" name="Severity" ticks={[1, 2, 3]} domain={[0, 4]} tickFormatter={v => ['', 'Low', 'Moderate', 'High'][v] || ''} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
            if (!payload || !payload.length) return null;
            const item = payload[0].payload;
            return <div style={{ background: 'var(--background)', padding: '10px', border: '1px solid var(--line)' }}>
              <strong>{item.name}</strong><br/>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.desc}</span>
            </div>;
          }} />
          <Scatter name="Flags" data={data} fill="var(--color-severe)">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.y === 3 ? 'var(--color-severe)' : entry.y === 2 ? 'var(--color-moderate)' : 'var(--color-mild)'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
