'use client';

import { ShieldAlert } from 'lucide-react';
import { RELIABLE_THRESHOLD } from '../utils/healthProfileProgress';

// A real, enforced state — not a label with no behavior behind it. Renders
// nothing at or above RELIABLE_THRESHOLD; below it, a persistent badge
// wherever the score is shown, since several domains are still excluded
// from the composite entirely at low confidence.
export default function ProvisionalBadge({ confidence, className = '' }) {
  if (typeof confidence !== 'number' || confidence >= RELIABLE_THRESHOLD) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${className}`}
      style={{ background: 'var(--soft-amber)', color: 'var(--amber-d)' }}
    >
      <ShieldAlert className="w-3 h-3" />
      Provisional — still building confidence
    </span>
  );
}
