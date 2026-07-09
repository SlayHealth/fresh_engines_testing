'use client';

import { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useCompatibility } from '../../../contexts/CompatibilityContext';
import { API_URL } from '../../../config/api';
import { apiFetch } from '../../../utils/api';
import { toast } from '../../../components/Toast';

import ModalityBadgeRow from '../../../components/usg/ModalityBadgeRow';
import ScrotalHealthPanel from '../../../components/usg/ScrotalHealthPanel';
import EchoPanel from '../../../components/usg/EchoPanel';
import DexaPanel from '../../../components/usg/DexaPanel';
import OrganStatusGrid from '../../../components/usg/OrganStatusGrid';
import CoupleRadarComparison from '../../../components/usg/CoupleRadarComparison';
import FattyLiverVisual from '../../../components/usg/FattyLiverVisual';
import FemaleReproductivePanel from '../../../components/usg/FemaleReproductivePanel';
import MaleReproductivePanel from '../../../components/usg/MaleReproductivePanel';
import RiskMatrix from '../../../components/usg/RiskMatrix';
import MetabolicHealthDashboard from '../../../components/usg/MetabolicHealthDashboard';
import NuptiaScoreUSGSlice from '../../../components/usg/NuptiaScoreUSGSlice';
import SharedRiskIntelligence from '../../../components/usg/SharedRiskIntelligence';

export default function UsgPage() {
  const { activeMatchId, user, prospectForm } = useCompatibility();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isUserUploading, setIsUserUploading] = useState(false);
  const [isProspectUploading, setIsProspectUploading] = useState(false);
  const [userUploadError, setUserUploadError] = useState(null);
  const [prospectUploadError, setProspectUploadError] = useState(null);

  const userFileInputRef = useRef(null);
  const prospectFileInputRef = useRef(null);

  const userSex = user?.gender || 'Male';
  const isUserMale = userSex.toLowerCase() === 'male';

  const maleName = isUserMale ? (user?.name || 'Sachin') : (prospectForm?.name || 'Sachin');
  const femaleName = isUserMale ? (prospectForm?.name || 'Swati') : (user?.name || 'Swati');

  const calculateAge = (dobString) => {
    if (!dobString) return 30;
    const birthDate = new Date(dobString);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
  };

  const fetchRadiology = async () => {
    if (!activeMatchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/compatibility/matches/${activeMatchId}/radiology`);
      if (!res.ok) throw new Error('Failed to load radiology data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadiology();
  }, [activeMatchId]);

  const handleRadiologyUpload = async (file, isProspect) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid radiology report (PDF).');
      return;
    }

    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setErrorVal = isProspect ? setProspectUploadError : setUserUploadError;

    setIsUploading(true);
    setErrorVal(null);

    const formData = new FormData();
    formData.append('pdf', file);
    
    const sexVal = isProspect 
      ? (prospectForm.gender === 'Male' ? 'Male' : 'Female') 
      : (user.gender.toLowerCase() === 'male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(user.dob);
    const nameVal = isProspect ? prospectForm.name : user.name;

    formData.append('patientSlayId', nameVal);
    formData.append('sex', sexVal);
    formData.append('age', ageVal);

    try {
      const response = await apiFetch(`${API_URL}/api/radiology/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Radiology extraction failed');
      }

      const resJson = await response.json();
      if (resJson.reportId) {
        // Refresh radiology data to load the dashboard
        await fetchRadiology();
      } else {
        throw new Error(resJson.error || 'Failed to extract data');
      }
    } catch (err) {
      setErrorVal(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerMockRadiology = async (isProspect) => {
    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setErrorVal = isProspect ? setProspectUploadError : setUserUploadError;

    setIsUploading(true);
    setErrorVal(null);

    const sexVal = isProspect 
      ? (prospectForm.gender === 'Male' ? 'Male' : 'Female') 
      : (user.gender.toLowerCase() === 'male' ? 'Male' : 'Female');
    const ageVal = isProspect ? calculateAge(prospectForm.dob) : calculateAge(user.dob);
    const nameVal = isProspect ? prospectForm.name : user.name;

    try {
      const mockScrotum = sexVal === 'Male' ? {
        right_testis: { length_mm: 42, width_mm: 24, height_mm: 31, volume_cc: 16, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
        left_testis: { length_mm: 41, width_mm: 23, height_mm: 30, volume_cc: 15, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
        right_epididymis: { normal: true, thickened: false, cyst_present: false },
        left_epididymis: { normal: true, thickened: false, cyst_present: false },
        varicocele: { present: true, side: 'right', grade: 2 },
        hydrocele: { present: false, side: 'none', significant: false },
        spermatic_cord_normal: true,
        inguinal_hernia: false,
        impression_normal: false,
        impression_text: 'Right varicocele Grade II'
      } : null;

      const mockTvs = sexVal === 'Female' ? {
        uterus: { length_mm: 75, width_mm: 40, height_mm: 30, volume_cc: null, endometrial_thickness_mm: 7.2, fibroids_present: false },
        ovaries: {
          right: { length_mm: 35, width_mm: 22, height_mm: 20, volume_cc: 8.1, follicles_count: 14, dominant_follicle_present: false },
          left: { length_mm: 34, width_mm: 21, height_mm: 19, volume_cc: 7.8, follicles_count: 15, dominant_follicle_present: false },
          pcos_morphology_bilateral: true,
          pcos_morphology_unilateral: false
        }
      } : null;

      const mockFindings = {
        USG_ABDOMEN: {
          liver: { fatty_grade: sexVal === 'Male' ? 2 : 0, hepatomegaly: sexVal === 'Male', ihbr_dilated: false, focal_lesions: [] },
          gallbladder: { present: true, calculi_present: false, polyp_present: false, wall_thickness_normal: true },
          pancreas: { size_normal: true, echotexture_normal: true, focal_lesion: false, calcifications: false },
          spleen: { size_normal: true, size_category: 'normal', focal_lesion: false },
          kidneys: {
            right: { calculi_present: sexVal === 'Male', size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' },
            left: { calculi_present: false, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' }
          },
          urinary_bladder: { wall_thickness_normal: true, calculi_present: false, post_void_residual_cc: 0, mass_present: false },
          ...(sexVal === 'Male' ? {
            prostate: { _applicable: true, size_normal: false, grade: 'Grade_I', volume_cc: 24, weight_grams: null }
          } : {
            uterus: mockTvs.uterus,
            ovaries: mockTvs.ovaries
          })
        },
        ...(sexVal === 'Male' ? { USG_SCROTUM_DOPPLER: mockScrotum } : { USG_TVS: mockTvs }),
        ECHO: {
          lvef_percent: sexVal === 'Male' ? 48 : 62,
          valves: {
            mitral: { mr_grade: sexVal === 'Male' ? 'mild' : 'none' }
          },
          diastolic_dysfunction_grade: sexVal === 'Male' ? 2 : null,
          pah: { present: false, pasp_mmhg: sexVal === 'Male' ? 28 : 20 },
          pericardial_effusion: false,
          rwma: false,
          thrombus: false,
          vegetation: false
        },
        DEXA: {
          lowest_t_score_value: sexVal === 'Male' ? -2.2 : -0.5,
          lowest_t_score_site: sexVal === 'Male' ? 'left femoral neck' : 'lumbar spine',
          overall_who_classification: sexVal === 'Male' ? 'osteopenia' : 'normal'
        }
      };

      const mockScores = {
        organ_scores: {
          USG_ABDOMEN: sexVal === 'Male' ? 82.5 : 95.0,
          ...(sexVal === 'Male' ? { USG_SCROTUM_DOPPLER: 75.0 } : { USG_TVS: 95.0 }),
          ECHO: sexVal === 'Male' ? 65.0 : 95.0,
          DEXA: sexVal === 'Male' ? 55.0 : 90.0
        },
        radiology_nuptia_contribution: sexVal === 'Male' ? 18.71 : 27.5,
        max_possible: 30,
        modalities_scored: ['USG_ABDOMEN', sexVal === 'Male' ? 'USG_SCROTUM_DOPPLER' : 'USG_TVS', 'ECHO', 'DEXA']
      };

      const mockRiskFlags = sexVal === 'Male' ? [
        { flag_id: 'FATTY_LIVER_2', flag_label: 'Grade II Fatty Liver', severity: 'moderate', fertility_relevance: 'Metabolic markers affect spermatogenesis' },
        { flag_id: 'RENAL_CALCULUS', flag_label: 'Right Kidney Stone (4mm)', severity: 'mild', fertility_relevance: 'No direct impact on fertility, watch hydration' },
        { flag_id: 'VARICOCELE_GR2', flag_label: 'Right Varicocele Grade II', severity: 'severe', fertility_relevance: 'Impaired spermatogenesis and semen quality' },
        { flag_id: 'ECHO_DIASTOLIC_DYSFUNCTION_G2', flag_label: 'Grade II Diastolic Dysfunction', severity: 'moderate', fertility_relevance: 'Cardiovascular assessment advised' },
        { flag_id: 'DEXA_OSTEOPENIA', flag_label: 'Osteopenia (T-score -2.2)', severity: 'mild', fertility_relevance: 'Assess vitamin D and calcium balance' }
      ] : [
        { flag_id: 'PCOS_MORPHOLOGY', flag_label: 'Bilateral PCOS Ovarian Morphology', severity: 'moderate', fertility_relevance: 'Ovulatory subfertility risk, lifestyle reset advised' }
      ];

      const response = await apiFetch(`${API_URL}/api/radiology/report`, {
        method: 'POST',
        body: JSON.stringify({
          patient_slay_id: nameVal,
          sex: sexVal,
          age: ageVal,
          modalities_detected: ['USG_ABDOMEN', sexVal === 'Male' ? 'USG_SCROTUM_DOPPLER' : 'USG_TVS', 'ECHO', 'DEXA'],
          findings: mockFindings,
          scores: mockScores,
          risk_flags: mockRiskFlags,
          raw_ocr_text: `MOCK PREMARITAL PORTAL UPLOAD FOR ${nameVal.toUpperCase()}`
        })
      });

      const dataVal = await response.json();
      if (dataVal.reportId) {
        // Refresh radiology data to load the dashboard
        await fetchRadiology();
      } else {
        throw new Error(dataVal.error || 'Failed to trigger mock report');
      }
    } catch (err) {
      setErrorVal(err.message || 'Mock failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
        <span>Analyzing couple's multi-modality radiology records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-center">
        <AlertCircle size={32} className="mx-auto mb-2" />
        <p className="font-semibold">{error}</p>
      </div>
    );
  }

  if (!data || (!data.partner_A && !data.partner_B)) {
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="inline-flex p-4 rounded-full bg-teal-50 text-teal-600 mb-4">
          <ShieldCheck size={36} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Radiology Analysis Inactive</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed text-center">
          To view the detailed organ wellness status, couple radar metrics, and specialty panels (Echocardiography, Scrotal Doppler, DEXA), please upload radiology reports for the partners below.
        </p>

        <div className="grid grid-cols-2 gap-4 text-left">
          <div className="p-4 border border-dashed border-slate-300 rounded-xl space-y-3 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 block">{isUserMale ? user?.name || 'Your' : prospectForm?.name || 'Prospect'}'s Radiology PDF</span>
            <button
              type="button"
              onClick={() => userFileInputRef.current.click()}
              className={`w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all ${
                isUserUploading ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isUserUploading ? 'Parsing PDF...' : 'Upload PDF'}
            </button>
            <button
              type="button"
              onClick={() => triggerMockRadiology(false)}
              className="text-[10px] text-slate-500 underline block mx-auto hover:text-teal-600 cursor-pointer"
            >
              Trigger Mock Report
            </button>
            {userUploadError && <span className="text-[10px] text-rose-500 block text-center">{userUploadError}</span>}
          </div>

          <div className="p-4 border border-dashed border-slate-300 rounded-xl space-y-3 bg-slate-50/50">
            <span className="text-xs font-bold text-slate-700 block">{isUserMale ? prospectForm?.name || 'Prospect' : user?.name || 'Your'}'s Radiology PDF</span>
            <button
              type="button"
              onClick={() => prospectFileInputRef.current.click()}
              className={`w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all ${
                isProspectUploading ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isProspectUploading ? 'Parsing PDF...' : 'Upload PDF'}
            </button>
            <button
              type="button"
              onClick={() => triggerMockRadiology(true)}
              className="text-[10px] text-slate-500 underline block mx-auto hover:text-teal-600 cursor-pointer"
            >
              Trigger Mock Report
            </button>
            {prospectUploadError && <span className="text-[10px] text-rose-500 block text-center">{prospectUploadError}</span>}
          </div>
        </div>

        <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
        <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* Missing partner banner */}
      {(!data.partner_A || !data.partner_B) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Partial Couple Compatibility View</h4>
              <p className="text-xs text-slate-600">
                Upload the remaining partner's radiology report to unlock the complete side-by-side comparison, couple radar, and shared risk insights.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!data.partner_A && (
              <button
                type="button"
                onClick={() => triggerMockRadiology(isUserMale ? false : true)}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Trigger {maleName}'s Mock Report
              </button>
            )}
            {!data.partner_B && (
              <button
                type="button"
                onClick={() => triggerMockRadiology(isUserMale ? true : false)}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Trigger {femaleName}'s Mock Report
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modality Badges */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Detected Modalities</h3>
        <div className="space-y-3">
          {data.partner_A ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 w-32">{maleName} (Male):</span>
              <ModalityBadgeRow modalities={data.partner_A.modalities_detected} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 w-32">{maleName} (Male):</span>
              <span className="text-xs text-slate-400 italic">No report uploaded</span>
            </div>
          )}
          {data.partner_B ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 w-32">{femaleName} (Female):</span>
              <ModalityBadgeRow modalities={data.partner_B.modalities_detected} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 w-32">{femaleName} (Female):</span>
              <span className="text-xs text-slate-400 italic">No report uploaded</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        {/* Top Row: Overall scores */}
        <div style={{ gridColumn: 'span 4' }}>
          <NuptiaScoreUSGSlice 
            contributionA={data.partner_A?.nuptia_score_usg_contribution} 
            contributionB={data.partner_B?.nuptia_score_usg_contribution}
            nameA={maleName}
            nameB={femaleName}
          />
        </div>
        <div style={{ gridColumn: 'span 4' }}>
           <MetabolicHealthDashboard 
             indexA={data.partner_A?.scores?.metabolic_index} 
             indexB={data.partner_B?.scores?.metabolic_index}
             nameA={maleName}
             nameB={femaleName}
           />
        </div>
        <div style={{ gridColumn: 'span 4' }}>
           <FattyLiverVisual 
             gradeA={data.partner_A?.raw_data?.findings?.liver?.fatty_grade} 
             gradeB={data.partner_B?.raw_data?.findings?.liver?.fatty_grade}
             nameA={maleName}
             nameB={femaleName}
           />
        </div>

        {/* Middle Row: Radar and Status Grid */}
        <div style={{ gridColumn: 'span 6' }}>
          <CoupleRadarComparison 
            scoresA={data.partner_A?.scores} 
            scoresB={data.partner_B?.scores}
            nameA={maleName}
            nameB={femaleName}
          />
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          <OrganStatusGrid 
            scoresA={data.partner_A?.scores} 
            scoresB={data.partner_B?.scores}
            nameA={maleName}
            nameB={femaleName}
          />
        </div>

        {/* Reproductive Row */}
        <div style={{ gridColumn: 'span 6' }}>
          {data.partner_A ? (
            <MaleReproductivePanel 
              prostate={data.partner_A.raw_data?.findings?.prostate} 
              age={data.partner_A.raw_data?.patient?.age_years} 
            />
          ) : (
            <div className="glass-panel p-5 text-center flex flex-col justify-center items-center h-full min-h-[200px]">
              <h3 className="text-sm font-bold text-slate-705 mb-2 uppercase tracking-wider" style={{ color: 'var(--prostate-color)' }}>Male Reproductive Panel</h3>
              <p className="text-xs text-slate-500 mb-4">No male reproductive data available. Please upload {maleName}'s report.</p>
              <button 
                type="button" 
                onClick={() => triggerMockRadiology(isUserMale ? false : true)} 
                className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Trigger {maleName}'s Mock Report
              </button>
            </div>
          )}
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          {data.partner_B ? (
            <FemaleReproductivePanel 
              ovaries={data.partner_B.raw_data?.findings?.ovaries} 
              uterus={data.partner_B.raw_data?.findings?.uterus} 
            />
          ) : (
            <div className="glass-panel p-5 text-center flex flex-col justify-center items-center h-full min-h-[200px]">
              <h3 className="text-sm font-bold text-slate-705 mb-2 uppercase tracking-wider" style={{ color: 'var(--ovary-color)' }}>Female Reproductive Panel</h3>
              <p className="text-xs text-slate-500 mb-4">No female reproductive data available. Please upload {femaleName}'s report.</p>
              <button 
                type="button" 
                onClick={() => triggerMockRadiology(isUserMale ? true : false)} 
                className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Trigger {femaleName}'s Mock Report
              </button>
            </div>
          )}
        </div>

        {/* Specialty Panels - Doppler, Echo, DEXA */}
        {(data.partner_A?.findings_all?.USG_SCROTUM_DOPPLER || data.partner_B?.findings_all?.USG_SCROTUM_DOPPLER) && (
          <>
            {data.partner_A?.findings_all?.USG_SCROTUM_DOPPLER && (
              <div style={{ gridColumn: data.partner_B?.findings_all?.USG_SCROTUM_DOPPLER ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{maleName}'s Scrotal Health & Doppler</div>
                <ScrotalHealthPanel scrotumData={data.partner_A.findings_all.USG_SCROTUM_DOPPLER} />
              </div>
            )}
            {data.partner_B?.findings_all?.USG_SCROTUM_DOPPLER && (
              <div style={{ gridColumn: data.partner_A?.findings_all?.USG_SCROTUM_DOPPLER ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{femaleName}'s Scrotal Health & Doppler</div>
                <ScrotalHealthPanel scrotumData={data.partner_B.findings_all.USG_SCROTUM_DOPPLER} />
              </div>
            )}
          </>
        )}

        {(data.partner_A?.findings_all?.ECHO || data.partner_B?.findings_all?.ECHO) && (
          <>
            {data.partner_A?.findings_all?.ECHO && (
              <div style={{ gridColumn: data.partner_B?.findings_all?.ECHO ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{maleName}'s Echocardiography (Echo)</div>
                <EchoPanel echoData={data.partner_A.findings_all.ECHO} />
              </div>
            )}
            {data.partner_B?.findings_all?.ECHO && (
              <div style={{ gridColumn: data.partner_A?.findings_all?.ECHO ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{femaleName}'s Echocardiography (Echo)</div>
                <EchoPanel echoData={data.partner_B.findings_all.ECHO} />
              </div>
            )}
          </>
        )}

        {(data.partner_A?.findings_all?.DEXA || data.partner_B?.findings_all?.DEXA) && (
          <>
            {data.partner_A?.findings_all?.DEXA && (
              <div style={{ gridColumn: data.partner_B?.findings_all?.DEXA ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{maleName}'s Bone Density (DEXA)</div>
                <DexaPanel dexaData={data.partner_A.findings_all.DEXA} />
              </div>
            )}
            {data.partner_B?.findings_all?.DEXA && (
              <div style={{ gridColumn: data.partner_A?.findings_all?.DEXA ? 'span 6' : 'span 12' }}>
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{femaleName}'s Bone Density (DEXA)</div>
                <DexaPanel dexaData={data.partner_B.findings_all.DEXA} />
              </div>
            )}
          </>
        )}

        {/* Risk & Shared Risk Row */}
        <div style={{ gridColumn: 'span 6' }}>
          <RiskMatrix 
            flagsA={data.partner_A?.risk_flags} 
            flagsB={data.partner_B?.risk_flags}
            nameA={maleName}
            nameB={femaleName}
          />
        </div>
        <div style={{ gridColumn: 'span 6' }}>
          {data.partner_B ? (
             <SharedRiskIntelligence insights={data.shared_insights} />
          ) : (
             <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
               <p className="text-slate-400">Add {femaleName}'s report to view Shared Risk Intelligence.</p>
             </div>
          )}
        </div>
      </div>

      {/* AI Couple Summary */}
      {data.ai_summary && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-6 text-left">
          <h3 className="text-base font-bold text-emerald-700 flex items-center gap-2 mb-4">
            <Sparkles size={20} />
            NuptiaScore™ AI Compatibility Summary
          </h3>
          
          <div className="grid md:grid-cols-3 gap-5">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">The Good Things 🌿</h4>
              <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                {data.ai_summary.good_things.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Minor Observations ⚡</h4>
              <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                {data.ai_summary.minor_issues.length > 0 ? data.ai_summary.minor_issues.map((item, i) => <li key={i}>{item}</li>) : <li>None!</li>}
              </ul>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Areas for Attention 🚩</h4>
              <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                {data.ai_summary.major_issues.length > 0 ? data.ai_summary.major_issues.map((item, i) => <li key={i}>{item}</li>) : <li>None!</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs for uploading PDF */}
      <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], false)} />
      <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleRadiologyUpload(e.target.files[0], true)} />
    </div>
  );
}
