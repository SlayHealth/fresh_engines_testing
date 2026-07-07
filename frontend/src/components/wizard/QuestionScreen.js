'use client';

import { ChevronLeft } from 'lucide-react';
import styles from '../../app/page.module.css';

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
  children
}) {
  const progressPct = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;
  const nextBg = nextVariant === 'pink' ? 'var(--pink)' : 'var(--teal)';
  const nextShadowClass = nextVariant === 'pink'
    ? 'hover:shadow-[0_6px_20px_rgba(222,69,125,0.3)]'
    : 'hover:shadow-[0_6px_20px_rgba(24,204,150,0.3)]';

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${styles.dashboard}`}>
      {/* Progress bar + step counter */}
      <div className="flex items-center gap-3 mb-6 shrink-0">
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
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%`, background: 'var(--teal)' }}
          />
        </div>
        <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--muted)' }}>
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* Question */}
      <div className="mb-6 shrink-0">
        <h2 className="font-serif text-2xl leading-snug" style={{ color: 'var(--ink)' }}>{title}</h2>
        {subtitle && (
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>

      {/* Answer content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>

      {/* Navigation */}
      <div className="mt-6 pt-2 shrink-0">
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
