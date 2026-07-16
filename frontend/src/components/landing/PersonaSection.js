'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Heart, RefreshCw, Baby, Shield, ArrowRight, ArrowDown, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const ICONS = { Users, Heart, RefreshCw, Baby, Shield };

const COLOR_MAP = {
  pink: { border: 'var(--pink)', bg: 'var(--soft-pink)', text: 'var(--pink-d)', btn: 'var(--pink)', btnHover: 'var(--pink-d)' },
  teal: { border: 'var(--teal)', bg: 'var(--soft-teal)', text: 'var(--teal-d)', btn: 'var(--teal)', btnHover: 'var(--teal-d)' },
  amber: { border: 'var(--amber)', bg: 'var(--soft-amber)', text: 'var(--amber-d)', btn: 'var(--amber)', btnHover: 'var(--amber-d)' },
  danger: { border: 'var(--danger)', bg: 'var(--soft-danger)', text: 'var(--danger)', btn: 'var(--danger)', btnHover: 'var(--danger-d)' },
  info: { border: 'var(--info)', bg: 'var(--soft-blue)', text: 'var(--info)', btn: 'var(--info)', btnHover: 'var(--info)' }
};

export default function PersonaSection({ personas }) {
  const [selectedId, setSelectedId] = useState(personas[0]?.id || '');
  const selected = personas.find((p) => p.id === selectedId);
  const colors = COLOR_MAP[selected.color] || COLOR_MAP.teal;
  const SelectedIcon = ICONS[selected.icon] || Users;

  const topRow = personas.slice(0, 3);
  const bottomRow = personas.slice(3);

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {topRow.map((persona) => (
            <PersonaCard key={persona.id} persona={persona} isActive={persona.id === selectedId} onClick={() => setSelectedId(persona.id)} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-5 lg:gap-6">
          {bottomRow.map((persona) => (
            <PersonaChip key={persona.id} persona={persona} isActive={persona.id === selectedId} onClick={() => setSelectedId(persona.id)} />
          ))}
        </div>
      </div>

      <div
        key={selected.id}
        className="rounded-2xl border overflow-hidden shadow-sm animate-fade-in-up"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      >
        <div className="px-6 lg:px-8 py-5 flex items-center justify-between" style={{ background: colors.btn }}>
          <div className="flex items-center gap-3 text-white">
            <SelectedIcon className="w-5 h-5 lg:w-6 lg:h-6" />
            <span className="font-bold text-sm lg:text-base">{selected.title} — Assessment Overview</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white/80 text-xs lg:text-sm">
            <Clock className="w-3.5 h-3.5" />
            Results in 48 hours
          </div>
        </div>

        <div className="p-6 lg:p-8 space-y-6">
          <div className="rounded-lg px-5 py-4 flex items-start gap-3" style={{ background: colors.bg }}>
            <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5 mt-0.5 flex-shrink-0" style={{ color: colors.text }} />
            <p className="text-sm lg:text-base leading-relaxed" style={{ color: 'var(--ink)' }}>{selected.warningStat}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
            {selected.needs.map((need, i) => (
              <div key={i} className="rounded-lg border border-l-4 p-4 lg:p-5" style={{ borderColor: 'var(--line)', borderLeftColor: colors.border }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.text }}>
                  Check {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-sm lg:text-base leading-snug" style={{ color: 'var(--ink)' }}>{need}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'var(--paper)' }}>
            <div>
              <p className="font-bold text-sm lg:text-base" style={{ color: 'var(--ink)' }}>
                Begin your {selected.title.toLowerCase()} health assessment
              </p>
              <p className="text-xs lg:text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                15-minute intake · Evidence-based · Starting at <strong>₹{selected.price}</strong>
              </p>
            </div>
            <Link
              href="/login"
              className="text-white px-6 py-3 rounded-full font-bold text-sm lg:text-base transition-all hover:scale-105 flex items-center gap-2 whitespace-nowrap"
              style={{ background: colors.btn }}
            >
              Start Assessment <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaCard({ persona, isActive, onClick }) {
  const c = COLOR_MAP[persona.color] || COLOR_MAP.teal;
  const Icon = ICONS[persona.icon] || Users;
  return (
    <button
      onClick={onClick}
      className="h-full flex flex-col text-left rounded-xl p-6 border-2 transition-all duration-200 relative"
      style={{
        borderColor: isActive ? c.border : 'var(--line)',
        background: isActive ? c.bg : 'var(--surface)',
        boxShadow: isActive ? '0 4px 16px rgba(20,22,26,0.06)' : 'none'
      }}
    >
      {isActive && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: c.btn }}>
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isActive ? 'var(--surface)' : 'var(--paper)', color: isActive ? c.text : 'var(--muted)' }}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-base" style={{ color: isActive ? c.text : 'var(--ink)' }}>{persona.title}</h3>
          {isActive && <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.text }}>Selected</span>}
        </div>
      </div>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--muted)' }}>{persona.desc}</p>
      <ul className="space-y-2 flex-1">
        {persona.needs.map((need, i) => (
          <li key={i} className="text-sm flex items-start gap-2 leading-snug" style={{ color: 'var(--muted)' }}>
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: isActive ? c.border : 'var(--line)' }} />
            {need}
          </li>
        ))}
      </ul>
      {isActive ? (
        <p className="text-sm font-semibold mt-5 flex items-center gap-1.5" style={{ color: c.text }}>
          View detailed assessment <ArrowDown className="w-3.5 h-3.5" />
        </p>
      ) : (
        <p className="text-sm mt-5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          Explore checks <ArrowRight className="w-3.5 h-3.5" />
        </p>
      )}
    </button>
  );
}

function PersonaChip({ persona, isActive, onClick }) {
  const c = COLOR_MAP[persona.color] || COLOR_MAP.teal;
  const Icon = ICONS[persona.icon] || Users;
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl px-6 py-5 border-2 transition-all duration-200 relative flex items-center gap-4 min-w-[260px]"
      style={{
        borderColor: isActive ? c.border : 'var(--line)',
        background: isActive ? c.bg : 'var(--surface)',
        boxShadow: isActive ? '0 4px 16px rgba(20,22,26,0.06)' : 'none'
      }}
    >
      {isActive && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: c.btn }}>
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isActive ? 'var(--surface)' : 'var(--paper)', color: isActive ? c.text : 'var(--muted)' }}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-base" style={{ color: isActive ? c.text : 'var(--ink)' }}>{persona.title}</h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{persona.desc}</p>
      </div>
    </button>
  );
}
