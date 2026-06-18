import React, { useState, useRef } from 'react';
import { API_URL } from '../../config/api';

export default function PDFUploader({ onUploadSuccess, partnerLabel }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | ocr | llm | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      // Step 1: Upload & OCR
      setStatus('ocr'); 
      const res = await fetch(`${API_URL}/api/usg/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setStatus('llm');
      const data = await res.json();
      
      setStatus('success');
      if (onUploadSuccess) onUploadSuccess(data.reportId);
      
      // Reset after a brief moment
      setTimeout(() => {
        setFile(null);
        setStatus('idle');
      }, 3000);

    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', flex: 1 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>Upload {partnerLabel} Report</h3>
      
      {status === 'idle' || status === 'error' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <input 
            type="file" 
            accept="application/pdf,image/*" 
            onChange={handleFileChange} 
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{ padding: '12px 24px', background: 'var(--glass-bg)', color: 'var(--foreground)', border: '1px dashed var(--line)', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
          >
            {file ? file.name : 'Select PDF or Image'}
          </button>
          
          {file && (
            <button 
              onClick={handleUpload}
              style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
            >
              Start Analysis
            </button>
          )}

          {status === 'error' && <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{errorMsg}</p>}
        </div>
      ) : status === 'success' ? (
        <div style={{ color: 'var(--success)', padding: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
          Successfully Analyzed
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          <div className="animate-pulse" style={{ fontSize: '1.5rem', marginBottom: '12px' }}>⚙️</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            {status === 'uploading' && 'Uploading file...'}
            {status === 'ocr' && 'Extracting text (OCR)...'}
            {status === 'llm' && 'LLM generating JSON...'}
          </p>
        </div>
      )}
    </div>
  );
}
