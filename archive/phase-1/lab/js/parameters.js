// Provisional UI schema v1. These are not verified RNBO export parameter IDs.
const knob = (id, label, min, max, initial, unit = '', scale = 'linear', step = .01) =>
  ({ id, label, min, max, initial, unit, scale, step, type: 'knob' });
const toggle = (id, label, initial = 0) =>
  ({ id, label, initial, min: 0, max: 1, step: 1, unit: '', scale: 'linear', type: 'toggle' });
const select = (id, label, options, initial = 0) =>
  ({ id, label, options, initial, min: 0, max: options.length - 1, step: 1, unit: '', scale: 'linear', type: 'select' });
const stages = [
  { id: '0A', title: 'Continuous noise', category: 'STOCHASTIC', description: 'A workspace for low-pass-filtered noise without an explicit sample-and-hold stage. Noise bandwidth is the intended low-pass cutoff in Hz; the filter is not implemented. A future digital noise source and filter may have internal memory.', parameters: [
    knob('0A.rate', 'Noise bandwidth', .05, 30, 1, 'Hz', 'log', .01),
    knob('0A.depth', 'Depth', 0, 1, .5),
    knob('0A.offset', 'Offset', -1, 1, 0), toggle('0A.bipolar', 'Bipolar', 1)
  ] },
  { id: '0B', title: 'Clocked sample & hold', category: 'CLOCKED', description: 'A workspace for sampling and held values. Future DSP: clocked sampling with optional diatonic quantization.', parameters: [
    knob('0B.clock', 'Clock rate', .1, 40, 2, 'Hz', 'log', .01),
    knob('0B.depth', 'Depth', 0, 1, .5), toggle('0B.quantize', 'Quantizer'),
    select('0B.scale', 'Scale', ['Major', 'Natural minor', 'Dorian'])
  ] },
  { id: '1', title: 'The core Rungler', category: 'RECURSIVE', description: 'A workspace for two oscillators, register state and feedback. Future DSP must preserve clock, data and FM dependencies.', parameters: [
    knob('1.vcoA', 'VCO A frequency', .1, 2000, 110, 'Hz', 'log', .1),
    knob('1.vcoB', 'VCO B frequency', .1, 2000, 70, 'Hz', 'log', .1),
    knob('1.feedbackA', 'FM depth A', 0, 1, .3), knob('1.feedbackB', 'FM depth B', 0, 1, .3),
    select('1.clockSource', 'Clock source', ['VCO A', 'VCO B']), toggle('1.feedback', 'Feedback path', 1)
  ] },
  { id: '2', title: 'PWM acoustic generation', category: 'COMPARATOR', description: 'A workspace for comparator routing and pulse width. No comparator or sound model is implemented.', parameters: [
    knob('2.pulseWidth', 'Pulse width', .05, .95, .5), knob('2.modDepth', 'Modulation depth', 0, 1, .25),
    select('2.source', 'Modulation source', ['VCO A', 'VCO B', 'Register CV']), toggle('2.invert', 'Invert output')
  ] },
  { id: '3', title: 'Exciter & resonator', category: 'RESONANCE', description: 'A workspace for excitation and Twin Peak Filter controls. No filter model or spectral measurement is implemented.', parameters: [
    knob('3.peakA', 'Peak A frequency', 30, 12000, 450, 'Hz', 'log', 1),
    knob('3.peakB', 'Peak B frequency', 30, 12000, 1300, 'Hz', 'log', 1),
    knob('3.resonance', 'Resonance', 0, 1, .4), select('3.exciter', 'Exciter', ['Pulse', 'Noise', 'Register CV'])
  ] },
  { id: '4', title: 'Blippoo Box architecture', category: 'SYSTEM', description: 'A workspace for two coupled systems. Future DSP topology and mappings require a separate review.', parameters: [
    knob('4.couplingAB', 'Coupling A → B', 0, 1, .3), knob('4.couplingBA', 'Coupling B → A', 0, 1, .3),
    knob('4.balance', 'System balance', -1, 1, 0), toggle('4.crossFeedback', 'Cross feedback', 1),
    select('4.routing', 'Output routing', ['System A', 'System B', 'Combined'])
  ] }
];
export const STAGES = Object.freeze(stages.map(stage => Object.freeze({ ...stage,
  parameters: Object.freeze(stage.parameters.map(p => Object.freeze({ ...p, ...(p.options ? { options: Object.freeze(p.options) } : {}) })))
})));
export const PARAMETERS = Object.freeze(Object.fromEntries(STAGES.flatMap(stage => stage.parameters.map(p => [p.id, p]))));
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
export function formatValue(p, value) {
  return p.options ? p.options[value] : p.type === 'toggle' ? (value ? 'ON' : 'OFF') : `${Number(value.toFixed(2))}${p.unit ? ' ' + p.unit : ''}`;
}
