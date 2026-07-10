'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Phone, ClipboardPaste } from 'lucide-react';
import { useCompatibility } from '../../contexts/CompatibilityContext';
import { API_URL } from '../../config/api';
import { apiFetch, setAccessToken } from '../../utils/api';
import QuestionScreen from '../../components/wizard/QuestionScreen';
import ChoiceList from '../../components/wizard/ChoiceList';
import SplashScreen from '../../components/wizard/SplashScreen';
import { RELATIONS, MARRIAGE_TIMELINES } from '../../constants/lifestyleOptions';

const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' }
];

const fieldInputClass = 'w-full p-4 border rounded-xl outline-none text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

const STEP_ORDER_NEW = ['phone', 'otp', 'name', 'relation', 'eta'];
const STEP_ORDER_RETURNING = ['phone', 'otp'];

export default function LoginPage() {
  const router = useRouter();
  const {
    user, setUser,
    authPhone, setAuthPhone,
    authOtp, setAuthOtp,
    authStep, setAuthStep,
    isAuthLoading, setIsAuthLoading,
    authError, setAuthError,
    setRunsUsed,
    setChatsUsed,
    fetchRecentMatches,
    setOnboardingStep,
    onboardingForm, setOnboardingForm
  } = useCompatibility();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState('+91');
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  // Authentication status checker & guard redirect
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) {
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

  useEffect(() => {
    const handleExpired = () => setCheckingAuth(false);
    window.addEventListener('auth_session_expired', handleExpired);
    return () => window.removeEventListener('auth_session_expired', handleExpired);
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Reads a 6-digit code from the clipboard, if present, into the OTP field.
  // The code arrives via WhatsApp (not SMS), so browser/OS SMS-autofill (iOS
  // QuickType, Android WebOTP) can't see it — those only read actual SMS
  // messages. This is the practical substitute: the user copies the code in
  // WhatsApp, switches back here, and it's one tap (or, where the browser
  // allows a permission-less read, automatic) instead of retyping 6 digits.
  const pasteOtpFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = (text.match(/\d/g) || []).join('').slice(-6);
      if (digits.length === 6) setAuthOtp(digits);
    } catch (e) {
      // Clipboard API unavailable/denied/empty — user can still type it in manually.
    }
  };

  // Best-effort auto-fill: when the user switches back to this tab (e.g. after
  // copying the code from a WhatsApp notification) try a silent clipboard read.
  // Browsers that require a direct user gesture for clipboard access will just
  // reject this quietly — the explicit "Paste code" button below always works.
  useEffect(() => {
    if (authStep !== 'otp') return;
    const handleFocus = () => {
      if (!authOtp) pasteOtpFromClipboard();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStep, authOtp]);

  const goNext = () => {
    const order = isNewUser ? STEP_ORDER_NEW : STEP_ORDER_RETURNING;
    const idx = order.indexOf(authStep);
    if (idx >= 0 && idx < order.length - 1) setAuthStep(order[idx + 1]);
  };

  const goBack = () => {
    const order = isNewUser ? STEP_ORDER_NEW : STEP_ORDER_RETURNING;
    const idx = order.indexOf(authStep);
    if (idx > 0) setAuthStep(order[idx - 1]);
  };

  const submitPhone = async () => {
    if (!phoneNumberInput.trim()) return;
    if (cooldown > 0) {
      setAuthError(`Please wait ${cooldown}s before requesting a new OTP.`);
      return;
    }
    setIsAuthLoading(true);
    setAuthError(null);

    let cleanDigits = phoneNumberInput.replace(/\D/g, '');
    if (cleanDigits.startsWith('0')) cleanDigits = cleanDigits.slice(1);
    const countryDigits = selectedCountry.replace(/\D/g, '');
    const fullPhone = cleanDigits.startsWith(countryDigits) ? `+${cleanDigits}` : `${selectedCountry}${cleanDigits}`;
    setAuthPhone(fullPhone);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: fullPhone })
      });
      const data = await res.json();
      if (data.success) {
        setIsNewUser(!!data.is_new_user);
        setCooldown(60);
        setAuthStep('otp');
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError(err.message || 'Connection failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: authPhone })
      });
      const data = await res.json();
      if (data.success) {
        setCooldown(60);
      } else {
        throw new Error(data.error || 'Failed to resend code');
      }
    } catch (err) {
      setAuthError(err.message || 'Connection failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const submitOtp = async () => {
    if (!authOtp.trim() || authOtp.length !== 6) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: authPhone.trim(), otp: authOtp.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Verification failed');

      setAccessToken(data.accessToken);
      if (data.refreshToken) localStorage.setItem('slayhealth_refresh_token', data.refreshToken);

      if (isNewUser) {
        // Name/relation/marriage-timeline still need to be collected — hold off on
        // persisting/finalizing the session and continue the wizard instead. See
        // completeSignup, called once those remaining steps are answered.
        setUser(data.user);
        setAuthStep('name');
        return;
      }

      localStorage.setItem('slayhealth_user', JSON.stringify(data.user));
      setUser(data.user);
      setRunsUsed(data.user.runs_used || 0);
      setChatsUsed(data.user.chats_used || 0);
      fetchRecentMatches(data.user.id);

      if (!data.user.name) {
        setOnboardingStep(1);
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setAuthError(err.message || 'Verification failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Final step of new-user signup (called after name/relation/eta are all answered):
  // saves the name collected earlier now that OTP has verified a real user id, then
  // finalizes the session the same way the returning-user path does.
  const completeSignup = async () => {
    if (isAuthLoading) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      let finalUser = user;
      if (onboardingForm.userName?.trim()) {
        const profileRes = await apiFetch(`${API_URL}/api/auth/profile`, {
          method: 'POST',
          body: JSON.stringify({ id: finalUser.id, name: onboardingForm.userName.trim() })
        });
        const profileData = await profileRes.json();
        if (profileData.success) finalUser = profileData.user;
      }

      finalUser = {
        ...finalUser,
        userRelation: onboardingForm.userRelation,
        marriageTimeline: onboardingForm.marriageTimeline
      };
      localStorage.setItem('slayhealth_user', JSON.stringify(finalUser));
      setUser(finalUser);
      setRunsUsed(finalUser.runs_used || 0);
      setChatsUsed(finalUser.chats_used || 0);
      fetchRecentMatches(finalUser.id);
      setAuthStep('splash');
    } catch (err) {
      setAuthError(err.message || 'Failed to save your details.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="h-dvh flex flex-col items-center justify-center gap-4 wizard-bg">
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--teal)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Initializing SlayHealth Portal...</span>
      </main>
    );
  }

  if (authStep === 'splash') {
    return <SplashScreen name={onboardingForm.userName} onDone={() => router.push('/dashboard')} />;
  }

  const order = isNewUser ? STEP_ORDER_NEW : STEP_ORDER_RETURNING;
  const stepIndex = Math.max(0, order.indexOf(authStep));

  const errorBanner = authError && (
    <div
      className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium mb-4"
      style={{ background: 'var(--soft-danger)', color: 'var(--danger-d)' }}
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{authError}</span>
    </div>
  );

  let title, subtitle, content, onNext, nextLabel, nextDisabled, onBack, onSkip;

  if (authStep === 'phone') {
    title = 'What’s your phone number?';
    subtitle = 'We’ll send a one-time code to verify it’s you.';
    onNext = submitPhone;
    nextLabel = isAuthLoading ? 'Sending code…' : 'Send OTP Code';
    nextDisabled = !phoneNumberInput.trim() || isAuthLoading;
    content = (
      <div>
        {errorBanner}
        <div className="flex gap-2">
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="rounded-xl border outline-none px-3 shrink-0"
            style={{ ...fieldInputStyle, minWidth: '95px' }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
            ))}
          </select>
          <input
            type="tel"
            placeholder="98765 43210"
            value={phoneNumberInput}
            onChange={(e) => setPhoneNumberInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            autoFocus
            autoComplete="tel-national"
            className={`${fieldInputClass} flex-1 min-w-0`}
            style={fieldInputStyle}
          />
        </div>
      </div>
    );
  } else if (authStep === 'name') {
    title = 'What’s your name?';
    onNext = goNext;
    nextDisabled = !onboardingForm.userName?.trim();
    onBack = goBack;
    content = (
      <input
        type="text"
        placeholder="Enter your name"
        value={onboardingForm.userName || ''}
        onChange={(e) => setOnboardingForm({ ...onboardingForm, userName: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        autoFocus
        autoComplete="name"
        className={fieldInputClass}
        style={fieldInputStyle}
      />
    );
  } else if (authStep === 'relation') {
    title = 'Who are you in relation to the person getting married?';
    onBack = goBack;
    nextDisabled = true;
    content = (
      <ChoiceList
        options={RELATIONS}
        value={onboardingForm.userRelation}
        onChange={(v) => setOnboardingForm({ ...onboardingForm, userRelation: v })}
        onAdvance={goNext}
      />
    );
  } else if (authStep === 'eta') {
    title = 'What’s your ETA for marriage?';
    onBack = goBack;
    nextDisabled = true;
    content = (
      <ChoiceList
        options={MARRIAGE_TIMELINES}
        value={onboardingForm.marriageTimeline}
        onChange={(v) => setOnboardingForm({ ...onboardingForm, marriageTimeline: v })}
        onAdvance={completeSignup}
      />
    );
  } else if (authStep === 'otp') {
    title = 'Enter the 6-digit code';
    subtitle = `Sent via WhatsApp to ${authPhone}`;
    onNext = submitOtp;
    nextLabel = isAuthLoading ? 'Verifying…' : 'Verify & Continue';
    nextDisabled = authOtp.trim().length !== 6 || isAuthLoading;
    onBack = () => { setAuthStep('phone'); setAuthOtp(''); setAuthError(null); };
    onSkip = cooldown > 0 ? undefined : resendOtp;
    content = (
      <div>
        {errorBanner}
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={authOtp}
          onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          autoFocus
          autoComplete="one-time-code"
          className={`${fieldInputClass} text-center text-2xl tracking-[0.3em] font-bold`}
          style={fieldInputStyle}
        />
        <button
          type="button"
          onClick={pasteOtpFromClipboard}
          className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-xs font-semibold transition-opacity duration-150 hover:opacity-70"
          style={{ color: 'var(--teal-d)' }}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste code
        </button>
        <p className="text-xs mt-1 text-center" style={{ color: 'var(--muted)' }}>
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Didn’t get it? Tap below to resend.'}
        </p>
      </div>
    );
  }

  return (
    <main className="h-dvh overflow-hidden flex flex-col wizard-bg">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-5 overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-2 shrink-0">
          <Phone className="w-4 h-4" style={{ color: 'var(--teal-d)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Sign in to SlayHealth</span>
        </div>
        <QuestionScreen
          key={authStep}
          stepIndex={stepIndex}
          totalSteps={order.length}
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          onNext={onNext}
          nextLabel={nextLabel || 'Next'}
          nextDisabled={nextDisabled}
          onSkip={authStep === 'otp' ? onSkip : undefined}
          skipLabel="Resend code"
        >
          {content}
        </QuestionScreen>
      </div>
    </main>
  );
}
