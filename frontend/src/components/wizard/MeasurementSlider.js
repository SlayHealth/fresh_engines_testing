'use client';

import { useState, useEffect } from 'react';
import styles from './wizard.module.css';

const RANGES = {
  height: { cm: [140, 210], ft: [55, 83] },
  weight: { kg: [35, 150], lb: [77, 330] },
  waist: { in: [20, 50], cm: [50, 127] }
};

const UNIT_OPTIONS = {
  height: [{ key: 'cm', label: 'cm' }, { key: 'ft', label: 'ft / in' }],
  weight: [{ key: 'kg', label: 'kg' }, { key: 'lb', label: 'lb' }],
  waist: [{ key: 'in', label: 'in' }, { key: 'cm', label: 'cm' }]
};

const DEFAULTS = { height: 170, weight: 65, waist: 32 };

// Canonical storage stays cm for height, kg for weight, inches for waist.
function canonicalToSlider(type, unit, canonical) {
  if (type === 'height') return unit === 'cm' ? canonical : canonical / 2.54;
  if (type === 'weight') return unit === 'kg' ? canonical : canonical * 2.20462;
  if (type === 'waist') return unit === 'in' ? canonical : canonical * 2.54;
  return canonical;
}

function sliderToCanonical(type, unit, sliderVal) {
  if (type === 'height') return unit === 'cm' ? sliderVal : sliderVal * 2.54;
  if (type === 'weight') return unit === 'kg' ? sliderVal : sliderVal / 2.20462;
  if (type === 'waist') return unit === 'in' ? sliderVal : sliderVal / 2.54;
  return sliderVal;
}

function formatDisplay(type, unit, sliderVal) {
  if (type === 'height' && unit === 'ft') {
    const feet = Math.floor(sliderVal / 12);
    const inches = Math.round(sliderVal % 12);
    return `${feet}'${inches}"`;
  }
  if (type === 'weight') return `${Math.round(sliderVal)} ${unit}`;
  if (type === 'waist') return `${Math.round(sliderVal)} ${unit}`;
  return `${Math.round(sliderVal)} cm`;
}

export default function MeasurementSlider({ type, value, onChange }) {
  const unitOptions = UNIT_OPTIONS[type] || null;
  const [unit, setUnit] = useState(unitOptions ? unitOptions[0].key : 'in');

  // The displayed value defaults even before the user drags the slider —
  // commit that default immediately so it's actually saved, not just shown.
  useEffect(() => {
    if (!value) onChange(String(DEFAULTS[type]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canonical = parseFloat(value) || DEFAULTS[type];
  const [min, max] = RANGES[type][unit];
  const sliderValue = Math.min(max, Math.max(min, canonicalToSlider(type, unit, canonical)));
  const pct = ((sliderValue - min) / (max - min)) * 100;

  const handleSliderChange = (raw) => {
    onChange(String(Math.round(sliderToCanonical(type, unit, parseFloat(raw)))));
  };

  return (
    <div>
      {unitOptions && (
        <div className="flex gap-2 mb-6 justify-center">
          {unitOptions.map((u) => (
            <button
              key={u.key}
              type="button"
              onClick={() => setUnit(u.key)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150"
              style={{
                background: unit === u.key ? 'var(--teal)' : 'var(--line)',
                color: unit === u.key ? '#fff' : 'var(--muted)'
              }}
            >
              {u.label}
            </button>
          ))}
        </div>
      )}

      <div className="text-center mb-5">
        <span className="font-serif text-4xl font-semibold" style={{ color: 'var(--ink)' }}>
          {formatDisplay(type, unit, sliderValue)}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={sliderValue}
        onChange={(e) => handleSliderChange(e.target.value)}
        className={styles.measurementSlider}
        style={{ '--fill-pct': `${pct}%` }}
      />
      <div className="flex justify-between text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
        <span>{formatDisplay(type, unit, min)}</span>
        <span>{formatDisplay(type, unit, max)}</span>
      </div>
    </div>
  );
}
