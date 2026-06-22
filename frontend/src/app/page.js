'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useCompatibility } from '../contexts/CompatibilityContext';
import { API_URL } from '../config/api';
import styles from './page.module.css';

export default function RootPage() {
  const router = useRouter();
  const { 
    user, 
    setUser,
    authPhone, 
    setAuthPhone,
    authOtp, 
    setAuthOtp,
    authStep, 
    setAuthStep,
    isAuthLoading, 
    setIsAuthLoading,
    authError, 
    setAuthError,
    setRunsUsed,
    setChatsUsed,
    fetchRecentMatches,
    setOnboardingStep,
    setOnboardingForm
  } = useCompatibility();

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Authentication status checker & guard redirect
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.name && parsed.gender && parsed.activity_level) {
          router.push('/dashboard');
        } else {
          setOnboardingStep(1);
          router.push('/onboarding');
        }
      } catch (e) {
        localStorage.removeItem('slayhealth_user');
        setCheckingAuth(false);
      }
    } else {
      setCheckingAuth(false);
    }
  }, [router, setOnboardingStep]);

  // Phone Authentication Submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (authStep === 'phone') {
      if (!authPhone.trim()) return;
      setIsAuthLoading(true);
      setAuthError(null);
      try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: authPhone.trim() })
        });
        const data = await res.json();
        if (data.success) {
          setAuthStep('otp');
        } else {
          throw new Error(data.error || 'Login failed');
        }
      } catch (err) {
        setAuthError(err.message || 'Connection failed');
      } finally {
        setIsAuthLoading(false);
      }
    } else {
      if (!authOtp.trim() || authOtp.length !== 4) return;
      setIsAuthLoading(true);
      setAuthError(null);
      try {
        const res = await fetch(`${API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: authPhone.trim(), otp: authOtp.trim() })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
          setUser(data.user);
          setRunsUsed(data.user.runs_used || 0);
          setChatsUsed(data.user.chats_used || 0);
          fetchRecentMatches(data.user.id);

          if (!data.user.name || !data.user.gender || !data.user.activity_level) {
            setOnboardingStep(1);
            setOnboardingForm(prev => ({
              ...prev,
              ...data.user,
              userName: data.user.userName || data.user.name || '',
              userRelation: data.user.userRelation || 'Self',
              candidateName: data.user.candidateName || data.user.name || '',
              candidateGender: data.user.gender || '',
              candidateDob: data.user.dob || '',
              candidateCity: data.user.city || '',
              relationshipStatus: data.user.relationshipStatus || 'Single',
              marriageTimeline: data.user.marriageTimeline || 'Not sure yet'
            }));
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        } else {
          throw new Error(data.error || 'Verification failed');
        }
      } catch (err) {
        setAuthError(err.message || 'Verification failed');
      } finally {
        setIsAuthLoading(false);
      }
    }
  };

  if (checkingAuth) {
    return (
      <main className={styles.authContainer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#28c79a' }} />
        <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Initializing SlayHealth Portal...</span>
      </main>
    );
  }

  return (
    <main className={styles.authContainer}>
      <div className={styles.authCard}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '16px', background: 'rgba(40, 199, 154, 0.1)', color: '#28c79a', marginBottom: '1.5rem' }}>
          <Lock size={36} />
        </div>
        <h2 className={styles.authTitle}>SlayHealth Engines</h2>
        <p className={styles.authSubtitle}>Verify your mobile number to access clinical compatibility portals.</p>
        
        <form className={styles.authForm} onSubmit={handleAuthSubmit}>
          {authStep === 'phone' ? (
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Mobile Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                className={styles.authInput}
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Enter 4-Digit OTP Code</label>
              <div className={styles.otpGrid}>
                <input
                  type="text"
                  maxLength="4"
                  placeholder="0000"
                  className={styles.otpInput}
                  value={authOtp}
                  onChange={(e) => setAuthOtp(e.target.value)}
                  style={{ width: '100px' }}
                  required
                />
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '6px' }}>
                Demo mode: Enter any 4-digit code to continue.
              </p>
            </div>
          )}

          {authError && (
            <div style={{ color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', padding: '10px', borderRadius: '8px' }}>
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <button type="submit" className={styles.primaryBtn} disabled={isAuthLoading} style={{ cursor: 'pointer' }}>
            {isAuthLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw className="animate-spin" size={16} />
                <span>Loading...</span>
              </div>
            ) : (
              authStep === 'phone' ? 'Request OTP code' : 'Verify and enter'
            )}
          </button>

          {authStep === 'otp' && (
            <button 
              type="button" 
              className={styles.secondaryBtn} 
              onClick={() => { setAuthStep('phone'); setAuthOtp(''); }}
              style={{ marginTop: '-8px', cursor: 'pointer' }}
            >
              Change mobile number
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
