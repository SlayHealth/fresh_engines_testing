"use client";
import React, { useState } from 'react';
import OrganHealthRadar from '@/components/usg/OrganHealthRadar';
import OrganStatusGrid from '@/components/usg/OrganStatusGrid';
import CoupleRadarComparison from '@/components/usg/CoupleRadarComparison';
import FattyLiverVisual from '@/components/usg/FattyLiverVisual';
import FemaleReproductivePanel from '@/components/usg/FemaleReproductivePanel';
import MaleReproductivePanel from '@/components/usg/MaleReproductivePanel';
import RiskMatrix from '@/components/usg/RiskMatrix';
import MetabolicHealthDashboard from '@/components/usg/MetabolicHealthDashboard';
import NuptiaScoreUSGSlice from '@/components/usg/NuptiaScoreUSGSlice';
import SharedRiskIntelligence from '@/components/usg/SharedRiskIntelligence';
import PDFUploader from '@/components/usg/PDFUploader';
import { API_URL } from '@/config/api';

export default function USGAbdomenEngine() {
  const [reportA, setReportA] = useState('');
  const [reportB, setReportB] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTrace, setShowTrace] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const fetchCoupleAnalysis = async (overrideA = reportA, overrideB = reportB) => {
    if (!overrideA) return;
    setLoading(true);
    setError(null);
    try {
      let finalData = {};
      if (overrideA && !overrideB) {
        const res = await fetch(`${API_URL}/api/usg/report/${overrideA}`);
        if (!res.ok) throw new Error('Report A not found');
        const json = await res.json();
        finalData.partner_A = json.analyzed_results;
        finalData.partner_B = null;
        finalData.shared_insights = [];
      } else {
        const res = await fetch(`${API_URL}/api/usg/couple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId_A: overrideA, reportId_B: overrideB })
        });
        if (!res.ok) throw new Error('Couple reports not found');
        finalData = await res.json();

        // Fetch AI Summary
        try {
          const sumRes = await fetch(`${API_URL}/api/usg/couple-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId_A: overrideA, reportId_B: overrideB })
          });
          if (sumRes.ok) {
            finalData.ai_summary = await sumRes.json();
          }
        } catch(e) {
          console.error("Could not fetch summary", e);
        }
      }
      setData(finalData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '24px', textAlign: 'center' }}>USG Abdomen Engine</h1>
        
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginBottom: '24px' }}>
          <PDFUploader 
            partnerLabel="Partner A" 
            onUploadSuccess={(id) => { setReportA(id); fetchCoupleAnalysis(id, reportB); }} 
          />
          <PDFUploader 
            partnerLabel="Partner B" 
            onUploadSuccess={(id) => { setReportB(id); fetchCoupleAnalysis(reportA, id); }} 
          />
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)' }}>Or manually enter Report IDs:</span>
          <input placeholder="Partner A ID" value={reportA} onChange={e => setReportA(e.target.value)} style={{ padding: '8px', background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--line)', borderRadius: '4px' }} />
          <input placeholder="Partner B ID" value={reportB} onChange={e => setReportB(e.target.value)} style={{ padding: '8px', background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--line)', borderRadius: '4px' }} />
          <button onClick={() => fetchCoupleAnalysis()} disabled={loading} style={{ padding: '8px 16px', background: 'var(--teal)', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
            {loading ? 'Analyzing...' : 'Fetch Existing'}
          </button>
        </div>
        
        {error && <p style={{ color: 'var(--error)', marginTop: '16px', textAlign: 'center' }}>{error}</p>}
      </header>

      {data && data.partner_A && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
          {/* Top Row: Overall scores */}
          <div style={{ gridColumn: 'span 4' }}>
            <NuptiaScoreUSGSlice contribution={data.partner_A.nuptia_score_usg_contribution} />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
             <MetabolicHealthDashboard metabolicIndex={data.partner_A.scores?.metabolic_index} />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
             <FattyLiverVisual grade={data.partner_A.raw_data?.findings?.liver?.fatty_grade} />
          </div>

          {/* Middle Row: Radar and Status */}
          <div style={{ gridColumn: 'span 4' }}>
            <OrganHealthRadar scores={data.partner_A.scores} />
          </div>
          <div style={{ gridColumn: 'span 8' }}>
            <OrganStatusGrid scores={data.partner_A.scores} />
          </div>

          {/* Reproductive & Risk */}
          <div style={{ gridColumn: 'span 6' }}>
            {data.partner_A.raw_data?.patient?.sex === 'Female' ? (
              <FemaleReproductivePanel ovaries={data.partner_A.raw_data?.findings?.ovaries} uterus={data.partner_A.raw_data?.findings?.uterus} />
            ) : (
              <MaleReproductivePanel prostate={data.partner_A.raw_data?.findings?.prostate} age={data.partner_A.raw_data?.patient?.age_years} />
            )}
          </div>
          <div style={{ gridColumn: 'span 6' }}>
            <RiskMatrix flags={data.partner_A.risk_flags} />
          </div>

          {/* Couple Row */}
          <div style={{ gridColumn: 'span 6' }}>
            <CoupleRadarComparison scoresA={data.partner_A.scores} scoresB={data.partner_B?.scores} />
          </div>
          <div style={{ gridColumn: 'span 6' }}>
            {data.partner_B ? (
               <SharedRiskIntelligence insights={data.shared_insights} />
            ) : (
               <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <p style={{ color: 'var(--muted)' }}>Upload Partner B report to view Shared Risk Intelligence.</p>
               </div>
            )}
          </div>

          {/* AI Couple Summary */}
          {data.ai_summary && (
            <div style={{ gridColumn: 'span 12', marginTop: '24px' }} className="glass-panel">
              <div style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 20px 0', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  NuptiaScore™ AI Compatibility Summary
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ color: '#10b981', margin: '0 0 12px 0' }}>The Good Things 🌿</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.ai_summary.good_things.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ color: '#f59e0b', margin: '0 0 12px 0' }}>Minor Observations ⚡</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.ai_summary.minor_issues.length > 0 ? data.ai_summary.minor_issues.map((item, i) => <li key={i}>{item}</li>) : <li>None!</li>}
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ color: '#ef4444', margin: '0 0 12px 0' }}>Areas for Attention 🚩</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {data.ai_summary.major_issues.length > 0 ? data.ai_summary.major_issues.map((item, i) => <li key={i}>{item}</li>) : <li>None!</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Trace Section */}
          <div style={{ gridColumn: 'span 12', marginTop: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <button 
                onClick={() => setShowTrace(!showTrace)} 
                style={{ padding: '10px 20px', background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.target.style.background = 'var(--line)'}
                onMouseOut={(e) => e.target.style.background = 'var(--glass-bg)'}
              >
                {showTrace ? 'Hide Calculations Trace' : 'View Calculations Trace'}
              </button>
              <button 
                onClick={() => setShowRaw(!showRaw)} 
                style={{ padding: '10px 20px', background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.target.style.background = 'var(--line)'}
                onMouseOut={(e) => e.target.style.background = 'var(--glass-bg)'}
              >
                {showRaw ? 'Hide Raw JSON' : 'View Raw Extracted JSON'}
              </button>
            </div>

            {showTrace && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '16px' }}>
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--teal)' }}>Calculations Trace (Partner A)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <strong>Organ Scores</strong>
                      <pre style={{ fontSize: '0.85rem', color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                        {JSON.stringify(data.partner_A.scores, null, 2)}
                      </pre>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <strong>Risk Flags Generated</strong>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--muted)', marginTop: '8px' }}>
                        {data.partner_A.risk_flags?.length > 0 ? data.partner_A.risk_flags.map((flag, idx) => (
                          <li key={idx} style={{ marginBottom: '8px' }}>
                            <span style={{ color: 'var(--color-severe)' }}>[{flag.severity?.toUpperCase() || 'UNKNOWN'}]</span> {flag.flag_label}
                          </li>
                        )) : <li style={{ color: 'var(--muted)' }}>No risk flags detected.</li>}
                      </ul>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                      <strong>NuptiaScore Pipeline</strong>
                      <pre style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: '8px', lineHeight: '1.4' }}>
                        Composite Organ Score Math:<br/>
                        Liver: {data.partner_A.scores.liver} × 0.22<br/>
                        Gallbladder: {data.partner_A.scores.gallbladder} × 0.10<br/>
                        Pancreas: {data.partner_A.scores.pancreas} × 0.08<br/>
                        Spleen: {data.partner_A.scores.spleen} × 0.07<br/>
                        Kidneys: {data.partner_A.scores.kidneys} × 0.18<br/>
                        Bladder: {data.partner_A.scores.bladder} × 0.10<br/>
                        Reproductive: {data.partner_A.scores.reproductive} × 0.25<br/>
                        ------------------------------------<br/>
                        Composite Organ Score: {data.partner_A.scores.composite_abdominal?.toFixed(2)}<br/>
                        <br/>
                        Nuptia USG Slice Calculation:<br/>
                        Metabolic: ({data.partner_A.scores.metabolic_index}/10 × 30%)<br/>
                        Reproductive: ({data.partner_A.scores.reproductive}/100 × 35%)<br/>
                        Renal: ({data.partner_A.scores.kidneys}/100 × 15%)<br/>
                        Abdominal: ({data.partner_A.scores.composite_abdominal}/100 × 20%)<br/>
                        Sum × 15 (Max Points)<br/>
                        ------------------------------------<br/>
                        Final USG Contribution (max 15): {data.partner_A.nuptia_score_usg_contribution?.toFixed(2)}
                      </pre>
                    </div>
                  </div>
                </div>

                {data.partner_B && (
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', color: 'var(--teal)' }}>Calculations Trace (Partner B)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <strong>Organ Scores</strong>
                        <pre style={{ fontSize: '0.85rem', color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                          {JSON.stringify(data.partner_B.scores, null, 2)}
                        </pre>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <strong>Risk Flags Generated</strong>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--muted)', marginTop: '8px' }}>
                          {data.partner_B.risk_flags?.length > 0 ? data.partner_B.risk_flags.map((flag, idx) => (
                            <li key={idx} style={{ marginBottom: '8px' }}>
                              <span style={{ color: 'var(--color-severe)' }}>[{flag.severity?.toUpperCase() || 'UNKNOWN'}]</span> {flag.flag_label}
                            </li>
                          )) : <li style={{ color: 'var(--muted)' }}>No risk flags detected.</li>}
                        </ul>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <strong>NuptiaScore Pipeline</strong>
                        <pre style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: '8px', lineHeight: '1.4' }}>
                          Composite Organ Score Math:<br/>
                          Liver: {data.partner_B.scores.liver} × 0.22<br/>
                          Gallbladder: {data.partner_B.scores.gallbladder} × 0.10<br/>
                          Pancreas: {data.partner_B.scores.pancreas} × 0.08<br/>
                          Spleen: {data.partner_B.scores.spleen} × 0.07<br/>
                          Kidneys: {data.partner_B.scores.kidneys} × 0.18<br/>
                          Bladder: {data.partner_B.scores.bladder} × 0.10<br/>
                          Reproductive: {data.partner_B.scores.reproductive} × 0.25<br/>
                          ------------------------------------<br/>
                          Composite Organ Score: {data.partner_B.scores.composite_abdominal?.toFixed(2)}<br/>
                          <br/>
                          Nuptia USG Slice Calculation:<br/>
                          Metabolic: ({data.partner_B.scores.metabolic_index}/10 × 30%)<br/>
                          Reproductive: ({data.partner_B.scores.reproductive}/100 × 35%)<br/>
                          Renal: ({data.partner_B.scores.kidneys}/100 × 15%)<br/>
                          Abdominal: ({data.partner_B.scores.composite_abdominal}/100 × 20%)<br/>
                          Sum × 15 (Max Points)<br/>
                          ------------------------------------<br/>
                          Final USG Contribution (max 15): {data.partner_B.nuptia_score_usg_contribution?.toFixed(2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showRaw && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--teal)' }}>Raw LLM Extracted JSON (Partner A)</h3>
                  <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--muted)', overflowX: 'auto' }}>
                    {JSON.stringify(data.partner_A.raw_data, null, 2)}
                  </pre>
                </div>
                {data.partner_B && (
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', color: 'var(--teal)' }}>Raw LLM Extracted JSON (Partner B)</h3>
                    <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--muted)', overflowX: 'auto' }}>
                      {JSON.stringify(data.partner_B.raw_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
