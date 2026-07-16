// WS0-05: the STI safety gate and the ontology extractor are two independently-
// maintained string contracts — the gate reads five hardcoded canonical param
// names, and if the ontology ever renames, drops, or fuzzy-loses one of them, the
// gate silently stops firing for that marker with no error anywhere (a clinical-
// safety-critical bypass, not just a broken test). This test binds them together:
// it fails loudly the moment either side drifts from the other.
const test = require('node:test');
const assert = require('node:assert');
const { STI_GATE_CANONICAL_PARAMS, classifySerologyResult, checkSTISafetyGate } = require('../src/services/compatibility/reportSummary.service');
const ontologyMapper = require('../src/services/parser/ontologyMapper.service');

test('STI gate <-> ontology binding', async (t) => {
  await t.test('every STI gate canonical param exists in the ontology', () => {
    for (const [marker, canonicalName] of Object.entries(STI_GATE_CANONICAL_PARAMS)) {
      assert.ok(
        ontologyMapper.hasCanonical(canonicalName),
        `Gate reads '${canonicalName}' for ${marker}, but the ontology no longer defines this canonical — the gate would silently never fire for this marker.`
      );
    }
  });

  await t.test('gate genuinely fires end-to-end for each marker via its bound canonical key', () => {
    for (const [marker, canonicalName] of Object.entries(STI_GATE_CANONICAL_PARAMS)) {
      const details = { male_data: { serology: { [canonicalName]: { value: 'Reactive' } } }, female_data: {} };
      const result = checkSTISafetyGate(details);
      assert.strictEqual(result.triggered, true, `Gate did not trigger for ${marker} ('${canonicalName}') even with a directly-injected Reactive value — the key binding is broken, not just the ontology.`);
    }
  });

  await t.test('classifySerologyResult vocabulary matrix stays correct (regression net for WS0-02/03/WS1D02/03)', () => {
    assert.strictEqual(classifySerologyResult('Reactive'), 'positive');
    assert.strictEqual(classifySerologyResult('Positive'), 'positive');
    assert.strictEqual(classifySerologyResult('Detected'), 'positive');
    assert.strictEqual(classifySerologyResult('Non-Reactive'), 'negative');
    assert.strictEqual(classifySerologyResult('Not Reactive'), 'negative');
    assert.strictEqual(classifySerologyResult('Undetected'), 'negative');
    assert.strictEqual(classifySerologyResult('Equivocal'), 'equivocal');
  });
});
