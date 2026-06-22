'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Sparkles, LogOut, Activity, MessageSquare, HeartPulse, 
  ShieldCheck, ArrowLeft, RotateCcw
} from 'lucide-react';
import { useCompatibility } from '../../contexts/CompatibilityContext';
import styles from '../page.module.css';
import ReportChatDrawer from '../../components/ReportChatDrawer';

export default function CoreEngineLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const { 
    user, 
    runsUsed, 
    chatsUsed, 
    isUpgradingQuota, 
    handleResetQuota, 
    handleLogout,
    chronicResult,
    mfrResult,
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
    setMfrResult
  } = useCompatibility();

  // Auth & Data guards
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else if (!chronicResult || !mfrResult) {
      // If results are not computed/active, go back to dashboard
      router.push('/dashboard');
    }
  }, [router, chronicResult, mfrResult]);

  // Determine active tab from current route path
  const selectedTab = useMemo(() => {
    if (pathname.includes('/mfr')) return 'mfr';
    if (pathname.includes('/usg')) return 'usg';
    if (pathname.includes('/genomics')) return 'genomics';
    return 'chronic';
  }, [pathname]);

  const handleTabClick = (tab) => {
    router.push(`/core-engine/${tab}`);
  };

  // Combine metadata bundle to pass to chatbot drawer
  const combinedContextMetadata = useMemo(() => {
    if (!chronicResult && !mfrResult) return null;
    return {
      chronicResult,
      mfrResult,
      userProfile: user,
      prospectProfile: prospectForm,
      userPathologyRaw: userReport?.sections || null,
      prospectPathologyRaw: prospectReport?.sections || null
    };
  }, [chronicResult, mfrResult, user, prospectForm, userReport, prospectReport]);

  if (!user || !chronicResult || !mfrResult) return null;

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

      {/* Workspace Active Header */}
      <div className="mt-4 pb-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl mb-4 flex justify-between items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold transition-colors text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report Workspace Active</span>
        </div>
      </div>

      {/* Tabbed Workspace */}
      <section className={styles.tabsContainer}>
        {/* Tab Header Bar */}
        <div className={styles.tabsNavList}>
          <button 
            className={`${styles.tabItemBtn} ${selectedTab === 'chronic' ? styles.tabItemBtnActive : ''}`}
            onClick={() => handleTabClick('chronic')}
          >
            <Activity size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Chronic Risk & Trajectory
          </button>
          <button 
            className={`${styles.tabItemBtn} ${selectedTab === 'mfr' ? styles.tabItemBtnActive : ''}`}
            onClick={() => handleTabClick('mfr')}
          >
            <HeartPulse size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Fertility Timeline (MFR)
          </button>
          <button 
            className={`${styles.tabItemBtn} ${selectedTab === 'usg' ? styles.tabItemBtnActive : ''}`}
            onClick={() => handleTabClick('usg')}
          >
            <ShieldCheck size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            USG Organ status
          </button>
          <button 
            className={`${styles.tabItemBtn} ${selectedTab === 'genomics' ? styles.tabItemBtnActive : ''}`}
            onClick={() => handleTabClick('genomics')}
          >
            <Sparkles size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Genetics & Carrier Risk
          </button>
        </div>

        <div className={styles.tabPaneContent}>
          {/* Shared Timeline Slider for active tabs */}
          {(selectedTab === 'chronic' || selectedTab === 'mfr') && (
            <div style={{ backgroundColor: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2b2b3f' }}>
                  Premarital Timeline Projection:
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#d94386', background: '#fdf2f8', padding: '4px 12px', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
                  {selectedProjYear === 0 ? 'Today (Baseline)' : `Year +${selectedProjYear} Projection`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={selectedProjYear}
                onChange={(e) => setSelectedProjYear(parseInt(e.target.value))}
                style={{ width: '100%', height: '6px', accentColor: '#d94386', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                <span>0 (Today)</span>
                <span>1 Yr</span>
                <span>2 Yr</span>
                <span>3 Yr</span>
                <span>4 Yr</span>
                <span>5 Yr</span>
                <span>6 Yr</span>
                <span>7 Yr</span>
                <span>8 Yr</span>
                <span>9 Yr</span>
                <span>10 Years</span>
              </div>
            </div>
          )}

          {/* Child pages content */}
          {children}

          {/* Scan Another Prospect */}
          <div style={{ textAlign: 'center', marginTop: '3.5rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => {
                setChronicResult(null);
                setMfrResult(null);
                setChatSessionId(null);
                setIsChatOpen(false);
                router.push('/dashboard');
              }} 
              className={styles.secondaryBtn}
              style={{ borderRadius: '12px', padding: '10px 24px' }}
            >
              <RotateCcw size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              Scan Another Prospect
            </button>
          </div>
        </div>
      </section>

      {/* Floating AI counselor drawer */}
      <button
        onClick={() => setIsChatOpen(true)}
        disabled={chatsUsed >= 5}
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
          opacity: chatsUsed >= 5 ? 0.6 : 1
        }}
      >
        <MessageSquare size={16} />
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
  );
}
