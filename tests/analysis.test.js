// Tests for the chaos and entropy indicators, on signals whose answer is known.
import test from 'node:test';
import assert from 'node:assert/strict';
import { orderHistogram, entropyAndComplexity } from '../lab/js/analysis/permutation-entropy.js';
import { findPeriod } from '../lab/js/analysis/period-detector.js';
import { twinDivergence, LIMIT } from '../lab/js/analysis/twin-divergence.js';
import { EventRungler, cellsFromPattern } from '../lab/js/analysis/event-map.js';
import { Rungler } from '../lab/js/dsp/modules/rungler.js';
import { SCALES } from '../lab/js/dsp/modules/quantizer.js';
import { NoiseSource } from '../lab/js/dsp/modules/noise.js';

const measure = series => entropyAndComplexity(orderHistogram(series));

test('white noise: entropy close to 1, complexity close to 0', () => {
  const noise = new NoiseSource(3), series = Array.from({ length: 5000 }, () => noise.white());
  const { entropy, complexity } = measure(series);
  assert.ok(entropy > 0.98, `H ${entropy}`); assert.ok(complexity < 0.05, `C ${complexity}`);
});

test('a periodic sequence uses few orders: entropy = ln 4 / ln 24 for period 4', () => {
  const series = Array.from({ length: 2000 }, (_, i) => [0.1, 0.7, 0.3, 0.9][i % 4]);
  assert.ok(Math.abs(measure(series).entropy - Math.log(4) / Math.log(24)) < 0.01);
  assert.ok(measure(Array.from({ length: 2000 }, (_, i) => i)).entropy === 0); // a ramp: one order only
});

test('logistic map (chaotic, r = 4): clearly more complex than noise', () => {
  let x = 0.3141; const series = [];
  for (let i = 0; i < 5000; i++) { x = 4 * x * (1 - x); series.push(x); }
  const chaos = measure(series);
  assert.ok(chaos.complexity > 0.25, `C ${chaos.complexity}`);
  assert.ok(chaos.entropy > 0.5 && chaos.entropy < 0.9, `H ${chaos.entropy}`);
});

test('period detector finds the shortest exact repetition, or none', () => {
  const cycle = [5, 9, 9, 2, 7];
  assert.equal(findPeriod(Array.from({ length: 60 }, (_, i) => cycle[i % 5])), 5);
  assert.equal(findPeriod(Array.from({ length: 60 }, () => 3)), 1);
  const noise = new NoiseSource(9);
  assert.equal(findPeriod(Array.from({ length: 300 }, () => Math.floor(noise.next() * 256))), null);
  assert.equal(findPeriod([1, 2, 1, 2]), null); // too short to trust
});

const base = { osc1Hz: 183, osc2Hz: 900, osc1DepthOctaves: 1.4, osc2DepthOctaves: 0.8, xor: 1, quantize: 0, scale: SCALES.major, driftCents: 0 };

// Run the real-time Rungler and record (OSC1 phase, register) at every clock edge.
function edges(settings, count, sampleRate = 48000) {
  const r = new Rungler(sampleRate, new NoiseSource(1)), out = [];
  while (out.length < count) { r.run(settings); if (r.clocked) out.push({ theta: r.dataPhase, pattern: r.register.pattern }); }
  return out;
}

test('the event map follows the real-time Rungler clock by clock', () => {
  for (const settings of [base, { ...base, osc2Hz: 7.3, osc1DepthOctaves: 1.4 }, { ...base, quantize: 1, scale: SCALES.dorian }]) {
    const real = edges(settings, 400);
    const map = new EventRungler(settings, real[0].theta, cellsFromPattern(real[0].pattern));
    for (let k = 1; k < real.length; k++) {
      map.step();
      assert.equal(map.pattern, real[k].pattern, `register differs at clock ${k}`);
      assert.ok(Math.abs(map.theta - real[k].theta) < 1e-6, `phase differs at clock ${k}`);
    }
  }
});

test('twin divergence: an irregular Rungler separates within the limit, instantly', () => {
  const [first] = edges(base, 1);
  const t0 = performance.now();
  const report = twinDivergence(new EventRungler(base, first.theta, cellsFromPattern(first.pattern)));
  assert.ok(performance.now() - t0 < 100);
  assert.equal(report.trials, 31);
  assert.ok(report.median < LIMIT, `median ${report.median}`);
});

test('twin divergence: a rotation without feedback on a rational ratio never separates', () => {
  const rotation = { ...base, osc1Hz: 183, osc2Hz: 300, osc1DepthOctaves: 0, osc2DepthOctaves: 0 };
  const report = twinDivergence(new EventRungler(rotation, 0.123, [1, 0, 1, 1, 0, 0, 1, 0]));
  assert.equal(report.median, Infinity);
});
