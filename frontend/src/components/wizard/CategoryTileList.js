'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Check } from 'lucide-react';
import { CONFIDENCE_WEIGHTS, categoryTone, TONE_COLORS } from '../../utils/healthProfileProgress';

function MiniRing({ progress, tone, size = 34 }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  const { color } = TONE_COLORS[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {progress >= 100
          ? <Check className="w-3.5 h-3.5" style={{ color }} />
          : <span className="text-[9px] font-bold" style={{ color: 'var(--muted)' }}>{Math.round(progress)}%</span>}
      </div>
    </div>
  );
}

function Tile({ category, onEnter, onUnlock, compact }) {
  const [showTests, setShowTests] = useState(false);
  const { key, label, desc, progress = 0, locked, comingSoon, icon: Icon, price, suggestedTests } = category;
  const tone = categoryTone(category);
  const { color, soft, text } = TONE_COLORS[tone];
  const weight = CONFIDENCE_WEIGHTS[key];

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--line)', background: 'var(--surface)', opacity: comingSoon ? 0.65 : 1 }}>
      <button
        type="button"
        onClick={() => !locked && !comingSoon && onEnter(key)}
        disabled={locked || comingSoon}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        style={{ cursor: locked || comingSoon ? 'default' : 'pointer' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: soft }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{label}</h3>
            {comingSoon ? (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--line)', color: 'var(--muted)' }}>Soon</span>
            ) : weight ? (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: soft, color: text }}>+{weight}%</span>
            ) : null}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{desc}</p>
        </div>
        {!comingSoon && (
          locked
            ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}><Lock className="w-3 h-3" /> Locked</span>
            : <MiniRing progress={progress} tone={tone} />
        )}
        {!comingSoon && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--muted)' }} />}
      </button>

      {locked && !comingSoon && !compact && (
        <div className="px-3.5 pb-3.5">
          <button
            type="button"
            onClick={() => onUnlock?.(key)}
            disabled={!onUnlock}
            className="w-full rounded-xl p-3 flex items-center justify-between gap-3 text-left transition-opacity duration-150 hover:opacity-90"
            style={{ background: 'var(--soft-amber)' }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--amber-d)' }}>{price} — one-time unlock</span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: 'var(--amber)' }}>Unlock</span>
          </button>
        </div>
      )}

      {suggestedTests && suggestedTests.length > 0 && !compact && (
        <div className="px-3.5 pb-3.5">
          <button
            type="button"
            onClick={() => setShowTests((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--teal-d)' }}
            aria-expanded={showTests}
          >
            Suggested tests
            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" style={{ transform: showTests ? 'rotate(180deg)' : 'none' }} />
          </button>
          {showTests && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {suggestedTests.map((t) => (
                <li key={t} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: 'var(--line)', color: 'var(--ink)' }}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Always renders every category — no hide-on-complete, no ack/exiting state.
// Used by both the Home and Questionnaire mobile screens; `compact` drops the
// unlock banner and suggested-tests accordion for the Questionnaire hub.
export default function CategoryTileList({ categories, onEnter, onUnlock, compact = false }) {
  return (
    <div className="space-y-2.5">
      {categories.map((cat) => (
        <Tile key={cat.key} category={cat} onEnter={onEnter} onUnlock={onUnlock} compact={compact} />
      ))}
    </div>
  );
}
