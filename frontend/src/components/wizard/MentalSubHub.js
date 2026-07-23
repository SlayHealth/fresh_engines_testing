'use client';

import { Check, ArrowRight, Info } from 'lucide-react';
import { MENTAL_HEALTH_CATEGORIES, MENTAL_HEALTH_QUESTIONS, mentalCategoryCounts } from '../../constants/mentalHealthQuestions';
import { estimateTimeLeftForCount } from '../../utils/estimateTime';
import ScrollHintArea from './ScrollHintArea';

// Center label is a concrete "3/5" rather than "60%" — an exact count of
// what's left reads as more tangible and less abstract than a percentage,
// and is what people actually picture when they decide whether to start
// something ("just 2 more") versus size up something abstract ("40% to go").
function SubRing({ answered, total, color }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? (answered / total) * 100 : 0;
  const done = total > 0 && answered >= total;
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width={44} height={44} className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {done
          ? <Check className="w-4 h-4" style={{ color }} />
          : <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>{answered}/{total}</span>}
      </div>
    </div>
  );
}

// One page, five cards — every mental-wellbeing subcategory shown at once with
// its own real progress ring, instead of a single flat 1-of-21 walk with a
// nested "section within section" progress bar. Any card can be started in
// any order; finishing one returns here (see add-prospect/page.js's
// activeMentalSubcategory state) rather than auto-advancing into the next.
// `hasEvidence`: a completed match proves all 21 questions were answered in
// a past session, even when the live answers object is empty (that data
// only ever lived in session/draft state — see dashboard/add-prospect's
// hasMentalEvidence). Without this, a returning user would see the hub
// card claim "done" while every subcategory here shows 0 — so it's treated
// as fully answered for display purposes rather than contradicting itself.
export default function MentalSubHub({ answers, onEnter, onDone, allDone, hasEvidence, subjectName }) {
  const totalQuestions = MENTAL_HEALTH_QUESTIONS.length;
  const totalAnswered = hasEvidence ? totalQuestions : MENTAL_HEALTH_QUESTIONS.filter((q) => answers?.[q.id] !== undefined).length;
  const totalRemaining = totalQuestions - totalAnswered;
  const overallEta = estimateTimeLeftForCount(totalRemaining);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="mb-1">
        <h2 className="font-serif text-2xl leading-snug" style={{ color: 'var(--ink)' }}>Mental Wellbeing</h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
          {totalRemaining === 0
            ? `All ${totalQuestions} of ${totalQuestions} answered — nice work.`
            : `${totalAnswered} of ${totalQuestions} answered${overallEta ? ` ${overallEta}` : ''}. Pick up wherever you like.`}
        </p>
      </div>

      <div className="mt-3 p-3.5 rounded-2xl flex items-start gap-2.5 shrink-0" style={{ background: 'var(--soft-teal)' }}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--teal-d)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--teal-d)' }}>
          <b>Why this matters —</b> physical compatibility is only half the picture. How you handle stress, conflict &amp; expectations predicts a relationship&apos;s staying power just as much, which is why this section carries real weight: <b>+20%</b> of your overall confidence score.
        </p>
      </div>

      <ScrollHintArea wrapperClassName="mt-4" className="brand-scroll pb-2" watch={answers}>
        <div className="grid grid-cols-2 gap-2.5">
          {MENTAL_HEALTH_CATEGORIES.map((cat, i) => {
            const rawCounts = mentalCategoryCounts(cat.key, answers);
            const { answered, total } = hasEvidence ? { answered: rawCounts.total, total: rawCounts.total } : rawCounts;
            const remaining = total - answered;
            const eta = estimateTimeLeftForCount(remaining, { compact: true });
            const Icon = cat.icon;
            // Odd one out (5th of 5) spans both columns but is itself
            // width-capped to one column and centered, so it reads as a
            // lone box on its own row rather than a stretched-out one.
            const isOrphan = MENTAL_HEALTH_CATEGORIES.length % 2 === 1 && i === MENTAL_HEALTH_CATEGORIES.length - 1;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onEnter(cat.key)}
                className={`flex flex-col gap-2.5 p-3.5 rounded-2xl border text-left transition-transform duration-150 active:scale-[0.97] ${isOrphan ? 'col-span-2 justify-self-center' : ''}`}
                style={{ borderColor: 'var(--line)', background: 'var(--surface)', width: isOrphan ? 'calc(50% - 5px)' : undefined }}
              >
                <span className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.soft }}>
                    {Icon && <Icon className="w-5 h-5" style={{ color: cat.color }} />}
                  </span>
                  <SubRing answered={answered} total={total} color={cat.color} />
                </span>
                <span className="min-w-0">
                  <b className="block text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>{cat.label}</b>
                  <span className="block text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--muted)' }}>
                    {subjectName && cat.descP ? cat.descP.replace(/\{name\}/g, subjectName) : cat.desc}
                  </span>
                </span>
                <span className="text-[9px] font-semibold" style={{ color: remaining === 0 ? cat.color : 'var(--muted)' }}>
                  {remaining === 0 ? 'Done' : eta}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollHintArea>

      <div className="mt-4 pt-2 shrink-0">
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-shadow duration-150 flex items-center justify-center gap-2"
          style={allDone
            ? { background: 'var(--pink)', color: '#fff' }
            : { background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2, var(--ink))' }}
        >
          {allDone ? 'Finish Mental Wellbeing' : 'Back to Health Profile'}
          {allDone && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
