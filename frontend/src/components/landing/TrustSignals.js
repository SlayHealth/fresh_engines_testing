import { Shield, Lock, Users, Award, Check } from 'lucide-react';

const SIGNALS = [
  { icon: Lock, text: '100% Private & Encrypted', detail: 'Your health data is secure', color: 'var(--teal-d)' },
  { icon: Shield, text: 'Medical-Grade Privacy', detail: 'Bank-level encryption standards', color: 'var(--info)' },
  { icon: Users, text: '450+ Verified Reviews', detail: '4.8/5 rating from couples', color: 'var(--pink-d)' },
  { icon: Award, text: 'Doctor Verified', detail: 'All reports reviewed by MDs', color: 'var(--amber-d)' }
];

export function TrustSignals({ variant = 'default', className = '' }) {
  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap justify-center gap-4 text-xs ${className}`} style={{ color: 'var(--muted)' }}>
        {SIGNALS.map((signal, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <signal.icon className="w-3.5 h-3.5" />
            {signal.text}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 ${className}`}>
        {SIGNALS.map((signal, i) => (
          <div key={i} className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--paper)', color: signal.color }}>
              <signal.icon className="w-9 h-9" />
            </div>
            <h4 className="font-semibold text-base mb-1.5" style={{ color: 'var(--ink)' }}>{signal.text}</h4>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{signal.detail}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-5 ${className}`}>
      {SIGNALS.map((signal, i) => (
        <div key={i} className="flex items-center gap-3.5 p-5 rounded-lg border transition-colors" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--paper)', color: signal.color }}>
            <signal.icon className="w-5 h-5" />
          </div>
          <p className="text-base font-semibold truncate" style={{ color: 'var(--ink)' }}>{signal.text}</p>
        </div>
      ))}
    </div>
  );
}

export function QuickTrustBadges() {
  return (
    <div className="flex flex-wrap justify-start gap-3 text-sm lg:text-base">
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium" style={{ background: 'var(--soft-teal)', color: 'var(--teal-d)' }}>
        <Check className="w-4 h-4 lg:w-5 lg:h-5" />
        100% Private
      </span>
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium" style={{ background: 'var(--soft-blue)', color: 'var(--info)' }}>
        <Shield className="w-4 h-4 lg:w-5 lg:h-5" />
        Encrypted & Secure
      </span>
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium" style={{ background: 'var(--soft-pink)', color: 'var(--pink-d)' }}>
        <Award className="w-4 h-4 lg:w-5 lg:h-5" />
        Evidence-Based
      </span>
    </div>
  );
}
