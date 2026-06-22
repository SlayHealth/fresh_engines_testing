'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, HeartPulse, RefreshCw, Sparkles, Award, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.css';
import ManualInputs from '../../components/ManualInputs';
import ReportChatDrawer from '../../components/ReportChatDrawer';
import { API_URL } from '../../config/api';
import { parsePatientMeta, findExtractedParam, classifyOvarianReserve, parseMaleRadiology, parseFemaleRadiology, parseMaleGenomics, parseFemaleGenomics } from '../../utils/reportParser';

export default function FertilityPage() {
  const defaultMaleManual = {
    name: '',
    age: '',
    semenQuality: '',
    scrotalFinding: '',
    b_azoo: false,
    varicoceleGrade: '',
    testicularVolume: '',
    scrotalObstruction: '',
    prostateGrade: '',
    pvrVolume: '',
    fattyLiverGrade: '',
    yDeletion: '',
    maleKaryotype: '',
  };

  const defaultFemaleManual = {
    name: '',
    age: '',
    ovarianReserve: '',
    b_tubal: false,
    b_uterus: false,
    uterineLining: '',
    fibroids: '',
    tubalPatency: '',
    pcosMorphology: '',
    ovarianVolume: '',
    pelvicFluid: '',
    fattyLiverGrade: '',
    mthfr: '',
    femaleKaryotype: '',
    cftrCarrier: '',
  };

  const defaultSharedLifestyle = {
    smoke: '',
    bmi: '',
    act: '',
    alc: '',
    stress: '',
    freq: '',
  };

  // State for evaluation tier
  const [evaluationTier, setEvaluationTier] = useState(1);

  // State for uploads
  // pathology
  const [maleReport, setMaleReport] = useState(null);
  const [isMaleUploading, setIsMaleUploading] = useState(false);
  const [maleError, setMaleError] = useState(null);
  const [maleManualData, setMaleManualData] = useState(defaultMaleManual);
  const maleInputRef = useRef(null);

  const [femaleReport, setFemaleReport] = useState(null);
  const [isFemaleUploading, setIsFemaleUploading] = useState(false);
  const [femaleError, setFemaleError] = useState(null);
  const [femaleManualData, setFemaleManualData] = useState(defaultFemaleManual);
  const femaleInputRef = useRef(null);

  // radiology
  const [maleRadReport, setMaleRadReport] = useState(null);
  const [isMaleRadUploading, setIsMaleRadUploading] = useState(false);
  const [maleRadError, setMaleRadError] = useState(null);
  const maleRadInputRef = useRef(null);

  const [femaleRadReport, setFemaleRadReport] = useState(null);
  const [isFemaleRadUploading, setIsFemaleRadUploading] = useState(false);
  const [femaleRadError, setFemaleRadError] = useState(null);
  const femaleRadInputRef = useRef(null);

  // genomics
  const [maleGenReport, setMaleGenReport] = useState(null);
  const [isMaleGenUploading, setIsMaleGenUploading] = useState(false);
  const [maleGenError, setMaleGenError] = useState(null);
  const maleGenInputRef = useRef(null);

  const [femaleGenReport, setFemaleGenReport] = useState(null);
  const [isFemaleGenUploading, setIsFemaleGenUploading] = useState(false);
  const [femaleGenError, setFemaleGenError] = useState(null);
  const femaleGenInputRef = useRef(null);

  const [sharedLifestyle, setSharedLifestyle] = useState(defaultSharedLifestyle);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState(null);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedProjYear, setSelectedProjYear] = useState(0);

  const syncedMaleReportId = useRef(null);
  const syncedFemaleReportId = useRef(null);

  // Auto-analysis on data changes
  useEffect(() => {
    const hasMaleReport = maleReport;
    const hasFemaleReport = femaleReport;
    const hasMaleRadReport = evaluationTier < 2 || maleRadReport;
    const hasFemaleRadReport = evaluationTier < 2 || femaleRadReport;
    const hasMaleGenReport = evaluationTier < 3 || maleGenReport;
    const hasFemaleGenReport = evaluationTier < 3 || femaleGenReport;

    // Only auto-analyze if all manual inputs are already filled (to avoid showing validation error prematurely)
    const isFormFilled = () => {
      // Partner A
      if (!maleManualData.name?.trim() || !maleManualData.age || !maleManualData.semenQuality || !maleManualData.scrotalFinding) return false;
      if (evaluationTier >= 2) {
        if (!maleManualData.varicoceleGrade || !maleManualData.testicularVolume || !maleManualData.scrotalObstruction || !maleManualData.prostateGrade || !maleManualData.pvrVolume || !maleManualData.fattyLiverGrade) return false;
      }
      if (evaluationTier === 3) {
        if (!maleManualData.yDeletion || !maleManualData.maleKaryotype) return false;
      }
      // Partner B
      if (!femaleManualData.name?.trim() || !femaleManualData.age || !femaleManualData.ovarianReserve) return false;
      if (evaluationTier >= 2) {
        if (!femaleManualData.uterineLining || !femaleManualData.fibroids || !femaleManualData.tubalPatency || !femaleManualData.pcosMorphology || !femaleManualData.ovarianVolume || !femaleManualData.pelvicFluid || !femaleManualData.fattyLiverGrade) return false;
      }
      if (evaluationTier === 3) {
        if (!femaleManualData.mthfr || !femaleManualData.femaleKaryotype || !femaleManualData.cftrCarrier) return false;
      }
      // Lifestyle
      if (sharedLifestyle.smoke === '' || sharedLifestyle.bmi === '' || sharedLifestyle.act === '' || sharedLifestyle.alc === '' || sharedLifestyle.stress === '' || sharedLifestyle.freq === '') return false;
      return true;
    };

    if (hasMaleReport && hasFemaleReport && hasMaleRadReport && hasFemaleRadReport && hasMaleGenReport && hasFemaleGenReport && isFormFilled()) {
      handleAnalyzeMfr();
    }
  }, [
    maleManualData, femaleManualData, sharedLifestyle, 
    maleReport, femaleReport, 
    maleRadReport, femaleRadReport, 
    maleGenReport, femaleGenReport,
    evaluationTier
  ]);

  const triggerMockExtraction = async (gender, reportType = 'pathology') => {
    const setIsUploading = reportType === 'pathology' 
      ? (gender === 'male' ? setIsMaleUploading : setIsFemaleUploading)
      : reportType === 'radiology'
      ? (gender === 'male' ? setIsMaleRadUploading : setIsFemaleRadUploading)
      : (gender === 'male' ? setIsMaleGenUploading : setIsFemaleGenUploading);
      
    const setError = reportType === 'pathology'
      ? (gender === 'male' ? setMaleError : setFemaleError)
      : reportType === 'radiology'
      ? (gender === 'male' ? setMaleRadError : setFemaleRadError)
      : (gender === 'male' ? setMaleGenError : setFemaleGenError);

    const setReport = reportType === 'pathology'
      ? (gender === 'male' ? setMaleReport : setFemaleReport)
      : reportType === 'radiology'
      ? (gender === 'male' ? setMaleRadReport : setFemaleRadReport)
      : (gender === 'male' ? setMaleGenReport : setFemaleGenReport);

    setIsUploading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
        if (reportType === 'pathology') {
          if (gender === 'male') {
            setMaleManualData(prev => ({
              ...prev,
              name: prev.name || 'John',
              age: prev.age || 32,
              semenQuality: 'Normal',
              scrotalFinding: 'Normal',
              b_azoo: false,
            }));
            setSharedLifestyle({
              smoke: 0,
              bmi: 0,
              act: 0,
              alc: 0,
              stress: 0,
              freq: 0.92,
            });
          } else {
            setFemaleManualData(prev => ({
              ...prev,
              name: prev.name || 'Jane',
              age: prev.age || 30,
              ovarianReserve: 'Normal',
              b_tubal: false,
              b_uterus: false,
            }));
          }
        } else if (reportType === 'radiology') {
          if (gender === 'male') {
            setMaleManualData(prev => ({
              ...prev,
              name: prev.name || 'John',
              age: prev.age || 32,
              varicoceleGrade: 'Grade 2',
              testicularVolume: 'Normal',
              scrotalObstruction: 'No',
              prostateGrade: 'Grade I',
              pvrVolume: 'Normal',
              fattyLiverGrade: 'Grade II'
            }));
          } else {
            setFemaleManualData(prev => ({
              ...prev,
              name: prev.name || 'Jane',
              age: prev.age || 30,
              uterineLining: 'Normal',
              fibroids: 'Intramural',
              tubalPatency: 'Both open',
              pcosMorphology: 'Bilateral',
              ovarianVolume: 'Enlarged',
              pelvicFluid: 'No',
              fattyLiverGrade: 'Grade I'
            }));
          }
        } else if (reportType === 'genomics') {
          if (gender === 'male') {
            setMaleManualData(prev => ({
              ...prev,
              name: prev.name || 'John',
              age: prev.age || 32,
              yDeletion: 'None',
              maleKaryotype: 'Normal 46,XY'
            }));
          } else {
            setFemaleManualData(prev => ({
              ...prev,
              name: prev.name || 'Jane',
              age: prev.age || 30,
              mthfr: 'Heterozygous',
              femaleKaryotype: 'Normal 46,XX',
              cftrCarrier: 'No'
            }));
          }
        }
      } else {
        setError(data.error || 'Failed to extract mock data');
      }
    } catch (err) {
      setError('Connection to backend failed. Make sure the server is running.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (file, gender, reportType = 'pathology') => {
    const setIsUploading = reportType === 'pathology' 
      ? (gender === 'male' ? setIsMaleUploading : setIsFemaleUploading)
      : reportType === 'radiology'
      ? (gender === 'male' ? setIsMaleRadUploading : setIsFemaleRadUploading)
      : (gender === 'male' ? setIsMaleGenUploading : setIsFemaleGenUploading);
      
    const setError = reportType === 'pathology'
      ? (gender === 'male' ? setMaleError : setFemaleError)
      : reportType === 'radiology'
      ? (gender === 'male' ? setMaleRadError : setFemaleRadError)
      : (gender === 'male' ? setMaleGenError : setFemaleGenError);

    const setReport = reportType === 'pathology'
      ? (gender === 'male' ? setMaleReport : setFemaleReport)
      : reportType === 'radiology'
      ? (gender === 'male' ? setMaleRadReport : setFemaleRadReport)
      : (gender === 'male' ? setMaleGenReport : setFemaleGenReport);

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
        
        const rawText = data.report_metadata?.raw_ocr_text || '';
        const meta = parsePatientMeta(rawText);
        const extracted = data.sections || {};
        
        if (reportType === 'pathology') {
          if (gender === 'male') {
            let volume = parseFloat(findExtractedParam(extracted, 'semen_volume')?.value);
            let concentration = parseFloat(findExtractedParam(extracted, 'sperm_concentration')?.value);
            let totalCount = parseFloat(findExtractedParam(extracted, 'total_sperm_count_per_ejaculate')?.value || findExtractedParam(extracted, 'total_sperm_count')?.value);
            let totalMotility = parseFloat(findExtractedParam(extracted, 'total_sperm_motility')?.value || findExtractedParam(extracted, 'total_motility')?.value);
            let progressive = parseFloat(findExtractedParam(extracted, 'progressive_motility')?.value);
            let vitality = parseFloat(findExtractedParam(extracted, 'sperm_vitality_viability')?.value || findExtractedParam(extracted, 'vitality')?.value);
            let morphology = parseFloat(findExtractedParam(extracted, 'sperm_morphology_normal_forms')?.value || findExtractedParam(extracted, 'morphology')?.value);
            let ph = parseFloat(findExtractedParam(extracted, 'semen_ph')?.value || findExtractedParam(extracted, 'ph')?.value);

            // Regex fallbacks for semen parameters from raw OCR text
            if (isNaN(volume)) {
              const match = rawText.match(/(?:Semen\s*)?Volume\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*m[lL]/i);
              if (match) volume = parseFloat(match[1]);
            }
            if (isNaN(concentration)) {
              const match = rawText.match(/(?:Sperm\s*)?Concentration\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:M|Million)/i);
              if (match) concentration = parseFloat(match[1]);
            }
            if (isNaN(totalCount)) {
              const match = rawText.match(/Total\s*(?:Sperm\s*)?Count\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:M|Million)/i);
              if (match) totalCount = parseFloat(match[1]);
            }
            if (isNaN(totalMotility)) {
              const match = rawText.match(/(?:Total\s*)?Motility\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
              if (match) totalMotility = parseFloat(match[1]);
            }
            if (isNaN(progressive)) {
              const match = rawText.match(/Progressive\s*(?:Motility)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
              if (match) progressive = parseFloat(match[1]);
            }
            if (isNaN(vitality)) {
              const match = rawText.match(/Vitality\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
              if (match) vitality = parseFloat(match[1]);
            }
            if (isNaN(morphology)) {
              const match = rawText.match(/Morphology\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i) || rawText.match(/Normal\s*Forms\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
              if (match) morphology = parseFloat(match[1]);
            }
            if (isNaN(ph)) {
              const match = rawText.match(/pH\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
              if (match) ph = parseFloat(match[1]);
            }

            // Semen Quality classification logic
            let semenQuality = '';
            let b_azoo = false;
            
            if (concentration === 0 || totalCount === 0) {
              semenQuality = 'Severe Deficit';
              b_azoo = true;
            } else if (!isNaN(volume) || !isNaN(concentration) || !isNaN(totalMotility)) {
              let belowCount = 0;
              if (!isNaN(concentration) && concentration < 16) belowCount++;
              if (!isNaN(totalCount) && totalCount < 39) belowCount++;
              if (!isNaN(volume) && volume < 1.4) belowCount++;
              if (!isNaN(totalMotility) && totalMotility < 42) belowCount++;
              if (!isNaN(progressive) && progressive < 30) belowCount++;
              if (!isNaN(vitality) && vitality < 54) belowCount++;
              if (!isNaN(morphology) && morphology < 4) belowCount++;
              if (!isNaN(ph) && ph < 7.2) belowCount++;

              if (belowCount >= 3 || (!isNaN(concentration) && concentration < 5)) {
                semenQuality = 'Severe Deficit';
              } else if (belowCount === 2) {
                semenQuality = 'Moderate Deficit';
              } else if (belowCount === 1) {
                semenQuality = 'Mild Deficit';
              } else {
                semenQuality = 'Normal';
              }
            }

            setMaleManualData(prev => ({
              ...prev,
              name: meta.name || prev.name,
              age: meta.age || prev.age,
              semenQuality: semenQuality || prev.semenQuality,
              b_azoo: b_azoo || prev.b_azoo,
              scrotalFinding: prev.scrotalFinding || 'Normal'
            }));
          } else {
            // Female Pathology
            let amh = parseFloat(findExtractedParam(extracted, 'amh')?.value);
            let afc = parseFloat(findExtractedParam(extracted, 'afc')?.value);

            if (isNaN(amh)) {
              const amhMatch = rawText.match(/(?:AMH|Anti\s*-?\s*Mullerian\s*Hormone)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
              if (amhMatch) amh = parseFloat(amhMatch[1]);
            }
            if (isNaN(afc)) {
              const afcMatch = rawText.match(/(?:AFC|Antral\s*Follicle\s*Count)\s*[:\-]?\s*(\d+)/i);
              if (afcMatch) afc = parseFloat(afcMatch[1]);
            }

            const ageNum = meta.age || femaleManualData.age || 30;
            let ovarianReserve = '';
            if (!isNaN(amh) || !isNaN(afc)) {
              ovarianReserve = classifyOvarianReserve(amh, afc, ageNum);
            }

            setFemaleManualData(prev => ({
              ...prev,
              name: meta.name || prev.name,
              age: meta.age || prev.age,
              ovarianReserve: ovarianReserve || prev.ovarianReserve
            }));
          }
        } else if (reportType === 'radiology') {
          if (gender === 'male') {
            const rad = parseMaleRadiology(rawText);
            setMaleManualData(prev => ({
              ...prev,
              name: prev.name || meta.name,
              age: prev.age || meta.age,
              varicoceleGrade: rad.varicoceleGrade,
              testicularVolume: rad.testicularVolume,
              scrotalObstruction: rad.scrotalObstruction
            }));
          } else {
            const rad = parseFemaleRadiology(rawText);
            setFemaleManualData(prev => ({
              ...prev,
              name: prev.name || meta.name,
              age: prev.age || meta.age,
              uterineLining: rad.uterineLining,
              fibroids: rad.fibroids,
              tubalPatency: rad.tubalPatency
            }));
          }
        } else if (reportType === 'genomics') {
          if (gender === 'male') {
            const gen = parseMaleGenomics(rawText);
            setMaleManualData(prev => ({
              ...prev,
              name: prev.name || meta.name,
              age: prev.age || meta.age,
              yDeletion: gen.yDeletion,
              maleKaryotype: gen.maleKaryotype
            }));
          } else {
            const gen = parseFemaleGenomics(rawText);
            setFemaleManualData(prev => ({
              ...prev,
              name: prev.name || meta.name,
              age: prev.age || meta.age,
              mthfr: gen.mthfr,
              femaleKaryotype: gen.femaleKaryotype,
              cftrCarrier: gen.cftrCarrier
            }));
          }
        }
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

  const handleAnalyzeMfr = async () => {
    if (!maleReport || !femaleReport) return;
    
    const missing = [];

    // Partner A
    if (!maleManualData.name?.trim()) missing.push("Prospect A Name");
    if (!maleManualData.age) missing.push("Prospect A Age");
    if (!maleManualData.semenQuality) missing.push("Prospect A Semen Quality");
    if (!maleManualData.scrotalFinding) missing.push("Prospect A Scrotal Findings");

    if (evaluationTier >= 2) {
      if (!maleManualData.varicoceleGrade) missing.push("Prospect A Varicocele Grade");
      if (!maleManualData.testicularVolume) missing.push("Prospect A Testicular Volume");
      if (!maleManualData.scrotalObstruction) missing.push("Prospect A Scrotal Obstruction");
      if (!maleManualData.prostateGrade) missing.push("Prospect A Prostate BPH Grade");
      if (!maleManualData.pvrVolume) missing.push("Prospect A Post-Void Residual Volume");
      if (!maleManualData.fattyLiverGrade) missing.push("Prospect A Fatty Liver Grade");
    }
    if (evaluationTier === 3) {
      if (!maleManualData.yDeletion) missing.push("Prospect A Y-Chromosome Deletion");
      if (!maleManualData.maleKaryotype) missing.push("Prospect A Male Karyotype");
    }

    // Partner B
    if (!femaleManualData.name?.trim()) missing.push("Prospect B Name");
    if (!femaleManualData.age) missing.push("Prospect B Age");
    if (!femaleManualData.ovarianReserve) missing.push("Prospect B Ovarian Reserve");

    if (evaluationTier >= 2) {
      if (!femaleManualData.uterineLining) missing.push("Prospect B Uterine Lining");
      if (!femaleManualData.fibroids) missing.push("Prospect B Fibroids");
      if (!femaleManualData.tubalPatency) missing.push("Prospect B Tubal Patency");
      if (!femaleManualData.pcosMorphology) missing.push("Prospect B PCOS Ovarian Morphology");
      if (!femaleManualData.ovarianVolume) missing.push("Prospect B Ovarian Volume");
      if (!femaleManualData.pelvicFluid) missing.push("Prospect B Pelvic Free Fluid");
      if (!femaleManualData.fattyLiverGrade) missing.push("Prospect B Fatty Liver Grade");
    }
    if (evaluationTier === 3) {
      if (!femaleManualData.mthfr) missing.push("Prospect B MTHFR Mutation");
      if (!femaleManualData.femaleKaryotype) missing.push("Prospect B Female Karyotype");
      if (!femaleManualData.cftrCarrier) missing.push("Prospect B CFTR Carrier Status");
    }

    // Shared Lifestyle
    if (sharedLifestyle.smoke === undefined || sharedLifestyle.smoke === '') missing.push("Smoking");
    if (sharedLifestyle.bmi === undefined || sharedLifestyle.bmi === '') missing.push("Body weight (BMI)");
    if (sharedLifestyle.act === undefined || sharedLifestyle.act === '') missing.push("Physical activity");
    if (sharedLifestyle.alc === undefined || sharedLifestyle.alc === '') missing.push("Alcohol");
    if (sharedLifestyle.stress === undefined || sharedLifestyle.stress === '') missing.push("Stress");
    if (sharedLifestyle.freq === undefined || sharedLifestyle.freq === '') missing.push("Intercourse frequency");

    if (missing.length > 0) {
      setMatchError(`Please fill in the following columns to proceed: ${missing.join(", ")}`);
      return;
    }

    setIsAnalyzing(true);
    setMatchError(null);

    try {
      const response = await fetch(`${API_URL}/api/mfr/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          male_report_id: maleReport.report_metadata.report_id,
          female_report_id: femaleReport.report_metadata.report_id,
          male_manual_data: maleManualData,
          female_manual_data: femaleManualData,
          shared_lifestyle: sharedLifestyle,
          evaluationTier,
          barriers: {
            b_tubal: femaleManualData.b_tubal || femaleManualData.tubalPatency === 'Both blocked',
            b_uterus: femaleManualData.b_uterus,
            b_azoo: maleManualData.b_azoo || maleManualData.scrotalObstruction === 'Yes'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setMatchResult(data);

        let shouldUpdate = false;
        const newMaleManual = { ...maleManualData };
        const newFemaleManual = { ...femaleManualData };

        if (maleReport && syncedMaleReportId.current !== maleReport.report_metadata.report_id) {
          if (data.details.detected_semen_from_pathology?.category) {
            newMaleManual.semenQuality = data.details.detected_semen_from_pathology.category;
            syncedMaleReportId.current = maleReport.report_metadata.report_id;
            shouldUpdate = true;
          }
        }

        if (femaleReport && syncedFemaleReportId.current !== femaleReport.report_metadata.report_id) {
          if (data.details.detected_reserve_from_pathology) {
            newFemaleManual.ovarianReserve = data.details.detected_reserve_from_pathology;
            syncedFemaleReportId.current = femaleReport.report_metadata.report_id;
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          setMaleManualData(newMaleManual);
          setFemaleManualData(newFemaleManual);
        }
      } else {
        throw new Error(data.error || 'Failed to analyze fertility');
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
    setMaleRadReport(null);
    setFemaleRadReport(null);
    setMaleGenReport(null);
    setFemaleGenReport(null);
    
    setMatchResult(null);
    setMatchError(null);
    
    setMaleError(null);
    setFemaleError(null);
    setMaleRadError(null);
    setFemaleRadError(null);
    setMaleGenError(null);
    setFemaleGenError(null);
    
    setMaleManualData(defaultMaleManual);
    setFemaleManualData(defaultFemaleManual);
    setSharedLifestyle(defaultSharedLifestyle);
    setEvaluationTier(1);
    
    syncedMaleReportId.current = null;
    syncedFemaleReportId.current = null;
    setShowCalculations(false);
    setChatSessionId(null);
    setIsChatOpen(false);
  };

  const handleLifestyleChange = (e) => {
    const { name, value } = e.target;
    setSharedLifestyle(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
  };

  const getBadgeStyle = (status) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('blocked') || s.includes('specialist')) {
      return { badge: styles.badgeCritical, dot: styles.dotCritical };
    }
    if (s.includes('reduced') || s.includes('plan together')) {
      return { badge: styles.badgeCaution, dot: styles.dotCaution };
    }
    return { badge: styles.badgeAligned, dot: styles.dotAligned };
  };

  const renderSvgChart = (currentProj, optProj) => {
    if (!currentProj || !optProj) return null;

    // Convert monthly projection percentages to cumulative 12-month scores
    const currentProjCum = currentProj.map(val => (1.0 - Math.pow(1.0 - val / 100, 12)) * 100);
    const optProjCum = optProj.map(val => (1.0 - Math.pow(1.0 - val / 100, 12)) * 100);

    const chartWidth = 600;
    const chartHeight = 320;
    const paddingLeft = 55;
    const paddingRight = 140;
    const paddingTop = 30;
    const paddingBottom = 45;

    const getCoords = (val, idx) => {
      const x = paddingLeft + (idx / 10) * (chartWidth - paddingLeft - paddingRight);
      const y = chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
      return `${x},${y}`;
    };

    const currentPoints = currentProjCum.map((val, idx) => getCoords(val, idx)).join(' ');
    const optimisedPoints = optProjCum.map((val, idx) => getCoords(val, idx)).join(' ');

    const getYCoord = (val) => {
      return chartHeight - paddingBottom - (val / 100) * (chartHeight - paddingTop - paddingBottom);
    };

    const femaleBaseAge = matchResult?.details?.female_age || 30;
    const maleBaseAge = matchResult?.details?.male_age || 30;
    const yr40 = 40 - femaleBaseAge;
    const yr45 = 45 - femaleBaseAge;

    const xStart = paddingLeft;
    const xEnd = chartWidth - paddingRight;
    const chartAreaWidth = chartWidth - paddingLeft - paddingRight;

    const t40 = Math.max(0, Math.min(10, yr40));
    const t45 = Math.max(0, Math.min(10, yr45));

    const x40 = paddingLeft + (t40 / 10) * chartAreaWidth;
    const x45 = paddingLeft + (t45 / 10) * chartAreaWidth;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="mfr-line-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={chartHeight}>
              <stop offset={`${(getYCoord(100) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(85) / chartHeight) * 100}%`} stopColor="#10B981" />
              <stop offset={`${(getYCoord(72.5) / chartHeight) * 100}%`} stopColor="var(--amber)" />
              <stop offset={`${(getYCoord(60) / chartHeight) * 100}%`} stopColor="#EF4444" />
              <stop offset={`${(getYCoord(0) / chartHeight) * 100}%`} stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Shading / Bands */}
          {/* Green Zone (85% - 100%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(100)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(85) - getYCoord(100)}
            fill="rgba(16, 185, 129, 0.05)"
          />
          {/* Yellow Zone (60% - 85%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(85)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(60) - getYCoord(85)}
            fill="rgba(245, 158, 11, 0.05)"
          />
          {/* Red Zone (0% - 60%) */}
          <rect
            x={paddingLeft}
            y={getYCoord(60)}
            width={chartWidth - paddingLeft - paddingRight}
            height={getYCoord(0) - getYCoord(60)}
            fill="rgba(239, 68, 68, 0.05)"
          />

          {/* Zone separator lines */}
          <line x1={paddingLeft} y1={getYCoord(85)} x2={chartWidth - paddingRight} y2={getYCoord(85)} stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" strokeDasharray="3,3" />
          <line x1={paddingLeft} y1={getYCoord(60)} x2={chartWidth - paddingRight} y2={getYCoord(60)} stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1" strokeDasharray="3,3" />

          {/* Zone Labels (Right-aligned, multi-line for layout spacing) */}
          <text x={chartWidth - paddingRight + 8} y={getYCoord(92.5)} fontSize="10" fontWeight="600" fill="var(--teal-d)" opacity="0.9">Good to Go (Decent)</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(92.5) + 11} fontSize="9" fill="var(--muted)" opacity="0.85">Chance &ge; 85%</text>

          <text x={chartWidth - paddingRight + 8} y={getYCoord(72.5)} fontSize="10" fontWeight="600" fill="var(--amber)" opacity="0.9">Consultation Advised</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(72.5) + 11} fontSize="9" fill="var(--muted)" opacity="0.85">Moderate: 60% - 85%</text>

          <text x={chartWidth - paddingRight + 8} y={getYCoord(30)} fontSize="10" fontWeight="600" fill="#E53E3E" opacity="0.9">IVF / Egg Freezing</text>
          <text x={chartWidth - paddingRight + 8} y={getYCoord(30) + 11} fontSize="9" fill="var(--muted)" opacity="0.85">Requires Attention: &lt; 60%</text>

          {/* Grid lines */}
          {[0, 20, 40, 60, 80, 100].map((level, i) => {
            const y = getYCoord(level);
            return (
              <g key={i}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={chartWidth - paddingRight} 
                  y2={y} 
                  stroke="var(--line)" 
                  strokeWidth="0.5" 
                  strokeDasharray="2,2" 
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 3} 
                  fontSize="9.5" 
                  fill="var(--muted)" 
                  textAnchor="end"
                >
                  {level}%
                </text>
              </g>
            );
          })}

          {/* X axis years */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((yr, i) => {
            const x = paddingLeft + (yr / 10) * (chartWidth - paddingLeft - paddingRight);
            return (
              <g key={i}>
                <line 
                  x1={x} 
                  y1={chartHeight - paddingBottom} 
                  x2={x} 
                  y2={chartHeight - paddingBottom + 4} 
                  stroke="var(--line)" 
                  strokeWidth="0.8" 
                />
                <text 
                  x={x} 
                  y={chartHeight - paddingBottom + 16} 
                  fontSize="9.5" 
                  fill="var(--muted)" 
                  textAnchor="middle"
                >
                  Yr {yr}
                </text>
              </g>
            );
          })}

          {/* Vertical Regions Background Shading */}
          {/* Zone 1: Active Reproductive (Age < 40) */}
          {x40 > xStart && (
            <rect 
              x={xStart} 
              y={paddingTop} 
              width={x40 - xStart} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(16, 185, 129, 0.015)" 
            />
          )}
          {/* Zone 2: Premenopause (Age 40 - 45) */}
          {x45 > x40 && (
            <rect 
              x={x40} 
              y={paddingTop} 
              width={x45 - x40} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(245, 158, 11, 0.025)" 
            />
          )}
          {/* Zone 3: Menopause (Age >= 45) */}
          {xEnd > x45 && (
            <rect 
              x={x45} 
              y={paddingTop} 
              width={xEnd - x45} 
              height={chartHeight - paddingTop - paddingBottom} 
              fill="rgba(239, 68, 68, 0.035)" 
            />
          )}

          {/* Vertical boundary lines and text labels */}
          {yr40 >= 0 && yr40 <= 10 && (
            <g key="vertical-premenopause">
              <line 
                x1={x40} 
                y1={paddingTop - 12} 
                x2={x40} 
                y2={chartHeight - paddingBottom} 
                stroke="rgba(217, 119, 6, 0.5)" 
                strokeWidth="1.2" 
                strokeDasharray="3,3" 
              />
            </g>
          )}

          {yr45 >= 0 && yr45 <= 10 && (
            <g key="vertical-menopause">
              <line 
                x1={x45} 
                y1={paddingTop - 12} 
                x2={x45} 
                y2={chartHeight - paddingBottom} 
                stroke="rgba(220, 38, 38, 0.5)" 
                strokeWidth="1.2" 
                strokeDasharray="3,3" 
              />
            </g>
          )}

          {/* Region Label Texts */}
          {x40 - xStart > 45 && (
            <text 
              x={xStart + (x40 - xStart) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="var(--teal-d)" 
              textAnchor="middle"
            >
              Reproductive (&lt;40)
            </text>
          )}
          {x45 - x40 > 45 && (
            <text 
              x={x40 + (x45 - x40) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="#D97706" 
              textAnchor="middle"
            >
              Premenopause (40-45)
            </text>
          )}
          {xEnd - x45 > 45 && (
            <text 
              x={x45 + (xEnd - x45) / 2} 
              y={paddingTop - 6} 
              fontSize="8.5" 
              fontWeight="700" 
              fill="#DC2626" 
              textAnchor="middle"
            >
              Menopause (&ge;45)
            </text>
          )}

          {/* Y Axis Label */}
          <text
            x={-(chartHeight - paddingBottom - paddingTop) / 2 - paddingTop}
            y="15"
            fontSize="10"
            fontWeight="600"
            fill="var(--muted)"
            transform="rotate(-90)"
            textAnchor="middle"
          >
            Yearly Conception Chance (%)
          </text>

          {/* X Axis Label */}
          <text
            x={paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2}
            y={chartHeight - 8}
            fontSize="10.5"
            fontWeight="600"
            fill="var(--muted)"
            textAnchor="middle"
          >
            Time Horizon (Years)
          </text>

          {/* Hover helper vertical line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.cx}
              y1={paddingTop}
              x2={hoveredPoint.cx}
              y2={chartHeight - paddingBottom}
              stroke="var(--line)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
          )}

          {/* Projections */}
          <polyline 
            fill="none" 
            stroke="url(#mfr-line-grad)" 
            strokeWidth="3.5" 
            strokeDasharray="5,4" 
            points={currentPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />
          <polyline 
            fill="none" 
            stroke="url(#mfr-line-grad)" 
            strokeWidth="3.5" 
            points={optimisedPoints} 
            style={{ transition: 'stroke-width 0.2s' }}
          />

          {/* Visible circles for nodes */}
          {currentProjCum.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProjCum[idx], idx).split(',');

            const isCurHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Current';
            const isOptHovered = hoveredPoint && hoveredPoint.idx === idx && hoveredPoint.type === 'Optimised';

            const getNodeColor = (v) => {
              if (v >= 85) return '#10B981';
              if (v >= 60) return 'var(--amber)';
              return '#EF4444';
            };

            return (
              <g key={idx}>
                {/* Current Path Node */}
                <circle 
                  cx={coordsCur[0]} 
                  cy={coordsCur[1]} 
                  r={isCurHovered ? "6" : "4.5"} 
                  fill="var(--paper)" 
                  stroke={getNodeColor(val)} 
                  strokeWidth={isCurHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
                {/* Optimised Path Node */}
                <circle 
                  cx={coordsOpt[0]} 
                  cy={coordsOpt[1]} 
                  r={isOptHovered ? "6" : "4.5"} 
                  fill="var(--paper)" 
                  stroke={getNodeColor(optProjCum[idx])} 
                  strokeWidth={isOptHovered ? "3.5" : "2"}
                  style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
                />
              </g>
            );
          })}

          {/* Interactive Invisible Overlay Circles (Easier to hover) */}
          {currentProjCum.map((val, idx) => {
            const coordsCur = getCoords(val, idx).split(',');
            const coordsOpt = getCoords(optProjCum[idx], idx).split(',');

            return (
              <g key={`interactive-${idx}`}>
                {/* Current */}
                <circle
                  cx={coordsCur[0]}
                  cy={coordsCur[1]}
                  r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const containerRect = e.currentTarget.closest(`.${styles.svgChartContainer}`).getBoundingClientRect();
                    setHoveredPoint({
                      val,
                      idx,
                      type: 'Current',
                      cx: parseFloat(coordsCur[0]),
                      cy: parseFloat(coordsCur[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: maleBaseAge + idx
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {/* Optimised */}
                <circle
                  cx={coordsOpt[0]}
                  cy={coordsOpt[1]}
                  r="12"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const containerRect = e.currentTarget.closest(`.${styles.svgChartContainer}`).getBoundingClientRect();
                    setHoveredPoint({
                      val: optProjCum[idx],
                      idx,
                      type: 'Optimised',
                      cx: parseFloat(coordsOpt[0]),
                      cy: parseFloat(coordsOpt[1]),
                      left: rect.left - containerRect.left + rect.width / 2,
                      top: rect.top - containerRect.top - 8,
                      femaleAge: femaleBaseAge + idx,
                      maleAge: maleBaseAge + idx
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredPoint && (
          <div 
            style={{
              position: 'absolute',
              left: `${hoveredPoint.left}px`,
              top: `${hoveredPoint.top}px`,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(17, 24, 39, 0.95)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              lineHeight: '1.4',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 100,
              width: '180px',
              border: `1px solid ${hoveredPoint.type === 'Current' ? 'var(--amber)' : 'var(--teal)'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '3px' }}>
              <span style={{ fontWeight: 'bold', color: hoveredPoint.type === 'Current' ? 'var(--amber)' : 'var(--teal-l, #4FD1C5)' }}>
                {hoveredPoint.type} Path
              </span>
              <span style={{ opacity: 0.8 }}>Year {hoveredPoint.idx}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '2px 0' }}>
              12-Month Chance: <span style={{ color: '#fff' }}>{hoveredPoint.val.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: '4px', opacity: 0.95 }}>
              {hoveredPoint.val >= 85 ? (
                <span style={{ color: '#34D399' }}>● Decent baseline chance</span>
              ) : hoveredPoint.val >= 60 ? (
                <span style={{ color: '#FBBF24' }}>● Moderate/reduced chance</span>
              ) : (
                <span style={{ color: '#F87171' }}>● Attention: Consider IVF/egg freezing</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', justifyContent: 'center', opacity: 0.9 }}>
              <span>F-Age: <strong>{hoveredPoint.femaleAge}</strong></span>
              <span>•</span>
              <span>M-Age: <strong>{hoveredPoint.maleAge}</strong></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUploadSlot = (gender, reportType) => {
    const isMale = gender === 'male';
    let isUploading = false;
    let report = null;
    let error = null;
    let inputRef = null;
    let label = '';
    
    if (reportType === 'pathology') {
      isUploading = isMale ? isMaleUploading : isFemaleUploading;
      report = isMale ? maleReport : femaleReport;
      error = isMale ? maleError : femaleError;
      inputRef = isMale ? maleInputRef : femaleInputRef;
      label = isMale ? 'Pathology (Semen Report)' : 'Pathology (AMH Report)';
    } else if (reportType === 'radiology') {
      isUploading = isMale ? isMaleRadUploading : isFemaleRadUploading;
      report = isMale ? maleRadReport : femaleRadReport;
      error = isMale ? maleRadError : femaleRadError;
      inputRef = isMale ? maleRadInputRef : femaleRadInputRef;
      label = isMale ? 'Radiology (Scrotal USG)' : 'Radiology (Pelvic USG/HSG)';
    } else if (reportType === 'genomics') {
      isUploading = isMale ? isMaleGenUploading : isFemaleGenUploading;
      report = isMale ? maleGenReport : femaleGenReport;
      error = isMale ? maleGenError : femaleGenError;
      inputRef = isMale ? maleGenInputRef : femaleGenInputRef;
      label = isMale ? 'Genomics (Y-Deletion)' : 'Genomics (MTHFR / Karyotype)';
    }

    return (
      <div className={styles.uploadSlotContainer} key={reportType}>
        <div className={styles.uploadSlotLabel}>{label}</div>
        <div 
          className={styles.compactDropzone}
          onClick={() => !report && inputRef.current?.click()}
          style={report ? { borderColor: 'var(--teal)', background: 'var(--soft-teal)' } : {}}
        >
          <input 
            type="file" 
            ref={inputRef} 
            onChange={(e) => e.target.files.length && handleFileUpload(e.target.files[0], gender, reportType)} 
            accept=".pdf" 
            style={{ display: 'none' }} 
          />
          {isUploading ? (
            <div className={styles.loader} style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
          ) : report ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <CheckCircle size={18} color="var(--teal)" style={{ flexShrink: 0 }} />
              <span className={styles.uploadSlotText} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Extracted
              </span>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (reportType === 'pathology') {
                    if (isMale) { setMaleReport(null); setMaleManualData(defaultMaleManual); }
                    else { setFemaleReport(null); setFemaleManualData(defaultFemaleManual); }
                  } else if (reportType === 'radiology') {
                    if (isMale) { setMaleRadReport(null); setMaleManualData(prev => ({ ...prev, varicoceleGrade: '', testicularVolume: '', scrotalObstruction: '' })); }
                    else { setFemaleRadReport(null); setFemaleManualData(prev => ({ ...prev, uterineLining: '', fibroids: '', tubalPatency: '' })); }
                  } else if (reportType === 'genomics') {
                    if (isMale) { setMaleGenReport(null); setMaleManualData(prev => ({ ...prev, yDeletion: '', maleKaryotype: '' })); }
                    else { setFemaleGenReport(null); setFemaleManualData(prev => ({ ...prev, mthfr: '', femaleKaryotype: '', cftrCarrier: '' })); }
                  }
                }} 
                className={styles.slotClearBtn}
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <UploadCloud size={18} className={styles.uploadSlotIcon} />
              <span className={styles.uploadSlotText}>Upload PDF</span>
              {!isUploading && !report && (
                <button 
                  onClick={(e) => { e.stopPropagation(); triggerMockExtraction(gender, reportType); }} 
                  className={styles.slotMockBtn}
                >
                  Mock
                </button>
              )}
            </>
          )}
          {error && <div className={styles.slotErrorText}>{error}</div>}
        </div>
      </div>
    );
  };

  const isUploadRequiredFilled = 
    maleReport && 
    femaleReport && 
    (evaluationTier < 2 || (maleRadReport && femaleRadReport)) && 
    (evaluationTier < 3 || (maleGenReport && femaleGenReport));

  return (
    <div className={styles.mfrThemeWrapper}>
      <main className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>SlayHealth Fertility Analysis</h1>
          <p className={styles.subtitle}>
            Assess baseline fecundability markers, ovarian reserve indexes, and semen profiles for natural conception.
          </p>

          <div className={styles.tabs}>
            <Link href="/" className={`${styles.tabLink} ${styles.tabInactive}`}>
              Home
            </Link>
            <Link href="/usg" className={`${styles.tabLink} ${styles.tabInactive}`}>
              USG Abdomen
            </Link>
            <Link href="/chronic" className={`${styles.tabLink} ${styles.tabInactive}`}>
              Chronic Health Engine
            </Link>
            <Link href="/mfr" className={`${styles.tabLink} ${styles.tabActive}`}>
              Fertility Analysis
            </Link>
          </div>
        </header>

        {!matchResult && (
          <>
            {/* Interactive Evaluation Tree Selector */}
            <div className={styles.treeSelectorContainer}>
              <h3 className={styles.treeSelectorTitle}>Evaluation Tier</h3>
              <div className={styles.treeSvgWrapper}>
                <svg viewBox="0 0 600 200" width="100%" height="200" style={{ overflow: 'visible' }}>
                  <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Branches (Connection Lines) */}
                  <path
                    d="M 300 35 C 300 80, 115 80, 115 120"
                    fill="none"
                    stroke={evaluationTier >= 1 ? "var(--teal)" : "var(--line)"}
                    strokeWidth={evaluationTier === 1 ? "3" : "1.5"}
                    strokeDasharray={evaluationTier >= 1 ? "none" : "4 4"}
                    style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
                  />
                  <path
                    d="M 300 35 L 300 120"
                    fill="none"
                    stroke={evaluationTier >= 2 ? "var(--teal)" : "var(--line)"}
                    strokeWidth={evaluationTier === 2 ? "3" : "1.5"}
                    strokeDasharray={evaluationTier >= 2 ? "none" : "4 4"}
                    style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
                  />
                  <path
                    d="M 300 35 C 300 80, 485 80, 485 120"
                    fill="none"
                    stroke={evaluationTier === 3 ? "var(--teal)" : "var(--line)"}
                    strokeWidth={evaluationTier === 3 ? "3" : "1.5"}
                    strokeDasharray={evaluationTier === 3 ? "none" : "4 4"}
                    style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
                  />

                  {/* Root Node (Fertility Assessment Center) */}
                  <g transform="translate(300, 35)">
                    <rect
                      x="-80"
                      y="-20"
                      width="160"
                      height="36"
                      rx="18"
                      fill="var(--ink)"
                      stroke="none"
                    />
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      fill="var(--paper)"
                      fontSize="12.5"
                      fontWeight="bold"
                      style={{ pointerEvents: 'none' }}
                    >
                      Fertility Engine
                    </text>
                  </g>

                  {/* Tier 1 Node */}
                  <g 
                    onClick={() => setEvaluationTier(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x="25"
                      y="120"
                      width="180"
                      height="70"
                      rx="12"
                      style={{
                        fill: evaluationTier === 1 ? 'var(--soft-teal)' : 'var(--surface)',
                        stroke: evaluationTier === 1 ? 'var(--teal)' : 'var(--line)',
                        strokeWidth: evaluationTier === 1 ? '2.5px' : '1px',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <text x="115" y="142" textAnchor="middle" fontWeight="bold" fontSize="13" fill={evaluationTier === 1 ? 'var(--teal-d)' : 'var(--ink)'}>
                      Tier 1
                    </text>
                    <text x="115" y="160" textAnchor="middle" fontSize="11" fill={evaluationTier === 1 ? 'var(--teal-d)' : 'var(--muted)'}>
                      Pathology + Lifestyle
                    </text>
                    <text x="115" y="176" textAnchor="middle" fontSize="9.5" fill="var(--muted)" opacity="0.8">
                      AMH, Semen Profile
                    </text>
                  </g>

                  {/* Tier 2 Node */}
                  <g 
                    onClick={() => setEvaluationTier(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x="210"
                      y="120"
                      width="180"
                      height="70"
                      rx="12"
                      style={{
                        fill: evaluationTier === 2 ? 'var(--soft-teal)' : 'var(--surface)',
                        stroke: evaluationTier === 2 ? 'var(--teal)' : 'var(--line)',
                        strokeWidth: evaluationTier === 2 ? '2.5px' : '1px',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <text x="300" y="142" textAnchor="middle" fontWeight="bold" fontSize="13" fill={evaluationTier === 2 ? 'var(--teal-d)' : 'var(--ink)'}>
                      Tier 2
                    </text>
                    <text x="300" y="160" textAnchor="middle" fontSize="11" fill={evaluationTier === 2 ? 'var(--teal-d)' : 'var(--muted)'}>
                      Radiology + Path + Lifestyle
                    </text>
                    <text x="300" y="176" textAnchor="middle" fontSize="9.5" fill="var(--muted)" opacity="0.8">
                      Adds Pelvic/Scrotal USG
                    </text>
                  </g>

                  {/* Tier 3 Node */}
                  <g 
                    onClick={() => setEvaluationTier(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x="395"
                      y="120"
                      width="180"
                      height="70"
                      rx="12"
                      style={{
                        fill: evaluationTier === 3 ? 'var(--soft-teal)' : 'var(--surface)',
                        stroke: evaluationTier === 3 ? 'var(--teal)' : 'var(--line)',
                        strokeWidth: evaluationTier === 3 ? '2.5px' : '1px',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <text x="485" y="142" textAnchor="middle" fontWeight="bold" fontSize="13" fill={evaluationTier === 3 ? 'var(--teal-d)' : 'var(--ink)'}>
                      Tier 3
                    </text>
                    <text x="485" y="160" textAnchor="middle" fontSize="11" fill={evaluationTier === 3 ? 'var(--teal-d)' : 'var(--muted)'}>
                      Genomics + Rad + Path
                    </text>
                    <text x="485" y="176" textAnchor="middle" fontSize="9.5" fill="var(--muted)" opacity="0.8">
                      Adds Karyotype, MTHFR, CFTR
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            <div className={styles.dualUploadContainer}>
              <div className={styles.uploadWrapper}>
                <div className={styles.uploadLabel}>
                  {maleManualData.name ? `${maleManualData.name}'s Reports` : "Prospect 1's Reports"}
                </div>
                <div className={styles.uploadSlotsGrid}>
                  {renderUploadSlot('male', 'pathology')}
                  {evaluationTier >= 2 && renderUploadSlot('male', 'radiology')}
                  {evaluationTier === 3 && renderUploadSlot('male', 'genomics')}
                </div>
                <ManualInputs 
                  title={maleManualData.name ? `${maleManualData.name}'s Parameters` : "Prospect 1's Parameters"} 
                  data={maleManualData} 
                  onChange={setMaleManualData} 
                  gender="male"
                  engine="mfr"
                  evaluationTier={evaluationTier}
                />
              </div>

              <div className={styles.uploadWrapper}>
                <div className={styles.uploadLabel}>
                  {femaleManualData.name ? `${femaleManualData.name}'s Reports` : "Prospect 2's Reports"}
                </div>
                <div className={styles.uploadSlotsGrid}>
                  {renderUploadSlot('female', 'pathology')}
                  {evaluationTier >= 2 && renderUploadSlot('female', 'radiology')}
                  {evaluationTier === 3 && renderUploadSlot('female', 'genomics')}
                </div>
                <ManualInputs 
                  title={femaleManualData.name ? `${femaleManualData.name}'s Parameters` : "Prospect 2's Parameters"} 
                  data={femaleManualData} 
                  onChange={setFemaleManualData} 
                  gender="female"
                  engine="mfr"
                  evaluationTier={evaluationTier}
                />
              </div>
            </div>

            {/* Shared Household Lifestyle & Timing Inputs */}
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>Shared Household Lifestyle & Timing</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Smoking</label>
                  <select name="smoke" value={sharedLifestyle.smoke} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Smoking...</option>
                    <option value="0">Neither smokes</option>
                    <option value="10">One smokes</option>
                    <option value="22">Both smoke</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Body weight (BMI)</label>
                  <select name="bmi" value={sharedLifestyle.bmi} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select BMI Range...</option>
                    <option value="0">Both healthy range</option>
                    <option value="6">One outside range</option>
                    <option value="14">Both outside range</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Physical activity</label>
                  <select name="act" value={sharedLifestyle.act} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Activity...</option>
                    <option value="0">Active</option>
                    <option value="6">Mixed</option>
                    <option value="14">Sedentary</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Alcohol</label>
                  <select name="alc" value={sharedLifestyle.alc} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Alcohol...</option>
                    <option value="0">None / light</option>
                    <option value="4">Moderate</option>
                    <option value="12">Heavy</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Stress</label>
                  <select name="stress" value={sharedLifestyle.stress} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Stress...</option>
                    <option value="0">Low</option>
                    <option value="4">Moderate</option>
                    <option value="10">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '500' }}>Intercourse frequency</label>
                  <select name="freq" value={sharedLifestyle.freq} onChange={handleLifestyleChange} className={styles.formSelect}>
                    <option value="">Select Frequency...</option>
                    <option value="1">3+ times / week</option>
                    <option value="0.92">About twice / week</option>
                    <option value="0.82">About once / week</option>
                    <option value="0.68">Less than weekly</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              className={styles.actionButton}
              disabled={!isUploadRequiredFilled || isAnalyzing}
              onClick={handleAnalyzeMfr}
            >
              {isAnalyzing ? 'Analyzing Fertility...' : 'Analyze Fertility Profiles'}
            </button>
          </>
        )}

        {matchResult && (() => {
          // 1. Suggestions logic
          const suggestions = [];
          if (parseFloat(sharedLifestyle.smoke) > 0) suggestions.push("Quit smoking");
          if (parseFloat(sharedLifestyle.bmi) > 0) suggestions.push("Optimise body weight/BMI");
          if (parseFloat(sharedLifestyle.act) > 0) suggestions.push("Increase physical activity");
          if (parseFloat(sharedLifestyle.alc) > 0) suggestions.push("Reduce alcohol intake");
          if (parseFloat(sharedLifestyle.stress) > 0) suggestions.push("Manage stress levels");
          if (parseFloat(sharedLifestyle.freq) < 1.0) suggestions.push("Increase intercourse frequency");
          
          const hasOptimisation = suggestions.length > 0;

          // 2. Math calculations
          const mfrCurY = matchResult.projection.current[selectedProjYear] / 100;
          const cumCurY = (1.0 - Math.pow(1.0 - mfrCurY, 12)) * 100;
          const mfrCur0 = matchResult.projection.current[0] / 100;
          const cumCur0 = (1.0 - Math.pow(1.0 - mfrCur0, 12)) * 100;
          const declineCur = cumCur0 - cumCurY;

          const mfrOptY = matchResult.projection.optimised[selectedProjYear] / 100;
          const cumOptY = (1.0 - Math.pow(1.0 - mfrOptY, 12)) * 100;
          const mfrOpt0 = matchResult.projection.optimised[0] / 100;
          const cumOpt0 = (1.0 - Math.pow(1.0 - mfrOpt0, 12)) * 100;
          const declineOpt = cumOpt0 - cumOptY;

          // Time to conceive at selected Year Y
          let timeToConceiveY = 'N/A';
          if (matchResult.details.gate) {
            timeToConceiveY = 'Blocked';
          } else if (mfrCurY > 0) {
            const medianMonths = Math.max(1, Math.round(1 / mfrCurY));
            timeToConceiveY = `~${medianMonths} mo`;
          } else {
            timeToConceiveY = 'Extremely low';
          }

          return (
            <section className={styles.dashboard}>
              <div className={styles.matchScoreCard}>
                <div className={styles.matchScoreTitle}>
                  <HeartPulse size={16} style={{display:'inline', verticalAlign:'middle', marginRight:'6px', color: 'var(--teal)'}}/>
                  Natural Conception Fecundability (Monthly)
                </div>
                <div className={styles.matchScoreValue}>
                  {matchResult.details.gate ? '0%' : `${matchResult.monthly_chance_current.toFixed(1)}%`}
                </div>
                
                {(() => {
                  const badgeObj = getBadgeStyle(matchResult.state);
                  return (
                    <div className={`${styles.statusBadge} ${badgeObj.badge}`}>
                      <span className={`${styles.statusDot} ${badgeObj.dot}`}></span>
                      <span>Status: {matchResult.state}</span>
                    </div>
                  );
                })()}

                {matchResult.validation_issue && (
                  <div className={styles.warnBanner} style={{ marginTop: '16px', marginBottom: '0', textAlign: 'left' }}>
                    <AlertCircle size={16} />
                    <span>{matchResult.validation_issue}</span>
                  </div>
                )}

                {/* Radiology & Genomics Warnings */}
                {((matchResult.rad_warnings && matchResult.rad_warnings.length > 0) || 
                  (matchResult.genomic_warnings && matchResult.genomic_warnings.length > 0)) && (
                  <div className={styles.warningsContainer} style={{ marginTop: '16px' }}>
                    {matchResult.rad_warnings && matchResult.rad_warnings.length > 0 && (
                      <div className={styles.warningCard} style={{ borderColor: 'var(--amber)', background: 'var(--soft-amber)', marginBottom: matchResult.genomic_warnings?.length > 0 ? '12px' : '0' }}>
                        <h4 className={styles.warningCardTitle} style={{ color: 'var(--amber-d)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}>
                          <AlertCircle size={16} />
                          Radiology Assessment Flags (USG/HSG)
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--amber-d)', fontSize: '12px', lineHeight: '1.5', textAlign: 'left' }}>
                          {matchResult.rad_warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {matchResult.genomic_warnings && matchResult.genomic_warnings.length > 0 && (
                      <div className={styles.warningCard} style={{ borderColor: 'var(--red-d)', background: 'var(--soft-red)' }}>
                        <h4 className={styles.warningCardTitle} style={{ color: 'var(--red-d)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px' }}>
                          <AlertCircle size={16} />
                          Genomics Assessment Flags
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--red-d)', fontSize: '12px', lineHeight: '1.5', textAlign: 'left' }}>
                          {matchResult.genomic_warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Strengths */}
              {matchResult.positive_findings && matchResult.positive_findings.length > 0 && (
                <div className={styles.card} style={{ borderColor: 'var(--teal)', background: 'var(--soft-teal)' }}>
                  <h3 className={styles.sectionTitle} style={{ color: 'var(--teal-d)', margin: '0 0 10px' }}>
                    <Award size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    Clinical Strengths & Positive Markers
                  </h3>
                  <ul style={{ paddingLeft: '24px', margin: 0, color: 'var(--ink)' }}>
                    {matchResult.positive_findings.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.metricsGrid}>
                {/* Current MFR 12m Cumulative Chance */}
                <div className={styles.metricCard} style={!hasOptimisation ? { gridColumn: 'span 2' } : {}}>
                  <div className={styles.metricLabel}>
                    Chance of Pregnancy in 12 Months (Year {selectedProjYear})
                  </div>
                  <div className={styles.metricValue}>
                    {matchResult.details.gate ? '\u2014' : `${cumCurY.toFixed(1)}%`}
                  </div>
                  <div className={styles.metricNote}>
                    {matchResult.details.gate ? '\u2014' : `Drop in success rate if you wait: -${declineCur.toFixed(1)}%`}
                  </div>
                </div>

                {/* Optimised MFR 12m Cumulative Chance (only show if suggestions exist) */}
                {hasOptimisation && (
                  <div className={styles.metricCard} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: '16px', textAlign: 'left' }}>
                    <div style={{ flex: '1' }}>
                      <div className={styles.metricLabel} style={{ marginBottom: '2px' }}>Chance of Pregnancy (With Lifestyle Improvements, Year {selectedProjYear})</div>
                      <div className={styles.metricValue} style={{ color: 'var(--teal-d)', fontSize: '24px' }}>
                        {matchResult.details.gate ? '\u2014' : `${cumOptY.toFixed(1)}%`}
                      </div>
                      <div className={styles.metricNote}>
                        {matchResult.details.gate ? '\u2014' : `Drop if you wait (optimised): -${declineOpt.toFixed(1)}%`}
                      </div>
                    </div>
                    <div style={{ flex: '1.2', borderLeft: '1px solid var(--line)', paddingLeft: '14px', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--teal-d)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        What to Optimise:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '12px', fontSize: '10.5px', color: 'var(--ink)', lineHeight: '1.3' }}>
                        {suggestions.map((item, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Range Slider for projection year (starts from Yr 0) */}
                <div className={styles.metricCard} style={{ gridColumn: 'span 2', padding: '10px 14px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span>Select Year to Start Trying:</span>
                    <span style={{ color: 'var(--ink)', fontWeight: '700' }}>Year {selectedProjYear} {selectedProjYear === 0 ? '(Today)' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={selectedProjYear}
                    onChange={(e) => setSelectedProjYear(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: 'var(--teal)',
                      cursor: 'pointer',
                      height: '5px',
                      margin: '6px 0 4px',
                      borderRadius: '2.5px',
                      background: 'var(--line)',
                      outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--muted)' }}>
                    <span>Year 0 (Today)</span>
                    <span>Year 2</span>
                    <span>Year 4</span>
                    <span>Year 6</span>
                    <span>Year 8</span>
                    <span>Year 10</span>
                  </div>
                </div>

                {/* Typical Time to Conceive (Dynamic with slider) */}
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Average Time to Get Pregnant</div>
                  <div className={styles.metricValue}>
                    {timeToConceiveY}
                  </div>
                  <div className={styles.metricNote}>
                    {matchResult.details.gate ? 'Pathways physically blocked' : `Expected months of trying (Year ${selectedProjYear})`}
                  </div>
                </div>

                {/* Cost of waiting Y years (Dynamic with slider) */}
                <div className={styles.metricCard}>
                  <div className={styles.metricLabel}>Loss in success rate by waiting {selectedProjYear} {selectedProjYear === 1 ? 'year' : 'years'}</div>
                  <div className={styles.metricValue} style={{ color: 'var(--amber-d)' }}>
                    {matchResult.details.gate ? '\u2014' : `-${declineCur.toFixed(1)}%`}
                  </div>
                  <div className={styles.metricNote}>
                    Drop in pregnancy chance compared to starting today
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>10-Year Fertility Decay Curve</h2>
                <p className={styles.subtitle} style={{ margin: '0 0 10px', textAlign: 'left', fontSize: '13px' }}>
                  Year-by-year monthly conception chance, current vs optimised lifestyle.
                </p>
                <div className={styles.svgChartContainer}>
                  {renderSvgChart(matchResult.projection.current, matchResult.projection.optimised)}
                </div>
                <div className={styles.chartLegend}>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: 'var(--amber)' }}></span>
                    Current Lifestyle Path
                  </span>
                  {hasOptimisation && (
                    <span className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: 'var(--teal)' }}></span>
                      Optimised Lifestyle Path
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>Clinician Assessment Summary</h2>
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '16px', borderRadius: '8px', lineHeight: '1.6' }}>
                  {matchResult.summary}
                </div>
              </div>

              {matchResult.calculations && (
                <div className={styles.traceSection}>
                  <div className={styles.traceHeader}>
                    <h2 className={styles.traceTitle}>In-depth Calculations Trace</h2>
                    <button 
                      onClick={() => setShowCalculations(!showCalculations)} 
                      className={styles.traceToggleBtn}
                    >
                      {showCalculations ? 'Hide Working Trace' : 'View Working Trace'}
                    </button>
                  </div>
                  {showCalculations && (
                    <div className={styles.traceContent}>
                      
                      <div className={styles.stepCard}>
                        <div className={styles.stepCardHeader}>
                          <span className={styles.stepNumber}>1</span>
                          <h3 className={styles.stepTitle}>Biological Score Components</h3>
                        </div>
                        <p style={{ fontSize: '14px', margin: '0 0 10px' }}>
                          Base interpolation curve from age, plus adjustments for reserve and semen:
                        </p>
                        <div className={styles.partnerGrid}>
                          <div className={styles.partnerTraceCard}>
                            <h4 className={styles.partnerTraceName} style={{ color: 'var(--info)' }}>
                              {maleManualData.name || 'Prospect 1'}
                            </h4>
                            <ul className={styles.mathResultList}>
                              <li><strong>Age Base Score:</strong> {matchResult.calculations.male_base_score.toFixed(1)}</li>
                              <li><strong>Semen Adj Points:</strong> {matchResult.calculations.male_semen_adj}</li>
                              <li><strong>Final Biological Score:</strong> {matchResult.calculations.male_final_score.toFixed(1)}</li>
                            </ul>
                          </div>
                          <div className={styles.partnerTraceCard}>
                            <h4 className={styles.partnerTraceName} style={{ color: 'var(--amber-d)' }}>
                              {femaleManualData.name || 'Prospect 2'}
                            </h4>
                            <ul className={styles.mathResultList}>
                              <li><strong>Age Base Score:</strong> {matchResult.calculations.female_base_score.toFixed(1)}</li>
                              <li><strong>Reserve Adj Points:</strong> {matchResult.calculations.female_reserve_adj}</li>
                              <li><strong>Final Biological Score:</strong> {matchResult.calculations.female_final_score.toFixed(1)}</li>
                            </ul>
                          </div>
                        </div>
                        <div style={{ marginTop: '14px' }}>
                          <strong>Combined Biological MFR Baseline:</strong> {(matchResult.calculations.bio_mfr * 100).toFixed(2)}%<br/>
                          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>(Formula: 0.6 * min(f, m) + 0.4 * max(f, m))</span>
                        </div>
                      </div>

                      <div className={styles.stepCard}>
                        <div className={styles.stepCardHeader}>
                          <span className={styles.stepNumber}>2</span>
                          <h3 className={styles.stepTitle}>Lifestyle Penalty & Timing Multipliers</h3>
                        </div>
                        <p style={{ fontSize: '14px', margin: '0 0 10px' }}>
                          Shared household lifestyle and frequency modify the biological base probability:
                        </p>
                        <ul className={styles.mathResultList}>
                          <li><strong>Shared Lifestyle Index (L):</strong> {matchResult.calculations.lifestyle_index} / 100</li>
                          <li><strong>Lifestyle Multiplier (&lambda;):</strong> {matchResult.calculations.lifestyle_multiplier_current.toFixed(3)}</li>
                          <li><strong>Frequency Multiplier:</strong> {matchResult.calculations.frequency_multiplier.toFixed(2)}</li>
                        </ul>
                      </div>

                      <div className={styles.stepCard}>
                        <div className={styles.stepCardHeader}>
                          <span className={styles.stepNumber}>3</span>
                          <h3 className={styles.stepTitle}>Absolute Barriers</h3>
                        </div>
                        <p style={{ fontSize: '14px', margin: '0 0 10px' }}>
                          Any absolute barriers physically prevent natural conception, overriding the model to zero.
                        </p>
                        <ul className={styles.mathResultList}>
                          <li><strong>Barrier present:</strong> {matchResult.details.gate ? 'Yes' : 'No'}</li>
                        </ul>
                      </div>

                      <div className={styles.stepCard}>
                        <div className={styles.stepCardHeader}>
                          <span className={styles.stepNumber}>4</span>
                          <h3 className={styles.stepTitle}>Final Year 0 Baseline Outputs</h3>
                        </div>
                        <ul className={styles.mathResultList}>
                          <li><strong>P_monthly_current:</strong> {(matchResult.calculations.p_monthly_current * 100).toFixed(2)}%</li>
                          <li><strong>P_monthly_optimised:</strong> {(matchResult.calculations.p_monthly_optimised * 100).toFixed(2)}%</li>
                          <li><strong>12-Month Current (Year 0):</strong> {matchResult.calculations.p_12m_current.toFixed(1)}%</li>
                          <li><strong>12-Month Optimised (Year 0):</strong> {matchResult.calculations.p_12m_optimised.toFixed(1)}%</li>
                        </ul>
                      </div>

                      <div className={styles.stepCard}>
                        <div className={styles.stepCardHeader}>
                          <span className={styles.stepNumber}>5</span>
                          <h3 className={styles.stepTitle}>Time-Horizon & Slider-Driven Calculations (Year {selectedProjYear})</h3>
                        </div>
                        <p style={{ fontSize: '14px', margin: '0 0 10px' }}>
                          Calculations for Year {selectedProjYear} starting parameters relative to Year 0 (Now):
                        </p>
                        <ul className={styles.mathResultList} style={{ lineHeight: '1.6' }}>
                          <li><strong>Selected Year MFR (Current):</strong> {matchResult.projection.current[selectedProjYear].toFixed(2)}%</li>
                          <li><strong>Selected Year MFR (Optimised):</strong> {matchResult.projection.optimised[selectedProjYear].toFixed(2)}%</li>
                          <li>
                            <strong>12-Month Cumulative Conception Chance (Current):</strong>
                            <br />
                            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                              Formula: 1 - (1 - MFR_Y)^12 = 1 - (1 - {(mfrCurY).toFixed(4)})^12 = <strong>{cumCurY.toFixed(2)}%</strong>
                            </span>
                          </li>
                          <li>
                            <strong>12-Month Cumulative Conception Chance (Optimised):</strong>
                            <br />
                            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                              Formula: 1 - (1 - MFR_Y_opt)^12 = 1 - (1 - {(mfrOptY).toFixed(4)})^12 = <strong>{cumOptY.toFixed(2)}%</strong>
                            </span>
                          </li>
                          <li>
                            <strong>Typical Time to Conceive (Current):</strong>
                            <br />
                            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                              Formula: 1 / MFR_Y = 1 / {(mfrCurY).toFixed(4)} = <strong>{timeToConceiveY}</strong> (rounded expected months)
                            </span>
                          </li>
                          <li>
                            <strong>Cost of Waiting to Year {selectedProjYear}:</strong>
                            <br />
                            <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                              Formula: Cum_0 - Cum_Y = {cumCur0.toFixed(2)}% - {cumCurY.toFixed(2)}% = <strong>-{declineCur.toFixed(2)}%</strong> (reduction in 12-month cumulative pregnancy success chance)
                            </span>
                          </li>
                        </ul>
                      </div>

                    </div>
                  )}
                </div>
              )}

              <button onClick={resetAll} className={styles.resetButton}>
                Clear Reports & Start Over
              </button>
            </section>
          );
        })()}
      </main>

      {matchResult && (
        <>
          <button
            onClick={() => setIsChatOpen(true)}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              border: 'none',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.25)';
            }}
          >
            <MessageSquare size={16} />
            Consult AI Counselor
          </button>
          <ReportChatDrawer
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            sessionId={chatSessionId}
            onSessionCreated={setChatSessionId}
            reportId={maleReport?.report_metadata?.report_id}
            partnerReportId={femaleReport?.report_metadata?.report_id}
            engineType="mfr"
            contextMetadata={{
              analysisResult: matchResult,
              malePathologyRaw: maleReport?.sections || null,
              femalePathologyRaw: femaleReport?.sections || null,
              maleRadiologyRaw: maleRadReport?.sections || null,
              femaleRadiologyRaw: femaleRadReport?.sections || null,
              maleGenomicsRaw: maleGenReport?.sections || null,
              femaleGenomicsRaw: femaleGenReport?.sections || null
            }}
          />
        </>
      )}
    </div>
  );
}
