'use client';

import { CONFIDENCE_WEIGHTS, categoryTone, TONE_COLORS } from '../../utils/healthProfileProgress';

// Horizontal weighted confidence bar — one segment per category, WIDTH fixed
// to that category's real share of CONFIDENCE_WEIGHTS (never the identity of
// the category), FILL proportional to its real progress. Label degrades by
// rendered segment width, not by which category it is: a wide segment
// (Pathology, 35%) gets its full title; a narrow one (Radiology, 10%) gets a
// compact "+10"; a sliver gets no label at all, just a colored dot.
//
// Invariant this component exists to protect: for every segment,
// earned + owed === weight, and sum(weight) === 100. If CONFIDENCE_WEIGHTS
// is ever edited to stop summing to 100, this bar's math becomes a silent
// lie — so that's asserted loudly in dev rather than left as a comment.
const FULL_LABEL_MIN_PCT = 15;
const COMPACT_LABEL_MIN_PCT = 8;

// The category list's real display labels ("Lifestyle & Habits", "Mental
// Wellbeing") are written for a full-width card, not a ~15-20%-wide bar
// segment — at these weights they were overflowing their own segment and
// getting hard-clipped. Short aliases here, used only inside this bar.
const SHORT_LABELS = {
  about: 'About',
  lifestyle: 'Lifestyle',
  pathology: 'Pathology',
  radiology: 'Radiology',
  mental: 'Mental',
  genomics: 'Genomics'
};

export default function ScoreBar({ categories, targetMarker, height = 10 }) {
  const weighted = categories.filter((c) => CONFIDENCE_WEIGHTS[c.key]);
  const totalWeight = weighted.reduce((sum, c) => sum + (CONFIDENCE_WEIGHTS[c.key] || 0), 0);

  if (process.env.NODE_ENV !== 'production') {
    console.assert(
      totalWeight === 100,
      `ScoreBar: CONFIDENCE_WEIGHTS must sum to 100 across weighted categories, got ${totalWeight} — the bar's math is silently wrong otherwise.`
    );
    weighted.forEach((c) => {
      const weight = CONFIDENCE_WEIGHTS[c.key];
      const earned = weight * ((c.progress || 0) / 100);
      const owed = weight - earned;
      console.assert(
        Math.abs(earned + owed - weight) < 0.001,
        `ScoreBar: earned+owed must equal weight for "${c.key}" (earned=${earned}, owed=${owed}, weight=${weight}).`
      );
    });
  }

  const segments = weighted.map((c) => ({
    ...c,
    widthPct: totalWeight > 0 ? (CONFIDENCE_WEIGHTS[c.key] / totalWeight) * 100 : 0
  }));

  return (
    <div className="w-full">
      {/* Label row — same proportional flex-basis as the bar below it, so labels align without absolute-position math */}
      <div className="flex mb-1.5" aria-hidden="true">
        {segments.map((s) => {
          const tone = categoryTone(s);
          const { text } = TONE_COLORS[tone];
          let label = null;
          if (s.widthPct >= FULL_LABEL_MIN_PCT) {
            label = <span className="text-[10.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis block" style={{ color: text }}>{SHORT_LABELS[s.key] || s.label}</span>;
          } else if (s.widthPct >= COMPACT_LABEL_MIN_PCT) {
            label = <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: text }}>+{CONFIDENCE_WEIGHTS[s.key]}</span>;
          }
          return (
            <div key={s.key} style={{ flex: `${s.widthPct} 0 0%`, minWidth: 0 }} className="px-1 overflow-hidden">
              {label}
            </div>
          );
        })}
      </div>

      {/* The bar itself */}
      <div className="relative w-full flex rounded-full overflow-hidden" style={{ height, background: 'var(--line)' }}>
        {segments.map((s) => {
          const tone = categoryTone(s);
          const { color } = TONE_COLORS[tone];
          return (
            <div
              key={s.key}
              className="relative h-full"
              style={{ flex: `${s.widthPct} 0 0%`, borderRight: '2px solid var(--paper)', minWidth: 0 }}
            >
              <div
                className="absolute inset-y-0 left-0 h-full transition-[width] duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, s.progress || 0))}%`, background: color }}
              />
            </div>
          );
        })}
        {typeof targetMarker === 'number' && (
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{ left: `${targetMarker}%`, background: 'var(--ink)', opacity: 0.3 }}
            aria-hidden="true"
          />
        )}
      </div>

      {typeof targetMarker === 'number' && (
        <div className="relative mt-1" style={{ height: 14 }} aria-hidden="true">
          <span
            className="absolute text-[9.5px] font-bold uppercase tracking-wide"
            style={{ left: `${targetMarker}%`, transform: 'translateX(-50%)', color: 'var(--muted)' }}
          >
            reliable
          </span>
        </div>
      )}
    </div>
  );
}
