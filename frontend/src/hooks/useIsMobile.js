'use client';

import { useSyncExternalStore } from 'react';

// 1023px (not 767) so the JS tree-switch agrees with the bottom-nav hide point
// (mobile-shell.css hides .mnav at >=1024px). This closes the old 768-1023px
// dead-zone where the desktop tree mounted UNDER the still-visible mobile nav.
// <1024px => mobile shell + bottom nav; >=1024px => desktop sidebar shell.
const QUERY = '(max-width: 1023px)';

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// Unknown on the server — resolved after hydration on the client. Consumers
// should render nothing until this stops being `undefined`, then mount
// EITHER the mobile OR desktop tree — never both — so heavy per-page
// components (SVG score bars, chat drawers) aren't double-mounted just to
// be CSS-hidden on one side.
function getServerSnapshot() {
  return undefined;
}

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
