// Regression net for a real, previously-undetected bug class: LIFESTYLE_LRS'
// alcohol and smoking keys never matched the frontend's actual option values
// (alcohol: 'Regular'/'Occasional'/'Never' vs 'socially'/'regularly'/'heavily';
// smoking: 'Regular'/'Occasional'/'Never' vs lowercase 'regular'/'occasion'/
// 'never'/'chain' — not even 'Never' vs 'never' matched), so
// getEffectiveLifestyleLR's `LIFESTYLE_LRS[factor][value] || 1.0` lookup
// silently fell through to the neutral default for every real answer —
// these habits contributed nothing to chronic risk scoring regardless of
// what a user actually selected. This binds the frontend's real option
// values directly to the backend's LR map so a future rename on either side
// fails loudly here instead of silently going inert again.
const test = require('node:test');
const assert = require('node:assert');
const { LIFESTYLE_LRS, getEffectiveLifestyleLR } = require('../src/controllers/chronic.controller');

// Mirrors frontend/src/constants/lifestyleOptions.js's LIFESTYLE_DRINKING /
// LIFESTYLE_SMOKING_TOBACCO `val`s exactly. Not cross-imported directly —
// that file pulls in lucide-react/JSX and can't be required from this plain
// Node test runner — so keep these lists in sync by hand if either option
// set ever changes; that's the one manual step standing between this test
// and the same silent-drift bug it exists to catch.
const FRONTEND_ALCOHOL_VALUES = ['Never', 'Quit', 'Occasionally', 'Frequently'];
const FRONTEND_SMOKING_VALUES = ['Never', 'Quit', 'Occasionally', 'Regularly'];

test('alcohol lifestyle LR mapping', async (t) => {
  await t.test('every LIFESTYLE_DRINKING option value has a real (non-fallback) LR entry', () => {
    for (const val of FRONTEND_ALCOHOL_VALUES) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(LIFESTYLE_LRS.alcohol, val),
        `LIFESTYLE_LRS.alcohol has no entry for '${val}' — this answer would silently score as risk-neutral (1.0) instead of its intended LR.`
      );
    }
  });

  await t.test('Occasionally and Frequently carry real elevated risk (the exact bug this test guards against)', () => {
    const { multipliers } = getEffectiveLifestyleLR({ alcohol: 'Occasionally' });
    assert.strictEqual(multipliers.alcohol, 1.1);
    const { multipliers: m2 } = getEffectiveLifestyleLR({ alcohol: 'Frequently' });
    assert.strictEqual(m2.alcohol, 1.2);
  });

  await t.test('Never and Quit both score risk-neutral (1.0) — no current consumption, no fabricated penalty', () => {
    assert.strictEqual(getEffectiveLifestyleLR({ alcohol: 'Never' }).multipliers.alcohol, 1.0);
    assert.strictEqual(getEffectiveLifestyleLR({ alcohol: 'Quit' }).multipliers.alcohol, 1.0);
  });

  await t.test('an unrecognized value still safely falls back to 1.0, not undefined/NaN', () => {
    const { multipliers } = getEffectiveLifestyleLR({ alcohol: 'garbage-value' });
    assert.strictEqual(multipliers.alcohol, 1.0);
  });
});

test('smoking lifestyle LR mapping', async (t) => {
  await t.test('every LIFESTYLE_SMOKING_TOBACCO option value has a real (non-fallback) LR entry', () => {
    for (const val of FRONTEND_SMOKING_VALUES) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(LIFESTYLE_LRS.smoking, val),
        `LIFESTYLE_LRS.smoking has no entry for '${val}' — this answer would silently score as risk-neutral (1.0) instead of its intended LR.`
      );
    }
  });

  await t.test('Occasionally and Regularly carry real elevated risk (the exact bug this test guards against)', () => {
    const { multipliers } = getEffectiveLifestyleLR({ smoking: 'Occasionally' });
    assert.strictEqual(multipliers.smoking, 1.25);
    const { multipliers: m2 } = getEffectiveLifestyleLR({ smoking: 'Regularly' });
    assert.strictEqual(m2.smoking, 1.5);
  });

  await t.test('Never and Quit both score risk-neutral (1.0) — no current use, no fabricated penalty', () => {
    assert.strictEqual(getEffectiveLifestyleLR({ smoking: 'Never' }).multipliers.smoking, 1.0);
    assert.strictEqual(getEffectiveLifestyleLR({ smoking: 'Quit' }).multipliers.smoking, 1.0);
  });

  await t.test('an unrecognized value still safely falls back to 1.0, not undefined/NaN', () => {
    const { multipliers } = getEffectiveLifestyleLR({ smoking: 'garbage-value' });
    assert.strictEqual(multipliers.smoking, 1.0);
  });
});
