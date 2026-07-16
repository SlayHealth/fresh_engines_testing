'use client';

import { useState, useRef, useEffect } from 'react';
import { CITIES } from '../../constants/lifestyleOptions';

const fieldInputClass = 'w-full p-4 border rounded-xl text-base';
const fieldInputStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' };

export default function CityInput({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = (value || '').trim().toLowerCase();
  const matches = query
    ? CITIES.filter((c) => c.toLowerCase().includes(query)).slice(0, 6)
    : [];

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search or enter your city"
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setIsOpen(false); } }}
        autoFocus
        autoComplete="off"
        className={fieldInputClass}
        style={fieldInputStyle}
      />
      {isOpen && matches.length > 0 && (
        <div
          className="absolute z-10 w-full mt-2 rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(20,22,26,0.1)' }}
        >
          {matches.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => { onChange(city); setIsOpen(false); }}
              className="w-full px-4 py-3 text-left text-sm transition-colors duration-150 hover:bg-black/[0.03]"
              style={{ color: 'var(--ink)' }}
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
