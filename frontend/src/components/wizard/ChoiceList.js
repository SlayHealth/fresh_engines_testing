'use client';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Full-width single-select list for one-question-per-screen wizard steps.
 * Only selects a value — advancing to the next question is always a
 * separate, explicit tap on the step's own Next button.
 *
 * Every option always shows a radio-style indicator (empty ring / filled
 * dot), not just a checkmark on the selected one — a persistent circular
 * indicator is the universal "pick exactly one" signal, whereas a checkmark
 * that only appears after picking reads like a multi-select filter chip.
 * Real `role="radio"` semantics reinforce the same thing for screen readers.
 */
export default function ChoiceList({ options, value, onChange }) {
  const handlePick = (val) => {
    onChange(val);
  };

  return (
    <div className="space-y-2.5" role="radiogroup">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = value === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handlePick(opt.val)}
            className={cn(
              'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left cursor-pointer transition-colors duration-150'
            )}
            style={{
              borderColor: isSelected ? 'var(--pink)' : 'var(--line)',
              background: isSelected ? 'var(--soft-pink)' : 'var(--surface)'
            }}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-150"
              style={{ borderColor: isSelected ? 'var(--pink)' : 'var(--line)' }}
            >
              {isSelected && <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--pink)' }} />}
            </span>
            {Icon && (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isSelected ? '#fff' : 'var(--line)' }}
              >
                <Icon className="w-5 h-5" style={{ color: isSelected ? 'var(--pink-d)' : 'var(--muted)' }} />
              </div>
            )}
            <div className="flex-1 pt-0.5">
              <span className="block font-semibold text-sm" style={{ color: 'var(--ink)' }}>{opt.label}</span>
              {opt.desc && (
                <span className="block text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{opt.desc}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
