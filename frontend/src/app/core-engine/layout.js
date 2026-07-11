'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Sparkles, Settings, Activity, MessageSquare, HeartPulse,
  ShieldCheck, ArrowLeft, RotateCcw, Brain, Download,
  LayoutDashboard, Heart, Dna, HelpCircle, Menu, X
} from 'lucide-react';
import { useCompatibility } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { getAccessToken, apiFetch } from '../../utils/api';
import styles from '../page.module.css';
import ReportChatDrawer from '../../components/ReportChatDrawer';

// Users choose a projection checkpoint, not a raw month/year count — only these
// stops are ever selectable, though the underlying model still computes (and the
// "In-depth Calculations" trace still shows) every year 0-10 under the hood.
const PROJECTION_YEARS = [0, 3, 5, 7, 10];

export default function CoreEngineLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { 
    user, 
    runsUsed, 
    chatsUsed, 
    isUpgradingQuota, 
    handleResetQuota,
    chronicResult,
    mfrResult,
    mentalResult,
    selectedProjYear,
    setSelectedProjYear,
    isChatOpen,
    setIsChatOpen,
    chatSessionId,
    setChatSessionId,
    prospectForm,
    userReport,
    prospectReport,
    setChronicResult,
    setMfrResult,
    setMentalResult,
    setActiveMatchId,
    activeMatchId
  } = useCompatibility();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth & Data guards
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else if (!chronicResult || !mfrResult) {
      router.push('/dashboard');
    }
  }, [router, chronicResult, mfrResult]);

  // Determine active tab from current route path
  const selectedTab = useMemo(() => {
    if (pathname.includes('/story')) return 'story';
    if (pathname.includes('/mfr')) return 'mfr';
    if (pathname.includes('/usg')) return 'usg';
    if (pathname.includes('/genomics')) return 'genomics';
    if (pathname.includes('/mental')) return 'mental';
    return 'chronic';
  }, [pathname]);

  const handleTabClick = (tab) => {
    setIsMobileMenuOpen(false);
    router.push(`/core-engine/${tab}`);
  };

  // Combine metadata bundle to pass to chatbot drawer
  const combinedContextMetadata = useMemo(() => {
    if (!chronicResult && !mfrResult) return null;
    return {
      chronicResult,
      mfrResult,
      mentalResult,
      userProfile: user,
      prospectProfile: prospectForm,
      userPathologyRaw: userReport?.sections || null,
      prospectPathologyRaw: prospectReport?.sections || null
    };
  }, [chronicResult, mfrResult, mentalResult, user, prospectForm, userReport, prospectReport]);

  const partnerAName = user?.name || 'Partner A';
  const partnerBName = prospectForm?.name || 'Partner B';
  const coupleHeader = partnerAName && partnerBName 
    ? `${partnerAName} & ${partnerBName}` 
    : 'Your health';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => router.push('/dashboard') },
    { id: 'story', label: 'Partner Sync', icon: HeartPulse, action: () => handleTabClick('story') },
    { id: 'mfr', label: 'Fertility Timeline', icon: Heart, action: () => handleTabClick('mfr') },
    { id: 'chronic', label: 'Chronic Risk', icon: Activity, action: () => handleTabClick('chronic') },
    { id: 'mental', label: 'Stress Resilience', icon: Brain, action: () => handleTabClick('mental') },
    { id: 'usg', label: 'Organ Wellness', icon: ShieldCheck, action: () => handleTabClick('usg') },
    { id: 'genomics', label: 'Genetics Risk', icon: Dna, action: () => handleTabClick('genomics') },
  ];

  if (!user || !chronicResult || !mfrResult) return null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-(--paper) overflow-hidden">
      
      {/* Mobile Top Header (hidden on desktop) */}
      <header className="lg:hidden bg-white border-b border-(--line) px-6 py-4 flex items-center justify-between z-20 sticky top-0 shadow-sm font-sans">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-(--teal)" />
          <span className="font-serif font-bold text-lg text-slate-800 tracking-tight">SlayHealth</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 focus:outline-none"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation Panel (Desktop layout) */}
      <aside className="hidden lg:flex flex-col justify-between w-64 h-screen bg-white border-r border-(--line) p-6 sticky top-0 flex-shrink-0 font-sans select-none">
        
        {/* Top block */}
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6 px-1">
            <Sparkles size={22} className="text-(--teal)" />
            <span className="font-serif font-bold text-xl text-slate-800 tracking-tight">SlayHealth</span>
          </div>

          {/* Couple avatar card */}
          <div className="border border-(--line) bg-slate-50/50 rounded-2xl p-3 flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-(--soft-teal) border border-(--teal)/25 flex items-center justify-center flex-shrink-0 text-xl">
              👩‍❤️‍👨
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-800 truncate font-sans">{coupleHeader}</h4>
              <span className="text-[9px] font-semibold text-slate-400 block tracking-wider uppercase font-sans mt-0.5">
                Premium Health Tier
              </span>
            </div>
          </div>

          {/* Nav List */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = selectedTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-(--pink) text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom block */}
        <div className="border-t border-(--line) pt-4 space-y-4">
          <button 
            className="w-full bg-(--teal) hover:bg-(--teal-d) text-white py-2.5 px-4 rounded-xl font-bold text-xs transition-all duration-300 shadow-sm shadow-(--teal)/10 cursor-pointer flex items-center justify-center gap-1.5 font-sans"
            onClick={handleResetQuota}
            disabled={isUpgradingQuota}
          >
            {isUpgradingQuota ? 'Resetting...' : 'Upgrade Plan'}
          </button>
          
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer">
              <HelpCircle size={14} className="text-slate-400" />
              Support
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              <Settings size={14} className="text-slate-400" />
              Profile
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex font-sans">
          {/* Backdrop click dismiss */}
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          
          <div className="relative flex flex-col justify-between w-64 max-w-xs bg-white h-full p-6 shadow-xl animate-fade-in-left">
            <div>
              {/* Couple Info */}
              <div className="border border-(--line) bg-slate-50/50 rounded-2xl p-3 flex items-center gap-3 mb-6 mt-4">
                <div className="w-10 h-10 rounded-xl bg-(--soft-teal) border border-(--teal)/25 flex items-center justify-center flex-shrink-0 text-lg">
                  👩‍❤️‍👨
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-800 truncate">{coupleHeader}</h4>
                  <span className="text-[9px] font-semibold text-slate-400 block tracking-wider uppercase">
                    Premium Health Tier
                  </span>
                </div>
              </div>

              {/* Navigation list items */}
              <nav className="space-y-1.5">
                {menuItems.map((item) => {
                  const isActive = selectedTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                        isActive 
                          ? 'bg-(--pink) text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-(--line) pt-4 space-y-4">
              <button 
                className="w-full bg-(--teal) hover:bg-(--teal-d) text-white py-2.5 px-4 rounded-xl font-bold text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5"
                onClick={handleResetQuota}
                disabled={isUpgradingQuota}
              >
                {isUpgradingQuota ? 'Resetting...' : 'Upgrade Plan'}
              </button>
              
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer">
                  <HelpCircle size={14} className="text-slate-400" />
                  Support
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); router.push('/profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  <Settings size={14} className="text-slate-400" />
                  Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace Panel */}
      <main className="flex-1 min-w-0 bg-(--paper) overflow-y-auto h-screen p-6 sm:p-10 pb-24 flex flex-col justify-between">
        
        {/* Right header block */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-(--line)">
            <div>
              <h2 className="text-2xl font-normal text-slate-800 font-serif tracking-tight">Premarital Sync</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans font-medium">
                A comprehensive, projected view of your joint health trajectory based on combined medical profiles.
              </p>
            </div>
            
            {/* Quick Actions (Dashboard navigation and PDF) */}
            <div className="flex items-center gap-3 select-none">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer shadow-sm font-sans"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              {activeMatchId && (
                <a
                  href={`${API_URL}/api/compatibility/matches/${activeMatchId}/pdf?token=${getAccessToken()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-white bg-(--teal) hover:bg-(--teal-d) px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer shadow-sm font-sans"
                >
                  <Download size={14} />
                  Download PDF Report
                </a>
              )}
            </div>
          </div>

          {/* Quota limit warnings */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl mt-4 text-[10px] text-slate-500 font-sans font-semibold">
            <span>Free Plan Active</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>Match scan: {Math.max(0, 1 - runsUsed)}/1 left</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>Counselor chat: {Math.max(0, 5 - chatsUsed)}/5 left</span>
          </div>
        </div>

        {/* Tab main child page content panel */}
        <div className="flex-1">
          {/* Shared Timeline Slider for MFR and Chronic tabs */}
          {(selectedTab === 'chronic' || selectedTab === 'mfr') && (
            <div className="bg-white border border-(--line) rounded-3xl p-6 mb-8 shadow-sm font-sans">
              <div className="flex justify-between items-center mb-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Timeline Projection Scrubber:
                </span>
                <span className="text-[10px] font-extrabold text-(--teal) bg-(--soft-teal) border border-(--teal)/25 px-3 py-1 rounded-full uppercase tracking-wider">
                  {selectedProjYear === 0 ? 'Today (Baseline)' : `Year +${selectedProjYear} Projection`}
                </span>
              </div>
              <div className="relative pt-4 pb-2">
                <input
                  type="range"
                  min="0"
                  max={PROJECTION_YEARS.length - 1}
                  step="1"
                  value={Math.max(0, PROJECTION_YEARS.indexOf(selectedProjYear))}
                  onChange={(e) => setSelectedProjYear(PROJECTION_YEARS[parseInt(e.target.value)])}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, var(--teal) 0%, var(--teal) ${(Math.max(0, PROJECTION_YEARS.indexOf(selectedProjYear)) / (PROJECTION_YEARS.length - 1)) * 100}%, #E2E8F0 ${(Math.max(0, PROJECTION_YEARS.indexOf(selectedProjYear)) / (PROJECTION_YEARS.length - 1)) * 100}%, #E2E8F0 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold select-none">
                {PROJECTION_YEARS.map((yr) => (
                  <span key={yr}>{yr === 0 ? '0 (Today)' : `Yr ${yr}`}</span>
                ))}
              </div>
            </div>
          )}

          {children}

          {/* Bottom Back Button */}
          <div className="text-center mt-12 mb-4 select-none">
            <button 
              onClick={() => {
                setChronicResult(null);
                setMfrResult(null);
                setMentalResult(null);
                setActiveMatchId(null);
                setChatSessionId(null);
                setIsChatOpen(false);
                router.push('/dashboard');
              }} 
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl px-5 py-2.5 font-bold font-sans text-xs transition-all duration-300 cursor-pointer shadow-sm inline-flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              Scan Another Prospect
            </button>
          </div>
        </div>

        {/* Floating counselor trigger */}
        <button
          onClick={() => setIsChatOpen(true)}
          disabled={chatsUsed >= 5}
          className="fixed bottom-6 right-6 z-10 flex items-center gap-2 py-3 px-5 rounded-full bg-(--teal) hover:bg-(--teal-d) text-[#fff] border-none font-bold text-xs font-sans shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <MessageSquare size={14} />
          Consult AI Counselor ({Math.max(0, 5 - chatsUsed)} Left)
        </button>
        
        <ReportChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          sessionId={chatSessionId}
          onSessionCreated={setChatSessionId}
          reportId={user.id}
          partnerReportId={prospectForm.name}
          engineType={selectedTab === 'mfr' ? 'mfr' : 'chronic'}
          contextMetadata={combinedContextMetadata}
        />
      </main>
    </div>
  );
}
