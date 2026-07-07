'use client';

import { Check, Lock, ArrowRight, Sparkles } from 'lucide-react';

const OPTIONS = [
  { key: 'lifestyle', label: 'Lifestyle & Habits', desc: 'Activity, sleep, habits alignment', included: true },
  { key: 'pathology', label: 'Pathology Reports', desc: 'Blood work — chronic & fertility markers', included: true },
  { key: 'mental', label: 'Mental Wellbeing', desc: 'Emotional & personality compatibility', included: true },
  { key: 'radiology', label: 'Radiology Reports', desc: 'USG, Echo, DEXA scans', included: false, price: '₹999', boostPct: 12 },
  { key: 'genomics', label: 'Genomics Report', desc: 'Carrier & hereditary risk screening', included: false, comingSoon: true }
];

export default function ComparisonSelector({ selected, onToggle, onContinue }) {
  const unlockedCount = OPTIONS.filter((o) => o.included && selected[o.key]).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="mb-5 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--teal)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>New Compatibility Check</span>
        </div>
        <h2 className="font-serif text-xl leading-snug" style={{ color: 'var(--ink)' }}>Build your comparison</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Pick what to include — add more engines anytime to sharpen your result.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {OPTIONS.map((opt) => {
          const isOn = !!selected[opt.key];
          const isLocked = !opt.included;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => !isLocked && !opt.comingSoon && onToggle(opt.key)}
              disabled={isLocked || opt.comingSoon}
              className="w-full flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-colors duration-150"
              style={{
                borderColor: isOn ? 'var(--teal)' : 'var(--line)',
                background: isOn ? 'var(--soft-teal)' : 'var(--surface)',
                opacity: opt.comingSoon ? 0.6 : 1,
                cursor: isLocked || opt.comingSoon ? 'default' : 'pointer'
              }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{
                  borderColor: isOn ? 'var(--teal)' : isLocked ? 'var(--amber)' : 'var(--line)',
                  background: isOn ? 'var(--teal)' : 'transparent'
                }}
              >
                {isOn && <Check className="w-3.5 h-3.5 text-white" />}
                {isLocked && !isOn && <Lock className="w-3 h-3" style={{ color: 'var(--amber-d)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{opt.label}</span>
                  {opt.comingSoon && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--line)', color: 'var(--muted)' }}>
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{opt.desc}</p>
                {isLocked && !opt.comingSoon && (
                  <p className="text-xs font-bold mt-1.5" style={{ color: 'var(--amber-d)' }}>
                    {opt.price} · +{opt.boostPct}% engine confidence
                  </p>
                )}
              </div>
              {isLocked && !opt.comingSoon && (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white shrink-0" style={{ background: 'var(--amber)' }}>
                  Unlock
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-2 shrink-0">
        <p className="text-xs text-center mb-2" style={{ color: 'var(--muted)' }}>
          {unlockedCount}/3 free engines selected — you can fill these in at your own pace.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-shadow duration-150 flex items-center justify-center gap-2"
          style={{ background: 'var(--pink)' }}
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
