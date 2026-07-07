'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Brief branded welcome shown once, right after a first-time signup completes.
 * The background artwork already contains the full logo + "slay.health"
 * wordmark + heart mark centered in the frame, with a clear stretch of empty
 * space beneath the heart — that's where the personalized greeting sits, so
 * it reads as a caption under the brand mark rather than competing with it.
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
    const doneTimer = setTimeout(() => onDoneRef.current(), 2600);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <main
      className="h-dvh overflow-hidden flex flex-col items-center justify-end px-6 pb-[9%] text-center cursor-pointer"
      style={{
        backgroundImage: 'url(/splash_screen.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
      onClick={onDone}
    >
      <div
        className="transition-all duration-700 ease-out max-w-[280px]"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <h1 className="font-serif text-xl sm:text-2xl leading-snug" style={{ color: 'var(--ink)' }}>
          Welcome{name ? `, ${name}` : ''}!
        </h1>
        <p className="text-xs sm:text-sm mt-1.5 leading-snug" style={{ color: 'var(--muted)' }}>
          Your account is ready — let&apos;s bring clarity to your journey together.
        </p>
      </div>
    </main>
  );
}
