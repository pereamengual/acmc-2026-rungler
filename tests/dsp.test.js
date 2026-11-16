// Tests for the DSP modules and stage patches. They render sound in Node, without audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShiftRegister } from '../lab/js/dsp/modules/shift-register.js';
import { ThreeBitDAC } from '../lab/js/dsp/modules/dac.js';
import { quantize, SCALES } from '../lab/js/dsp/modules/quantizer.js';
import { Oscillator } from '../lab/js/dsp/modules/oscillator.js';
import { NoiseSource } from '../lab/js/dsp/modules/noise.js';
import { ThreePoleLowpass } from '../lab/js/dsp/modules/three-pole-lowpass.js';
import { CentredDAC } from '../lab/js/dsp/modules/dac.js';
import { BlippooCore } from '../lab/js/dsp/modules/blippoo-core.js';
import { coreSettings } from '../lab/js/dsp/patches/stage-4-blippoo.js';
import { LabEngine, STAGE_PATCHES } from '../lab/js/dsp/lab-engine.js';
import { STAGES } from '../lab/js/core/parameters.js';
import { runglerSettings, voiceSemitones } from '../lab/js/dsp/patches/stage-1-rungler.js';

const SR = 48000;
const defaults = stage => STAGES.find(s => s.id === stage).parameters
  .map(p => ({ id: p.id, value: p.initial, glide: p.type === 'knob' }));

function render(engine, seconds) {
  const left = new Float32Array(128), right = new Float32Array(128), out = [];
  let events = 0;
  for (let b = 0; b < Math.round(seconds * SR / 128); b++) {
    assert.equal(engine.process(left, right, 128), true);
    out.push(...left);
    events += engine.snapshot(64).events.length;
  }
  return { samples: Float32Array.from(out), events };
}

test('shift register moves bits from cell 1 towards cell 8', () => {
  const r = new ShiftRegister(8);
  r.clock(1);
  assert.equal(r.cell(1), 1);
  for (let i = 0; i < 7; i++) r.clock(0);
  assert.equal(r.cell(8), 1); assert.equal(r.lastBit, 1);
  r.clock(0);
  assert.equal(r.pattern, 0);
});

test('3-bit DAC weights cells 6, 7, 8 as 4, 2, 1 and gives eight levels', () => {
  const r = new ShiftRegister(8), dac = new ThreeBitDAC(), levels = new Set();
  for (let n = 0; n < 8; n++) {
    r.cells.fill(0); r.cells[5] = (n >> 2) & 1; r.cells[6] = (n >> 1) & 1; r.cells[7] = n & 1;
    levels.add(dac.convert(r));
    assert.equal(dac.convert(r), n / 7);
  }
  assert.equal(levels.size, 8);
});

test('quantizer snaps to the nearest scale degree in any octave', () => {
  assert.equal(quantize(1.2, SCALES.major), 2);       // major: C# → D
  assert.equal(quantize(-1.4, SCALES.major), -1);     // B below
  assert.equal(quantize(11.6, SCALES.major), 12);     // up to the next octave
  assert.equal(quantize(3.1, SCALES.naturalMinor), 3); // natural minor keeps the minor third
  assert.equal(quantize(5.9, SCALES.octaves), 0);     // octaves: everything snaps to the root…
  assert.equal(quantize(6.1, SCALES.octaves), 12);    // …or to the next octave
  assert.equal(quantize(6.4, SCALES.chromatic), 6);   // chromatic: the nearest semitone
});

test('oscillator wraps once per cycle and reports where it was at the edge', () => {
  const osc = new Oscillator(SR);
  let wraps = 0;
  for (let n = 0; n < SR; n++) { osc.run(100); if (osc.wrapped) wraps++; }
  assert.ok(Math.abs(wraps - 100) <= 1);
  osc.reset(); osc.phase = 0.99; osc.run(SR * 0.02); // step 0.02 → wraps, now at 0.01
  assert.equal(osc.wrapped, true);
  assert.ok(Math.abs(osc.samplesSinceWrap - 0.5) < 1e-9);
});

test('noise is deterministic for a seed and gaussian noise has unit spread', () => {
  const a = new NoiseSource(7), b = new NoiseSource(7);
  for (let i = 0; i < 100; i++) assert.equal(a.white(), b.white());
  let sum = 0, squares = 0;
  for (let i = 0; i < 100000; i++) { const g = a.gaussian(); sum += g; squares += g * g; }
  assert.ok(Math.abs(sum / 1e5) < 0.02); assert.ok(Math.abs(squares / 1e5 - 1) < 0.03);
});

test('every implemented stage renders finite, bounded audio with its defaults', () => {
  for (const stage of Object.keys(STAGE_PATCHES)) {
    const engine = new LabEngine(SR, 1);
    engine.setStage(stage, defaults(stage));
    const { samples } = render(engine, 1);
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(peak > 0.05 && peak < 1, `stage ${stage} peak ${peak}`);
  }
});

test('the same seed gives the same Rungler; the register clocks at the OSC2 rate', () => {
  const a = new LabEngine(SR, 1), b = new LabEngine(SR, 1);
  a.setStage('1', defaults('1')); b.setStage('1', defaults('1'));
  const ra = render(a, 1), rb = render(b, 1);
  assert.deepEqual(ra.samples, rb.samples);
  // OSC2 starts at 7.3 Hz and the Rungler can only raise it.
  assert.ok(ra.events >= 7, `events ${ra.events}`);
});

test('with the default settings the register keeps changing (no frozen state)', () => {
  const engine = new LabEngine(SR, 1), patterns = new Set();
  engine.setStage('1', defaults('1'));
  const left = new Float32Array(128), right = new Float32Array(128);
  for (let b = 0; b < SR * 4 / 128; b++) { engine.process(left, right, 128); patterns.add(engine.out.register); }
  assert.ok(patterns.size >= 4, `only ${patterns.size} register patterns in 4 s`);
});

test('a non-finite control value is ignored and the engine keeps running', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('1', defaults('1'));
  engine.setParameter('1.osc1', NaN);
  engine.setParameter('1.osc1', Infinity);
  const { samples } = render(engine, 0.1);
  assert.ok(samples.every(Number.isFinite));
});

test('Twin Peak: equal peaks cancel (the two low-passes subtract to silence)', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('3', defaults('3').map(p => (p.id === '3.peak1' || p.id === '3.peak2' ? { ...p, value: 500 } : p)));
  const { samples } = render(engine, 0.5);
  assert.ok(samples.every(v => Math.abs(v) < 1e-6));
});

test('3-pole low-pass: below resonance 1 an edge makes a ping that dies away; at 1 it rings on', () => {
  const ringAfter = (resonance, seconds) => {
    const filter = new ThreePoleLowpass(SR);
    let level = 0;
    for (let n = 0; n < SR * seconds; n++) {
      const y = filter.process(n < SR * 0.01 ? 0 : 0.5, 1000, resonance) - 0.5 / (1 + 8 * resonance);
      if (n > SR * (seconds - 0.05)) level = Math.max(level, Math.abs(y));
    }
    return level;
  };
  assert.ok(ringAfter(0.95, 1) < 1e-4, 'resonance 0.95: a ping, silent after a second');
  assert.ok(ringAfter(1, 1) > 5e-3, 'resonance 1: the edge of oscillation, it keeps ringing');
});

test('3-pole low-pass: the peak is where the knob says', () => {
  const filter = new ThreePoleLowpass(SR), y = [];
  for (let n = 0; n < SR * 0.2; n++) y.push(filter.process(n < 10 ? 0.5 : 0, 1000, 0.99));
  let crossings = 0;
  for (let n = SR * 0.02; n < SR * 0.12; n++) if (y[n - 1] < 0 && y[n] >= 0) crossings++;
  assert.ok(Math.abs(crossings / 0.1 - 1000) <= 20);
});

test('Twin Peak self-modulation: the second pole fed back to the cutoff adds even harmonics', () => {
  const secondHarmonic = octaves => {
    const filter = new ThreePoleLowpass(SR), y = [];
    for (let n = 0; n < SR * 0.06; n++) y.push(filter.process(n < 10 ? 0 : 0.5, 1000 * 2 ** (-octaves * filter.z), 0.95));
    const ping = y.slice(20, 2420), mean = ping.reduce((a, v) => a + v) / ping.length;
    const amplitude = f => {
      let re = 0, im = 0;
      ping.forEach((v, n) => {
        const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (ping.length - 1)), a = 2 * Math.PI * f * n / SR;
        re += w * (v - mean) * Math.cos(a); im -= w * (v - mean) * Math.sin(a);
      });
      return Math.hypot(re, im);
    };
    let f0 = 0, best = 0;
    for (let f = 500; f < 1500; f += 2) { const a = amplitude(f); if (a > best) { best = a; f0 = f; } }
    return 20 * Math.log10(amplitude(2 * f0) / best);
  };
  assert.ok(secondHarmonic(0) < -60, 'no self-modulation: two clean damped sines');
  assert.ok(secondHarmonic(8) > -30, 'self-modulation: a clear second harmonic');
});

test('Blippoo DAC 1–2–1: eight patterns, five levels around 0, the middle ones twice as likely', () => {
  const dac = new CentredDAC(), r = new ShiftRegister(8), count = [0, 0, 0, 0, 0];
  for (let bits = 0; bits < 8; bits++) {
    r.cells[5] = (bits >> 2) & 1; r.cells[6] = (bits >> 1) & 1; r.cells[7] = bits & 1;
    count[dac.level(r)]++;
  }
  assert.deepEqual(count, [1, 2, 2, 2, 1]);
  r.cells.fill(0); assert.equal(dac.convert(r), -1);
  r.cells.fill(1); assert.equal(dac.convert(r), 1);
});

test('Blippoo core: each Rungler is clocked by its own oscillator (A by OSC A, B by OSC B)', () => {
  const core = new BlippooCore(SR, new NoiseSource(1));
  const settings = { rateA: 10, rateB: 3, runglerToRateA: 0, runglerToRateB: 0, shToRateA: 0, shToRateB: 0, shSource: 0 };
  let a = 0, b = 0;
  for (let n = 0; n < SR; n++) { core.run(settings); a += core.clockedA; b += core.clockedB; }
  assert.ok(Math.abs(a - 10) <= 1 && Math.abs(b - 3) <= 1);
});

test('Blippoo step 1: Rungler A only makes the jumps its window allows (0 → 0 or 1, 4 → 3 or 4)', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('4', defaults('4').map(p => (p.id === '4.rateA' ? { ...p, value: 200 } : p.id === '4.rateB' ? { ...p, value: 73 } : p)));
  const levels = [];
  for (let b = 0; b < SR / 128; b++) { engine.process(new Float32Array(128), new Float32Array(128), 128); levels.push(...engine.snapshot(64).events); }
  const steps = levels.map(v => Math.round(v * 4));
  assert.ok(steps.length > 150);
  for (let i = 1; i < steps.length; i++) {
    if (steps[i - 1] === 0) assert.ok(steps[i] <= 1);
    if (steps[i - 1] === 4) assert.ok(steps[i] >= 3);
  }
});

test('Blippoo steps 2–3: the S&H samples R Mix on the pulse\'s rising edge (nine levels), and only from step 2', () => {
  const settings = { rateA: 300, rateB: 170, runglerToRateA: 0, runglerToRateB: 0, shToRateA: .5, shToRateB: .5, shSource: 0 };
  const core = new BlippooCore(SR, new NoiseSource(1)), held = new Set();
  let triggers = 0;
  for (let n = 0; n < SR; n++) { core.run(settings); if (core.sampled) { triggers++; held.add(core.sh); } }
  assert.ok(triggers > 50);
  assert.ok([...held].every(v => Number.isInteger(v * 4) && Math.abs(v) <= 1), 'R Mix: steps of ¼ between −1 and +1');
  assert.equal(coreSettings({ step: 0, shToRateA: .5, shToRateB: .5 }).shToRateA, 0, 'step 1: no S&H yet');
  assert.equal(coreSettings({ step: 1, shToRateA: .5, shToRateB: .5 }).shToRateA, .5);
});

test('0A Listen 2: CV history and XY show the CV the oscillator receives, scaled by Pitch CV amount', () => {
  const spread = amount => {
    const engine = new LabEngine(SR, 1);
    engine.setStage('0A', defaults('0A').map(p => (p.id === '0A.listen' ? { ...p, value: 2 } : p.id === '0A.depth' ? { ...p, value: amount } : p.id === '0A.bandwidth' ? { ...p, value: 5 } : p)));
    let largest = 0;
    for (let b = 0; b < SR / 128; b++) {
      engine.process(new Float32Array(128), new Float32Array(128), 128);
      const { cv, xy } = engine.snapshot();
      for (const v of cv) largest = Math.max(largest, Math.abs(v));
      for (const v of xy) largest = Math.max(largest, Math.abs(v));
    }
    return largest;
  };
  assert.equal(spread(0), 0, 'amount 0: nothing reaches the oscillator');
  const one = spread(1), three = spread(3);
  assert.ok(one > 0.05 && Math.abs(three / one - 3) < 0.01, 'three times the amount, three times the CV');
});

test('0A Listen 2, Pitch CV amount 0: the entropy reads a steady voltage (regular), not the noise', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('0A', defaults('0A').map(p => (p.id === '0A.listen' ? { ...p, value: 2 } : p.id === '0A.depth' ? { ...p, value: 0 } : p)));
  const values = [];
  for (let b = 0; b < SR / 128; b++) { engine.process(new Float32Array(128), new Float32Array(128), 128); values.push(...engine.snapshot(64).analysis); }
  assert.ok(values.length > 10 && values.every(v => v === 0));
});

test('0B and 1: CV history and event map show the pitch CV the voice receives (±1 = ±3 octaves)', () => {
  const widest = (stage, amountId, amount) => {
    const engine = new LabEngine(SR, 1);
    engine.setStage(stage, defaults(stage).map(p => (p.id === amountId ? { ...p, value: amount } : p.id.endsWith('.quantize') ? { ...p, value: 0 } : p)));
    let cv = 0, events = 0;
    for (let b = 0; b < 2 * SR / 128; b++) {
      engine.process(new Float32Array(128), new Float32Array(128), 128);
      const frame = engine.snapshot();
      for (const v of frame.cv) cv = Math.max(cv, Math.abs(v));
      for (const v of frame.events) events = Math.max(events, Math.abs(v - 0.5) * 2);
    }
    return { cv, events };
  };
  for (const [stage, id] of [['0B', '0B.depth'], ['1', '1.range']]) {
    assert.deepEqual(widest(stage, id, 0), { cv: 0, events: 0 }, `${stage}: amount 0, a single note`);
    const one = widest(stage, id, 1), three = widest(stage, id, 3);
    assert.ok(one.cv <= 1 / 3 + 1e-6 && three.cv > one.cv, `${stage}: one octave stays within a third of the height`);
  }
});

test('0A Listen 1: the bandwidth knob darkens the audible noise (fewer zero crossings)', () => {
  const crossings = bandwidth => {
    const engine = new LabEngine(SR, 1);
    engine.setStage('0A', defaults('0A').map(p =>
      p.id === '0A.listen' ? { ...p, value: 1 } : p.id === '0A.bandwidth' ? { ...p, value: bandwidth } : p));
    const { samples } = render(engine, 0.5);
    let count = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i - 1] <= 0 && samples[i] > 0) count++;
    return count;
  };
  const dark = crossings(0.5), bright = crossings(20);
  assert.ok(bright > dark * 4, `crossings: ${dark} at 0.5 Hz, ${bright} at 20 Hz`);
});

test('0A XY delay map: white noise has no memory; the filter gives it memory', () => {
  const correlation = (listen, bandwidth) => {
    const engine = new LabEngine(SR, 1);
    engine.setStage('0A', defaults('0A').map(p =>
      p.id === '0A.listen' ? { ...p, value: listen } : p.id === '0A.bandwidth' ? { ...p, value: bandwidth } : p));
    render(engine, 0.3);
    const { xy } = engine.snapshot(512);
    let sxy = 0, sxx = 0, syy = 0, mx = 0, my = 0;
    for (let i = 0; i < xy.length; i += 2) { mx += xy[i]; my += xy[i + 1]; }
    mx /= xy.length / 2; my /= xy.length / 2;
    for (let i = 0; i < xy.length; i += 2) { sxy += (xy[i] - mx) * (xy[i + 1] - my); sxx += (xy[i] - mx) ** 2; syy += (xy[i + 1] - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy);
  };
  assert.ok(Math.abs(correlation(0, 1)) < 0.15, 'noise source: a filled square');
  assert.ok(correlation(1, 1) > 0.95, 'filtered noise, low bandwidth: a narrow diagonal');
  assert.ok(correlation(1, 30) < correlation(1, 1), 'more bandwidth: a wider band');
});

test('the engine counts clock pulses for the clock LED (0b clock, OSC2 in stages 1–3)', () => {
  const pulsesPerSecond = (stage, overrides = {}) => {
    const engine = new LabEngine(SR, 1);
    engine.setStage(stage, defaults(stage).map(p => (p.id in overrides ? { ...p, value: overrides[p.id] } : p)));
    const left = new Float32Array(128), right = new Float32Array(128);
    let pulses = 0;
    for (let b = 0; b < SR / 128; b++) { engine.process(left, right, 128); pulses += engine.snapshot(64).clocks; }
    return pulses;
  };
  assert.ok(Math.abs(pulsesPerSecond('0B', { '0B.clock': 10 }) - 10) <= 1);
  assert.ok(Math.abs(pulsesPerSecond('0B', { '0B.clock': 100 }) - 100) <= 1);
  assert.ok(Math.abs(pulsesPerSecond('3') - 1.9) <= 1);      // OSC2 at 1.9 Hz (Rungler → OSC2 at 0)
  assert.equal(pulsesPerSecond('0A'), 0);                    // no clock in 0a
});

test('stage 1, step 3: the voice is still what you hear, now driven by the closed loop', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('1', defaults('1').map(p => (p.id === '1.step' ? { ...p, value: 2 } : p)));
  const { samples } = render(engine, 0.5);
  const rms = Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length);
  assert.ok(rms > 0.05, `rms ${rms}`);
  const left = new Float32Array(128), right = new Float32Array(128);
  engine.process(left, right, 128);
  assert.deepEqual(left, right);   // mono voice
});

test('stage 1 steps switch on one thing at a time: register, then XOR, then feedback', () => {
  const controls = { osc1: 183, osc2: 10, xor: 1, depth1: 0.35, depth2: 0.2 };
  const register = runglerSettings({ ...controls, step: 0 });
  const loop = runglerSettings({ ...controls, step: 1 });
  const feedback = runglerSettings({ ...controls, step: 2 });
  assert.deepEqual([register.xor, register.osc1DepthOctaves, register.osc2DepthOctaves, register.driftCents], [0, 0, 0, 0]);
  assert.deepEqual([loop.xor, loop.osc1DepthOctaves, loop.driftCents], [1, 0, 0]);
  assert.deepEqual([feedback.xor, feedback.osc1DepthOctaves, feedback.driftCents], [1, 1.4, 0]);
  assert.equal(runglerSettings({ osc1: 183, osc2: 10, depth1: 0, depth2: 0 }).xor, 1); // stage 2: no switch, XOR on
  assert.equal(runglerSettings(controls).osc1DepthOctaves, 1.4);   // stage 2 (no step): full Rungler
});

test('stage 1 voice: the eight DAC levels spread over ±range, then the quantizer, as in 0b', () => {
  const controls = { range: 1, quantize: 0, scale: 1 };
  assert.equal(voiceSemitones(0, controls), -12);
  assert.equal(voiceSemitones(1, controls), 12);
  assert.equal(voiceSemitones(4 / 7, { ...controls, quantize: 1, scale: 0 }), 0);  // octaves: snaps to the centre
});

test('stage 1, step 1: the voice follows the register (pitch changes at the clock rate)', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('1', defaults('1'));
  const pitches = new Set();
  const left = new Float32Array(128), right = new Float32Array(128);
  for (let b = 0; b < SR * 2 / 128; b++) { engine.process(left, right, 128); engine.snapshot(64).events.forEach(v => pitches.add(v)); }
  assert.ok(pitches.size >= 3, `only ${pitches.size} pitches in 2 s`);
});

test('the raw output (for the oscilloscope) is the patch before the DC blocker: a flat ±0.2 pulse in stage 2', () => {
  const engine = new LabEngine(SR, 1);
  engine.setStage('2', defaults('2'));
  const left = new Float32Array(128), right = new Float32Array(128), raw = new Float32Array(128);
  const levels = new Set();
  for (let b = 0; b < 200; b++) { engine.process(left, right, 128, raw); raw.forEach(v => levels.add(Math.round(v * 1000) / 1000)); }
  assert.deepEqual([...levels].sort(), [-0.2, 0.2]);   // only the two comparator levels: no sag
});
