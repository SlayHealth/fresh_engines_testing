'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';

export default function ManualInputs({ title, data, onChange, gender, engine = 'chronic' }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({
      ...data,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    onChange({
      ...data,
      [name]: parseInt(value) || 30
    });
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: '#fff',
    marginTop: '0.5rem',
    fontSize: '0.95rem'
  };

  const labelStyle = {
    color: '#9ca3af',
    fontSize: '0.85rem',
    fontWeight: '500',
    display: 'block'
  };

  const sectionStyle = {
    marginTop: '1.5rem',
    marginBottom: '1rem',
    fontWeight: '600',
    color: '#fff',
    fontSize: '1rem'
  };

  const renderChronicInputs = () => (
    <>
      <div style={sectionStyle}>Medical Parameters & Overrides</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <label style={labelStyle}>Waist Circumference</label>
          <select name="waist" value={data.waist || 'Normal'} onChange={handleChange} style={inputStyle}>
            <option value="Normal">Normal</option>
            <option value="Borderline">Borderline</option>
            <option value="High">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Blood Pressure</label>
          <select name="bloodPressure" value={data.bloodPressure || 'Normal'} onChange={handleChange} style={inputStyle}>
            <option value="Normal">Normal</option>
            <option value="Elevated">Elevated</option>
            <option value="High">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Fasting Glucose / HbA1c</label>
          <select name="glucose" value={data.glucose || 'Normal'} onChange={handleChange} style={inputStyle}>
            <option value="Normal">Normal (&lt;5.7% / &lt;100 mg/dL)</option>
            <option value="Borderline">Borderline (5.7%-6.4% / 100-125 mg/dL)</option>
            <option value="High">High (Diabetic) (&ge;6.5% / &ge;126 mg/dL)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Lipids Profile</label>
          <select name="lipids" value={data.lipids || 'Normal'} onChange={handleChange} style={inputStyle}>
            <option value="Normal">Normal</option>
            <option value="Borderline">Borderline</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>Family Health History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="parentDiabetes" 
            checked={data.parentDiabetes || false} 
            onChange={handleChange} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
          />
          Parent with Type-2 Diabetes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="parentHbp" 
            checked={data.parentHbp || false} 
            onChange={handleChange} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
          />
          Parent with High Blood Pressure
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            name="prematureHeartDisease" 
            checked={data.prematureHeartDisease || false} 
            onChange={handleChange} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
          />
          Premature Heart Disease in Family
        </label>
      </div>
    </>
  );

  const renderMfrInputs = () => {
    if (gender === 'male') {
      return (
        <>
          <div style={sectionStyle}>Semen & Scrotal Parameters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Semen Quality Class</label>
              <select name="semenQuality" value={data.semenQuality || 'Normal'} onChange={handleChange} style={inputStyle}>
                <option value="Normal">Normal (meets all WHO parameters)</option>
                <option value="Mild Deficit">Mild Deficit (1 below threshold)</option>
                <option value="Moderate Deficit">Moderate Deficit (2 below threshold)</option>
                <option value="Severe Deficit">Severe Deficit (3+ below threshold / Azoospermia)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Scrotal Findings</label>
              <select name="scrotalFinding" value={data.scrotalFinding || 'Normal'} onChange={handleChange} style={inputStyle}>
                <option value="Normal">Normal / Unimpeded</option>
                <option value="Varicocele (correctable)">Varicocele (Correctable)</option>
                <option value="Obstruction / CBAVD">Obstruction / CBAVD (Blocks natural pathway)</option>
              </select>
            </div>
          </div>
          
          <div style={sectionStyle}>Absolute Barriers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="b_azoo" 
                checked={data.b_azoo || false} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
              />
              Azoospermia (no sperm)
            </label>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div style={sectionStyle}>Ovarian Parameters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Ovarian Reserve Class</label>
              <select name="ovarianReserve" value={data.ovarianReserve || 'Normal'} onChange={handleChange} style={inputStyle}>
                <option value="High for age">High for Age</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
                <option value="Very Low">Very Low</option>
              </select>
            </div>
          </div>
          
          <div style={sectionStyle}>Absolute Barriers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="b_tubal" 
                checked={data.b_tubal || false} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
              />
              Bilateral tubal block
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d1d5db', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="b_uterus" 
                checked={data.b_uterus || false} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
              />
              Absent / non-functional uterus
            </label>
          </div>
        </>
      );
    }
  };

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      overflow: 'hidden',
      marginTop: '1.5rem'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: isOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
          <Settings size={18} color="#9ca3af" />
          {title}
        </div>
        {isOpen ? <ChevronUp size={20} color="#9ca3af"/> : <ChevronDown size={20} color="#9ca3af"/>}
      </div>

      {isOpen && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {/* Partner Name & Age Slider */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Partner's Name</label>
              <input 
                type="text" 
                name="name" 
                value={data.name || ''} 
                onChange={handleChange} 
                style={inputStyle} 
                placeholder="Enter name" 
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Age: <span style={{ color: 'var(--teal)', fontWeight: 'bold', fontSize: '1rem' }}>{data.age || 30} years</span></label>
              </div>
              <input 
                type="range" 
                name="age" 
                min="18" 
                max={engine === 'mfr' ? (gender === 'male' ? "55" : "48") : "80"} 
                value={data.age || 30} 
                onChange={handleSliderChange} 
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  accentColor: 'var(--teal)'
                }} 
              />
            </div>
          </div>

          {engine === 'mfr' ? renderMfrInputs() : renderChronicInputs()}
        </div>
      )}
    </div>
  );
}
