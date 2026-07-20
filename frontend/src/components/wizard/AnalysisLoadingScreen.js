'use client';

import { useEffect, useState } from 'react';
import {
  Check, FileSearch, ShieldCheck, Cpu, TrendingUp, PenLine, FileCheck2
} from 'lucide-react';

const STEP_INTERVAL_MS = 1400;

export const DEFAULT_ANALYSIS_STEPS = [
  { label: 'Extracting your medical parameters', sub: 'Reading pathology, hormonal & lifestyle inputs', icon: FileSearch },
  { label: 'Medically validating your inputs', sub: 'Cross-checking values against clinical reference ranges', icon: ShieldCheck },
  { label: 'Running proprietary compatibility engines', sub: 'Chronic risk, fertility & psychometric models in parallel', icon: Cpu },
  { label: 'Modeling your 10-year health trajectory', sub: 'Projecting outcomes across both lifestyle paths', icon: TrendingUp },
  { label: 'Synthesising your personalised narrative', sub: 'Composing plain-language insights from the clinical output', icon: PenLine },
  { label: 'Formatting your report', sub: 'Polishing charts, scores & recommendations', icon: FileCheck2 }
];

/**
 * Full-bleed dummy multi-step progress shown while the real
 * chronic/fertility/mental engines + AI narrative call are in flight.
 * Steps auto-advance on a timer and hold on the final one until the
 * caller unmounts this (i.e. real work resolved and navigation happens) —
 * there's no `done`/`onComplete` wiring because the parent route change
 * itself is the completion signal.
 */
export default function AnalysisLoadingScreen({
  active,
  steps = DEFAULT_ANALYSIS_STEPS,
  heading = 'Analysing your compatibility',
  subheading = "Hold tight — we're crunching the clinical data together."
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    if (stepIndex >= steps.length - 1) return;
    const timer = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [active, stepIndex, steps.length]);

  if (!active) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
      <div className="text-center mb-8 px-2">
        <h2 className="font-serif text-2xl leading-snug" style={{ color: 'var(--ink)' }}>{heading}</h2>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>{subheading}</p>
      </div>

      <div className="w-full max-w-xs mx-auto">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const status = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
          const isLast = i === steps.length - 1;

          return (
            <div key={step.label} className="flex items-stretch gap-3.5">
              <div className="flex flex-col items-center">
                <div
                  className="relative flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors duration-300"
                  style={{
                    background: status === 'done' ? 'var(--teal)' : status === 'active' ? 'var(--surface)' : 'var(--paper)',
                    border: status === 'active' ? '2px solid var(--teal)' : status === 'pending' ? '1.5px solid var(--line)' : 'none'
                  }}
                >
                  {status === 'active' && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: 'var(--soft-teal)' }}
                    />
                  )}
                  <span className="relative">
                    {status === 'done' ? (
                      <Check size={15} className="text-white" strokeWidth={3} />
                    ) : (
                      <Icon size={14} style={{ color: status === 'active' ? 'var(--teal)' : 'var(--muted)' }} />
                    )}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className="w-px flex-1 min-h-[24px] transition-colors duration-500"
                    style={{ background: status === 'done' ? 'var(--teal)' : 'var(--line)' }}
                  />
                )}
              </div>
              <div className={isLast ? 'pb-0' : 'pb-6'}>
                <p
                  className="text-sm font-semibold leading-tight transition-colors duration-300"
                  style={{ color: status === 'pending' ? 'var(--muted)' : 'var(--ink)' }}
                >
                  {step.label}
                </p>
                <p className="text-xs mt-1 leading-snug" style={{ color: 'var(--muted)' }}>{step.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-8 px-4 text-center" style={{ color: 'var(--muted)' }}>
        Please don&apos;t close this page — your report is on its way.
      </p>
    </div>
  );
}
