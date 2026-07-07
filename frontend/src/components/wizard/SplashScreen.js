'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';

/**
 * Brief branded welcome shown once, right after a first-time signup completes.
 * Auto-advances after a short delay, or the user can tap through immediately.
 */
export default function SplashScreen({ name, onDone }) {
  const [visible, setVisible] = useState(false);
  // onDone is typically a fresh inline function every render — keep the dismiss
  // timer keyed on mount only (via a ref) so an unrelated re-render can't reset it.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 30);
    const doneTimer = setTimeout(() => onDoneRef.current(), 2400);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <main
      className="h-dvh overflow-hidden flex flex-col items-center justify-center px-6 text-center wizard-bg cursor-pointer"
      onClick={onDone}
    >
      <div
        className="transition-all duration-700 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)' }}
      >
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="SlayHealth" width={180} height={103} priority className="h-12 w-auto object-contain" />
        </div>

        <div
          className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
          style={{ background: 'var(--soft-teal)' }}
        >
          <Sparkles className="w-8 h-8" style={{ color: 'var(--teal-d)' }} />
        </div>

        <h1 className="font-serif text-2xl sm:text-3xl mb-3" style={{ color: 'var(--ink)' }}>
          Welcome{name ? `, ${name}` : ''}!
        </h1>
        <p className="text-sm sm:text-base max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
          Your account is ready. Let&apos;s bring clarity to your journey together.
        </p>
      </div>
    </main>
  );
}
