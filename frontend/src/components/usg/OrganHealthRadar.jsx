import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function OrganHealthRadar({ scores }) {
  const data = [
    { subject: 'Liver', A: scores?.liver || 0 },
    { subject: 'Gallbladder', A: scores?.gallbladder || 0 },
    { subject: 'Pancreas', A: scores?.pancreas || 0 },
    { subject: 'Spleen', A: scores?.spleen || 0 },
    { subject: 'Kidneys', A: scores?.kidneys || 0 },
    { subject: 'Bladder', A: scores?.bladder || 0 },
    { subject: 'Reproductive', A: scores?.reproductive || 0 },
  ];

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '350px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--teal)' }}>Organ Health Radar</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--line)' }} />
          <Radar name="Health Score" dataKey="A" stroke="var(--color-normal)" fill="var(--color-normal)" fillOpacity={0.15} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
