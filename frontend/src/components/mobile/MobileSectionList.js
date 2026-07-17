'use client';

import { useState } from 'react';
import Ico from './Ico';
import MobileMiniRing from './MobileMiniRing';

// One list row, ported from the mockup's renderList(). `section` shape:
// { id, title, sub, weight, pct, duration, icon, tone, state, price, tests }
// state ∈ 'progress' | 'todo' | 'locked' | 'soon'.
function RowEnd({ s }) {
  if (s.state === 'locked') return <span className="pill pill-out"><Ico name="lock" sm /> Locked</span>;
  if (s.state === 'soon') return <span className="pill pill-ghost">Notify me</span>;
  if (s.pct > 0) return <MobileMiniRing pct={s.pct} tone={s.tone} answered={s.answered} total={s.total} />;
  return <span className="pill pill-out">Start</span>;
}

function Item({ s, onOpen, onUnlock, compact }) {
  const [open, setOpen] = useState(false);
  const disabled = s.state === 'soon';
  return (
    <li className={`item ${s.state === 'soon' ? 'soon' : ''}`} style={{ '--tint': `var(--t-${s.tone})`, '--hue': `var(--h-${s.tone})` }}>
      <button className="row" onClick={() => !disabled && onOpen?.(s)} disabled={disabled} style={{ cursor: disabled ? 'default' : 'pointer' }}>
        <span className="tile"><Ico name={s.icon} /></span>
        <span className="r-main">
          <span className="r-title">
            {s.title}{' '}
            {s.weight ? <span className="tag">+{s.weight}%</span> : <span className="tag">Soon</span>}
          </span>
          <span className="r-sub">{s.sub}{s.duration ? ` ≈${s.duration}` : ''}</span>
          {s.pct > 0 && <span className="bar"><i style={{ width: `${Math.min(100, s.pct)}%` }} /></span>}
        </span>
        <span className="r-end">
          <RowEnd s={s} />
          {s.state !== 'soon' && <Ico name="chev" className="chevron" />}
        </span>
      </button>

      {s.state === 'locked' && !compact && (
        <div className="unlock">
          <span className="u-t"><b>{s.price}</b>One-time — unlock scan uploads &amp; reading</span>
          <button onClick={() => onUnlock?.(s)}>Unlock</button>
        </div>
      )}

      {s.tests && s.tests.length > 0 && !compact && (
        <>
          <button className="acc" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            Suggested tests <Ico name="down" sm />
          </button>
          <div className={`acc-body${open ? ' open' : ''}`}>
            <div className="acc-inner">
              <div className="tests">
                {s.tests.map((t) => <span key={t} className="test">{t}</span>)}
              </div>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

export default function MobileSectionList({ sections, onOpen, onUnlock, compact = false }) {
  return (
    <ul className="list">
      {sections.map((s) => (
        <Item key={s.id} s={s} onOpen={onOpen} onUnlock={onUnlock} compact={compact} />
      ))}
    </ul>
  );
}
