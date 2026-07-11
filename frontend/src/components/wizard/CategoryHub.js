'use client';

import { useState } from 'react';
import { Check, ChevronDown, Lock, ArrowRight, Gauge } from 'lucide-react';
import { CONFIDENCE_WEIGHTS, computeConfidence } from '../../utils/healthProfileProgress';

function ProgressRing({ progress, size = 44, locked, done }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;
  const color = locked ? 'var(--muted)' : done ? 'var(--teal)' : progress > 0 ? 'var(--pink)' : 'var(--line)';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {!locked && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {locked ? (
          <Lock className="w-4 h-4" style={{ color: 'var(--muted)' }} />
        ) : done ? (
          <Check className="w-4 h-4" style={{ color: 'var(--teal)' }} />
        ) : (
          <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>{Math.round(progress)}%</span>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ category, onEnter, onUnlock }) {
  const { icon: Icon, label, desc, progress = 0, locked, comingSoon, price, suggestedTests, required } = category;
  const weight = CONFIDENCE_WEIGHTS[category.key];
  const [showSuggested, setShowSuggested] = useState(false);
  const done = progress >= 100;
  // Subtle nudge toward the one card that's effectively mandatory (basics like
  // age/gender live here) — nothing else in the hub visually distinguishes it
  // from optional cards, so it's easy to skip straight to uploads and never see it.
  const needsAttention = required && !done && !locked && !comingSoon;

  return (
    <div
      className="rounded-2xl border transition-all"
      style={{
        background: needsAttention ? 'var(--soft-blue)' : 'var(--surface)',
        borderColor: done ? 'var(--teal)' : needsAttention ? 'var(--info)' : 'var(--line)',
        opacity: comingSoon ? 0.65 : 1
      }}
    >
      <button
        type="button"
        onClick={() => !locked && !comingSoon && onEnter(category.key)}
        disabled={locked || comingSoon}
        className="w-full flex items-center gap-3.5 p-4 text-left"
        style={{ cursor: locked || comingSoon ? 'default' : 'pointer' }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--paper)' }}>
          <Icon className="w-5 h-5" style={{ color: locked ? 'var(--muted)' : 'var(--teal-d)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</h3>
            {comingSoon && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--line)', color: 'var(--muted)' }}>
                Coming soon
              </span>
            )}
            {!comingSoon && !!weight && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                style={{ background: done ? 'var(--soft-teal)' : 'var(--soft-amber)', color: done ? 'var(--teal-d)' : 'var(--amber-d)' }}
              >
                +{weight}% confidence
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{desc}</p>
        </div>
        {!comingSoon && <ProgressRing progress={progress} locked={locked} done={done} />}
      </button>

      {locked && !comingSoon && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onUnlock?.(category.key)}
            disabled={!onUnlock}
            className="w-full rounded-xl p-3 flex items-center justify-between gap-3 text-left transition-opacity duration-150 hover:opacity-90 disabled:cursor-default"
            style={{ background: 'var(--soft-amber)' }}
          >
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--amber-d)' }}>{price}</p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: 'var(--amber)' }}>
              Unlock
            </span>
          </button>
        </div>
      )}

      {suggestedTests && suggestedTests.length > 0 && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => setShowSuggested((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--teal-d)' }}
          >
            Suggested tests
            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: showSuggested ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showSuggested && (
            <ul className="mt-2 space-y-1">
              {suggestedTests.map((t) => (
                <li key={t} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--line)' }} />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function CategoryHub({
  heading,
  subheading,
  categories,
  onEnter,
  onUnlock,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryHint,
  embedded = false,
  confidenceLabel = 'Engine Confidence'
}) {
  const confidence = computeConfidence(categories);
  return (
    <div className={embedded ? '' : 'flex-1 flex flex-col overflow-hidden'}>
      {(heading || subheading) && (
        <div className="mb-4 shrink-0">
          {heading && <h2 className="font-serif text-xl leading-snug" style={{ color: 'var(--ink)' }}>{heading}</h2>}
          {subheading && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{subheading}</p>}
        </div>
      )}

      <div className="rounded-2xl p-4 mb-4 shrink-0 border border-(--teal)/25" style={{ background: 'var(--soft-teal)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--teal-d)' }}>
            <Gauge className="w-3.5 h-3.5" />
            {confidenceLabel}
          </span>
          <span className="text-sm font-extrabold" style={{ color: 'var(--teal-d)' }}>{confidence}%</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${confidence}%`, background: 'var(--teal)' }}
          />
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--teal-d)' }}>
          Fill in each section below to raise your engine's confidence in the analysis.
        </p>
      </div>

      <div className={embedded ? 'space-y-3' : 'flex-1 overflow-y-auto space-y-3 pb-2'}>
        {categories.map((cat) => (
          <CategoryCard key={cat.key} category={cat} onEnter={onEnter} onUnlock={onUnlock} />
        ))}
      </div>

      {primaryLabel && (
        <div className="mt-4 pt-2 shrink-0">
          {primaryHint && <p className="text-xs text-center mb-2" style={{ color: 'var(--amber-d)' }}>{primaryHint}</p>}
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-shadow duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'var(--pink)' }}
          >
            {primaryLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
