// Ported from the mockup's miniRing(): a small progress ring whose fill is the
// real percentage, colored by the section's hue token (--h-<tone>). The
// mockup's demo data never actually hit 100%, so it never surfaced that
// "100%" is wider than the ring's clear inner space at this font-size —
// at full completion this renders a checkmark instead, same as a real
// percentage would never need to be read past "done".
//
// Center label prefers a concrete "3/6" (answered/total) over an abstract
// "50%" whenever the caller has real counts to give — an exact number of
// fields left reads as more tangible and is what people actually picture
// when sizing up whether to start something. Falls back to "%" for
// categories with no discrete field count (e.g. upload-gated sections).
export default function MobileMiniRing({ pct, tone, id, answered, total }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const rounded = Math.round(pct);
  const done = rounded >= 100;
  const hasCounts = typeof total === 'number' && total > 0;
  return (
    <svg className="mring" id={id} viewBox="0 0 44 44" aria-hidden="true">
      <g transform="rotate(-90 22 22)">
        <circle className="mr-t" cx="22" cy="22" r={r} />
        <circle className="mr-f" cx="22" cy="22" r={r} style={{ stroke: `var(--h-${tone})` }}
          strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </g>
      {done ? (
        <path d="M15 22.5 19.5 27 29 16.5" fill="none" stroke={`var(--h-${tone})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : hasCounts ? (
        // Smaller than the default 11px — "20/21" (mental's aggregate count)
        // needs to fit the same clear space a 2-character "67%" does.
        <text className="mr-x" x="22" y="23" style={{ fontSize: 9 }}>{answered}/{total}</text>
      ) : (
        <text className="mr-x" x="22" y="23">{rounded}%</text>
      )}
    </svg>
  );
}
