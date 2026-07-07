'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Single-open-at-a-time accordion. Pass items as { key, header, content }.
 * `defaultOpenKey` opens one item initially (or null to start fully collapsed).
 */
export default function Accordion({ items, defaultOpenKey = null, className = '' }) {
  const [openKey, setOpenKey] = useState(defaultOpenKey);

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const isOpen = openKey === item.key;
        return (
          <div
            key={item.key}
            className="rounded-xl border overflow-hidden transition-colors"
            style={{ background: 'var(--surface)', borderColor: isOpen ? 'var(--teal)' : 'var(--line)' }}
          >
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : item.key)}
              className="w-full flex items-center justify-between gap-4 p-5 lg:p-6 text-left cursor-pointer"
            >
              {item.header}
              <ChevronDown
                className="w-5 h-5 shrink-0 transition-transform duration-300"
                style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="px-5 lg:px-6 pb-5 lg:pb-6">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
