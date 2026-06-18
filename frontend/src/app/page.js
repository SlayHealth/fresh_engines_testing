'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Activity, Clock, FileDigit, HeartPulse } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';
import ManualInputs from '../components/ManualInputs';
import { API_URL } from '../config/api';

export default function Home() {
  // State for Male Upload
  const [maleReport, setMaleReport] = useState(null);
  const [isMaleUploading, setIsMaleUploading] = useState(false);
  const [maleError, setMaleError] = useState(null);
  const [maleManualData, setMaleManualData] = useState({});
  const maleInputRef = useRef(null);

  // State for Female Upload
  const [femaleReport, setFemaleReport] = useState(null);
  const [isFemaleUploading, setIsFemaleUploading] = useState(false);
  const [femaleError, setFemaleError] = useState(null);
  const [femaleManualData, setFemaleManualData] = useState({});
  const femaleInputRef = useRef(null);

  // Match State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState(null);

  const triggerMockExtraction = async (gender) => {
    const setIsUploading = gender === 'male' ? setIsMaleUploading : setIsFemaleUploading;
    const setError = gender === 'male' ? setMaleError : setFemaleError;
    const setReport = gender === 'male' ? setMaleReport : setFemaleReport;

    setIsUploading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        setError(data.error || 'Failed to extract data');
      }
    } catch (err) {
      setError('Connection to backend failed. Make sure the server is running.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file, gender) => {
    const setIsUploading = gender === 'male' ? setIsMaleUploading : setIsFemaleUploading;
    const setError = gender === 'male' ? setMaleError : setFemaleError;
    const setReport = gender === 'male' ? setMaleReport : setFemaleReport;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${API_URL}/api/pathology/extract`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch(e) {
          throw new Error(`Server returned status ${response.status}`);
        }
        throw new Error(errorData?.error || 'Failed to extract data');
      }

      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out after 60 seconds.');
      } else {
        setError(err.message || 'Connection failed.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsUploading(false);
    }
  };

  const handleAnalyzeCompatibility = async () => {
    if (!maleReport || !femaleReport) return;
    
    setIsAnalyzing(true);
    setMatchError(null);

    try {
      const response = await fetch(`${API_URL}/api/compatibility/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          male_report_id: maleReport.report_metadata.report_id,
          female_report_id: femaleReport.report_metadata.report_id,
          male_manual_data: maleManualData,
          female_manual_data: femaleManualData
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setMatchResult(data);
      } else {
        throw new Error(data.error || 'Failed to analyze compatibility');
      }
    } catch (err) {
      setMatchError(err.message || 'Connection to backend failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setMaleReport(null);
    setFemaleReport(null);
    setMatchResult(null);
    setMatchError(null);
    setMaleError(null);
    setFemaleError(null);
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>SlayHealth Premarital Platform</h1>
        <p className={styles.subtitle} style={{ marginBottom: '2rem' }}>
          Upload health profiles for both partners to run a deterministic premarital compatibility analysis.
        </p>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--primary)' }}>
            Compatibility Analysis
          </Link>
          <Link href="/chronic" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            Chronic Health Engine
          </Link>
          <Link href="/mfr" style={{ padding: '0.6rem 1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', textDecoration: 'none', fontWeight: 'bold', border: '1px solid var(--glass-border)' }}>
            Fertility Analysis
          </Link>
        </div>
      </header>

      {!matchResult && (
        <>
          <div className={styles.dualUploadContainer}>
            {/* Prospect 1 Upload */}
            <div className={styles.uploadWrapper}>
              <div className={styles.uploadLabel}>{maleManualData.name ? `${maleManualData.name}'s Report` : "Prospect 1's Report"}</div>
              <div 
                className={`${styles.dropzone} ${styles['glass-panel']}`}
                onClick={() => !maleReport && maleInputRef.current?.click()}
                style={maleReport ? { borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)' } : {}}
              >
                <input 
                  type="file" 
                  ref={maleInputRef} 
                  onChange={(e) => e.target.files.length && handleFileUpload(e.target.files[0], 'male')} 
                  accept=".pdf" 
                  style={{ display: 'none' }} 
                />
                
                {isMaleUploading ? (
                  <div className={styles.loader}></div>
                ) : maleReport ? (
                  <CheckCircle size={48} color="var(--success)" />
                ) : (
                  <UploadCloud className={styles.uploadIcon} />
                )}
                
                <div className={styles.uploadText}>
                  {isMaleUploading ? 'Extracting...' : maleReport ? 'Upload Successful' : 'Upload Prospect 1 PDF'}
                </div>
                
                {maleError && <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{maleError}</div>}
                
                {!isMaleUploading && !maleReport && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); triggerMockExtraction('male'); }}
                    style={{
                      marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    Use Mock Data
                  </button>
                )}
              </div>
              <ManualInputs 
                title={maleManualData.name ? `${maleManualData.name}'s Manual Lifestyle Inputs` : "Prospect 1's Manual Lifestyle Inputs"} 
                data={maleManualData} 
                onChange={setMaleManualData} 
                gender="male"
              />
            </div>

            {/* Prospect 2 Upload */}
            <div className={styles.uploadWrapper}>
              <div className={styles.uploadLabel}>{femaleManualData.name ? `${femaleManualData.name}'s Report` : "Prospect 2's Report"}</div>
              <div 
                className={`${styles.dropzone} ${styles['glass-panel']}`}
                onClick={() => !femaleReport && femaleInputRef.current?.click()}
                style={femaleReport ? { borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)' } : {}}
              >
                <input 
                  type="file" 
                  ref={femaleInputRef} 
                  onChange={(e) => e.target.files.length && handleFileUpload(e.target.files[0], 'female')} 
                  accept=".pdf" 
                  style={{ display: 'none' }} 
                />
                
                {isFemaleUploading ? (
                  <div className={styles.loader}></div>
                ) : femaleReport ? (
                  <CheckCircle size={48} color="var(--success)" />
                ) : (
                  <UploadCloud className={styles.uploadIcon} />
                )}
                
                <div className={styles.uploadText}>
                  {isFemaleUploading ? 'Extracting...' : femaleReport ? 'Upload Successful' : 'Upload Prospect 2 PDF'}
                </div>
                
                {femaleError && <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{femaleError}</div>}
                
                {!isFemaleUploading && !femaleReport && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); triggerMockExtraction('female'); }}
                    style={{
                      marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(236, 72, 153, 0.1)',
                      color: '#ec4899', border: '1px solid #ec4899', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    Use Mock Data
                  </button>
                )}
              </div>
              <ManualInputs 
                title={femaleManualData.name ? `${femaleManualData.name}'s Manual Lifestyle Inputs` : "Prospect 2's Manual Lifestyle Inputs"} 
                data={femaleManualData} 
                onChange={setFemaleManualData} 
                gender="female"
              />
            </div>
          </div>

          {matchError && (
            <div style={{ color: 'var(--error)', textAlign: 'center', marginBottom: '2rem' }}>
              <AlertCircle style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} />
              {matchError}
            </div>
          )}

          <button 
            className={styles.glowingButton}
            style={{ 
              background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)', 
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' 
            }}
            disabled={!maleReport || !femaleReport || isAnalyzing}
            onClick={handleAnalyzeCompatibility}
          >
            {isAnalyzing ? 'Analyzing Compatibility...' : 'Analyze Compatibility'}
          </button>
        </>
      )}

      {matchResult && (
        <section className={styles.dashboard}>
          <div className={styles.matchScoreCard}>
            <div className={styles.matchScoreTitle}><HeartPulse size={24} style={{display:'inline', verticalAlign:'middle', marginRight:'8px'}}/> Compatibility Score</div>
            <div className={styles.matchScoreValue}>{(matchResult.compatibility_score * 100).toFixed(0)}%</div>
            <div style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              General compatibility assessment based on uploaded profiles.
            </div>
          </div>

          {matchResult.analysis?.flags?.length > 0 && (
            <div className={`${styles.sectionCard} ${styles['glass-panel']}`} style={{ marginBottom: '2rem' }}>
              <h2 className={styles.sectionTitle}>Compatibility Observations & Flags</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matchResult.analysis.flags.map((flag, idx) => {
                  const isHigh = flag.severity === 'high';
                  const isMedium = flag.severity === 'medium';
                  const color = isHigh ? 'var(--error)' : isMedium ? 'var(--warning)' : 'var(--success)';
                  const bg = isHigh ? 'rgba(239, 68, 68, 0.1)' : isMedium ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                  
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        background: bg, 
                        borderLeft: `4px solid ${color}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <AlertCircle size={20} color={color} style={{ flexShrink: 0 }} />
                      <span style={{ color: '#fff', fontSize: '0.95rem' }}>{flag.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Parameter Comparison */}
          {(() => {
            const details = matchResult.analysis.details;
            return (
              <div className={`${styles.sectionCard} ${styles['glass-panel']}`}>
                <h2 className={styles.sectionTitle}>Parameter Comparison</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.sideBySideTable}>
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th style={{ color: '#3b82f6' }}>{details.male_manual_data?.name || 'Prospect 1'}</th>
                        <th style={{ color: '#ec4899' }}>{details.female_manual_data?.name || 'Prospect 2'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <td colSpan={3} style={{ fontWeight: 600, color: '#fff', textAlign: 'left', padding: '0.5rem 1rem' }}>
                          Extracted Medical Parameters (CBC)
                        </td>
                      </tr>
                      {Object.keys(details.male_data?.cbc || {}).map(paramKey => {
                        const maleParam = details.male_data.cbc[paramKey];
                        const femaleParam = details.female_data?.cbc?.[paramKey];
                        
                        return (
                          <tr key={paramKey}>
                            <td className={styles.paramName}>
                              {paramKey.replace(/_/g, ' ').toUpperCase()}
                            </td>
                            <td style={{ color: '#93c5fd' }}>
                              {maleParam ? `${maleParam.value} ${maleParam.unit}` : 'N/A'}
                            </td>
                            <td style={{ color: '#fbcfe8' }}>
                              {femaleParam ? `${femaleParam.value} ${femaleParam.unit}` : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}

                      <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <td colSpan={3} style={{ fontWeight: 600, color: '#fff', textAlign: 'left', padding: '0.5rem 1rem', marginTop: '1rem' }}>
                          Manual Lifestyle Inputs
                        </td>
                      </tr>
                      {['name', 'height', 'weight', 'waist', 'activityLevel', 'dailySteps', 'occupation', 'drinking', 'smoking', 'tobacco', 'sleepCycle', 'bloodPressure', 'diet', 'menstrualHealth'].map(key => {
                        const mVal = details.male_manual_data?.[key];
                        const fVal = details.female_manual_data?.[key];
                        if (!mVal && !fVal) return null;
                        return (
                          <tr key={key}>
                            <td className={styles.paramName}>{key === 'name' ? 'Name' : key.replace(/([A-Z])/g, ' $1').toUpperCase()}</td>
                            <td style={{ color: '#93c5fd' }}>{mVal?.toString() || 'N/A'}</td>
                            <td style={{ color: '#fbcfe8' }}>{fVal?.toString() || 'N/A'}</td>
                          </tr>
                        );
                      })}
                      {['priorAscvd', 'parentDiabetes', 'prematureHeartDisease', 'parentHbp'].map(key => {
                        const mVal = details.male_manual_data?.[key];
                        const fVal = details.female_manual_data?.[key];
                        if (!mVal && !fVal) return null;
                        return (
                          <tr key={key}>
                            <td className={styles.paramName}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</td>
                            <td style={{ color: '#93c5fd' }}>{mVal ? 'Yes' : 'No'}</td>
                            <td style={{ color: '#fbcfe8' }}>{fVal ? 'Yes' : 'No'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <div style={{textAlign: 'center', marginTop: '3rem'}}>
            <button 
              onClick={resetAll}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'var(--glass-bg)',
                color: '#fff',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Start New Analysis
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
