'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

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
