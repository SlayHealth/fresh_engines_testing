'use client';

import { useEffect, useState } from 'react';

// How much of the viewport's bottom is currently covered by the on-screen
// keyboard. iOS Safari's visualViewport is supposed to shrink to exclude the
// keyboard (and 100dvh with it), but that's unreliable in practice — and
// flatly doesn't happen inside in-app webviews (WhatsApp, Instagram, etc.),
// where the layout viewport never resizes at all. Comparing innerHeight
// against the actual visualViewport gives the true covered gap regardless
// of whether the browser already compensated — 0 where it did, the real
// keyboard height where it didn't — so a fixed/bottom-anchored element can
// always push up by exactly this much and stay visible either way.
export default function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
