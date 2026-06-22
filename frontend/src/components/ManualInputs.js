'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';

export default function ManualInputs({ title, data, onChange, gender, engine = 'chronic', evaluationTier = 1 }) {
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

  const isLight = engine === 'chronic';

  const containerStyle = {
    background: isLight ? '#f9fafb' : 'var(--surface)',
    borderRadius: '12px',
    border: isLight ? '1px solid #e5e7eb' : '1px solid var(--line)',
    overflow: 'hidden',
    marginTop: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };

  const headerStyle = {
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    background: isOpen ? (isLight ? '#f3f4f6' : 'var(--soft-teal)') : 'transparent',
    transition: 'background 0.2s',
    color: 'var(--ink)',
  };

  const inputStyle = {
    width: '100%',
    background: '#ffffff',
    border: isLight ? '1px solid #d1d5db' : '1px solid var(--line)',
    borderRadius: '8px',
    padding: '0.75rem',
    color: 'var(--ink)',
    marginTop: '0.5rem',
    fontSize: '0.95rem',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
  };

  const labelStyle = {
    color: 'var(--muted)',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'block'
  };

  const sectionStyle = {
    marginTop: '1.5rem',
    marginBottom: '1rem',
    fontWeight: '700',
    color: 'var(--ink)',
    fontSize: '1.05rem',
    borderBottom: isLight ? '1px solid #e5e7eb' : '1px solid var(--line)',
    paddingBottom: '0.5rem'
  };

  const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '500'
  };

  const renderChronicInputs = () => (
    <>
      <div style={sectionStyle}>Medical Parameters & Overrides</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div>
          <label style={labelStyle}>Waist Circumference</label>
          <select name="waist" value={data.waist || ''} onChange={handleChange} style={inputStyle}>
            <option value="">Select Waist...</option>
            <option value="Normal">Normal</option>
            <option value="Borderline">Borderline</option>
            <option value="High">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Blood Pressure</label>
          <select name="bloodPressure" value={data.bloodPressure || ''} onChange={handleChange} style={inputStyle}>
            <option value="">Select Blood Pressure...</option>
            <option value="Normal">Normal</option>
            <option value="Elevated">Elevated</option>
            <option value="High">High</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Fasting Glucose / HbA1c</label>
          <select name="glucose" value={data.glucose || ''} onChange={handleChange} style={inputStyle}>
            <option value="">Select Fasting Glucose...</option>
            <option value="Normal">Normal (&lt;5.7% / &lt;100 mg/dL)</option>
            <option value="Borderline">Borderline (5.7%-6.4% / 100-125 mg/dL)</option>
            <option value="High">High (Diabetic) (&ge;6.5% / &ge;126 mg/dL)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Lipids Profile</label>
          <select name="lipids" value={data.lipids || ''} onChange={handleChange} style={inputStyle}>
            <option value="">Select Lipids...</option>
            <option value="Normal">Normal</option>
            <option value="Borderline">Borderline</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>

      <div style={sectionStyle}>Family Health History</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={checkboxLabelStyle}>
          <input 
            type="checkbox" 
            name="parentDiabetes" 
            checked={data.parentDiabetes || false} 
            onChange={handleChange} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
          />
          Parent with Type-2 Diabetes
        </label>
        <label style={checkboxLabelStyle}>
          <input 
            type="checkbox" 
            name="parentHbp" 
            checked={data.parentHbp || false} 
            onChange={handleChange} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
          />
          Parent with High Blood Pressure
        </label>
        <label style={checkboxLabelStyle}>
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
          <div style={sectionStyle}>Semen & Pathology Parameters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Semen Quality Class</label>
              <select name="semenQuality" value={data.semenQuality || ''} onChange={handleChange} style={inputStyle}>
                <option value="">Select Semen Quality...</option>
                <option value="Normal">Normal (meets all WHO parameters)</option>
                <option value="Mild Deficit">Mild Deficit (1 below threshold)</option>
                <option value="Moderate Deficit">Moderate Deficit (2 below threshold)</option>
                <option value="Severe Deficit">Severe Deficit (3+ below threshold / Azoospermia)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Scrotal Findings (Manual Override)</label>
              <select name="scrotalFinding" value={data.scrotalFinding || ''} onChange={handleChange} style={inputStyle}>
                <option value="">Select Scrotal Findings...</option>
                <option value="Normal">Normal / Unimpeded</option>
                <option value="Varicocele (correctable)">Varicocele (Correctable)</option>
                <option value="Obstruction / CBAVD">Obstruction / CBAVD (Blocks natural pathway)</option>
              </select>
            </div>
          </div>
          
          {evaluationTier >= 2 && (
            <>
              <div style={sectionStyle}>Radiology Parameters (Scrotal & Abdominal USG)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Varicocele Grade</label>
                  <select name="varicoceleGrade" value={data.varicoceleGrade || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Grade...</option>
                    <option value="None">None</option>
                    <option value="Grade 1">Grade 1 (Mild)</option>
                    <option value="Grade 2">Grade 2 (Moderate)</option>
                    <option value="Grade 3">Grade 3 (Severe)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Testicular Volume</label>
                  <select name="testicularVolume" value={data.testicularVolume || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Volume...</option>
                    <option value="Normal">Normal</option>
                    <option value="Low">Low (Atrophy/Reduced)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prostate Size / BPH Grade</label>
                  <select name="prostateGrade" value={data.prostateGrade || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Grade...</option>
                    <option value="None">None / Normal</option>
                    <option value="Grade I">Grade I (Mild Prostatomegaly)</option>
                    <option value="Grade II">Grade II (Moderate Prostatomegaly)</option>
                    <option value="Grade III">Grade III (Severe Prostatomegaly)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Post-Void Residual (PVR)</label>
                  <select name="pvrVolume" value={data.pvrVolume || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select PVR...</option>
                    <option value="Normal">Normal (&lt;50cc)</option>
                    <option value="Borderline">Borderline (50-100cc)</option>
                    <option value="Significant">Significant (&gt;100cc)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fatty Liver Grade (Metabolic)</label>
                  <select name="fattyLiverGrade" value={data.fattyLiverGrade || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Fatty Liver...</option>
                    <option value="None">None / Normal</option>
                    <option value="Grade I">Grade I (Mild)</option>
                    <option value="Grade II">Grade II (Moderate)</option>
                    <option value="Grade III">Grade III (Severe)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Scrotal Obstruction Findings</label>
                  <select name="scrotalObstruction" value={data.scrotalObstruction || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Option...</option>
                    <option value="No">No</option>
                    <option value="Yes">Yes (Obstruction/Cyst detected)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {evaluationTier === 3 && (
            <>
              <div style={sectionStyle}>Genomics Parameters</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Y-Chromosome Microdeletion</label>
                  <select name="yDeletion" value={data.yDeletion || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select AZF Region...</option>
                    <option value="None">None</option>
                    <option value="AZFa">AZFa (Severe/No sperm)</option>
                    <option value="AZFb">AZFb (Severe/No sperm)</option>
                    <option value="AZFc">AZFc (Reduced count)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Male Karyotype</label>
                  <select name="maleKaryotype" value={data.maleKaryotype || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Karyotype...</option>
                    <option value="Normal 46,XY">Normal 46,XY</option>
                    <option value="Abnormal (47,XXY / other)">Abnormal (47,XXY / Klinefelter / other)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div style={sectionStyle}>Absolute Barriers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={checkboxLabelStyle}>
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
              <select name="ovarianReserve" value={data.ovarianReserve || ''} onChange={handleChange} style={inputStyle}>
                <option value="">Select Ovarian Reserve...</option>
                <option value="High for age">High for Age</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
                <option value="Very Low">Very Low</option>
              </select>
            </div>
          </div>

          {evaluationTier >= 2 && (
            <>
              <div style={sectionStyle}>Radiology Parameters (Pelvic & Abdominal USG)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>Endometrial Lining Thickness</label>
                  <select name="uterineLining" value={data.uterineLining || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Thickness...</option>
                    <option value="Normal">Normal (7-14mm)</option>
                    <option value="Thin">Thin (&lt;7mm)</option>
                    <option value="Thick">Thick (&gt;14mm)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Uterine Fibroids / Polyps</label>
                  <select name="fibroids" value={data.fibroids || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Type...</option>
                    <option value="None">None</option>
                    <option value="Subserosal">Subserosal (Outside wall, no impact)</option>
                    <option value="Intramural">Intramural (Inside wall, mild impact)</option>
                    <option value="Submucosal">Submucosal (Protruding inside, severe impact)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>PCOS Ovarian Morphology</label>
                  <select name="pcosMorphology" value={data.pcosMorphology || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Morphology...</option>
                    <option value="None">None / Normal</option>
                    <option value="Unilateral">Unilateral Bulky / Polycystic</option>
                    <option value="Bilateral">Bilateral Bulky / Polycystic (BCOM)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Ovarian Volume (Enlarged)</label>
                  <select name="ovarianVolume" value={data.ovarianVolume || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Volume...</option>
                    <option value="Normal">Normal (&lt;=10cc)</option>
                    <option value="Enlarged">Enlarged (&gt;10cc Rotterdam)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Pelvic Free Fluid (POD)</label>
                  <select name="pelvicFluid" value={data.pelvicFluid || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Fluid Status...</option>
                    <option value="No">No / Normal</option>
                    <option value="Yes">Yes (Significant free fluid/cyst)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fatty Liver Grade (Metabolic)</label>
                  <select name="fattyLiverGrade" value={data.fattyLiverGrade || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Fatty Liver...</option>
                    <option value="None">None / Normal</option>
                    <option value="Grade I">Grade I (Mild)</option>
                    <option value="Grade II">Grade II (Moderate)</option>
                    <option value="Grade III">Grade III (Severe)</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Fallopian Tubal Patency</label>
                  <select name="tubalPatency" value={data.tubalPatency || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Patency...</option>
                    <option value="Both open">Both open</option>
                    <option value="One blocked">One blocked</option>
                    <option value="Both blocked">Both blocked (Absolute Barrier)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {evaluationTier === 3 && (
            <>
              <div style={sectionStyle}>Genomics Parameters</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={labelStyle}>MTHFR Mutation Variant</label>
                  <select name="mthfr" value={data.mthfr || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Variant...</option>
                    <option value="None">None</option>
                    <option value="Heterozygous">Heterozygous (C677T / A1298C)</option>
                    <option value="Homozygous">Homozygous (Double copy)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Female Karyotype</label>
                  <select name="femaleKaryotype" value={data.femaleKaryotype || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Karyotype...</option>
                    <option value="Normal 46,XX">Normal 46,XX</option>
                    <option value="Abnormal">Abnormal (Turner 45,X / other)</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>CFTR Mutation Carrier Status</label>
                  <select name="cftrCarrier" value={data.cftrCarrier || ''} onChange={handleChange} style={inputStyle}>
                    <option value="">Select Status...</option>
                    <option value="No">No</option>
                    <option value="Yes">Yes (Carrier - transmission risk warning)</option>
                  </select>
                </div>
              </div>
            </>
          )}
          
          <div style={sectionStyle}>Absolute Barriers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={checkboxLabelStyle}>
              <input 
                type="checkbox" 
                name="b_tubal" 
                checked={data.b_tubal || false} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'var(--teal)' }} 
              />
              Bilateral tubal block
            </label>
            <label style={checkboxLabelStyle}>
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
    <div style={containerStyle}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={headerStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
          <Settings size={18} color={isLight ? '#4b5563' : '#9ca3af'} />
          {title}
        </div>
        {isOpen ? (
          <ChevronUp size={20} color={isLight ? '#4b5563' : '#9ca3af'}/>
        ) : (
          <ChevronDown size={20} color={isLight ? '#4b5563' : '#9ca3af'}/>
        )}
      </div>

      {isOpen && (
        <div style={{ padding: '1.5rem', borderTop: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255, 255, 255, 0.05)' }}>
          {/* Partner Name & Age Input */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              <label style={labelStyle}>Age (years)</label>
              <input 
                type="number" 
                name="age" 
                min="18" 
                max={engine === 'mfr' ? (gender === 'male' ? "55" : "48") : "80"} 
                value={data.age || ''} 
                onChange={handleSliderChange} 
                style={inputStyle} 
                placeholder="Enter age" 
              />
            </div>
          </div>

          {engine === 'mfr' ? renderMfrInputs() : renderChronicInputs()}
        </div>
      )}
    </div>
  );
}
