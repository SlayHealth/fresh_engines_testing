'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

let listeners = [];
let idCounter = 0;

function emit(toast) {
  const id = ++idCounter;
  const entry = { id, duration: 4000, ...toast };
  listeners.forEach((fn) => fn(entry));
  return id;
}

/**
 * Fire-and-forget toast notifications, callable from anywhere (components,
 * context helpers, plain utility functions) — no hook required. Mount a
 * single <ToastContainer /> once near the app root to render them.
 */
export const toast = {
  success: (message, opts) => emit({ type: 'success', message, ...opts }),
  error: (message, opts) => emit({ type: 'error', message, ...opts }),
  info: (message, opts) => emit({ type: 'info', message, ...opts })
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const COLORS = {
  success: { bg: 'var(--soft-teal)', border: 'var(--teal)', icon: 'var(--teal-d)' },
  error: { bg: 'var(--soft-danger)', border: 'var(--danger)', icon: 'var(--danger)' },
  info: { bg: 'var(--soft-blue)', border: 'var(--info)', icon: 'var(--info)' }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNew = (entry) => {
      setToasts((prev) => [...prev, entry]);
      if (entry.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== entry.id));
        }, entry.duration);
      }
    };
    listeners.push(handleNew);
    return () => {
      listeners = listeners.filter((fn) => fn !== handleNew);
    };
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm px-4 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        const c = COLORS[t.type] || COLORS.info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-lg animate-fade-in-up"
            style={{ background: c.bg, borderColor: c.border }}
          >
            <Icon className="w-4.5 h-4.5 shrink-0 mt-0.5" style={{ color: c.icon }} />
            <p className="flex-1 text-sm leading-snug" style={{ color: 'var(--ink)' }}>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--ink)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
