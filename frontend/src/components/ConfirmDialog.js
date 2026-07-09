'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

let requestListener = null;

/**
 * Promise-based replacement for window.confirm(), callable from anywhere:
 *   const ok = await confirmDialog({ message: 'Delete this?' });
 *   if (!ok) return;
 * Mount a single <ConfirmDialogContainer /> once near the app root.
 */
export function confirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    if (!requestListener) {
      resolve(false);
      return;
    }
    requestListener({ title, message, confirmLabel, cancelLabel, danger, resolve });
  });
}

export function ConfirmDialogContainer() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    requestListener = (req) => setRequest(req);
    return () => { requestListener = null; };
  }, []);

  if (!request) return null;

  const close = (result) => {
    request.resolve(result);
    setRequest(null);
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      style={{ background: 'rgba(20,22,26,0.45)' }}
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl animate-fade-in-up"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-3 mb-4">
          {request.danger && (
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--soft-danger)' }}>
              <AlertTriangle className="w-4.5 h-4.5" style={{ color: 'var(--danger)' }} />
            </div>
          )}
          <div>
            <h3 id="confirm-dialog-title" className="font-serif text-base font-semibold" style={{ color: 'var(--ink)' }}>
              {request.title}
            </h3>
            {request.message && (
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>{request.message}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => close(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
            style={{ background: 'var(--paper)', color: 'var(--ink)' }}
          >
            {request.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors duration-150"
            style={{ background: request.danger ? 'var(--danger)' : 'var(--teal)' }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
