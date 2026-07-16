'use client';

import { ChevronLeft, Sparkles } from 'lucide-react';
import styles from '../../app/page.module.css';
import { getTrustMessage } from '../../constants/trustMessages';
import useKeyboardInset from '../../hooks/useKeyboardInset';
import ScrollHintArea from './ScrollHintArea';

/**
 * One-question-at-a-time step shell. Pass `key={stepIndex}` when rendering
 * this from a parent wizard so each step remounts and replays the fade-in.
 * Fills the parent's available height and never scrolls itself — only the
 * answer slot scrolls, as a safety net for unusually tall content.
 */
export default function QuestionScreen({
  stepIndex,
  totalSteps,
  title,
  subtitle,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  nextVariant = 'teal', // 'teal' (default, most steps) | 'pink' (the one true final/hero action)
  onSkip,
  skipLabel = 'Skip',
  userName,
  trustCategory = 'general',
  trustSeed,
  // Optional — breaks a long flat step list into visible sub-sections (used by
  // the mental-wellbeing questionnaire) instead of one long N-of-M counter.
  // { label, color, soft, index, total, position, length, allColors }
  // Renders as two separate bars: a global one (`total` segments, one per
  // sub-category, each lighting up in its own color once reached) and a
  // local one directly below it (`length` segments, one per question in the
  // *current* sub-category) — kept as two distinct signals rather than
  // blending "which section" and "how far into it" into one bar.
  sectionInfo,
  // Optional dynamic "~40 sec left" / "Almost there — last one!" read,
  // pre-computed by the parent from the remaining steps (see utils/estimateTime).
  // Recomputed every step so it counts down in real time as the user answers.
  timeLeftLabel,
  children
}) {
  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
  const nextBg = nextVariant === 'pink' ? 'var(--pink)' : 'var(--teal)';
  const nextShadowClass = nextVariant === 'pink'
    ? 'hover:shadow-[0_6px_20px_rgba(222,69,125,0.3)]'
    : 'hover:shadow-[0_6px_20px_rgba(24,204,150,0.3)]';
  const trustMessage = getTrustMessage(userName, trustCategory, trustSeed ?? stepIndex, title);

  // Pushes the Next button up above the on-screen keyboard — iOS Safari's
  // viewport is supposed to shrink around it, but that's unreliable and
  // flatly doesn't happen inside in-app webviews (WhatsApp, etc.), where a
  // text-input step's Next button ends up hidden behind the keyboard entirely.
  const keyboardInset = useKeyboardInset();

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${styles.dashboard}`}>
      {/* Global progress — one segment per sub-category */}
      <div className="flex items-center gap-3 shrink-0" style={{ marginBottom: sectionInfo ? '8px' : '12px' }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-150 hover:bg-black/5 shrink-0"
            style={{ color: 'var(--muted)' }}
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-8 h-8 shrink-0" />
        )}

        {sectionInfo ? (
          <div className="flex-1 flex items-center gap-1.5">
            {Array.from({ length: sectionInfo.total }).map((_, i) => {
              const reached = i <= sectionInfo.index;
              return (
                <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                  {reached && (
                    <div className="h-full rounded-full" style={{ background: sectionInfo.allColors[i] }} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct}%`, background: 'var(--teal)' }}
            />
          </div>
        )}

        {!sectionInfo && (
          <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--muted)' }}>
            {stepIndex + 1}/{totalSteps}
          </span>
        )}
      </div>

      {/* Local progress — one segment per question in the *current* sub-category */}
      {sectionInfo && (
        <div className="flex items-center gap-3 mb-3 shrink-0">
          <div className="w-8 shrink-0" aria-hidden="true" />
          <div className="flex-1 flex items-center gap-1">
            {Array.from({ length: sectionInfo.length }).map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                {i < sectionInfo.position && (
                  <div className="h-full rounded-full" style={{ background: sectionInfo.color }} />
                )}
              </div>
            ))}
          </div>
          <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--muted)' }}>
            {sectionInfo.position}/{sectionInfo.length}
          </span>
        </div>
      )}

      {sectionInfo && (
        <span
          className="inline-flex self-start items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3 shrink-0"
          style={{ background: sectionInfo.soft, color: sectionInfo.color }}
        >
          {sectionInfo.label}
        </span>
      )}

      {timeLeftLabel && (
        <p className="text-[11px] font-medium mb-3 -mt-1 shrink-0" style={{ color: 'var(--muted)' }}>
          {timeLeftLabel}
        </p>
      )}

      {/* Question */}
      <div className="mb-6 shrink-0">
        <h2 className="font-serif text-2xl leading-snug" style={{ color: 'var(--ink)' }}>{title}</h2>
        {subtitle && (
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>

      {/* Answer content */}
      <ScrollHintArea className={`flex flex-col ${trustCategory === 'mental' ? 'brand-scroll' : ''}`} watch={children}>
        <div className="pb-3">{children}</div>

        {trustMessage && (
          <div className="mt-auto pt-8 pb-1 flex justify-center shrink-0 animate-fade-in">
            <div
              className="flex items-start gap-2 max-w-[260px] px-3.5 py-2.5 rounded-2xl"
              style={{ background: 'var(--soft-pink)' }}
            >
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--pink)' }} />
              <p className="text-[11px] leading-relaxed font-medium text-left" style={{ color: 'var(--pink-d)' }}>
                {trustMessage}
              </p>
            </div>
          </div>
        )}
      </ScrollHintArea>

      {/* Navigation */}
      <div className="mt-6 pt-2 shrink-0" style={{ paddingBottom: keyboardInset }}>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className={`w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-shadow duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none ${nextShadowClass}`}
          style={{ background: nextBg }}
        >
          {nextLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-center text-sm font-medium mt-3 py-1 transition-opacity duration-150 hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
