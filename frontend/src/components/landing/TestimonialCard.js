import { Quote } from 'lucide-react';

const COLOR_MAP = {
  amber: { badge: 'var(--amber)', text: 'var(--amber)' },
  pink: { badge: 'var(--pink)', text: 'var(--pink)' },
  teal: { badge: 'var(--teal)', text: 'var(--teal)' }
};

export default function TestimonialCard({ names, location, type, quote, highlight, impact, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.teal;
  return (
    <div className="p-8 rounded-2xl border relative h-full flex flex-col" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg text-slate-900" style={{ background: c.badge }}>
        {type}
      </div>
      <h3 className="text-xl font-bold mb-4" style={{ color: c.text }}>{highlight}</h3>
      <div className="relative flex-1">
        <Quote className="absolute -top-2 -left-2 w-6 h-6 opacity-30 transform -scale-x-100 text-white" />
        <p className="text-slate-300 text-base leading-relaxed mb-6 italic pl-6">{quote}</p>
      </div>
      <div className="flex items-center gap-4 border-t pt-4 mt-auto" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
          {names.split(' ').map((n) => n[0]).join('').substring(0, 2)}
        </div>
        <div>
          <div className="font-semibold text-white">{names}</div>
          <div className="text-xs text-slate-400">{location}</div>
        </div>
      </div>
      <div className="mt-4 text-sm font-medium" style={{ color: c.text }}>{impact}</div>
    </div>
  );
}
