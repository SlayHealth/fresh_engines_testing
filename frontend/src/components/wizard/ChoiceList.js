'use client';

import { Check } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Full-width single-select list for one-question-per-screen wizard steps.
 * Calls onChange immediately, then onAdvance (if provided) after a short
 * delay so the user sees their tap register before the step advances.
 */
export default function ChoiceList({ options, value, onChange, onAdvance, advanceDelay = 180 }) {
  const handlePick = (val) => {
    onChange(val);
    if (onAdvance) {
      setTimeout(onAdvance, advanceDelay);
    }
  };

  return (
    <div className="space-y-2.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = value === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            onClick={() => handlePick(opt.val)}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left cursor-pointer transition-colors duration-150'
            )}
            style={{
              borderColor: isSelected ? 'var(--pink)' : 'var(--line)',
              background: isSelected ? 'var(--soft-pink)' : 'var(--surface)'
            }}
          >
            {Icon && (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isSelected ? '#fff' : 'var(--line)' }}
              >
                <Icon className="w-5 h-5" style={{ color: isSelected ? 'var(--pink-d)' : 'var(--muted)' }} />
              </div>
            )}
            <div className="flex-1">
              <span className="block font-semibold text-sm" style={{ color: 'var(--ink)' }}>{opt.label}</span>
              {opt.desc && (
                <span className="block text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{opt.desc}</span>
              )}
            </div>
            {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--pink-d)' }} />}
          </button>
        );
      })}
    </div>
  );
}
