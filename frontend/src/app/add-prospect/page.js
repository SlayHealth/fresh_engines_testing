'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, LogOut, Activity, MessageSquare, User, Lock, 
  MapPin, Heart, ChevronDown, Check, ArrowLeft, ArrowRight,
  FlaskConical, AlertCircle, RefreshCw, Trophy, Zap, Footprints,
  Briefcase, Beer, Moon, Flame, Coffee, Calendar, Users
} from 'lucide-react';
import { useCompatibility, calculateAge, classifyWaist } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import styles from '../page.module.css';

const LIFESTYLE_ACTIVITIES = [
  { val: 'Sedentary', label: 'Sedentary', desc: 'Little to no regular exercise', icon: Coffee },
  { val: 'Moderate', label: 'Moderate', desc: 'Light exercise 1-3 times/week', icon: Footprints },
  { val: 'Active', label: 'Active', desc: 'Exercise 3-5 times/week', icon: Zap },
  { val: 'Athletic', label: 'Athletic', desc: 'Daily intense exercise/sports', icon: Trophy }
];

const LIFESTYLE_STEPS = [
  { val: '<3,000', label: 'Less than 3,000', desc: 'Mostly sitting', icon: Footprints },
  { val: '3,000 - 5,000', label: '3,000 - 5,000', desc: 'Light walking', icon: Footprints },
  { val: '5,000 - 10,000', label: '5,000 - 10,000', desc: 'Active day', icon: Footprints },
  { val: '10,000+', label: '10,000+', desc: 'Very active', icon: Footprints }
];

const LIFESTYLE_OCCUPATIONS = [
  { val: 'Sitting 8h+', label: 'Sitting 8h+', desc: 'Desk bound, high sedentary time', icon: Briefcase },
  { val: 'Sitting 4h+', label: 'Sitting 4h+', desc: 'Moderate movement during work', icon: Briefcase },
  { val: 'travelling', label: 'Travelling', desc: 'On the move frequently', icon: Briefcase },
  { val: 'other', label: 'Other', desc: 'Varying work environment', icon: Briefcase }
];

const LIFESTYLE_DRINKING = [
  { val: 'Never', label: 'Never', desc: 'No alcohol consumption', icon: Beer },
  { val: 'socially', label: 'Socially', desc: 'Occasional drinks with company', icon: Beer },
  { val: 'regularly', label: 'Regularly', desc: 'Regular weekly drinks', icon: Beer },
  { val: 'heavily', label: 'Heavily', desc: 'High frequency/binge drinking', icon: Beer },
  { val: 'other', label: 'Other', desc: 'Varying patterns', icon: Beer }
];

const LIFESTYLE_SMOKING = [
  { val: 'never', label: 'Never', desc: 'No tobacco smoking', icon: Flame },
  { val: 'occasion', label: 'Occasion', desc: 'Occasional social smoking', icon: Flame },
  { val: 'regular', label: 'Regular', desc: 'Daily smoking', icon: Flame },
  { val: 'chain', label: 'Chain', desc: 'High frequency smoking', icon: Flame }
];

const LIFESTYLE_TOBACCO = [
  { val: 'never', label: 'Never', desc: 'No tobacco use', icon: Sparkles },
  { val: 'occasional', label: 'Occasional', desc: 'Occasional usage', icon: Sparkles },
  { val: 'regular', label: 'Regular', desc: 'Daily usage', icon: Sparkles }
];

const LIFESTYLE_SLEEP = [
  { val: 'Early Bird', label: 'Early Bird', desc: 'Sleep early, wake early', icon: Moon },
  { val: 'night owl', label: 'Night Owl', desc: 'Sleep late, wake late', icon: Moon },
  { val: 'irregular', label: 'Irregular', desc: 'Shifting sleep schedule', icon: Moon },
  { val: 'insomniac', label: 'Insomniac', desc: 'Difficulty sleeping', icon: Moon }
];

const LIFESTYLE_MENSTRUAL = [
  { val: 'Regular', label: 'Regular', desc: 'Normal cycle monthly pattern', icon: Calendar },
  { val: 'Irregular', label: 'Irregular', desc: 'Inconsistent start times', icon: Calendar },
  { val: 'Menopause', label: 'Menopause', desc: 'Permanent cessation of cycle', icon: Calendar },
  { val: 'Other', label: 'Other', desc: 'Other patterns', icon: Calendar }
];

export default function AddProspectPage() {
  const router = useRouter();
  const { 
    user, 
    runsUsed, 
    chatsUsed, 
    isUpgradingQuota, 
    handleResetQuota, 
    handleLogout,
    prospectForm, 
    setProspectForm,
    userReport, 
    setUserReport,
    prospectReport, 
    setProspectReport,
    isUserUploading, 
    setIsUserUploading,
    isProspectUploading, 
    setIsProspectUploading,
    userUploadError, 
    setUserUploadError,
    prospectUploadError, 
    setProspectUploadError,
    isMatching,
    matchError, 
    setMatchError,
    handleCompatibilityMatch
  } = useCompatibility();

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  // Dropdown States
  const [isProspectGenderDropdownOpen, setIsProspectGenderDropdownOpen] = useState(false);
  const [isMeetingDropdownOpen, setIsMeetingDropdownOpen] = useState(false);
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);

  // Refs
  const prospectGenderDropdownRef = useRef(null);
  const meetingDropdownRef = useRef(null);
  const platformDropdownRef = useRef(null);
  const userFileInputRef = useRef(null);
  const prospectFileInputRef = useRef(null);

  // Auth check & Redirect
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    }
  }, [router]);

  // Click outside dropdowns handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (prospectGenderDropdownRef.current && !prospectGenderDropdownRef.current.contains(event.target)) {
        setIsProspectGenderDropdownOpen(false);
      }
      if (meetingDropdownRef.current && !meetingDropdownRef.current.contains(event.target)) {
        setIsMeetingDropdownOpen(false);
      }
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target)) {
        setIsPlatformDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute User BMI dynamically
  const userBmi = useMemo(() => {
    if (!user || !user.weight || !user.height) return null;
    const heightInMeters = user.height / 100;
    return parseFloat((user.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }, [user]);

  // File Upload parsing
  const handleFileUpload = async (file, isProspect) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid pathology report (PDF).');
      return;
    }

    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setError = isProspect ? setProspectUploadError : setUserUploadError;
    const setReport = isProspect ? setProspectReport : setUserReport;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch(`${API_URL}/api/pathology/extract`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Pathology extraction failed');
      }

      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger Mock extraction
  const triggerMockData = async (isProspect) => {
    const setIsUploading = isProspect ? setIsProspectUploading : setIsUserUploading;
    const setError = isProspect ? setProspectUploadError : setUserUploadError;
    const setReport = isProspect ? setProspectReport : setUserReport;

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/pathology/mock-extract`);
      const data = await response.json();
      if (data.success) {
        setReport(data);
      } else {
        throw new Error(data.error || 'Failed to get mock extraction');
      }
    } catch (err) {
      setError(err.message || 'Mock extraction failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMatch = async () => {
    const success = await handleCompatibilityMatch();
    if (success) {
      router.push('/core-engine/chronic');
    }
  };

  if (!user) return null;

  return (
    <main className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Portal Header */}
      <header className={styles.portalHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} style={{ color: '#28c79a' }} />
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#2b2b3f', margin: 0 }}>SlayHealth Premarital Portal</h1>
        </div>
        
        <div className={styles.userInfoBadge}>
          <div className={styles.userAvatar}>
            {user.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#2b2b3f' }}>{user.name || 'User Profile'}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{user.phone_number}</span>
          </div>
          <button className={styles.logoutBtn} onClick={() => { handleLogout(); router.push('/'); }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Free Tier Quota Panel */}
      <section className={styles.quotaWidget}>
        <div className={styles.quotaText}>
          <h3 className={styles.quotaTitle}>Free Plan Active</h3>
          <p className={styles.quotaSubtitle}>Enrolled by default. Experience our clinical match matrix and counselor chat.</p>
        </div>

        <div className={styles.quotaBadgesList}>
          <span className={styles.quotaLimitBadge}>
            <Activity size={14} style={{ color: '#28c79a' }} />
            Match scan left: <strong>{Math.max(0, 1 - runsUsed)}/1</strong>
          </span>
          <span className={styles.quotaLimitBadge}>
            <MessageSquare size={14} style={{ color: '#d94386' }} />
            Counselor chat left: <strong>{Math.max(0, 5 - chatsUsed)}/5</strong>
          </span>
          
          {(runsUsed > 0 || chatsUsed > 0) && (
            <button 
              className={styles.upgradeTextBtn} 
              onClick={handleResetQuota}
              disabled={isUpgradingQuota}
            >
              {isUpgradingQuota ? 'Resetting...' : 'Reset Quota / Demo Premium'}
            </button>
          )}
        </div>
      </section>

      {/* Add Prospect Workspace */}
      <div className="max-w-4xl mx-auto mt-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">New Compatibility Check</h1>
          <p className="text-slate-600 font-medium text-sm">Add your prospect's details and medical reports to begin the match scan</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Your Information (Locked) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-fit text-left">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
              <User className="w-5 h-5 text-primary" style={{ color: '#DE457D' }} />
              <h2 className="text-lg font-bold text-slate-900">Your Information</h2>
              <Lock className="w-4 h-4 text-slate-400 ml-auto" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                  {user.name}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Age</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                    {calculateAge(user.dob)} Yrs
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gender</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium capitalize">
                    {user.gender}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">City</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium capitalize">
                    {user.city}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">BMI</label>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 border border-slate-200 text-sm font-medium">
                    {userBmi} ({userBmi >= 25 ? 'High' : userBmi >= 23 ? 'Borderline' : 'Normal'})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Prospect Information Form */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5 text-left">
            <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
              <Users className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-bold text-slate-900">Prospect Information</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
              <input
                type="text"
                placeholder="Enter prospect's name"
                value={prospectForm.name || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, name: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
              <div className="relative" ref={prospectGenderDropdownRef}>
                <button
                  type="button"
                  className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] outline-none bg-white flex justify-between items-center text-slate-900"
                  onClick={() => setIsProspectGenderDropdownOpen(!isProspectGenderDropdownOpen)}
                >
                  <span className={cn(!prospectForm.gender && "text-slate-400")}>
                    {prospectForm.gender || "Select Gender"}
                  </span>
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                </button>

                {isProspectGenderDropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                    {["Male", "Female", "Other"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                        onClick={() => {
                          setProspectForm({ ...prospectForm, gender: g });
                          setIsProspectGenderDropdownOpen(false);
                        }}
                      >
                        <span className={cn("font-medium", prospectForm.gender === g ? "text-[#DE457D]" : "text-slate-700")}>{g}</span>
                        {prospectForm.gender === g && <Check className="w-4 h-4 text-[#DE457D]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">DOB</label>
                <input
                  type="date"
                  value={prospectForm.dob || ''}
                  onChange={(e) => setProspectForm({ ...prospectForm, dob: e.target.value })}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                <input
                  type="text"
                  placeholder="Enter city"
                  value={prospectForm.city || ''}
                  onChange={(e) => setProspectForm({ ...prospectForm, city: e.target.value })}
                  className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] text-slate-900"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* How Did You Meet & Relationship Context */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-4 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Heart className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900">How did you meet?</h2>
          </div>

          <div className="relative" ref={meetingDropdownRef}>
            <button
              type="button"
              className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] bg-white flex justify-between items-center text-slate-900"
              onClick={() => setIsMeetingDropdownOpen(!isMeetingDropdownOpen)}
            >
              <span className={cn(!prospectForm.meetingSource && "text-slate-400")}>
                {prospectForm.meetingSource || "Select how you met"}
              </span>
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </button>

            {isMeetingDropdownOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                {["Family Introduction", "Matrimonial Platform", "Work/College", "Friends", "Other"].map((source) => (
                  <button
                    key={source}
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => {
                      setProspectForm({ ...prospectForm, meetingSource: source, platformName: source !== 'Matrimonial Platform' ? '' : prospectForm.platformName });
                      setIsMeetingDropdownOpen(false);
                    }}
                  >
                    <span className={cn("font-medium", prospectForm.meetingSource === source ? "text-[#DE457D]" : "text-slate-700")}>{source}</span>
                    {prospectForm.meetingSource === source && <Check className="w-4 h-4 text-[#DE457D]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {prospectForm.meetingSource === 'Matrimonial Platform' && (
            <div className="relative" ref={platformDropdownRef}>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Platform Name</label>
              <button
                type="button"
                className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] bg-white flex justify-between items-center text-slate-900"
                onClick={() => setIsPlatformDropdownOpen(!isPlatformDropdownOpen)}
              >
                <span className={cn(!prospectForm.platformName && "text-slate-400")}>
                  {prospectForm.platformName || "Select platform"}
                </span>
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </button>

              {isPlatformDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                  {["Shaadi.com", "BharatMatrimony", "Jeevansathi", "Elite Matrimony", "Other"].map((platform) => (
                    <button
                      key={platform}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                      onClick={() => {
                        setProspectForm({ ...prospectForm, platformName: platform });
                        setIsPlatformDropdownOpen(false);
                      }}
                    >
                      <span className={cn("font-medium", prospectForm.platformName === platform ? "text-[#DE457D]" : "text-slate-700")}>{platform}</span>
                      {prospectForm.platformName === platform && <Check className="w-4 h-4 text-[#DE457D]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {prospectForm.meetingSource && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tell us your story (optional)</label>
              <textarea
                value={prospectForm.meetingStory || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, meetingStory: e.target.value })}
                placeholder="Share how you met, what drew you together..."
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] resize-none h-24 text-slate-900"
              />
            </div>
          )}
        </div>

        {/* Prospect Lifestyle & Metrics Form */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-6 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Activity className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-bold text-slate-900">Prospect Lifestyle & Habits</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Height (cm)</label>
              <input
                type="number"
                placeholder="e.g. 175"
                value={prospectForm.height || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, height: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Weight (kg)</label>
              <input
                type="number"
                placeholder="e.g. 70"
                value={prospectForm.weight || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, weight: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Waist (inches)</label>
              <input
                type="number"
                placeholder="e.g. 32"
                value={prospectForm.waist || ''}
                onChange={(e) => setProspectForm({ ...prospectForm, waist: e.target.value })}
                className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                required
              />
            </div>
          </div>

          {/* Habits Grid */}
          <div className="space-y-4">
            {/* Physical Activity Level */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <label className="block text-sm font-bold text-slate-800">Physical Activity Level</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_ACTIVITIES.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.activity_level === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, activity_level: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-emerald-500" />
                <label className="block text-sm font-bold text-slate-800">Daily Steps</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_STEPS.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.daily_steps === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, daily_steps: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Occupation Style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-teal-500" />
                <label className="block text-sm font-bold text-slate-800">Occupation & Work Style</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_OCCUPATIONS.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.occupation_style === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, occupation_style: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drinking habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Beer className="w-5 h-5 text-amber-500" />
                <label className="block text-sm font-bold text-slate-800">Alcohol Drinking Habits</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_DRINKING.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.drinking_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, drinking_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smoking habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                <label className="block text-sm font-bold text-slate-800">Smoking Habits</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_SMOKING.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.smoking_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, smoking_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tobacco habits */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                <label className="block text-sm font-bold text-slate-800">Tobacco consumption (Chewing/etc)</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_TOBACCO.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.tobacco_habits === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, tobacco_habits: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sleep cycle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-indigo-500" />
                <label className="block text-sm font-bold text-slate-800">Sleep Cycle patterns</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LIFESTYLE_SLEEP.map(opt => {
                  const IconComponent = opt.icon;
                  const isSelected = prospectForm.sleep_cycle === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                        isSelected
                          ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                          : "border-slate-200 bg-white hover:bg-slate-50/60"
                      )}
                      onClick={() => setProspectForm({ ...prospectForm, sleep_cycle: opt.val })}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menstrual cycle (conditional if female) */}
            {prospectForm.gender === 'Female' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-pink-500" />
                  <label className="block text-sm font-bold text-slate-800">Menstrual Cycle Status (Optional)</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LIFESTYLE_MENSTRUAL.map(opt => {
                    const IconComponent = opt.icon;
                    const isSelected = prospectForm.menstrualCycle === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border text-left cursor-pointer transition-all w-full",
                          isSelected
                            ? "border-[#DE457D] bg-pink-50/20 ring-1 ring-[#DE457D]"
                            : "border-slate-200 bg-white hover:bg-slate-50/60"
                        )}
                        onClick={() => setProspectForm({ ...prospectForm, menstrualCycle: opt.val })}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="block font-bold text-slate-800 text-sm">{opt.label}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{opt.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pathology Uploader */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 space-y-4 text-left">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <FlaskConical className="w-5 h-5 text-primary" style={{ color: '#DE457D' }} />
            <h2 className="text-lg font-bold text-slate-900">Upload Pathology Reports</h2>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Upload blood & pathology files containing parameters like HbA1c, Lipids, AMH or Semen readings.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Your Pathology PDF</span>
              <button
                type="button"
                onClick={() => userFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  userReport ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                {isUserUploading ? 'Parsing PDF...' : userReport ? 'My Report ✓' : 'Upload My PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockData(false)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-[#DE457D] cursor-pointer"
              >
                Trigger My Mock Report
              </button>
            </div>

            <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block">Prospect's Pathology PDF</span>
              <button
                type="button"
                onClick={() => prospectFileInputRef.current.click()}
                className={cn(
                  "w-full py-2 px-3 rounded-lg border font-semibold text-xs transition-all",
                  prospectReport ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                )}
              >
                {isProspectUploading ? 'Parsing PDF...' : prospectReport ? 'Prospect PDF ✓' : 'Upload Prospect PDF'}
              </button>
              <button
                type="button"
                onClick={() => triggerMockData(true)}
                className="text-[10px] text-slate-500 underline block mx-auto hover:text-[#DE457D] cursor-pointer"
              >
                Trigger Prospect Mock Report
              </button>
            </div>
          </div>

          <input type="file" ref={userFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], false)} />
          <input type="file" ref={prospectFileInputRef} style={{ display: 'none' }} accept=".pdf" onChange={(e) => handleFileUpload(e.target.files[0], true)} />
        </div>

        {matchError && (
          <div className="mt-6 p-4 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 flex items-center gap-2 text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{matchError}</p>
          </div>
        )}

        {/* Form navigation buttons */}
        <div className="mt-8 flex justify-between items-center pb-12">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          
          <button
            onClick={handleMatch}
            disabled={!userReport || !prospectReport || isMatching || runsUsed >= 1}
            className="bg-[#DE457D] hover:bg-[#c93d6f] text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-pink-500/25 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 text-sm"
          >
            {isMatching ? 'Generating...' : 'Generate Insights'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </main>
  );
}
