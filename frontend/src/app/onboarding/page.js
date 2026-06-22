'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, Heart, Activity, Check, ChevronDown, 
  ArrowLeft, ArrowRight, Sparkles, Moon, Flame, 
  Beer, Briefcase, Footprints, Calendar, Trophy, Zap, Coffee 
} from 'lucide-react';
import { useCompatibility } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';

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

export default function OnboardingPage() {
  const router = useRouter();
  const { 
    user, setUser, 
    onboardingStep, setOnboardingStep, 
    onboardingForm, setOnboardingForm, 
    fetchRecentMatches 
  } = useCompatibility();

  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);

  // Dropdown open/close states
  const [isRelationDropdownOpen, setIsRelationDropdownOpen] = useState(false);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

  // Dropdown refs
  const relationDropdownRef = useRef(null);
  const genderDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const timeDropdownRef = useRef(null);

  const cn = (...classes) => classes.filter(Boolean).join(' ');

  // Redirect if user is not authenticated
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else if (onboardingStep === 0) {
      // If onboarding is already completed, go to dashboard
      const parsed = JSON.parse(savedUser);
      if (parsed.name && parsed.gender && parsed.activity_level) {
        router.push('/dashboard');
      } else {
        setOnboardingStep(1);
      }
    }
  }, [onboardingStep, router, setOnboardingStep]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (relationDropdownRef.current && !relationDropdownRef.current.contains(event.target)) {
        setIsRelationDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target)) {
        setIsGenderDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
        setIsTimeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    if (onboardingStep === 1) {
      if (!onboardingForm.userName || !onboardingForm.userRelation) {
        alert('Please fill out all fields in Step 1');
        return;
      }
      setOnboardingStep(2);
      if (onboardingForm.userRelation === 'Self') {
        setOnboardingForm(prev => ({ ...prev, candidateName: prev.userName }));
      }
    } else if (onboardingStep === 2) {
      if (!onboardingForm.candidateName || !onboardingForm.candidateGender || !onboardingForm.candidateDob || !onboardingForm.candidateCity || !onboardingForm.relationshipStatus || !onboardingForm.marriageTimeline) {
        alert('Please fill out all fields in Step 2');
        return;
      }
      setOnboardingStep(3);
    } else {
      if (!onboardingForm.activity_level || !onboardingForm.occupation_style || !onboardingForm.drinking_habits || !onboardingForm.smoking_habits || !onboardingForm.tobacco_habits || !onboardingForm.sleep_cycle || !onboardingForm.height || !onboardingForm.weight || !onboardingForm.waist) {
        alert('Please answer all lifestyle questions and metrics in Step 3');
        return;
      }
      setIsOnboardingSaving(true);
      try {
        const payload = {
          id: user.id,
          name: onboardingForm.candidateName,
          gender: onboardingForm.candidateGender,
          dob: onboardingForm.candidateDob,
          city: onboardingForm.candidateCity,
          activity_level: onboardingForm.activity_level,
          daily_steps: onboardingForm.daily_steps || '3,000 - 5,000',
          occupation_style: onboardingForm.occupation_style,
          drinking_habits: onboardingForm.drinking_habits,
          smoking_habits: onboardingForm.smoking_habits,
          tobacco_habits: onboardingForm.tobacco_habits,
          sleep_cycle: onboardingForm.sleep_cycle,
          height: onboardingForm.height,
          weight: onboardingForm.weight,
          waist: onboardingForm.waist
        };
        const res = await fetch(`${API_URL}/api/auth/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          const extendedUser = {
            ...data.user,
            userRelation: onboardingForm.userRelation,
            userName: onboardingForm.userName,
            candidateName: onboardingForm.candidateName,
            relationshipStatus: onboardingForm.relationshipStatus,
            marriageTimeline: onboardingForm.marriageTimeline,
            menstrualCycle: onboardingForm.menstrualCycle
          };
          localStorage.setItem('slayhealth_user', JSON.stringify(extendedUser));
          setUser(extendedUser);
          setOnboardingStep(0);
          fetchRecentMatches(user.id);
          router.push('/dashboard');
        } else {
          throw new Error(data.error || 'Failed to save profile');
        }
      } catch (err) {
        alert(err.message);
      } finally {
        setIsOnboardingSaving(false);
      }
    }
  };

  if (onboardingStep === 0) return null;

  const isSelf = onboardingForm.userRelation === 'Self';

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tell us about yourself</h1>
          <p className="text-slate-600">These parameters calibrate SlayHealth's glycemic risk engines and metabolic projections.</p>
          
          {/* Step indicator dots */}
          <div className="flex justify-center gap-3 mt-4">
            <div className={cn("w-8 h-2 rounded-full transition-colors duration-300", onboardingStep >= 1 ? "bg-[#DE457D]" : "bg-slate-200")} />
            <div className={cn("w-8 h-2 rounded-full transition-colors duration-300", onboardingStep >= 2 ? "bg-[#DE457D]" : "bg-slate-200")} />
            <div className={cn("w-8 h-2 rounded-full transition-colors duration-300", onboardingStep >= 3 ? "bg-[#DE457D]" : "bg-slate-200")} />
          </div>
        </div>

        <form onSubmit={handleOnboardingSubmit} className="space-y-6">
          {/* Step 1: Your Information */}
          {onboardingStep === 1 && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <User className="w-6 h-6 text-[#DE457D]" />
                Step 1: Your Information
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={onboardingForm.userName || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, userName: e.target.value })}
                    placeholder="Enter your name"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none transition-all text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Who are you in relation to the person getting married?
                  </label>
                  <div className="relative" ref={relationDropdownRef}>
                    <button
                      type="button"
                      className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none transition-all bg-white flex justify-between items-center text-slate-900"
                      onClick={() => setIsRelationDropdownOpen(!isRelationDropdownOpen)}
                    >
                      <span className={cn(!onboardingForm.userRelation && "text-slate-400")}>
                        {onboardingForm.userRelation || "Select your relation"}
                      </span>
                      <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isRelationDropdownOpen && "rotate-180")} />
                    </button>
                    
                    {isRelationDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                        {['Self', 'Parents', 'Siblings', 'Friends', 'Relatives'].map((relation) => (
                          <button
                            key={relation}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => {
                              setOnboardingForm({
                                ...onboardingForm,
                                userRelation: relation,
                                candidateName: relation === 'Self' ? onboardingForm.userName : onboardingForm.candidateName
                              });
                              setIsRelationDropdownOpen(false);
                            }}
                          >
                            <span className={cn("font-medium", onboardingForm.userRelation === relation ? "text-[#DE457D]" : "text-slate-700")}>
                              {relation}
                            </span>
                            {onboardingForm.userRelation === relation && <Check className="w-4 h-4 text-[#DE457D]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Details of the Person Getting Married */}
          {onboardingStep === 2 && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Heart className="w-6 h-6 text-pink-500" />
                Step 2: {isSelf ? 'Your Details' : 'Details of the person getting married'}
              </h2>

              <div className="space-y-5">
                {!isSelf && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={onboardingForm.candidateName || ''}
                      onChange={(e) => setOnboardingForm({ ...onboardingForm, candidateName: e.target.value })}
                      placeholder="Enter their name"
                      className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none transition-all text-slate-900"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                  <div className="relative" ref={genderDropdownRef}>
                    <button
                      type="button"
                      className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none transition-all bg-white flex justify-between items-center text-slate-900"
                      onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
                    >
                      <span className={cn(!onboardingForm.candidateGender && "text-slate-400")}>
                        {onboardingForm.candidateGender || "Select Gender"}
                      </span>
                      <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isGenderDropdownOpen && "rotate-180")} />
                    </button>

                    {isGenderDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                        {["Male", "Female", "Other"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => {
                              setOnboardingForm({ ...onboardingForm, candidateGender: g });
                              setIsGenderDropdownOpen(false);
                            }}
                          >
                            <span className={cn("font-medium", onboardingForm.candidateGender === g ? "text-[#DE457D]" : "text-slate-700")}>{g}</span>
                            {onboardingForm.candidateGender === g && <Check className="w-4 h-4 text-[#DE457D]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={onboardingForm.candidateDob || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, candidateDob: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none bg-white text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    value={onboardingForm.candidateCity || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, candidateCity: e.target.value })}
                    placeholder="Search or enter city"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Status</label>
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      type="button"
                      className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none bg-white flex justify-between items-center text-slate-900"
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    >
                      <span className={cn(!onboardingForm.relationshipStatus && "text-slate-500")}>
                        {onboardingForm.relationshipStatus || "Select Status"}
                      </span>
                      <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isStatusDropdownOpen && "rotate-180")} />
                    </button>

                    {isStatusDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                        {["Single", "Engaged", "In a Relationship"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => {
                              setOnboardingForm({ ...onboardingForm, relationshipStatus: status });
                              setIsStatusDropdownOpen(false);
                            }}
                          >
                            <span className={cn("font-medium", onboardingForm.relationshipStatus === status ? "text-[#DE457D]" : "text-slate-700")}>{status}</span>
                            {onboardingForm.relationshipStatus === status && <Check className="w-4 h-4 text-[#DE457D]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">When is the marriage planned?</label>
                  <div className="relative" ref={timeDropdownRef}>
                    <button
                      type="button"
                      className="w-full p-3 text-left border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#DE457D] focus:border-[#DE457D] outline-none bg-white flex justify-between items-center text-slate-900"
                      onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                    >
                      <span className={cn(!onboardingForm.marriageTimeline && "text-slate-500")}>
                        {onboardingForm.marriageTimeline || "Select Timeline"}
                      </span>
                      <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", isTimeDropdownOpen && "rotate-180")} />
                    </button>

                    {isTimeDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
                        {["Within 6 months", "6 - 12 months", "1 - 2 years", "2+ years", "Not sure yet"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between"
                            onClick={() => {
                              setOnboardingForm({ ...onboardingForm, marriageTimeline: option });
                              setIsTimeDropdownOpen(false);
                            }}
                          >
                            <span className={cn("font-medium", onboardingForm.marriageTimeline === option ? "text-[#DE457D]" : "text-slate-700")}>{option}</span>
                            {onboardingForm.marriageTimeline === option && <Check className="w-4 h-4 text-[#DE457D]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Lifestyle & Habits */}
          {onboardingStep === 3 && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-500" />
                Step 3: Lifestyle & Habits
              </h2>

              {/* Metrics: Height, Weight, Waist */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Height (cm)</label>
                  <input
                    type="number"
                    placeholder="e.g. 175"
                    value={onboardingForm.height || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, height: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Weight (kg)</label>
                  <input
                    type="number"
                    placeholder="e.g. 70"
                    value={onboardingForm.weight || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, weight: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Waist (inches)</label>
                  <input
                    type="number"
                    placeholder="e.g. 32"
                    value={onboardingForm.waist || ''}
                    onChange={(e) => setOnboardingForm({ ...onboardingForm, waist: e.target.value })}
                    className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#DE457D] bg-white text-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Physical Activity Level */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  <label className="block text-sm font-bold text-slate-800">Activity Level</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {LIFESTYLE_ACTIVITIES.map(opt => {
                    const IconComponent = opt.icon;
                    const isSelected = onboardingForm.activity_level === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, activity_level: opt.val })}
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
                    const isSelected = onboardingForm.daily_steps === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, daily_steps: opt.val })}
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
                    const isSelected = onboardingForm.occupation_style === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, occupation_style: opt.val })}
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
                    const isSelected = onboardingForm.drinking_habits === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, drinking_habits: opt.val })}
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
                    const isSelected = onboardingForm.smoking_habits === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, smoking_habits: opt.val })}
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
                    const isSelected = onboardingForm.tobacco_habits === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, tobacco_habits: opt.val })}
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
                    const isSelected = onboardingForm.sleep_cycle === opt.val;
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
                        onClick={() => setOnboardingForm({ ...onboardingForm, sleep_cycle: opt.val })}
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
              {onboardingForm.candidateGender === 'Female' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-pink-500" />
                    <label className="block text-sm font-bold text-slate-800">Menstrual Cycle Status (Optional)</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {LIFESTYLE_MENSTRUAL.map(opt => {
                      const IconComponent = opt.icon;
                      const isSelected = onboardingForm.menstrualCycle === opt.val;
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
                          onClick={() => setOnboardingForm({ ...onboardingForm, menstrualCycle: opt.val })}
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
          )}

          {/* Form actions */}
          <div className="flex justify-between items-center pt-4">
            {onboardingStep > 1 ? (
              <button
                type="button"
                onClick={() => setOnboardingStep(prev => prev - 1)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}
            
            <button
              type="submit"
              disabled={isOnboardingSaving}
              className="bg-[#DE457D] hover:bg-[#c93d6f] text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-pink-500/25 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isOnboardingSaving ? 'Saving...' : (onboardingStep === 3 ? 'Complete Onboarding' : 'Continue')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
