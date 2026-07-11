'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ClipboardList, UserRound, BarChart3, MessageCircle, X, Calendar, ChevronRight, Plus } from 'lucide-react';
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
    restoreMatchSession,
    fetchRecentMatches,
    setIsChatOpen
  } = useCompatibility();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerMatches, setPickerMatches] = useState([]);

  // Gating on a saved name (fully onboarded) rather than a route allow-list means
  // this naturally shows on every authenticated page — dashboard, questionnaire,
  // analysis, profile, admin — while still staying off login/onboarding/invite
  // links, where there either is no user yet or the name step isn't done.
  if (!user?.name) return null;

  const isActive = (target) => pathname === target || pathname.startsWith(`${target}/`);
  const hasActiveAnalysis = !!(chronicResult && mfrResult);

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
    if (hasActiveAnalysis) {
      if (!pathname.startsWith('/core-engine')) router.push('/core-engine/story');
      return;
    }
    const matches = await fetchRecentMatches(user.id);
    if (matches && matches.length > 0) {
      restoreMatchSession(matches[0]);
      router.push('/core-engine/story');
    } else {
      toast.info('No compatibility analysis yet — start your first check.');
      router.push('/add-prospect');
    }
  };

  const navBtnStyle = (active) => ({ color: active ? 'var(--pink)' : 'var(--muted)' });

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors duration-150"
          style={navBtnStyle(isActive('/dashboard'))}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/add-prospect?enter=about')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors duration-150"
          style={navBtnStyle(false)}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Questionnaire</span>
        </button>

        {/* Elevated center Chat button — mobile-app style FAB embedded in the bar */}
        <div className="flex-1 flex flex-col items-center justify-end relative">
          <button
            type="button"
            onClick={openChat}
            aria-label="Chat with AI Counselor"
            className="absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-150 active:scale-95"
            style={{ background: 'var(--teal)', boxShadow: '0 6px 18px rgba(24,204,150,0.45)' }}
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <span className="text-[10px] font-semibold pb-2.5" style={{ color: 'var(--muted)' }}>Chat AI</span>
        </div>

        <button
          type="button"
          onClick={handleAnalysisTap}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors duration-150"
          style={navBtnStyle(isActive('/core-engine'))}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Analysis</span>
        </button>

        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors duration-150"
          style={navBtnStyle(isActive('/profile'))}
        >
          <UserRound className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Profile</span>
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
