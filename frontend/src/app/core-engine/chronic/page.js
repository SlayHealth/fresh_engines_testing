'use client';

import { useMemo } from 'react';
import { 
  ShieldCheck, Users, Stethoscope, Info, TriangleAlert, 
  ArrowRight, ClipboardList, Plus, Activity
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';
import { 
  useCompatibility, 
  getDriftedBiomarkers, 
  getRiskDrivers, 
  idrsBand, 
  SEV, 
  fmt, 
  clamp 
} from '../../../contexts/CompatibilityContext';

function Chip({ className, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  );
}

export default function ChronicEnginePage() {
  const { chronicResult, selectedProjYear } = useCompatibility();

  // Dynamic values based on selected slider year
  const chronicTimeline = useMemo(() => {
    if (!chronicResult || !chronicResult.projection) return null;
    const year = selectedProjYear;
    
    // 1. Get projected IDRS scores
    const sA = chronicResult.projection.idrsA[year] ?? 0;
    const sB = chronicResult.projection.idrsB[year] ?? 0;
    
    const rawA = chronicResult.partner_A?.rawValues || {};
    const rawB = chronicResult.partner_B?.rawValues || {};
    const lifestyleA = chronicResult.partner_A?.lifestyle || {};
    const lifestyleB = chronicResult.partner_B?.lifestyle || {};

    // 2. Compute dynamic/drifted biomarkers
    const bioA = getDriftedBiomarkers(rawA, lifestyleA, year, 'male');
    const bioB = getDriftedBiomarkers(rawB, lifestyleB, year, 'female');

    const gateFired = chronicResult.diabeticRangeDetected;
    const markersFlagged = bioA.flagged + bioB.flagged;
    
    // Check if HbA1c is in diabetic range after drift
    const currentHba1cA = bioA.rows.find(r => r.k === "HbA1c")?.v || rawA.hba1c || 0;
    const currentHba1cB = bioB.rows.find(r => r.k === "HbA1c")?.v || rawB.hba1c || 0;
    const diabeticCount = (currentHba1cA >= 6.5 ? 1 : 0) + (currentHba1cB >= 6.5 ? 1 : 0);

    // 3. Dynamic compatibility state based on projection curves
    const currentCurve = chronicResult.projection.currentLifestyle || chronicResult.projection.current || [];
    const optimizedCurve = chronicResult.projection.optimizedLifestyle || chronicResult.projection.optimized || [];
    const currentScenario = currentCurve[year] ?? 0;
    const optimisedScenario = optimizedCurve[year] ?? 0;
    
    let state = 'Aligned';
    if (gateFired || currentScenario < 50) {
      state = 'Specialist conversation';
    } else if (currentScenario < 75) {
      state = 'Plan together';
    }
    
    let tier = null;
    if (state === 'Specialist conversation') {
      tier = diabeticCount === 2 || markersFlagged >= 5 ? 'escalated' : (gateFired ? 'soft' : 'baseline');
    }

    const coupleIdx = (protA, protB, w) => {
      const lo = Math.min(protA, protB), hi = Math.max(protA, protB);
      return w * lo + (1 - w) * hi;
    };

    const protA = 100 - sA;
    const protB = 100 - sB;

    const bandLo = coupleIdx(protA, protB, 0.7);
    const bandHi = coupleIdx(protA, protB, 0.5);
    const central = coupleIdx(protA, protB, 0.6);
    
    const dividend = optimisedScenario - currentScenario;
    
    return {
      sA, sB, bioA, bioB, gateFired, markersFlagged, diabeticCount,
      state, tier, bandLo, bandHi, central, currentScenario, optimisedScenario, dividend,
      bandObjA: idrsBand(sA), bandObjB: idrsBand(sB),
      proj: chronicResult.projection.years.map((y, i) => ({
        year: y,
        current: Math.round(currentCurve[i] ?? 0),
        optimized: Math.round(optimizedCurve[i] ?? 0),
        A: chronicResult.projection.idrsA[i] ?? 0,
        B: chronicResult.projection.idrsB[i] ?? 0
      }))
    };
  }, [chronicResult, selectedProjYear]);

  if (!chronicTimeline) return null;

  const stateMeta = {
    'Aligned': { c: "emerald", label: "Health profiles are aligned", icon: ShieldCheck },
    'Plan together': { c: "blue", label: "Time to make a plan together", icon: Users },
    'Specialist conversation': { c: "rose", label: "Specialist medical conversation advised", icon: Stethoscope }
  }[chronicTimeline.state] || { c: "slate", label: "Pending", icon: Info };

  const Icon = stateMeta.icon;

  return (
    <div className="space-y-6">
      {/* What kind of conversation this needs */}
      <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-${stateMeta.c}-50 text-${stateMeta.c}-600`}>
            <Icon size={22} />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">What kind of conversation this needs</span>
            </div>
            <h2 className={`text-xl font-semibold text-${stateMeta.c}-700`}>{stateMeta.label}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {chronicResult.dynamic_insights?.conversation_needed_summary || 
               "Your health profiles show variations that warrant attention. A clinician conversation is recommended to establish a shared routine."}
            </p>
          </div>
        </div>
      </section>

      {/* LAYER A: Your Risk Profiles */}
      <div className="text-left">
        <h3 className="mb-1 mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-teal-600 text-[11px] text-white font-mono">A</span>
          Your risk profiles
          <Chip className="bg-teal-50 text-teal-700"><ShieldCheck size={11} /> Validated · CURES cohort</Chip>
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          This validated screening score assesses your current likelihood of metabolic conditions based on age, waist measurement, family history, and physical activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-left">
        {[{ tag: chronicResult.partner_A.name || "Partner 1", s: chronicTimeline.sA, band: chronicTimeline.bandObjA, age: chronicResult.partner_A.age + selectedProjYear, origData: chronicResult.partner_A },
          { tag: chronicResult.partner_B.name || "Partner 2", s: chronicTimeline.sB, band: chronicTimeline.bandObjB, age: chronicResult.partner_B.age + selectedProjYear, origData: chronicResult.partner_B }].map(({ tag, s, band, age, origData }) => (
          <div key={tag} className="rounded-xl border-l-4 border-teal-600 bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-slate-600">{tag} <span className="font-normal text-slate-400">(Age {age})</span></span>
              <Chip className={band.chip}>{band.label} risk</Chip>
            </div>
            
            <div className="mt-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Diabetes Risk Score (Lower is better)</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-semibold tabular-nums text-slate-900">{s}</span>
                <span className="text-sm text-slate-400">/ 100 points</span>
              </div>
            </div>
            
            <div className="mt-3 relative h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500">
              <div 
                className="absolute top-1/2 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-slate-800 shadow-sm transition-all duration-300" 
                style={{ left: `${s}%`, transform: 'translate(-50%, -50%)' }} 
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Low Risk (0)</span>
              <span>High Risk (100)</span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            {/* Insights Section - now using a responsive grid to reduce clutter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {/* What this means today */}
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">What this means today</div>
                <p className="text-xs text-slate-600">
                  {tag === (chronicResult.partner_A.name || "Partner 1")
                    ? chronicResult.dynamic_insights?.partnerA_insight?.what_it_means
                    : chronicResult.dynamic_insights?.partnerB_insight?.what_it_means}
                </p>
              </div>

              {/* What drove it */}
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">What drove it</div>
                <p className="text-xs text-slate-600">
                  {tag === (chronicResult.partner_A.name || "Partner 1")
                    ? chronicResult.dynamic_insights?.partnerA_insight?.what_drove_it
                    : chronicResult.dynamic_insights?.partnerB_insight?.what_drove_it}
                </p>
              </div>

              {/* What to do next */}
              <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">What to do next</div>
                <p className="text-xs text-slate-600">
                  {tag === (chronicResult.partner_A.name || "Partner 1")
                    ? chronicResult.dynamic_insights?.partnerA_insight?.what_to_do_next
                    : chronicResult.dynamic_insights?.partnerB_insight?.what_to_do_next}
                </p>
              </div>
            </div>
            </div>
          </div>
        ))}
      </div>

      {/* Asymmetry - How far apart your health baselines are */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 text-left">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">How far apart your health baselines are</span>
          <span className="font-mono tabular-nums text-slate-500">gap: {Math.abs(chronicTimeline.sA - chronicTimeline.sB)} pts</span>
        </div>
        <div className="relative h-8 rounded-md bg-gradient-to-r from-emerald-100 via-amber-100 to-rose-100">
          {[{ l: chronicResult.partner_A.name ? chronicResult.partner_A.name[0] : "1", v: chronicTimeline.sA }, 
            { l: chronicResult.partner_B.name ? chronicResult.partner_B.name[0] : "2", v: chronicTimeline.sB }].map((d, i) => (
            <div key={i} className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center justify-center" style={{ left: `${clamp(d.v, 0, 100)}%` }}>
              <div className="h-8 w-0.5 bg-slate-700" />
              <span className="absolute -top-0 rounded bg-slate-800 px-1 text-[10px] font-semibold text-white">{d.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flagged Biomarker Side-by-side Table */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 text-left">
        <h4 className="font-bold text-slate-900 text-sm mb-3">Biomarkers and Drift Projection Table</h4>
        <div className="grid sm:grid-cols-2 gap-4">
          {[{ name: chronicResult.partner_A.name || "Partner A", bio: chronicTimeline.bioA },
            { name: chronicResult.partner_B.name || "Partner B", bio: chronicTimeline.bioB }].map(({ name, bio }) => (
            <div key={name} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 block mb-2">{name}'s Panel</span>
              <div className="divide-y divide-slate-100">
                {bio.rows.map((row) => (
                  <div key={row.k} className="flex justify-between items-center py-2 text-xs">
                    <span className="text-slate-600">{row.k}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-900 font-medium">
                        {row.v != null ? `${row.v} ${row.unit}` : '—'}
                      </span>
                      {row.f && (
                        <span className={`w-2 h-2 rounded-full ${SEV[row.f]?.dot || 'bg-slate-300'}`} title={SEV[row.f]?.lab} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LAYER B: couple influence index */}
      <div className="text-left">
        <h3 className="mb-1 mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500 text-[11px] text-white font-mono">B</span>
          How much your routines shape each other
          <Chip className="bg-amber-100 text-amber-800"><TriangleAlert size={11} /> Uncalibrated · relative ordering</Chip>
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          This models how shared household routines (like shared meals, sleep cycles, and joint activity levels) will influence your individual baselines over time.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/30 p-5 text-left">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-amber-700">How you affect each other (index range)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-semibold tabular-nums text-amber-900">{fmt(chronicTimeline.bandLo)}–{fmt(chronicTimeline.bandHi)}</span>
            </div>
            <p className="mt-1 text-xs text-amber-800/70">central score: {fmt(chronicTimeline.central)} at w=0.60</p>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-amber-900/70">
              This range represents the spectrum of convergence. If you merge routines, you will drift toward a shared average. If you adopt the less active partner's habits, you drift toward the lower band. Aligning on healthy habits pulls you toward the higher band.
            </p>
          </div>
          <div className="space-y-4">
            {/* band visual */}
            <div>
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-amber-800"><span>0 (Less Healthy Drift)</span><span>Relative convergence spectrum</span><span>100 (Optimal)</span></div>
              <div className="relative h-6 rounded-full bg-white ring-1 ring-amber-200">
                <div className="absolute top-0 h-6 rounded-full bg-amber-300/60" style={{ left: `${chronicTimeline.bandLo}%`, width: `${chronicTimeline.bandHi - chronicTimeline.bandLo}%` }} />
                <div className="absolute top-0 h-6 w-0.5 bg-amber-700" style={{ left: `${chronicTimeline.central}%` }} />
              </div>
            </div>
            {/* lifestyle dividend */}
            <div className="rounded-lg bg-white/70 p-3 ring-1 ring-amber-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">How much you can improve together</span>
                <span className="font-mono font-bold tabular-nums text-emerald-700">+{fmt(chronicTimeline.dividend)} points potential</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono tabular-nums">current baseline {fmt(chronicTimeline.currentScenario)}</span>
                <ArrowRight size={12} className="text-emerald-600" />
                <span className="font-mono tabular-nums font-bold text-emerald-600">optimised routines {fmt(chronicTimeline.optimisedScenario)}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">This represents the recoverable dividend. If you optimize your shared kitchen, sleep, and physical activity habits, you can reclaim this points gap, directly improving your 10-year outlook.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      <div className="text-left">
        <h3 className="mb-3 mt-4 text-sm font-semibold text-slate-900">10-year dual trajectory view</h3>
      </div>
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chronicTimeline.proj} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "years", position: "insideBottomRight", fontSize: 10, fill: "#94a3b8" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload;
                const femaleAge = chronicResult.partner_B.age + data.year;
                const maleAge = chronicResult.partner_A.age + data.year;
                return (
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    borderRadius: '8px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    minWidth: '200px',
                    textAlign: 'left'
                  }}>
                    <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px', marginBottom: '5px' }}>
                      Year {data.year}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Household Baseline Index: <strong style={{ color: '#FBBF24' }}>{Math.round(data.current)}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Household Optimised Index: <strong style={{ color: '#34D399' }}>{Math.round(data.optimized)}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      {chronicResult.partner_A.name || 'Partner 1'} IDRS: <strong style={{ color: '#2dd4bf' }}>{Math.round(data.A)}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {chronicResult.partner_B.name || 'Partner 2'} IDRS: <strong style={{ color: '#a78bfa' }}>{Math.round(data.B)}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', justifyContent: 'center', opacity: 0.9 }}>
                      <span>F-Age: <strong>{femaleAge}</strong></span>
                      <span>•</span>
                      <span>M-Age: <strong>{maleAge}</strong></span>
                    </div>
                  </div>
                );
              }} />
              
              <ReferenceLine y={60} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "high risk ≥60", fontSize: 10, fill: "#f43f5e", position: "right" }} />
              <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "mod risk ≥30", fontSize: 10, fill: "#f59e0b", position: "right" }} />
              
              <Legend wrapperStyle={{ fontSize: 12 }} />
              
              <Line type="monotone" dataKey="current" name="Household Current Baseline" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="optimized" name="Household Optimised Routines" stroke="#10B981" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
              
              <Line type="stepAfter" dataKey="A" name={`${chronicResult.partner_A.name || 'Partner 1'} IDRS`} stroke="#0d9488" strokeWidth={2} dot={false} />
              <Line type="stepAfter" dataKey="B" name={`${chronicResult.partner_B.name || 'Partner 2'} IDRS`} stroke="#7c3aed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400 text-left">
          Honest by construction: IDRS steps only as a partner crosses an age band (35, 50). The household lines model continuous ageing drift and the recoverable lifestyle dividend.
        </p>
        {/* WS3B04/05: the underlying likelihood ratios (IDRS band weighting, biomarker
            and lifestyle multipliers, baseline prevalence) are reasoned but not
            independently validated against a published outcomes study for this exact
            use — disclosed here rather than presented as a clinically validated
            probability. */}
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400 text-left">
          This score is a wellness heuristic built on a validated screening tool (IDRS) combined with reasoned, but not independently validated, risk multipliers — not a clinically validated probability of developing diabetes or heart disease.
        </p>
      </div>

      {/* Calibration scaffold mock */}
      <div className="text-left">
        <h3 className="mb-3 mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ClipboardList size={15} className="text-slate-500" /> Calibration scaffold
        </h3>
      </div>
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-relaxed text-slate-500">
            The couple layer earns calibration only by capturing inputs against outcomes over time. Logging an assessment records the
            de-identified feature set, the index, and the convergence assumption used.
          </p>
          <button className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 cursor-pointer">
            <Plus size={14} /> Log assessment (Demo)
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-100">
                {["IDRS A", "IDRS B", "Index", "State", "Flagged", "Outcome"].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-slate-600">
              <tr className="border-b border-slate-50">
                <td className="py-1.5 pr-4">{chronicTimeline.sA}</td><td className="py-1.5 pr-4">{chronicTimeline.sB}</td>
                <td className="py-1.5 pr-4">{Math.round(chronicTimeline.central)}</td>
                <td className="py-1.5 pr-4">{chronicTimeline.state}</td><td className="py-1.5 pr-4">{chronicTimeline.markersFlagged}</td>
                <td className="py-1.5 pr-4 text-amber-600">pending</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
