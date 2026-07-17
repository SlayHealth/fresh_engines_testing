'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Activity, MessageSquare, Plus, Clock,
  Calendar, Heart, ChevronRight, Pencil,
  UserRound, HeartPulse, Brain, FlaskConical, ScanLine, Dna
} from 'lucide-react';
import { useCompatibility, buildOnboardingFormFromUser } from '../../contexts/CompatibilityContext';
import CategoryHub from '../../components/wizard/CategoryHub';
import useIsMobile from '../../hooks/useIsMobile';
import MobileHomeView from './MobileHomeView';
import { aboutProgress, aboutCounts, lifestyleProgress, lifestyleCounts, mentalProgress, mentalCounts } from '../../utils/healthProfileProgress';
import { SUGGESTED_PATHOLOGY_TESTS, SUGGESTED_RADIOLOGY_TESTS, SUGGESTED_GENOMICS_TESTS } from '../../constants/suggestedTests';
import styles from '../page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    runsUsed,
    chatsUsed,
    isUpgradingQuota,
    matchesList,
    isMatchesLoading,
    fetchRecentMatches,
    restoreMatchSession,
    handleResetQuota,
    chronicResult,
    mfrResult,
    setOnboardingStep,
    onboardingForm,
    setOnboardingForm,
    prospectForm,
    userReport,
    selfMentalAnswers
  } = useCompatibility();

  // Auth / Onboarding Redirect Guard
  useEffect(() => {
    const savedUser = localStorage.getItem('slayhealth_user');
    if (!savedUser) {
      router.push('/');
    } else {
      const parsed = JSON.parse(savedUser);
      if (!parsed.name) {
        setOnboardingStep(1);
        router.push('/onboarding');
      } else {
        fetchRecentMatches(parsed.id);
      }
    }
  }, [router, setOnboardingStep]);

  // Seed the health-profile form from the saved account once per session so
  // the cards below reflect real saved progress, not just this tab's wizard state.
  useEffect(() => {
    if (user && !onboardingForm.candidateGender) {
      setOnboardingForm((prev) => ({ ...prev, ...buildOnboardingFormFromUser(user) }));
    }
  }, [user]);

  const selfAdapter = {
    form: onboardingForm,
    nameField: 'candidateName', genderField: 'candidateGender', dobField: 'candidateDob', cityField: 'candidateCity',
    isSelfPerson: true,
    needsNameStep: !!(onboardingForm.userRelation && onboardingForm.userRelation !== 'Self')
  };

  const selfAboutCounts = aboutCounts(selfAdapter);
  const selfLifestyleCounts = lifestyleCounts(onboardingForm);
  const rawSelfMentalCounts = mentalCounts(selfMentalAnswers);

  // Pathology/mental answers live only in this tab's React state plus a
  // device-local draft (see CompatibilityContext) — unlike About/Lifestyle,
  // nothing rehydrates them from the backend on a fresh session, so a
  // returning user (new device, cleared storage, or just a while later)
  // would see "Start" here even with real data on file. A completed match
  // is durable, server-side proof those steps happened — matches can't be
  // created without both reports (see handleCompatibilityMatch's guard),
  // and mentalResult is only ever non-null once mental was completed — so
  // fall back to that evidence whenever the live session data is empty.
  const hasPathologyEvidence = !!(matchesList && matchesList.length > 0);
  const hasMentalEvidence = !!(matchesList && matchesList.some((m) => m?.analysis?.mentalResult));
  const selfMentalCounts = hasMentalEvidence
    ? { answered: rawSelfMentalCounts.total, total: rawSelfMentalCounts.total }
    : rawSelfMentalCounts;

  const healthProfileCategories = [
    {
      key: 'about', label: 'About You', desc: 'Basics, body & relationship context', icon: UserRound,
      progress: aboutProgress(selfAdapter), answered: selfAboutCounts.answered, total: selfAboutCounts.total, required: true
    },
    {
      key: 'lifestyle', label: 'Lifestyle & Habits', desc: 'Activity, sleep, drinking & more', icon: HeartPulse,
      progress: lifestyleProgress(onboardingForm), answered: selfLifestyleCounts.answered, total: selfLifestyleCounts.total
    },
    // Order mirrors the mockup (Mental sits third). It stays optional in behaviour —
    // it never gates match creation — the position here is display only.
    {
      key: 'mental', label: 'Mental Wellbeing', desc: 'Optional — 21 quick questions', icon: Brain,
      progress: hasMentalEvidence ? 100 : mentalProgress(selfMentalAnswers), answered: selfMentalCounts.answered, total: selfMentalCounts.total
    },
    {
      key: 'pathology', label: 'Pathology Reports', desc: 'Blood work for you', icon: FlaskConical,
      progress: (userReport || hasPathologyEvidence) ? 100 : 0,
      suggestedTests: SUGGESTED_PATHOLOGY_TESTS
    },
    {
      key: 'radiology', label: 'Radiology Reports', desc: 'Scans for you', icon: ScanLine,
      progress: 0, locked: true, price: '₹999',
      suggestedTests: SUGGESTED_RADIOLOGY_TESTS
    },
    {
      key: 'genomics', label: 'Genomics Report', desc: 'Carrier & hereditary risk screening', icon: Dna,
      comingSoon: true, locked: true,
      suggestedTests: SUGGESTED_GENOMICS_TESTS
    }
  ];

  const isMobile = useIsMobile();

  if (!user) return null;

  const scansLeft = Math.max(0, 1 - runsUsed);
  const chatsLeft = Math.max(0, 5 - chatsUsed);
  const editProfile = () => {
    setOnboardingForm(buildOnboardingFormFromUser(user));
    router.push('/add-prospect?enter=about');
  };

  const firstName = (user.name || 'there').trim().split(/\s+/)[0];
  const greetHour = new Date().getHours();
  const timeOfDay = greetHour < 12 ? 'Morning' : greetHour < 17 ? 'Afternoon' : greetHour < 21 ? 'Evening' : 'Night';

  // Undetermined on first paint (no `matchMedia` server-side) — render nothing
  // rather than flash one layout then swap, and never mount both trees at
  // once (five pages' worth of double SVG/data-fetching is real cost).
  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
      <MobileHomeView
        user={user}
        healthProfileCategories={healthProfileCategories}
        matchesList={matchesList}
        isMatchesLoading={isMatchesLoading}
        scansLeft={scansLeft}
        chatsLeft={chatsLeft}
        chronicResult={chronicResult}
        mfrResult={mfrResult}
        restoreMatchSession={restoreMatchSession}
        router={router}
      />
    );
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Ambient art — fixed to the viewport so it fills the full page width and
          never scrolls out of view, instead of a flat page with content floating
          in a box. Purely decorative, sits behind the content column. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(rgba(20,22,26,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px' }}
        />
        <div className="absolute -top-36 -left-44 w-[560px] h-[560px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(222,69,125,0.22), transparent 70%)' }} />
        <div className="absolute top-1/3 -right-52 w-[640px] h-[640px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(24,204,150,0.22), transparent 70%)' }} />
        <div className="absolute bottom-[-120px] left-1/4 w-[460px] h-[460px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(244,161,0,0.16), transparent 70%)' }} />

        <svg className="hidden 2xl:block absolute left-12 top-28 w-36 opacity-40" height="560" viewBox="0 0 140 560" fill="none">
          <path d="M70 0 C 15 55, 125 115, 70 175 S 15 295, 70 355 S 125 475, 70 560" stroke="var(--pink)" strokeWidth="1.5" strokeDasharray="1 9" strokeLinecap="round" />
          <circle cx="70" cy="175" r="5" fill="var(--pink)" opacity="0.55" />
          <circle cx="70" cy="355" r="5" fill="var(--teal)" opacity="0.55" />
        </svg>
        <svg className="hidden 2xl:block absolute right-12 top-52 w-36 opacity-40" height="500" viewBox="0 0 140 500" fill="none">
          <path d="M70 0 C 125 55, 15 115, 70 175 S 125 295, 70 355 S 15 445, 70 500" stroke="var(--teal)" strokeWidth="1.5" strokeDasharray="1 9" strokeLinecap="round" />
          <circle cx="70" cy="175" r="5" fill="var(--amber)" opacity="0.55" />
          <circle cx="70" cy="355" r="5" fill="var(--pink)" opacity="0.55" />
        </svg>
      </div>

      <div className={`relative max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-24 lg:pb-7 ${styles.dashboard}`}>

        {/* Identity bar */}
        <header className="flex items-center justify-between gap-3 pb-3">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2.5 min-w-0 text-left rounded-xl transition-colors duration-150 hover:bg-black/5 -m-1.5 p-1.5"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif font-semibold text-sm shrink-0"
              style={{ background: 'var(--pink)' }}
            >
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--muted)' }}>
                Good {timeOfDay}
              </p>
              <p className="font-serif text-[15px] leading-tight font-semibold truncate" style={{ color: 'var(--ink)' }}>
                {firstName}
              </p>
            </div>
          </button>
        </header>

        {/* Quota + profile strip */}
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-3 border-y"
          style={{ borderColor: 'var(--line)' }}
        >
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}
          >
            <Activity className="w-3 h-3" />
            {scansLeft}/1 scan
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}
          >
            <MessageSquare className="w-3 h-3" />
            {chatsLeft}/5 chats
          </span>

          {user.city && (
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {user.city}
            </span>
          )}

          <button
            onClick={editProfile}
            className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors duration-150 hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>

          {(runsUsed > 0 || chatsUsed > 0) && (
            <button
              onClick={handleResetQuota}
              disabled={isUpgradingQuota}
              className="text-[11px] font-semibold underline ml-auto transition-opacity duration-150 hover:opacity-70"
              style={{ color: 'var(--teal-d)' }}
            >
              {isUpgradingQuota ? 'Resetting…' : 'Reset quota'}
            </button>
          )}
        </div>

        {user.userRelation && user.userRelation !== 'Self' && (
          <p className="text-[11px] pt-2" style={{ color: 'var(--muted)' }}>
            Filled by {user.userName || user.name} ({user.userRelation})
          </p>
        )}

        {/* Primary CTA */}
        <div className="cta-gradient-pink rounded-2xl p-5 sm:p-6 mt-4 mb-4 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 text-white/80">
                Free Plan
              </p>
              <h2 className="font-serif text-2xl text-white mb-1 leading-tight">
                {scansLeft} match{scansLeft === 1 ? '' : 'es'} available
              </h2>
              <p className="text-xs text-white/70">Begin a new compatibility analysis</p>
            </div>
            <Sparkles className="w-7 h-7 shrink-0" style={{ color: 'var(--teal)' }} />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push('/add-prospect')}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-shadow duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              style={{ background: '#fff', color: 'var(--pink-d)' }}
            >
              <Plus className="w-4 h-4" />
              New Compatibility Check
            </button>
            {chronicResult && mfrResult && (
              <button
                onClick={() => router.push('/core-engine/story')}
                className="px-4 rounded-xl text-sm font-medium text-white border border-white/30 transition-colors duration-150 hover:bg-white/10"
              >
                View Reports
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity — height-capped so history never pushes the page down */}
        <div className="rounded-2xl border overflow-hidden mb-5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
            <Clock className="w-4 h-4" style={{ color: 'var(--teal)' }} />
            <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Recent Activity</h3>
          </div>

          <div className="max-h-[228px] overflow-y-auto">
            {isMatchesLoading ? (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--muted)' }}>
                Loading matches…
              </div>
            ) : matchesList.length > 0 ? (
              <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
                {matchesList.map((match) => (
                  <div
                    key={match.id}
                    className="px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors duration-150 hover:bg-black/2"
                    onClick={() => {
                      restoreMatchSession(match);
                      router.push('/core-engine/story');
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'var(--soft-teal)' }}
                    >
                      <span className="text-[11px] font-bold" style={{ color: 'var(--teal-d)' }}>{match.score || 85}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {match.user?.name || user.name} & {match.prospect?.name || 'Prospect'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>
                        <Calendar className="w-3 h-3" />
                        {new Date(match.createdAt).toLocaleDateString()}
                        {match.prospect?.meetingSource && (
                          <>
                            <span>·</span>
                            <Heart className="w-3 h-3" style={{ color: 'var(--magenta)' }} />
                            {match.prospect.meetingSource}
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm mb-1.5" style={{ color: 'var(--muted)' }}>No compatibility checks yet</p>
                <button
                  onClick={() => router.push('/add-prospect')}
                  className="text-xs font-semibold transition-opacity duration-150 hover:opacity-70"
                  style={{ color: 'var(--teal-d)' }}
                >
                  Start your first check →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Health Profile — fill in your own data ahead of time, resumable per card. */}
        <div className="mb-6">
          <h3 className="font-serif text-base font-semibold mb-1" style={{ color: 'var(--ink)' }}>Your Health Profile</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Pick up right where you left off — each card saves as you go.</p>
          <CategoryHub
            embedded
            categories={healthProfileCategories}
            onEnter={(key) => router.push(`/add-prospect?enter=${key}`)}
          />
        </div>

        {/* Support */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--ink)' }}>
          <h3 className="font-serif text-sm font-semibold mb-1.5 text-white">Need Help?</h3>
          <p className="text-xs text-white/55 mb-3 leading-relaxed">
            Our medical team is here to assist you with any questions about your health compatibility journey.
          </p>
          <button className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg text-xs font-medium transition-colors duration-150">
            Contact Support
          </button>
        </div>

        <p className="text-[10px] text-center mt-6 leading-relaxed" style={{ color: 'var(--muted)' }}>
          This report is for informational and educational purposes and does not diagnose or treat any medical condition. Always confirm results with a qualified doctor.
        </p>
      </div>
    </main>
  );
}
