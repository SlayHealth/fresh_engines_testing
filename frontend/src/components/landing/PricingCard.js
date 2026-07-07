import Link from 'next/link';
import { Check } from 'lucide-react';

export default function PricingCard({ plan }) {
  return (
    <div
      className={`rounded-2xl p-8 transition-all duration-300 flex flex-col h-full relative ${plan.popular ? 'md:-translate-y-4' : ''}`}
      style={{
        background: 'var(--surface)',
        border: plan.popular ? '2px solid var(--teal)' : '1px solid var(--line)',
        boxShadow: plan.popular ? '0 12px 32px rgba(24,204,150,0.14)' : 'none'
      }}
    >
      {plan.popular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white px-4 py-1 rounded-full text-sm font-bold" style={{ background: 'var(--teal)' }}>
          MOST CHOSEN
        </div>
      )}

      <h3 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{plan.title}</h3>
      <div className="mt-4 mb-6">
        <span className="text-4xl font-bold" style={{ color: 'var(--ink)' }}>{plan.price}</span>
        <span style={{ color: 'var(--muted)' }}>{plan.per}</span>
        {plan.save && <div className="text-xs font-medium mt-1" style={{ color: 'var(--teal-d)' }}>{plan.save}</div>}
      </div>

      <p className="text-sm lg:text-base mb-6 italic leading-relaxed" style={{ color: 'var(--muted)' }}>&quot;{plan.description}&quot;</p>

      <Link
        href="/login"
        className="w-full py-3 font-semibold rounded-lg transition-colors mb-8 text-white text-center shadow-md"
        style={{ background: plan.popular ? 'var(--teal)' : 'var(--pink)' }}
      >
        {plan.cta}
      </Link>

      <div className="flex-1">
        <ul className="space-y-3.5 text-sm lg:text-base" style={{ color: 'var(--muted)' }}>
          {plan.features.map((feature, i) => (
            <li key={i} className="flex gap-2.5 items-start leading-snug">
              <Check className="w-4 h-4 lg:w-5 lg:h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--teal-d)' }} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-6 border-t text-sm font-medium text-center" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
        Outcome: {plan.outcome}
      </div>
    </div>
  );
}
