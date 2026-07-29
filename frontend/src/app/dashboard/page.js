'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Activity, MessageSquare, Plus, Clock,
  Calendar, Heart, ChevronRight, Pencil, Shield,
  UserRound, HeartPulse, Brain, FlaskConical, ScanLine, Dna
} from 'lucide-react';
import { useCompatibility, buildOnboardingFormFromUser } from '../../contexts/CompatibilityContext';
import CategoryHub from '../../components/wizard/CategoryHub';
import DesktopShell from '../../components/DesktopShell';
import WeightedGauge from '../../components/mobile/WeightedGauge';
import { toMobileSections, weightedSections } from '../../utils/mobileSections';
import useIsMobile from '../../hooks/useIsMobile';
import MobileHomeView from './MobileHomeView';
import { aboutProgress, aboutCounts, lifestyleProgress, lifestyleCounts, mentalProgress, mentalCounts, computeConfidence } from '../../utils/healthProfileProgress';
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
    prospectReport,
    selfMentalAnswers,
    prospectMentalAnswers
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
      key: 'mental', label: 'Mental Wellbeing', desc: 'Optional — 27 quick questions', icon: Brain,
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

  // Poor Discoverability of Saved Prospects: prospectForm/prospectReport/
  // prospectMentalAnswers already survive a reload (CompatibilityContext's own
  // draft), and add-prospect/page.js now resumes at the exact step/category —
  // but neither surfaced anywhere on Home, so a user who navigated away had no
  // visible way to find their way back. A named prospect with no completed
  // match yet is treated as an active, resumable draft; the % reuses the same
  // weighted confidence formula as the self health-profile gauge (About/
  // Lifestyle/Mental/Pathology — Radiology is left at 0 here since its own
  // upload state lives in add-prospect/page.js's local draft, not this
  // Context, and this is meant as a quick approximate signal, not the source
  // of truth add-prospect/page.js computes precisely once you're back in it).
  const hasCompletedMatchForProspect = matchesList.some((m) => m.prospect?.name === prospectForm.name);
  const hasResumableProspectDraft = !!(prospectForm.name && !hasCompletedMatchForProspect);
  const prospectAdapter = {
    form: prospectForm,
    nameField: 'name', genderField: 'gender', dobField: 'dob', cityField: 'city',
    needsNameStep: false
  };
  const prospectDraftConfidence = hasResumableProspectDraft ? computeConfidence([
    { key: 'about', progress: aboutProgress(prospectAdapter) },
    { key: 'lifestyle', progress: lifestyleProgress(prospectForm) },
    { key: 'mental', progress: mentalProgress(prospectMentalAnswers) },
    { key: 'pathology', progress: prospectReport ? 100 : 0 },
    { key: 'radiology', progress: 0 }
  ]) : 0;

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
        hasResumableProspectDraft={hasResumableProspectDraft}
        prospectDraftName={prospectForm.name}
        prospectDraftConfidence={prospectDraftConfidence}
      />
    );
  }

  // ---- Desktop: the mobile design language, laid out for the wide canvas ----
  // Reuse the mobile signature gauge verbatim (same WeightedGauge + weighted
  // sections), just placed in a sidebar + main/rail desktop layout.
  const sections = toMobileSections(healthProfileCategories);
  const weighted = weightedSections(sections);
  const conf = Math.round(weighted.reduce((a, s) => a + (s.weight * s.pct) / 100, 0));
  const doneCount = weighted.filter((s) => s.pct > 0).length;
  const nextSection = weighted
    .filter((s) => s.state !== 'locked' && s.state !== 'soon' && s.pct < 100)
    .sort((a, b) => b.weight - a.weight)[0];
  const heaviest = [...weighted].sort((a, b) => b.weight - a.weight)[0];
  const leverName = heaviest ? (heaviest.id === 'pathology' ? 'Bloodwork' : heaviest.title) : 'Bloodwork';

  const recentActivity = (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <Clock className="w-4 h-4" style={{ color: 'var(--teal)' }} />
        <h3 className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Recent Activity</h3>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {isMatchesLoading ? (
          <div className="p-6 text-center text-xs" style={{ color: 'var(--muted)' }}>Loading matches…</div>
        ) : matchesList.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {matchesList.map((match) => (
              <div
                key={match.id}
                className="px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors duration-150 hover:bg-black/[0.02]"
                onClick={() => { restoreMatchSession(match); router.push('/core-engine/story'); }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--soft-teal)' }}>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--teal-d)' }}>{match.score || 85}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {match.user?.name || user.name} & {match.prospect?.name || 'Partner'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>
                    <Calendar className="w-3 h-3" />
                    {new Date(match.createdAt).toLocaleDateString()}
                    {match.prospect?.meetingSource && (
                      <><span>·</span><Heart className="w-3 h-3" style={{ color: 'var(--magenta)' }} />{match.prospect.meetingSource}</>
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
            <button onClick={() => router.push('/add-prospect')} className="text-xs font-semibold transition-opacity duration-150 hover:opacity-70" style={{ color: 'var(--teal-d)' }}>
              Start your first check →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DesktopShell user={user}>
      {/* Greeting + quota strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[12px] leading-tight" style={{ color: 'var(--muted)' }}>Good {timeOfDay}</p>
          <h1 className="font-serif text-[26px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{firstName}</h1>
          {user.userRelation && user.userRelation !== 'Self' && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Filled by {user.userName || user.name} ({user.userRelation})</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>
            <Activity className="w-3 h-3" />{scansLeft}/1 scan
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}>
            <MessageSquare className="w-3 h-3" />{chatsLeft}/5 chats
          </span>
          {user.city && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{user.city}</span>}
          <button onClick={editProfile} className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors duration-150 hover:opacity-70" style={{ color: 'var(--muted)' }}>
            <Pencil className="w-3 h-3" />Edit
          </button>
          {(runsUsed > 0 || chatsUsed > 0) && (
            <button onClick={handleResetQuota} disabled={isUpgradingQuota} className="text-[11px] font-semibold underline transition-opacity duration-150 hover:opacity-70" style={{ color: 'var(--teal-d)' }}>
              {isUpgradingQuota ? 'Resetting…' : 'Reset quota'}
            </button>
          )}
        </div>
      </div>

      {/* Hero row: signature gauge (left) + primary CTA & resume (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[384px_1fr] gap-5 mb-6 items-start">
        {/* Gauge hero — mobile hero reused verbatim inside a scoped .mshell */}
        <div className="mshell" data-mtheme="light" style={{ minHeight: 0, background: 'transparent' }}>
          <section className="hero grain" style={{ margin: 0 }}>
            <div className="hero-top">
              <span className="eyebrow">Your Full Picture</span>
              <span className="thr"><Shield className="w-3.5 h-3.5" /> Reliable at 70%</span>
            </div>
            <WeightedGauge sections={weighted} confidence={conf} subLabel={`${doneCount} of ${weighted.length} sections`} />
            <p className="hero-line">
              {nextSection
                ? <>Each arc is one section, sized by how much it moves the score. <b>{leverName} is your biggest lever.</b></>
                : <>You&apos;ve completed every section. <b>You&apos;re all set.</b></>}
            </p>
            {nextSection && (
              <button
                onClick={() => router.push(`/add-prospect?enter=${nextSection.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 13px', borderRadius: 14, background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.14)', color: '#EAF3F0', textAlign: 'left' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>Continue — {nextSection.title.toLowerCase()}</b>
                  <small style={{ fontSize: 11, opacity: 0.6 }}>+{nextSection.weight}% confidence</small>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ opacity: 0.7 }} />
              </button>
            )}
          </section>
        </div>

        {/* Right column: primary CTA + resume banner */}
        <div className="flex flex-col gap-4">
          <div className="cta-gradient-pink rounded-2xl p-6 relative overflow-hidden">
            <svg className="absolute top-0 right-0 h-full w-48 opacity-[0.13] pointer-events-none" viewBox="0 0 180 220" fill="none" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
              <path d="M30 -10 C 100 40, 50 100, 120 140 S 70 200, 150 230" stroke="#fff" strokeWidth="1.6" />
              <path d="M70 -20 C 140 30, 90 100, 160 140" stroke="#fff" strokeWidth="1.6" />
              <path d="M100 -10 C 170 40, 120 110, 190 150" stroke="#fff" strokeWidth="1.6" />
            </svg>
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 text-white/80">Free Plan</p>
                <h2 className="font-serif text-2xl text-white mb-1 leading-tight">{scansLeft} match{scansLeft === 1 ? '' : 'es'} available</h2>
                <p className="text-xs text-white/70">Invite your partner — we compare both profiles, not just yours.</p>
              </div>
              <Sparkles className="w-7 h-7 shrink-0" style={{ color: 'var(--teal)' }} />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => router.push('/add-prospect')} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-shadow duration-150 hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]" style={{ background: '#fff', color: 'var(--pink-d)' }}>
                <Plus className="w-4 h-4" />New Compatibility Check
              </button>
              {chronicResult && mfrResult && (
                <button onClick={() => router.push('/core-engine/story')} className="px-4 rounded-xl text-sm font-medium text-white border border-white/30 transition-colors duration-150 hover:bg-white/10">
                  View Reports
                </button>
              )}
            </div>
          </div>

          {hasResumableProspectDraft && (
            <button onClick={() => router.push('/add-prospect')} className="w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors duration-150 hover:bg-black/[0.02]" style={{ borderColor: 'var(--teal)', background: 'var(--soft-teal)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--teal)' }}>
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-sm font-semibold" style={{ color: 'var(--ink)' }}>Continue Your Last Draft</p>
                <p className="text-xs truncate" style={{ color: 'var(--teal-d)' }}>Partner: {prospectForm.name} · {prospectDraftConfidence}% Complete</p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold shrink-0" style={{ color: 'var(--teal-d)' }}>Continue <ChevronRight className="w-3.5 h-3.5" /></span>
            </button>
          )}

          {recentActivity}

          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--ink)' }}>
            {/* AI mascot */}
            <svg width="54" height="54" viewBox="0 0 44 44" fill="none" className="shrink-0" aria-hidden="true">
              <line x1="22" y1="9" x2="22" y2="4.5" stroke="#EDEAE2" strokeWidth="2" strokeLinecap="round" />
              <circle cx="22" cy="3.5" r="2.2" fill="#18CC96" />
              <rect x="8" y="9" width="28" height="23" rx="9" fill="#F1EEE6" />
              <rect x="12" y="13" width="20" height="15" rx="6" fill="#0E1513" />
              <ellipse cx="18" cy="20.5" rx="2.4" ry="3.2" fill="#18CC96" />
              <ellipse cx="26" cy="20.5" rx="2.4" ry="3.2" fill="#18CC96" />
              <rect x="5.5" y="17" width="3" height="7" rx="1.5" fill="#D9D4C8" />
              <rect x="35.5" y="17" width="3" height="7" rx="1.5" fill="#D9D4C8" />
              <rect x="14" y="33" width="16" height="5" rx="2.5" fill="#E4DFD4" />
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-sm font-semibold mb-1 text-white">Understand it, don&apos;t just read it</h3>
              <p className="text-xs text-white/55 leading-relaxed">Our AI assistant explains every number in plain language — ask it anything you&apos;d rather not Google.</p>
            </div>
            <button className="bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg text-xs font-medium transition-colors duration-150 shrink-0">Ask the AI assistant</button>
          </div>
        </div>
      </div>

      {/* Health profile — full width, 2-column card grid */}
      <div className="mb-6">
        <h3 className="font-serif text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Your Health Profile</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Every card saves as you go — leave, come back, finish on a lunch break.</p>
        <CategoryHub embedded hideSummary columns={2} categories={healthProfileCategories} onEnter={(key) => router.push(`/add-prospect?enter=${key}`)} />
      </div>

      <p className="text-[10px] leading-relaxed max-w-3xl" style={{ color: 'var(--muted)' }}>
        <Shield className="w-3 h-3 inline mr-1 -mt-0.5" />Encrypted end to end. Nothing is shared with your partner or family until you say so. This report is for informational and educational purposes and does not diagnose or treat any medical condition — always confirm results with a qualified doctor.
      </p>
    </DesktopShell>
  );
}
