'use client';

import { useRouter } from 'next/navigation';
import { Brain, HeartHandshake, ShieldCheck, Users, Stethoscope, Sparkles } from 'lucide-react';
import { useCompatibility } from '../../../contexts/CompatibilityContext';

// Mirrors mental.controller.js's computeMentalResult exactly — pillar order,
// labels, and weights (which must sum to 100) all match the live scoring
// engine so this page can never silently drift from what actually produced
// the numbers it's displaying.
const PILLARS = [
  { key: 'emotionalHealth', label: 'Emotional Health', weight: 15 },
  { key: 'personalityAttachment', label: 'Personality & Attachment', weight: 20 },
  { key: 'marriageReadiness', label: 'Marriage Readiness', weight: 25 },
  { key: 'lifeCareerAlignment', label: 'Life & Career Alignment', weight: 15 },
  { key: 'familyParentingAlignment', label: 'Family & Parenting', weight: 15 },
  { key: 'riskFactors', label: 'Risk Factors', weight: 10 }
];

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-slate-900">{Math.round(value)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function MentalEnginePage() {
  const router = useRouter();
  const { mentalResult, user, prospectForm } = useCompatibility();

  const partnerAName = user?.name || 'Partner A';
  const partnerBName = prospectForm?.name || 'Partner B';

  if (!mentalResult) {
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="inline-flex p-4 rounded-full bg-teal-50 text-teal-600 mb-4">
          <Brain size={36} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Mental Wellbeing Not Yet Assessed</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          Stress resilience, attachment patterns, and relationship readiness aren't part of your
          combined score yet. Complete the Mental Wellbeing questionnaire for both partners to
          unlock this section.
        </p>
        <button
          type="button"
          onClick={() => router.push('/add-prospect?enter=mental')}
          className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          Complete the Questionnaire
        </button>
      </div>
    );
  }

  const { overall_readiness: ov, pillar_scores: pillars, couple_analysis: analysis } = mentalResult;

  const stateMeta = {
    'Highly Aligned': { c: 'emerald', icon: ShieldCheck },
    'Moderate Alignment': { c: 'amber', icon: Users },
    'Discussion Recommended': { c: 'rose', icon: Stethoscope }
  }[ov.label] || { c: 'slate', icon: Brain };
  const StateIcon = stateMeta.icon;

  return (
    <div className="space-y-6">
      {/* Headline */}
      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-${stateMeta.c}-50 text-${stateMeta.c}-600`}>
            <StateIcon size={22} />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Overall relationship readiness</span>
            <div className="flex items-baseline gap-3">
              <h2 className={`text-3xl font-bold text-${stateMeta.c}-700 font-mono tabular-nums`}>{ov.score}</h2>
              <span className={`text-sm font-semibold text-${stateMeta.c}-700`}>{ov.label}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Agreement index {ov.agreement_index}/100 · {partnerAName} {ov.partner_A_overall}/100 · {partnerBName} {ov.partner_B_overall}/100
            </p>
          </div>
        </div>
      </section>

      {/* Attachment insight — the single most data-dense narrative line the
          engine produces (pursue-withdraw dynamic, mutual security, etc.) */}
      {analysis?.attachment_insight && (
        <section className="rounded-xl bg-teal-50/60 border border-teal-100 p-5 text-left">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700 mb-2">
            <HeartHandshake size={14} /> Attachment Dynamic
          </h3>
          <p className="text-sm leading-relaxed text-slate-700">{analysis.attachment_insight}</p>
        </section>
      )}

      {/* Six pillars, side by side */}
      <div className="text-left">
        <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-900">Pillar breakdown</h3>
        <p className="mb-4 text-xs text-slate-500">
          Each pillar's weight in the overall score is fixed — Marriage Readiness carries the most (25%), Risk Factors the least (10%).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 text-left">
        {[{ tag: partnerAName, side: 'A' }, { tag: partnerBName, side: 'B' }].map(({ tag, side }) => (
          <div key={side} className="rounded-xl border-l-4 border-teal-600 bg-white p-4 ring-1 ring-slate-200 space-y-4">
            <span className="text-xs font-semibold text-slate-600">{tag}</span>
            {PILLARS.map((p) => (
              <ScoreBar
                key={p.key}
                label={`${p.label} (${p.weight}%)`}
                value={pillars[p.key]?.[side] ?? 0}
                color={side === 'A' ? '#0d9488' : '#7c3aed'}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Strengths / Discussion areas / Risk factors, matching the same
          3-column "good things / observations / attention" pattern the
          radiology page uses for its AI couple summary. */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
        <h3 className="text-base font-bold text-emerald-700 flex items-center gap-2 mb-4">
          <Sparkles size={20} />
          Couple Analysis
        </h3>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Strengths</h4>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
              {(analysis?.strengths || []).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Worth Discussing</h4>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
              {(analysis?.discussion_areas || []).length > 0 ? analysis.discussion_areas.map((item, i) => <li key={i}>{item}</li>) : <li>None flagged</li>}
            </ul>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Risk Factors</h4>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
              {(analysis?.risk_factors || []).length > 0 ? analysis.risk_factors.map((item, i) => <li key={i}>{item}</li>) : <li>None flagged</li>}
            </ul>
          </div>
        </div>
        {analysis?.recommendations?.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recommendations</h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
              {analysis.recommendations.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
