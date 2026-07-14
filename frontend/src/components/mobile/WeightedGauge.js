'use client';

import { useEffect, useRef, useState } from 'react';

// Signature gauge from the mockup: one arc per weighted section, arc LENGTH
// encodes the section's weight, arc FILL encodes its real progress, colored by
// the section's ring hue. Math ported verbatim (R=54, GAP=16).
const R = 54;
const C = 2 * Math.PI * R;
const GAP = 16;

function useCountUp(target, ms = 1100) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : ms;
    let start;
    const step = (t) => {
      if (start === undefined) start = t;
      const p = dur === 0 ? 1 : Math.min((t - start) / dur, 1);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return n;
}

// sections: [{ weight, pct, tone }] — already weighted (weight > 0), in display order.
export default function WeightedGauge({ sections, confidence, subLabel }) {
  const [go, setGo] = useState(false);
  const confNum = useCountUp(confidence);

  useEffect(() => {
    const id = setTimeout(() => setGo(true), 120);
    return () => clearTimeout(id);
  }, []);

  const arcs = [];
  let start = 0;
  sections.forEach((s, i) => {
    const len = (s.weight / 100) * C;
    const seg = Math.max(len - GAP, 2);
    const off = -(start + GAP / 2);
    arcs.push(
      <circle key={`t${i}`} className="g-track" cx="70" cy="70" r={R}
        strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={off} />
    );
    if (s.pct > 0) {
      const fill = Math.max((seg * s.pct) / 100, 1);
      arcs.push(
        <circle key={`f${i}`} className={`g-fill${go ? ' go' : ''}`} cx="70" cy="70" r={R}
          style={{ stroke: `var(--r-${s.tone})` }}
          strokeDasharray={go ? `${fill} ${C - fill}` : `0.01 ${C}`}
          strokeDashoffset={off} />
      );
    }
    start += len;
  });

  return (
    <div className="gauge-wrap">
      <svg className="gauge" viewBox="0 0 140 140" aria-hidden="true">
        <g transform="rotate(-90 70 70)">{arcs}</g>
      </svg>
      <div className="gauge-c">
        <div className="gauge-n serif tnum">{confNum}<i>%</i></div>
        <div className="gauge-s">{subLabel}</div>
      </div>
    </div>
  );
}
