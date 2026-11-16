// UI schema v2 (Phase 2). Values are stored in the declared units and sent as-is to the
// AudioWorklet engine (lab/js/dsp/lab-engine.js), which reads them by these IDs.

import { SCALE_CHOICES } from '../dsp/modules/quantizer.js';

const knob = (id, label, min, max, initial, unit = '', scale = 'linear', step = .01) =>
  ({ id, label, min, max, initial, unit, scale, step, type: 'knob' });
const toggle = (id, label, initial = 0) =>
  ({ id, label, initial, min: 0, max: 1, step: 1, unit: '', scale: 'linear', type: 'toggle' });
const select = (id, label, options, initial = 0) =>
  ({ id, label, options, initial, min: 0, max: options.length - 1, step: 1, unit: '', scale: 'linear', type: 'select' });
// The Scale selector (stages 0b and 1): Octaves, Major, Chromatic.
const SCALE_NAMES = SCALE_CHOICES.map(choice => choice.name);
// A control that does nothing in the current setting is hidden: `when(control, id, values)`
// shows it only while the switch or selector `id` has one of `values` (see core/conditions.js).
const when = (control, id, values) => ({ ...control, visibleWhen: { id, in: values } });
// Controls next to each other with the same `group` are drawn together in a titled box.
const SINE = 'Sine Oscillator';
const TWIN_PEAK = 'Twin Peak Filter';
const RUNGLER_DESTINATIONS = 'Rungler Destinations';
const SH_DESTINATIONS = 'S&H Destinations';
const stages = [
  { id: '0A', title: 'Continuous noise', category: 'STOCHASTIC', implemented: true,
    description: 'Noise is a stochastic signal. Choose between the noise source itself, the same noise through a low-pass filter, or slowed-down noise used as a control voltage for the pitch of a sine voice.', parameters: [
    // While you listen to the filtered noise (Listen 1) the knob shows the audio filter's
    // real cutoff, which is the bandwidth × 100.
    // Not remembered between visits: 0a always opens on the first idea, the noise itself.
    { ...select('0A.listen', 'Listen', ['Noise source', 'Filtered noise', 'Noise → voice pitch']), remember: false },
    when({ ...knob('0A.bandwidth', 'Noise bandwidth', .05, 30, 1, 'Hz', 'log', .01), display: { by: '0A.listen', factors: [1, 100, 1] } }, '0A.listen', [1, 2]),
    when({ ...knob('0A.depth', 'Pitch CV amount', 0, 3, 1, 'oct'), group: SINE }, '0A.listen', [2]),
    when({ ...knob('0A.center', 'Centre pitch', 55, 880, 220, 'Hz', 'log', 1), group: SINE }, '0A.listen', [2])
  ] },
  { id: '0B', title: 'Clocked sample & hold', category: 'CLOCKED', implemented: true,
    description: 'A clock samples white noise and holds each value as a pitch. Switch the quantizer on to snap the same random values to a grid: octaves only, a major scale, or every semitone.', parameters: [
    { ...knob('0B.clock', 'Clock rate', .1, 100, 10, 'Hz', 'log', .01), led: true },
    { ...knob('0B.depth', 'Pitch CV amount', 0, 3, 3, 'oct'), group: SINE },
    { ...knob('0B.center', 'Centre pitch', 55, 880, 440, 'Hz', 'log', 1), group: SINE },
    toggle('0B.quantize', 'Quantizer'),
    when(select('0B.scale', 'Scale', SCALE_NAMES, 1), '0B.quantize', [1])
  ] },
  { id: '1', title: 'The core Rungler', category: 'RECURSIVE', implemented: true,
    description: 'The Rungler takes the place of the sample & hold of 0b, one change at a time. Register: OSC2 (CLOCK) shifts an 8-bit register that stores the square of OSC1 (DATA); its last three bits set the pitch of the same sine voice. Loop: XOR re-reads the last bit. Feedback: the Rungler voltage moves the two oscillators.', parameters: [
    // Step 1 · Register — the chain of 0b, with the register and DAC as its memory
    select('1.step', 'Step', ['1 · Register', '2 · Loop (XOR)', '3 · Feedback']),
    knob('1.osc1', 'OSC1 (DATA) frequency', .1, 2000, 15.6, 'Hz', 'log', .1),
    { ...knob('1.osc2', 'OSC2 (CLOCK) frequency', .1, 2000, 11.4, 'Hz', 'log', .1), led: true },
    // The voice, as in 0b
    { ...knob('1.range', 'Pitch CV amount', 0, 3, 2.77, 'oct'), group: SINE },
    { ...knob('1.center', 'Centre pitch', 55, 880, 330, 'Hz', 'log', 1), group: SINE },
    toggle('1.quantize', 'Quantizer'),
    when(select('1.scale', 'Scale', SCALE_NAMES, 1), '1.quantize', [1]),
    // Step 2 · Loop
    when(toggle('1.xor', 'XOR with last bit', 1), '1.step', [1, 2]),
    // Step 3 · Feedback
    when({ ...knob('1.depth1', 'Rungler → OSC1', 0, 1, 1), group: RUNGLER_DESTINATIONS }, '1.step', [2]),
    when({ ...knob('1.depth2', 'Rungler → OSC2', 0, 1, 0), group: RUNGLER_DESTINATIONS }, '1.step', [2])
  ] },
  { id: '2', title: 'PWM acoustic generation', category: 'COMPARATOR', implemented: true,
    description: 'One new thing after stage 1: a comparator. The pulse is high whenever the OSC1 triangle is above the OSC2 triangle, so its width keeps changing — and the Rungler, still moving both oscillators, keeps redrawing it.', parameters: [
    knob('2.osc1', 'OSC1 (DATA) frequency', .1, 2000, 140, 'Hz', 'log', .1),
    { ...knob('2.osc2', 'OSC2 (CLOCK) frequency', .1, 2000, 1, 'Hz', 'log', .1), led: true },
    { ...knob('2.depth1', 'Rungler → OSC1', 0, 1, 0), group: RUNGLER_DESTINATIONS },
    { ...knob('2.depth2', 'Rungler → OSC2', 0, 1, 0), group: RUNGLER_DESTINATIONS }
  ] },
  { id: '3', title: 'Exciter & resonator', category: 'RESONANCE', implemented: true,
    description: 'The comparator pulse excites a Twin Peak: two resonant 3-pole low-pass filters with the same input, whose outputs are subtracted, leaving two peaks. As in the Blippoo Box, the resonance is fixed just below oscillation, so each edge of the pulse makes a ping that dies away, and a fixed self-modulation bends the ping and adds odd and even harmonics. The Rungler CV moves the oscillators.', parameters: [
    knob('3.osc1', 'OSC1 (DATA) frequency', .1, 2000, 11.4, 'Hz', 'log', .1),
    { ...knob('3.osc2', 'OSC2 (CLOCK) frequency', .1, 2000, 1.9, 'Hz', 'log', .1), led: true },
    { ...knob('3.peak1', 'Peak 1 frequency', 30, 8000, 660, 'Hz', 'log', 1), group: TWIN_PEAK },
    { ...knob('3.peak2', 'Peak 2 frequency', 30, 8000, 969, 'Hz', 'log', 1), group: TWIN_PEAK },
    { ...knob('3.depth1', 'Rungler → OSC1', 0, 1, 0), group: RUNGLER_DESTINATIONS },
    { ...knob('3.depth2', 'Rungler → OSC2', 0, 1, 0), group: RUNGLER_DESTINATIONS }
  ] },
  { id: '4', title: 'Blippoo Box architecture', category: 'SYSTEM', implemented: true,
    description: 'The resonator of stage 3 stays; the chaotic core grows, one step at a time. Two Runglers: each oscillator clocks its own Rungler and gives data to the other, and each Rungler moves its own clock and one peak. Sample & hold: the rising edge of the pulse samples the Runglers or OSC B, and the held voltage warps both rates. Spread peaks: the same voltage pushes the two peaks apart.', parameters: [
    select('4.step', 'Step', ['1 · Two Runglers', '2 · Sample & hold', '3 · Spread peaks']),
    // Step 1 · Two Runglers
    { ...knob('4.rateA', 'Rate A (OSC A)', .1, 2000, 11.4, 'Hz', 'log', .1), led: true },
    { ...knob('4.rateB', 'Rate B (OSC B)', .1, 2000, 1.9, 'Hz', 'log', .1), led: 'B' },
    { ...knob('4.peak1', 'Peak 1 frequency', 30, 8000, 660, 'Hz', 'log', 1), group: TWIN_PEAK },
    { ...knob('4.peak2', 'Peak 2 frequency', 30, 8000, 969, 'Hz', 'log', 1), group: TWIN_PEAK },
    { ...knob('4.runglerToRateA', 'Rungler A → Rate A', 0, 1, 0), group: RUNGLER_DESTINATIONS },
    { ...knob('4.runglerToRateB', 'Rungler B → Rate B', 0, 1, 0), group: RUNGLER_DESTINATIONS },
    { ...knob('4.runglerToPeak1', 'Rungler A → Peak 1', 0, 1, .36), group: RUNGLER_DESTINATIONS },
    { ...knob('4.runglerToPeak2', 'Rungler B → Peak 2', 0, 1, .36), group: RUNGLER_DESTINATIONS },
    // Step 2 · Sample & hold
    when(select('4.shSource', 'S&H source', ['R Mix (A + B)', 'Tri B']), '4.step', [1, 2]),
    when({ ...knob('4.shToRateA', 'S&H → Rate A', 0, 1, 0), group: SH_DESTINATIONS }, '4.step', [1, 2]),
    when({ ...knob('4.shToRateB', 'S&H → Rate B', 0, 1, 0), group: SH_DESTINATIONS }, '4.step', [1, 2]),
    // Step 3 · Spread peaks
    when({ ...knob('4.spread', 'S&H spreads peaks', 0, 1, 0), group: SH_DESTINATIONS }, '4.step', [2])
  ] }
];
export const STAGES = Object.freeze(stages.map(stage => Object.freeze({ ...stage,
  parameters: Object.freeze(stage.parameters.map(p => Object.freeze({ ...p, ...(p.options ? { options: Object.freeze(p.options) } : {}) })))
})));
export const PARAMETERS = Object.freeze(Object.fromEntries(STAGES.flatMap(stage => stage.parameters.map(p => [p.id, p]))));
// The default of a control right now: the stage's step default if there is one, else `initial`.
export function defaultValue(p, valueOf) {
  const stage = STAGES.find(s => s.parameters.includes(p));
  const presets = stage?.stepDefaults;
  const forStep = presets ? presets[valueOf(presets.by)] : null;
  return forStep && p.id in forStep ? forStep[p.id] : p.initial;
}

export function getParameter(id) {
  if (typeof id !== 'string' || !Object.hasOwn(PARAMETERS, id)) throw new RangeError('Unknown parameter ID');
  return PARAMETERS[id];
}
export function validateConfirmedValue(p, value) {
  if (!Number.isFinite(value)) throw new TypeError('Confirmation must be a finite number');
  if (value < p.min || value > p.max || (p.type !== 'knob' && !Number.isInteger(value))) {
    throw new RangeError('Confirmation outside declared domain');
  }
  // An actual engine value is not silently quantized to the UI step.
  return value;
}
export function clampValue(p, value) {
  if (!Number.isFinite(value)) throw new TypeError(`Non-finite value for ${p.id}`);
  const clamped = Math.max(p.min, Math.min(p.max, value));
  const next = Number(Math.max(p.min, Math.min(p.max, p.min + Math.round((clamped - p.min) / p.step) * p.step)).toFixed(8));
  if (!Number.isFinite(next)) throw new TypeError('Invalid quantized value');
  return next;
}
export function normalize(p, value) {
  if (!Number.isFinite(value)) throw new TypeError('Value must be finite');
  const v = Math.max(p.min, Math.min(p.max, value));
  return p.scale === 'log' ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min);
}
export function denormalize(p, normalized) {
  if (!Number.isFinite(normalized)) throw new TypeError('Normalized value must be finite');
  const n = Math.max(0, Math.min(1, normalized));
  return clampValue(p, p.scale === 'log' ? p.min * (p.max / p.min) ** n : p.min + n * (p.max - p.min));
}
// How many decimals a resolution needs: 0.01 → 2, 0.1 → 1, 1 → 0.
export const decimalsOf = step => Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));

// A knob shows every decimal of its resolution ("8.00 Hz", not "8 Hz"), so a fine adjustment
// can be seen. `factor` is the display factor, if the knob shows another unit (see `display`).
export function formatValue(p, value, factor = 1) {
  if (p.options) return p.options[value];
  if (p.type === 'toggle') return value ? 'ON' : 'OFF';
  return `${value.toFixed(decimalsOf(p.step * factor))}${p.unit ? ' ' + p.unit : ''}`;
}
