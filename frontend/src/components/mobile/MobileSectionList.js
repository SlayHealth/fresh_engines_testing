'use client';

import { useState } from 'react';
import Ico from './Ico';
import MobileMiniRing from './MobileMiniRing';

// One list row, ported from the mockup's renderList(). `section` shape:
// { id, title, sub, weight, pct, duration, icon, tone, state, price, tests }
// state ∈ 'progress' | 'todo' | 'locked' | 'soon'.
//
// `s.tone` is the section's own brand-identity hue (pink for About You, teal
// for Lifestyle, etc.) — used for the icon tile, where it correctly answers
// "which section is this." The completion ring/bar answer a different
// question ("how done is it") and previously reused that same tone, so a
// fully-completed About You card kept showing a magenta/red ring and
// checkmark — reading as an error state rather than success. `statusTone`
// maps completion, not section identity: amber while in progress, green
// once done ('todo'/0% never reaches either — RowEnd renders a neutral
// "Start" pill instead of a ring for that state).
function statusToneFor(pct) {
  return pct >= 100 ? 'moss' : 'gold';
}

function RowEnd({ s }) {
  if (s.state === 'locked') return <span className="pill pill-out"><Ico name="lock" sm /> Locked</span>;
  if (s.state === 'soon') return <span className="pill pill-ghost">Notify me</span>;
  if (s.pct > 0) return <MobileMiniRing pct={s.pct} tone={statusToneFor(s.pct)} answered={s.answered} total={s.total} />;
  return <span className="pill pill-out">Start</span>;
}

function Item({ s, onOpen, onUnlock, compact }) {
  const [open, setOpen] = useState(false);
  const disabled = s.state === 'soon';
  const statusVar = s.pct > 0 ? `var(--h-${statusToneFor(s.pct)})` : 'var(--line)';
  return (
    <li className={`item ${s.state === 'soon' ? 'soon' : ''}`} style={{ '--tint': `var(--t-${s.tone})`, '--hue': `var(--h-${s.tone})`, '--status': statusVar }}>
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
