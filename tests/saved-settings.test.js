// Tests for saved settings: copying a stage as text and loading it back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ParameterStore } from '../lab/js/core/store.js';
import { settingsText, applySettingsText, restoreSaved } from '../lab/js/core/saved-settings.js';

test('a copied stage loads back exactly into a fresh lab', () => {
  const a = new ParameterStore();
  a.set('1.osc1', 300); a.set('1.osc2', 60); a.set('1.depth1', .5); a.set('1.quantize', 1); a.set('1.scale', 0);
  const text = settingsText(a, '1');
  const b = new ParameterStore();
  assert.equal(applySettingsText(b, text), '1');
  assert.deepEqual(b.snapshot('1'), a.snapshot('1'));
  assert.match(text, /"title": "The core Rungler"/);
});

test('bad texts are refused with a readable message; unknown or invalid values are skipped', () => {
  const store = new ParameterStore(), before = store.snapshot('0B');
  assert.throws(() => applySettingsText(store, 'hello'), /not a settings text/);
  assert.throws(() => applySettingsText(store, '{"stage":"9","values":{}}'), /no stage/);
  applySettingsText(store, JSON.stringify({ stage: '0B', values: { '0B.clock': 1e9, '0B.depth': 'loud', 'nope': 3 } }));
  assert.equal(store.get('0B.clock'), 100);                 // clamped to the knob's maximum
  assert.equal(store.get('0B.depth'), before['0B.depth']);  // not a number: kept
});

test('without browser storage (as in Node) restoring simply does nothing', () => {
  const store = new ParameterStore(), before = store.snapshot('1');
  restoreSaved(store);
  assert.deepEqual(store.snapshot('1'), before);
});

test('0a Listen is not remembered between visits: the stage always opens on the noise source', () => {
  const memory = new Map();
  globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
  try {
    memory.set('rungler-lab-settings-v2', JSON.stringify({ values: { '0A.listen': 2, '0A.bandwidth': 3 } }));
    const store = new ParameterStore();
    restoreSaved(store);
    assert.equal(store.get('0A.listen'), 0);
    assert.equal(store.get('0A.bandwidth'), 3);               // the other knobs are remembered
    applySettingsText(store, JSON.stringify({ stage: '0A', values: { '0A.listen': 2 } }));
    assert.equal(store.get('0A.listen'), 2);                  // a pasted settings text still sets it
  } finally { delete globalThis.localStorage; }
});
