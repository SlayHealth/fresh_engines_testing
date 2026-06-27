import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function CoupleRadarComparison({ scoresA, scoresB, nameA = "Partner A", nameB = "Partner B" }) {
  if (!scoresA && !scoresB) {
    return <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>No reports uploaded.</div>;
  }
  if (!scoresB) {
    return (
      <div className="glass-panel animate-pulse" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--partner-a)', fontWeight: 'bold' }}>{nameA} Analyzed</h3>
        <p style={{ color: 'var(--muted)' }}>Waiting for {nameB}'s report to unlock Couple Radar Comparison...</p>
        <div style={{ marginTop: '20px', width: '50px', height: '50px', border: '3px solid var(--partner-b)', borderRadius: '50%', margin: '20px auto' }}></div>
      </div>
    );
  }

  const data = [
    { subject: 'Liver', A: scoresA?.liver || 0, B: scoresB?.liver || 0 },
    { subject: 'Gallbladder', A: scoresA?.gallbladder || 0, B: scoresB?.gallbladder || 0 },
    { subject: 'Pancreas', A: scoresA?.pancreas || 0, B: scoresB?.pancreas || 0 },
    { subject: 'Spleen', A: scoresA?.spleen || 0, B: scoresB?.spleen || 0 },
    { subject: 'Kidneys', A: scoresA?.kidneys || 0, B: scoresB?.kidneys || 0 },
    { subject: 'Bladder', A: scoresA?.bladder || 0, B: scoresB?.bladder || 0 },
    { subject: 'Reproductive', A: scoresA?.reproductive || 0, B: scoresB?.reproductive || 0 },
  ];

  return (
    <div className="glass-panel" style={{ padding: '20px', height: '400px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}>Couple Radar Comparison</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--line)' }} />
          <Legend />
          <Radar name={nameA} dataKey="A" stroke="var(--partner-a)" fill="var(--partner-a)" fillOpacity={0.2} />
          <Radar name={nameB} dataKey="B" stroke="var(--partner-b)" fill="var(--partner-b)" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
