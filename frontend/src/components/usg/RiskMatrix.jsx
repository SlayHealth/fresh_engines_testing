import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const getSeverityValue = (severity) => {
  if (severity === 'high' || severity === 'severe') return 3;
  if (severity === 'moderate') return 2;
  return 1;
};

const getFertilityValue = (rel) => {
  if (rel === 'critical' || rel === 'severe') return 4;
  if (rel === 'high') return 3;
  if (rel === 'moderate') return 2;
  if (rel === 'low') return 1;
  return 0;
};

export default function RiskMatrix({ flagsA, flagsB, nameA = "Partner A", nameB = "Partner B" }) {
  const dataA = (flagsA || []).map(f => ({
    x: getFertilityValue(f.fertility_relevance),
    y: getSeverityValue(f.severity),
    name: f.flag_label,
    desc: f.clinical_note || f.fertility_relevance || 'No additional note',
    partnerName: nameA
  }));

  const dataB = (flagsB || []).map(f => ({
    x: getFertilityValue(f.fertility_relevance),
    y: getSeverityValue(f.severity),
    name: f.flag_label,
    desc: f.clinical_note || f.fertility_relevance || 'No additional note',
    partnerName: nameB
  }));

  const hasFlags = dataA.length > 0 || dataB.length > 0;

  if (!hasFlags) {
    return (
      <div className="glass-panel text-center" style={{ padding: '40px 20px', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--teal)', fontWeight: 'bold' }}>Risk Flag Priority Matrix</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No clinical risk flags detected for either partner.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '350px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--teal)', fontWeight: 'bold' }}>Risk Flag Priority Matrix</h3>
      <ResponsiveContainer width="100%" height="90%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid />
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Fertility Relevance" 
            ticks={[0, 1, 2, 3, 4]} 
            domain={[0, 4]} 
            tickFormatter={v => ['None', 'Low', 'Moderate', 'High', 'Critical'][v]} 
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Severity" 
            ticks={[1, 2, 3]} 
            domain={[0, 4]} 
            tickFormatter={v => ['', 'Low', 'Moderate', 'High'][v] || ''} 
            tick={{ fontSize: 10 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={({ payload }) => {
              if (!payload || !payload.length) return null;
              const item = payload[0].payload;
              return (
                <div style={{ background: 'var(--surface)', padding: '10px', border: '1px solid var(--line)', borderRadius: '8px', boxShadow: 'var(--glass-shadow)' }}>
                  <strong style={{ fontSize: '0.9rem', color: item.partnerName === nameA ? 'var(--partner-a)' : 'var(--partner-b)' }}>
                    {item.partnerName}: {item.name}
                  </strong>
                  <br/>
                  <span style={{ fontSize: '0.8rem', color: 'var(--foreground)' }}>{item.desc}</span>
                </div>
              );
            }} 
          />
          <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
          <Scatter name={nameA} data={dataA} fill="var(--partner-a)" shape="circle" line={false} />
          <Scatter name={nameB} data={dataB} fill="var(--partner-b)" shape="triangle" line={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
