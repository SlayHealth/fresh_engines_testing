'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Calendar, ChevronRight, Plus } from 'lucide-react';
import Ico from './mobile/Ico';
import { useCompatibility } from '../contexts/CompatibilityContext';
import { toast } from './Toast';

function ChatMatchPicker({ isLoading, matches, onSelect, onStartNew, onClose }) {
  return (
    <div
      className="lg:hidden fixed inset-0 z-[1100] flex items-end"
      style={{ background: 'rgba(20,22,26,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-h-[75vh] rounded-t-3xl p-5 overflow-y-auto animate-fade-in-up"
        style={{ background: 'var(--surface)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose which compatibility check to discuss"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-base font-semibold" style={{ color: 'var(--ink)' }}>Chat with AI Counselor</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Choose which compatibility check to discuss</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 hover:bg-black/5"
            style={{ color: 'var(--muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onStartNew}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl border mb-3 text-left transition-colors duration-150 hover:opacity-90"
          style={{ borderColor: 'var(--teal)', background: 'var(--soft-teal)' }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--teal)' }}>
            <Plus className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Start a new compatibility check</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Nothing to discuss yet? Run a new match first.</p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
        </button>

        {isLoading ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--muted)' }}>Loading your compatibility checks…</div>
        ) : matches.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: 'var(--muted)' }}>No past compatibility checks yet.</div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => onSelect(match)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors duration-150 hover:bg-black/[0.02]"
                style={{ borderColor: 'var(--line)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--soft-teal)' }}>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--teal-d)' }}>{match.score || 85}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {match.user?.name || 'You'} & {match.prospect?.name || 'Prospect'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>
                    <Calendar className="w-3 h-3" />
                    {new Date(match.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    chronicResult,
    mfrResult,
    matchesList,
    restoreMatchSession,
    fetchRecentMatches,
    setIsChatOpen
  } = useCompatibility();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerMatches, setPickerMatches] = useState([]);

  // Gating on a saved name (fully onboarded) rather than a route allow-list means
  // this naturally shows on every authenticated page — dashboard, questionnaire,
  // analysis, profile, admin — while still staying off login/onboarding, where
  // there either is no user yet or the name step isn't done.
  // The Questionnaire flow (hub + every per-category step screen) owns the
  // whole viewport — a floating nav bar here would sit on top of forms,
  // uploads, and the primary action button.
  //
  // The name-gate alone isn't enough on two routes that are meant to read as
  // "outside the authenticated app" regardless of whether *this* browser
  // happens to carry a real session: the public marketing landing page (a
  // returning, already-logged-in visitor still lands here first, per
  // page.js's own "Continue" shortcut) and the invite link (opened by a
  // different person entirely — the invited partner — who has never
  // authenticated in this flow at all, even if the account holder's own
  // session is what's sitting in this browser's localStorage). Confirmed
  // live: without this second check, an authenticated account holder's own
  // Home/Health/Chat AI/Analysis tabs rendered on both pages.
  if (!user?.name || pathname === '/' || pathname.startsWith('/invite/') || pathname.startsWith('/add-prospect')) return null;

  const isActive = (target) => pathname === target || pathname.startsWith(`${target}/`);
  const hasActiveAnalysis = !!(chronicResult && mfrResult);
  // The FAB treatment (elevated, colored) implies "there's something worth
  // discussing" — that's only true once at least one compatibility check
  // exists. Before that it renders as a plain tab, same as Home/Health/
  // Analysis, so it still works (offers to start a first check) without
  // visually promising a conversation that can't happen yet.
  const hasCompletedAnalysis = hasActiveAnalysis || (matchesList && matchesList.length > 0);

  const openChat = async () => {
    // Already looking at a loaded analysis — jump straight into its chat,
    // same as the in-report "Consult AI Counselor" button.
    if (hasActiveAnalysis) {
      setIsChatOpen(true);
      if (!pathname.startsWith('/core-engine')) router.push('/core-engine/story');
      return;
    }
    setIsPickerOpen(true);
    setIsPickerLoading(true);
    const matches = await fetchRecentMatches(user.id);
    setPickerMatches(matches || []);
    setIsPickerLoading(false);
  };

  const handlePickMatch = (match) => {
    restoreMatchSession(match);
    setIsPickerOpen(false);
    setIsChatOpen(true);
    router.push('/core-engine/story');
  };

  const handleStartNew = () => {
    setIsPickerOpen(false);
    router.push('/add-prospect');
  };

  const handleAnalysisTap = async () => {
    // Disabled state: there's nothing to analyze yet — a match (and the
    // required info behind it) has to exist first. Explain why instead of
    // silently doing nothing or bouncing them off to a different screen.
    if (!hasCompletedAnalysis) {
      toast.info("Your analysis will show up here once you've completed a compatibility check — finish your details and add a prospect first.");
      return;
    }
    if (hasActiveAnalysis) {
      if (!pathname.startsWith('/core-engine')) router.push('/core-engine/story');
      return;
    }
    const matches = await fetchRecentMatches(user.id);
    if (matches && matches.length > 0) {
      restoreMatchSession(matches[0]);
      router.push('/core-engine/story');
    } else {
      // hasCompletedAnalysis already implied matchesList had entries, but a
      // match can vanish between renders (e.g. deleted elsewhere) — fall
      // back to the same messaging rather than a dead click.
      toast.info('No compatibility analysis yet — start your first check.');
      router.push('/add-prospect');
    }
  };

  return (
    <>
      <nav className="mnav lg:hidden" aria-label="Primary">
        <button type="button" className={`tab${isActive('/dashboard') ? ' on' : ''}`} onClick={() => router.push('/dashboard')}>
          <Ico name="home" /><span>Home</span>
        </button>
        <button type="button" className={`tab${isActive('/add-prospect') ? ' on' : ''}`} onClick={() => router.push('/add-prospect')}>
          <Ico name="clip" /><span>Health</span>
        </button>
        {hasCompletedAnalysis ? (
          <button type="button" className="tab fab" onClick={openChat} aria-label="Chat with AI assistant">
            <span className="b"><Ico name="chat" /></span><span>Chat AI</span>
          </button>
        ) : (
          <button type="button" className="tab" onClick={openChat} aria-label="Chat with AI assistant">
            <Ico name="chat" /><span>Chat AI</span>
          </button>
        )}
        {/* Deliberately NOT aria-disabled — that tells screen readers (and
            Playwright) the control is inert, which would silently swallow
            the one interaction that's supposed to explain why it's muted.
            It stays a real, always-actionable button; only the label and
            opacity communicate "not yet". */}
        <button
          type="button"
          className={`tab${hasCompletedAnalysis && isActive('/core-engine') ? ' on' : ''}${hasCompletedAnalysis ? '' : ' disabled'}`}
          onClick={handleAnalysisTap}
          aria-label={hasCompletedAnalysis ? undefined : 'Analysis — locked until your first compatibility check is complete'}
        >
          <Ico name="chart" /><span>Analysis</span>
        </button>
      </nav>

      {isPickerOpen && (
        <ChatMatchPicker
          isLoading={isPickerLoading}
          matches={pickerMatches}
          onSelect={handlePickMatch}
          onStartNew={handleStartNew}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </>
  );
}
