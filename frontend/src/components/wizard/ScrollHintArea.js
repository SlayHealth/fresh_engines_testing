'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Wraps any tall content in an independently-scrolling region and surfaces a
// small "there's more below" cue (gradient fade + bouncing chevron) whenever
// it genuinely overflows — a nested overflow-y-auto region with no visual
// affordance just reads as "the last item got cut off," not "swipe up for
// more." Hidden once scrolled to the bottom, and never shown when content
// already fits. `hintBg` should match whatever's actually behind this area
// so the fade blends in rather than showing a mismatched color band.
export default function ScrollHintArea({ children, className = '', wrapperClassName = '', hintBg = 'var(--surface)', watch }) {
  const scrollRef = useRef(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const checkOverflow = () => {
      setHasMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    };
    checkOverflow();
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkOverflow);
      ro.disconnect();
    };
    // watch (e.g. the active question's key, or an answers object) intentionally
    // re-runs this whenever the scrollable content itself changes shape.
  }, [watch]);

  return (
    <div className={`flex-1 min-h-0 relative ${wrapperClassName}`}>
      <div ref={scrollRef} className={`h-full overflow-y-auto ${className}`}>
        {children}
      </div>
      {hasMoreBelow && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-end justify-center pb-1" style={{ height: 44 }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(247,248,250,0), ${hintBg} 85%)` }} />
          <span className="relative flex items-center justify-center w-6 h-6 rounded-full animate-bounce" style={{ background: hintBg, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
          </span>
        </div>
      )}
    </div>
  );
}
